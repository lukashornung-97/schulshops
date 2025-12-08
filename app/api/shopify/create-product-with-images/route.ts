import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProductWithImages, convertProductToShopify, ShopifyProductInput, normalizeVariant } from '@/lib/shopify'
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

    // Normalisiere Varianten aus DB (falls vorhanden)
    const normalizedVariants: ReturnType<typeof normalizeVariant>[] = []
    const variantMap = new Map<string, ReturnType<typeof normalizeVariant>>() // ID -> normalisierte Variante
    const originalVariantMap = new Map<string, (typeof variants)[0]>() // ID -> ursprüngliche Variante
    if (variants && variants.length > 0) {
      variants.forEach((v) => {
        const normalized = normalizeVariant(v)
        normalizedVariants.push(normalized)
        variantMap.set(v.id, normalized)
        originalVariantMap.set(v.id, v)
      })
    }
    
    // Hilfsfunktion zum Normalisieren von Farbnamen (case-insensitive, trim)
    const normalizeColorName = (color: string | null | undefined): string | null => {
      if (!color) return null
      return color.trim().toLowerCase()
    }
    
    // Sammle alle Varianten-IDs und Farben, die Bilder haben
    const variantsWithImages = new Set<string>() // Set von Varianten-IDs
    const colorsFromImages = new Set<string>() // Set von Farbnamen (normalisiert)
    const imageColorMap = new Map<string, string>() // normalisiert -> original
    
    if (productImages && productImages.length > 0) {
      productImages.forEach((img) => {
        // Prüfe textile_color_id (direkte Verknüpfung zur Variante)
        if (img.textile_color_id && variantMap.has(img.textile_color_id)) {
          variantsWithImages.add(img.textile_color_id)
          const variant = variantMap.get(img.textile_color_id)!
          const normalizedColor = normalizeColorName(variant.color_name)
          if (normalizedColor) {
            colorsFromImages.add(normalizedColor)
            // Speichere original Farbname
            if (!imageColorMap.has(normalizedColor)) {
              imageColorMap.set(normalizedColor, variant.color_name!)
            }
          }
        }
        
        // Prüfe textile_color_name (muss mit color_name der Variante übereinstimmen)
        if (img.textile_color_name && img.textile_color_name.trim() !== '') {
          const originalColor = img.textile_color_name.trim()
          const normalizedColor = normalizeColorName(originalColor)
          if (normalizedColor) {
            colorsFromImages.add(normalizedColor)
            // Speichere Mapping: normalisiert -> original
            if (!imageColorMap.has(normalizedColor)) {
              imageColorMap.set(normalizedColor, originalColor)
            }
            
            // Finde alle Varianten mit dieser Farbe (case-insensitive Vergleich)
            normalizedVariants.forEach((v) => {
              const variantColorName = normalizeColorName(v.color_name)
              if (variantColorName === normalizedColor) {
                // Finde die ursprüngliche Varianten-ID
                const originalVariant = variants?.find((orig) => {
                  const normalized = normalizeVariant(orig)
                  return normalizeColorName(normalized.color_name) === normalizedColor
                })
                if (originalVariant) {
                  variantsWithImages.add(originalVariant.id)
                }
              }
            })
          }
        }
      })
    }
    
    console.log('=== DEBUG: Varianten-Erkennung ===')
    console.log('Varianten aus DB:', variants?.length || 0, variants?.map(v => ({ id: v.id, name: v.name, color_name: v.color_name })))
    console.log('Bilder:', productImages?.length || 0, productImages?.map(img => ({ textile_color_id: img.textile_color_id, textile_color_name: img.textile_color_name })))
    console.log('VariantsWithImages (IDs):', Array.from(variantsWithImages))
    console.log('ColorsFromImages:', Array.from(colorsFromImages), `(${colorsFromImages.size} eindeutige Farben)`)
    console.log('ImageColorMap:', Array.from(imageColorMap.entries()).map(([k, v]) => `${k} -> ${v}`))

    // Filtere Varianten: Nur solche verwenden, die auch Bilder haben
    const variantsToUse: ReturnType<typeof normalizeVariant>[] = []
    
    // Wenn DB-Varianten existieren, prüfe welche Bilder haben
    if (normalizedVariants.length > 0 && variants) {
      variants.forEach((originalVariant) => {
        const normalized = variantMap.get(originalVariant.id)!
        const normalizedColor = normalizeColorName(normalized.color_name)
        
        // Prüfe ob Variante Bilder hat (über ID oder color_name)
        if (variantsWithImages.has(originalVariant.id)) {
          variantsToUse.push(normalized)
          console.log(`✓ Variante ${originalVariant.id} hat Bilder (über ID oder Farbe: ${normalized.color_name || normalized.name})`)
        } else if (normalizedColor && colorsFromImages.has(normalizedColor)) {
          variantsToUse.push(normalized)
          console.log(`✓ Variante ${originalVariant.id} hat Bilder (über Farbe: ${normalized.color_name})`)
        } else if (!normalizedColor && colorsFromImages.size > 0) {
          // Größen-Varianten (ohne Farbe) werden verwendet, wenn es Bilder gibt
          // Sie werden später mit allen Farben kombiniert
          variantsToUse.push(normalized)
          console.log(`✓ Größen-Variante ${originalVariant.id} wird verwendet (wird mit Farben kombiniert)`)
        } else {
          console.log(`✗ Variante ${originalVariant.id} hat KEINE Bilder (name: ${normalized.name}, color_name: ${normalized.color_name})`)
        }
      })
    }
    
    // Sammle alle Farben aus DB-Varianten, die verwendet werden (normalisiert)
    const colorsFromVariants = new Set<string>()
    variantsToUse.forEach((v) => {
      const normalizedColor = normalizeColorName(v.color_name)
      if (normalizedColor) {
        colorsFromVariants.add(normalizedColor)
      }
    })
    
    // WICHTIG: Wenn Bilder vorhanden sind, erstelle Varianten für alle Farben aus Bildern
    // Dies gilt sowohl wenn keine DB-Varianten existieren, als auch wenn DB-Varianten existieren,
    // aber nicht alle Farben aus Bildern abdecken
    // Diese Varianten werden auch in der Datenbank gespeichert
    if (colorsFromImages.size > 0) {
      const variantsToCreate: Array<{ name: string; color_name: string; additional_price: number }> = []
      
      colorsFromImages.forEach((normalizedColor) => {
        if (!colorsFromVariants.has(normalizedColor)) {
          const originalColorName = imageColorMap.get(normalizedColor) || normalizedColor
          variantsToCreate.push({
            name: '',
            color_name: originalColorName,
            additional_price: 0,
          })
        }
      })
      
      // Erstelle fehlende Varianten in der Datenbank
      if (variantsToCreate.length > 0) {
        try {
          const { data: createdVariants, error: createError } = await supabaseAdmin
            .from('product_variants')
            .insert(variantsToCreate.map(v => ({
              product_id: productId,
              name: v.name,
              color_name: v.color_name,
              active: true,
              additional_price: v.additional_price,
            })))
            .select()

          if (createError) {
            console.error('Fehler beim Erstellen der Varianten in der DB:', createError)
            // Fortfahren mit virtuellen Varianten
            variantsToCreate.forEach((v) => {
              variantsToUse.push(v)
              colorsFromVariants.add(normalizeColorName(v.color_name)!)
            })
          } else if (createdVariants) {
            console.log(`✓ ${createdVariants.length} Varianten in der DB erstellt`)
            // Normalisiere die erstellten Varianten und füge sie hinzu
            createdVariants.forEach((v) => {
              const normalized = normalizeVariant(v)
              variantsToUse.push(normalized)
              const normalizedColor = normalizeColorName(normalized.color_name)
              if (normalizedColor) {
                colorsFromVariants.add(normalizedColor)
              }
            })
          }
        } catch (error) {
          console.error('Fehler beim Erstellen der Varianten:', error)
          // Fallback: Verwende virtuelle Varianten
          variantsToCreate.forEach((v) => {
            variantsToUse.push(v)
            colorsFromVariants.add(normalizeColorName(v.color_name)!)
          })
        }
      }
    }
    
    console.log('VariantsToUse (final):', variantsToUse.length)
    if (variantsToUse.length > 0) {
      console.log('VariantsToUse Details:', variantsToUse.map(v => ({ name: v.name || '(leer)', color_name: v.color_name || '(keine)', additional_price: v.additional_price })))
    } else {
      console.log('⚠️ KEINE Varianten erstellt! Prüfe ob Bilder vorhanden sind.')
    }
    
    const shopifyProduct = convertProductToShopify(product, variantsToUse)

    // Erweitere Varianten mit Option-Werten für Shopify
    // Verwende nur gefilterte Varianten (die auch Bilder haben)
    if (shopifyProduct.variants && variantsToUse.length > 0) {
      // Hilfsfunktion: Prüft ob name wirklich einen Wert hat (nicht leer/Whitespace)
      const hasName = (name: string | null | undefined): boolean => {
        return name !== null && name !== undefined && name.trim().length > 0
      }
      
      const sizeVariants = variantsToUse.filter((v) => hasName(v.name) && !v.color_name)
      const colorVariants = variantsToUse.filter((v) => v.color_name && !hasName(v.name))
      const combinedVariants = variantsToUse.filter((v) => hasName(v.name) && v.color_name)
      
      console.log(`Varianten-Kategorien: sizeVariants=${sizeVariants.length}, colorVariants=${colorVariants.length}, combinedVariants=${combinedVariants.length}`)

      // Sammle alle eindeutigen Größen und Farben (nur von Varianten mit Bildern)
      const allSizes = new Set<string>()
      sizeVariants.forEach((v) => allSizes.add(v.name))
      combinedVariants.forEach((v) => allSizes.add(v.name))
      
      // Farben nur aus Varianten mit Bildern
      const allColors = new Set<string>()
      colorVariants.forEach((v) => v.color_name && allColors.add(v.color_name))
      combinedVariants.forEach((v) => v.color_name && allColors.add(v.color_name))

      // Erstelle Varianten mit Option-Werten
      const variantsWithOptions: Array<{
        price: string
        sku?: string
        option1?: string
        option2?: string
      }> = []

      // Wenn kombinierte Varianten vorhanden sind, verwende diese direkt
      if (combinedVariants.length > 0) {
        combinedVariants.forEach((variant) => {
          const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
          variantsWithOptions.push({
            price: variantPrice,
            sku: variant.sku || undefined,
            option1: variant.name,
            option2: variant.color_name || undefined,
          })
        })
      } else if (allSizes.size > 0 && allColors.size > 0) {
        // Kombinationen aus Größe und Farbe
        Array.from(allSizes).forEach((size) => {
          Array.from(allColors).forEach((color) => {
            // Finde die ursprüngliche Variante für diese Größe und Farbe (nur aus gefilterten Varianten)
            const sizeVariant = variantsToUse.find((v) => v.name === size && !v.color_name)
            const colorVariant = variantsToUse.find((v) => v.color_name === color && !v.name)
            
            const variantPrice = (
              product.base_price +
              (sizeVariant?.additional_price || 0) +
              (colorVariant?.additional_price || 0)
            ).toFixed(2)
            
            variantsWithOptions.push({
              price: variantPrice,
              sku: sizeVariant?.sku || colorVariant?.sku || undefined,
              option1: size,
              option2: color,
            })
          })
        })
      } else if (allSizes.size > 0) {
        // Nur Größen
        sizeVariants.forEach((variant) => {
          const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
          variantsWithOptions.push({
            price: variantPrice,
            sku: variant.sku || undefined,
            option1: variant.name,
          })
        })
      } else if (allColors.size > 0) {
        // Nur Farben - verwende Varianten falls vorhanden, sonst erstelle Varianten für alle Farben aus Bildern
        if (colorVariants.length > 0) {
          // Verwende vorhandene Farb-Varianten
          colorVariants.forEach((variant) => {
            const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
            variantsWithOptions.push({
              price: variantPrice,
              sku: variant.sku || undefined,
              option1: variant.color_name || undefined,
            })
          })
        } else {
          // Keine Farb-Varianten vorhanden, aber Farben aus Bildern vorhanden
          // Erstelle Varianten für alle Farben aus Bildern
          Array.from(allColors).forEach((color) => {
            const variantPrice = product.base_price.toFixed(2)
            variantsWithOptions.push({
              price: variantPrice,
              option1: color,
            })
          })
        }
      }

      // Aktualisiere Product Options, um sicherzustellen, dass alle Farben enthalten sind
      if (allColors.size > 0) {
        const existingOptions = shopifyProduct.productOptions || []
        const colorOption = existingOptions.find((opt) => opt.name === 'Farbe')
        
        if (colorOption) {
          // Aktualisiere bestehende Farb-Option mit allen Farben
          const existingColors = new Set(colorOption.values.map((v) => v.name))
          allColors.forEach((color) => existingColors.add(color))
          colorOption.values = Array.from(existingColors).map((color) => ({ name: color }))
        } else {
          // Füge neue Farb-Option hinzu
          existingOptions.push({
            name: 'Farbe',
            values: Array.from(allColors).map((color) => ({ name: color })),
          })
        }
        
        shopifyProduct.productOptions = existingOptions
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
      // Nur Varianten verwenden, die auch Bilder haben
      for (const [color, colorImages] of imagesByColor.entries()) {
        // Prüfe ob es Varianten für diese Farbe gibt
        const normalizedColor = normalizeColorName(color)
        const colorVariants = variantsToUse.filter((v) => {
          const variantColor = normalizeColorName(v.color_name)
          return variantColor === normalizedColor
        })
        
        // Nur Bilder hinzufügen, wenn es auch Varianten für diese Farbe gibt
        if (colorVariants.length > 0 || (normalizedColor && colorsFromImages.has(normalizedColor))) {
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

    // Sammle Debug-Informationen für die Response
    const debugInfo = {
      variantsFromDB: variants?.length || 0,
      imagesFound: productImages?.length || 0,
      colorsFromImages: Array.from(colorsFromImages),
      variantsWithImages: Array.from(variantsWithImages),
      variantsCreated: variantsToUse.length,
      variantsDetails: variantsToUse.map(v => ({
        name: v.name || '(leer)',
        color_name: v.color_name || '(keine)',
        additional_price: v.additional_price,
      })),
    }

    return NextResponse.json({
      success: true,
      product: createdProduct,
      message: `Produkt "${product.name}" wurde erfolgreich zu Shopify exportiert`,
      debug: debugInfo, // Debug-Informationen in der Response
    })
  } catch (error: any) {
    console.error('Error creating Shopify product with images:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Erstellen des Shopify-Produkts' },
      { status: 500 }
    )
  }
}

