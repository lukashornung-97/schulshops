import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Abrufen einer Shopify-Verbindung aus der Datenbank
 * GET /api/shopify/get-connection?shopId=UUID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const shopId = searchParams.get('shopId')

    if (!shopId) {
      return NextResponse.json(
        { error: 'shopId ist erforderlich' },
        { status: 400 }
      )
    }

    // Lade Verbindung aus der Datenbank
    const { data, error } = await supabaseAdmin
      .from('shopify_connections')
      .select('id, shop_id, shop_domain, access_token, active')
      .eq('shop_id', shopId)
      .eq('active', true)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Verbindung nicht gefunden' },
        { status: 404 }
      )
    }

    // Entferne Access Token aus der Response (Sicherheit)
    // Aber für interne Verwendung können wir es zurückgeben
    return NextResponse.json({
      success: true,
      connection: {
        id: data.id,
        shop_id: data.shop_id,
        shop_domain: data.shop_domain,
        access_token: data.access_token, // Für interne Verwendung OK
        active: data.active,
      },
    })
  } catch (error: any) {
    console.error('Error loading Shopify connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Fehler beim Laden der Verbindung' },
      { status: 500 }
    )
  }
}

