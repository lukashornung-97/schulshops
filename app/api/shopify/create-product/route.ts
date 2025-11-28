import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProduct, convertProductToShopify } from '@/lib/shopify'
import { supabase } from '@/lib/supabase'

/**
 * API Route zum Erstellen eines Shopify-Produkts
 * POST /api/shopify/create-product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, shopId, shopDomain, accessToken } = body

    if (!productId || !shopId || !shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: productId, shopId, shopDomain und accessToken sind erforderlich' },
        { status: 400 }
      )
    }

    // Lade Produkt aus Datenbank
    const { data: product, error: productError } = await supabase
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

    // Lade Varianten falls vorhanden
    const { data: variants } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('active', true)

    // Konvertiere zu Shopify-Format
    const shopifyProduct = convertProductToShopify(product, variants || [])

    // Erstelle Produkt in Shopify
    const result = await createShopifyProduct(shopDomain, accessToken, shopifyProduct)

    if (result.productCreate.userErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Shopify Fehler',
          userErrors: result.productCreate.userErrors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      product: result.productCreate.product,
    })
  } catch (error: any) {
    console.error('Error creating Shopify product:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Erstellen des Shopify-Produkts' },
      { status: 500 }
    )
  }
}


