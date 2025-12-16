import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/print-costs
 * Lädt alle Druckkosten
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const position = searchParams.get('position') as 'front' | 'back' | 'side' | null

    const query = supabaseAdmin
      .from('print_costs')
      .select('*')
      .order('position', { ascending: true })
      .order('name', { ascending: true })

    if (activeOnly) {
      query.eq('active', true)
    }

    if (position) {
      query.eq('position', position)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching print costs:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Druckkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printCosts: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/print-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/print-costs
 * Erstellt neue Druckkosten (nur für Admins)
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
    const {
      name,
      position,
      cost_per_unit,
      setup_fee = 0,
      active = true,
    } = body

    if (!name || !position || cost_per_unit === undefined) {
      return NextResponse.json(
        { error: 'Name, Position und Kosten pro Einheit sind erforderlich' },
        { status: 400 }
      )
    }

    if (!['front', 'back', 'side'].includes(position)) {
      return NextResponse.json(
        { error: 'Position muss front, back oder side sein' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('print_costs')
      .insert({
        name,
        position,
        cost_per_unit: parseFloat(cost_per_unit),
        setup_fee: parseFloat(setup_fee) || 0,
        active,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating print cost:', error)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen der Druckkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printCost: data })
  } catch (error: any) {
    console.error('Error in POST /api/print-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

