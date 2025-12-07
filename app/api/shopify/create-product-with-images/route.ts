import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProductWithImages, convertProductToShopify, ShopifyProductInput } from '@/lib/shopify'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Erstellen eines Shopify-Produkts mit Bildern und Farben
 * POST /api/shopify/create-product-with-images
 * 
 * Body: {
 *   productId: string (UUID)
 *   shopId?: string (UUID) - optional, wird aus Produkt geladen falls nicht angegeben
 *   shopDomain?: string - optional, wird aus shopify_connections geladen
 *   accessToken?: string - optional, wird aus shopify_connections geladen
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, shopId, shopDomain, accessToken } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'productId ist erforderlich' },
        { status: 400 }
      )
    }

    // Lade Produkt aus Datenbank
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Produkt nicht gefunden' },
        { status: 404 }
      )
    }

    // Bestimme shopId falls nicht angegeben
    const finalShopId = shopId || product.shop_id
    if (!finalShopId) {
      return NextResponse.json(
        { error: 'shopId konnte nicht ermittelt werden' },
        { status: 400 }
      )
    }

    // Lade Shopify-Verbindung falls shopDomain/accessToken nicht angegeben
    let finalShopDomain = shopDomain
    let finalAccessToken = accessToken

    if (!finalShopDomain || !finalAccessToken) {
      const { data: connection, error: connectionError } = await supabaseAdmin
        .from('shopify_connections')
        .select('shop_domain, access_token')
        .eq('shop_id', finalShopId)
        .eq('active', true)
        .single()

      if (connectionError || !connection) {
        return NextResponse.json(
          { error: 'Shopify-Verbindung nicht gefunden. Bitte shopDomain und accessToken angeben oder Verbindung konfigurieren.' },
          { status: 404 }
        )
      }

      finalShopDomain = finalShopDomain || connection.shop_domain
      finalAccessToken = finalAccessToken || connection.access_token
    }

    if (!finalShopDomain || !finalAccessToken) {
      return NextResponse.json(
        { error: 'shopDomain und accessToken sind erforderlich' },
        { status: 400 }
      )
    }

    // Lade Varianten
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('active', true)

    // Lade Produktbilder nach Farben
    const { data: productImages } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('textile_color_name', { ascending: true })
      .order('image_type', { ascending: true })

    // Konvertiere zu Shopify-Format
    const shopifyProduct = convertProductToShopify(product, variants || [])

    // Erweitere Varianten mit Option-Werten für Shopify
    if (shopifyProduct.variants && variants && variants.length > 0) {
      const sizeVariants = variants.filter((v) => !v.color_name)
      const colorVariants = variants.filter((v) => v.color_name)

      // Erstelle Varianten mit Option-Werten
      const variantsWithOptions: Array<{
        price: string
        sku?: string
        option1?: string
        option2?: string
      }> = []

      if (sizeVariants.length > 0 && colorVariants.length > 0) {
        // Kombinationen aus Größe und Farbe
        sizeVariants.forEach((sizeVariant) => {
          colorVariants.forEach((colorVariant) => {
            const variantPrice = (
              product.base_price +
              (sizeVariant.additional_price || 0) +
              (colorVariant.additional_price || 0)
            ).toFixed(2)
            
            variantsWithOptions.push({
              price: variantPrice,
              sku: sizeVariant.sku || colorVariant.sku || undefined,
              option1: sizeVariant.name,
              option2: colorVariant.color_name || undefined,
            })
          })
        })
      } else if (sizeVariants.length > 0) {
        // Nur Größen
        sizeVariants.forEach((variant) => {
          const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
          variantsWithOptions.push({
            price: variantPrice,
            sku: variant.sku || undefined,
            option1: variant.name,
          })
        })
      } else if (colorVariants.length > 0) {
        // Nur Farben
        colorVariants.forEach((variant) => {
          const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
          variantsWithOptions.push({
            price: variantPrice,
            sku: variant.sku || undefined,
            option1: variant.color_name || undefined,
          })
        })
      }

      shopifyProduct.variants = variantsWithOptions
    }

    // Bereite Bilder vor
    const images: Array<{ src: string; altText?: string; variantIds?: string[] }> = []

    if (productImages && productImages.length > 0) {
      // Gruppiere Bilder nach Textilfarbe
      const imagesByColor = new Map<string, Array<typeof productImages[0]>>()
      
      productImages.forEach((img) => {
        const color = img.textile_color_name || 'default'
        if (!imagesByColor.has(color)) {
          imagesByColor.set(color, [])
        }
        imagesByColor.get(color)!.push(img)
      })

      // Für jede Farbe: Erstelle Bilder und verknüpfe mit entsprechenden Varianten
      for (const [color, colorImages] of imagesByColor.entries()) {
        // Finde Varianten für diese Farbe
        const colorVariants = variants?.filter((v) => v.color_name === color) || []
        
        // Erstelle Bild-Einträge für diese Farbe
        // Verwende nur Frontend-Bilder (image_url), nicht Druckdateien
        const frontendImages = colorImages.filter((img) => img.image_url)
        
        for (const img of frontendImages) {
          images.push({
            src: img.image_url!,
            altText: `${product.name} - ${color} - ${img.image_type}`,
            // Varianten-IDs werden später zugeordnet, wenn das Produkt erstellt wurde
          })
        }
      }
    }

    // Füge Bilder zum Shopify-Produkt hinzu
    if (images.length > 0) {
      shopifyProduct.images = images
    }

    // Erstelle Produkt in Shopify
    const result = await createShopifyProductWithImages(
      finalShopDomain,
      finalAccessToken,
      shopifyProduct
    )

    if (result.productCreate.userErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Shopify Fehler',
          userErrors: result.productCreate.userErrors,
        },
        { status: 400 }
      )
    }

    const createdProduct = result.productCreate.product

    if (!createdProduct) {
      return NextResponse.json(
        { error: 'Produkt konnte nicht erstellt werden' },
        { status: 500 }
      )
    }

    // Speichere Mapping zwischen unserem Produkt und Shopify-Produkt
    await supabaseAdmin
      .from('shopify_product_mappings')
      .upsert({
        product_id: productId,
        shopify_product_id: createdProduct.id,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id',
      })

    return NextResponse.json({
      success: true,
      product: createdProduct,
      message: `Produkt "${product.name}" wurde erfolgreich zu Shopify exportiert`,
    })
  } catch (error: any) {
    console.error('Error creating Shopify product with images:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Erstellen des Shopify-Produkts' },
      { status: 500 }
    )
  }
}

