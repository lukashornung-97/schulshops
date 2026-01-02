import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * POST /api/lead-config/[id]/create-shop
 * Erstellt automatisch einen Shop und Produkte basierend auf einer approved Lead-Konfiguration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Lade Lead-Konfiguration
    const { data: config, error: configError } = await supabaseAdmin
      .from('lead_configurations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Konfiguration nicht gefunden' },
        { status: 404 }
      )
    }

    if (config.status !== 'approved') {
      return NextResponse.json(
        { error: 'Konfiguration muss approved sein, um einen Shop zu erstellen' },
        { status: 400 }
      )
    }

    if (config.shop_id) {
      return NextResponse.json(
        { error: 'Shop wurde bereits erstellt' },
        { status: 400 }
      )
    }

    // Lade Schuldaten
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('*')
      .eq('id', config.school_id)
      .single()

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'Schule nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade Textilien-Daten
    const selectedTextiles = config.selected_textiles as any[]
    if (!Array.isArray(selectedTextiles) || selectedTextiles.length === 0) {
      return NextResponse.json(
        { error: 'Keine Textilien ausgewählt' },
        { status: 400 }
      )
    }

    const textileIds = selectedTextiles.map(t => t.textile_id)
    const { data: textiles, error: textilesError } = await supabaseAdmin
      .from('textile_catalog')
      .select('*')
      .in('id', textileIds)

    if (textilesError || !textiles || textiles.length === 0) {
      return NextResponse.json(
        { error: 'Textilien nicht gefunden' },
        { status: 404 }
      )
    }

    const textilesMap = new Map(textiles.map(t => [t.id, t]))

    // Erstelle Shop
    const shopName = `${school.name} - Shop`
    const shopSlug = `${school.short_code || school.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')

    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .insert({
        school_id: config.school_id,
        name: shopName,
        slug: shopSlug,
        status: 'draft',
        currency: 'EUR',
      })
      .select()
      .single()

    if (shopError || !shop) {
      console.error('Error creating shop:', shopError)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Shops' },
        { status: 500 }
      )
    }

    // Erstelle Produkte für jedes Textil
    const printPositions = config.print_positions as any || {}
    const priceCalculation = config.price_calculation as any || {}

    const products = []
    for (const selectedTextile of selectedTextiles) {
      const textile = textilesMap.get(selectedTextile.textile_id)
      if (!textile) continue

      const calc = priceCalculation[selectedTextile.textile_id]
      const finalPrice = calc?.final_price || textile.base_price

      // Erstelle Produkt
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .insert({
          shop_id: shop.id,
          name: `${textile.name}${textile.brand ? ` - ${textile.brand}` : ''}`,
          description: `Textil: ${textile.name}${textile.brand ? ` (${textile.brand})` : ''}`,
          base_price: finalPrice,
          active: true,
          sort_index: products.length,
        })
        .select()
        .single()

      if (productError || !product) {
        console.error('Error creating product:', productError)
        continue
      }

      // Erstelle Varianten für Farben und Größen
      const colors = selectedTextile.colors || []
      const sizes = selectedTextile.sizes || []

      if (colors.length > 0 && sizes.length > 0) {
        for (const color of colors) {
          for (const size of sizes) {
            await supabaseAdmin
              .from('product_variants')
              .insert({
                product_id: product.id,
                name: size,
                color_name: color,
                active: true,
              })
          }
        }
      } else if (colors.length > 0) {
        // Nur Farben
        for (const color of colors) {
          await supabaseAdmin
            .from('product_variants')
            .insert({
              product_id: product.id,
              name: 'Standard',
              color_name: color,
              active: true,
            })
        }
      } else if (sizes.length > 0) {
        // Nur Größen
        for (const size of sizes) {
          await supabaseAdmin
            .from('product_variants')
            .insert({
              product_id: product.id,
              name: size,
              active: true,
            })
        }
      }

      products.push(product)
    }

    // Aktualisiere Lead-Konfiguration mit Shop-ID
    await supabaseAdmin
      .from('lead_configurations')
      .update({ shop_id: shop.id })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      shop,
      products,
      message: `Shop erfolgreich erstellt mit ${products.length} Produkt(en)`,
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/[id]/create-shop:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}



