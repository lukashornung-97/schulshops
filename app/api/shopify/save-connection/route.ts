import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Speichern einer Shopify-Verbindung in der Datenbank
 * POST /api/shopify/save-connection
 * 
 * Body: {
 *   shopId: string (UUID)
 *   shopDomain: string
 *   accessToken: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shopId, shopDomain, accessToken } = body

    if (!shopId || !shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'shopId, shopDomain und accessToken sind erforderlich' },
        { status: 400 }
      )
    }

    // Validiere Shop Domain Format
    if (!shopDomain.includes('.myshopify.com')) {
      return NextResponse.json(
        { error: 'Shop Domain muss im Format "shop-name.myshopify.com" sein' },
        { status: 400 }
      )
    }

    // Bereinige Access Token
    const cleanToken = accessToken.trim().replace(/\s+/g, '')
    
    // Validiere Token-Länge (Basis-Sicherheitscheck)
    // Hinweis: Tokens aus OAuth können unterschiedliche Präfixe haben,
    // daher prüfen wir nur die Mindestlänge.
    if (cleanToken.length < 32) {
      return NextResponse.json(
        { 
          error: 'Access Token scheint zu kurz zu sein',
          tokenLength: cleanToken.length,
          expectedMinLength: 32,
        },
        { status: 400 }
      )
    }

    // Prüfe ob Shop existiert
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('id', shopId)
      .single()

    if (shopError || !shop) {
      return NextResponse.json(
        { error: 'Shop nicht gefunden' },
        { status: 404 }
      )
    }

    // Speichere oder aktualisiere Verbindung
    const { data, error } = await supabaseAdmin
      .from('shopify_connections')
      .upsert({
        shop_id: shopId,
        shop_domain: shopDomain,
        access_token: cleanToken, // Verwende bereinigten Token
        active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving Shopify connection:', error)
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Verbindung', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: data.id,
        shop_id: data.shop_id,
        shop_domain: data.shop_domain,
        active: data.active,
      },
      message: 'Shopify-Verbindung erfolgreich gespeichert',
    })
  } catch (error: any) {
    console.error('Error saving Shopify connection:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Speichern der Shopify-Verbindung' },
      { status: 500 }
    )
  }
}

