import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/textile-prices
 * Lädt alle Textilpreise
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('textile_prices')
      .select('*, textile_catalog(name, brand)')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching textile prices:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Textilpreise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prices: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/textile-prices:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/textile-prices
 * Erstellt oder aktualisiert einen Textilpreis (nur für Admins)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { textile_id, price } = body

    if (!textile_id || price === undefined) {
      return NextResponse.json(
        { error: 'Textil-ID und Preis sind erforderlich' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('textile_prices')
      .upsert({
        textile_id,
        price: parseFloat(price),
        active: true,
      }, {
        onConflict: 'textile_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating/updating textile price:', error)
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Textilpreises' },
        { status: 500 }
      )
    }

    return NextResponse.json({ price: data })
  } catch (error: any) {
    console.error('Error in POST /api/textile-prices:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}



