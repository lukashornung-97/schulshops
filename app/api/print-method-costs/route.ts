import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/print-method-costs
 * Lädt alle Druckarten-Preise (mit Join zu print_methods)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const printMethodId = searchParams.get('print_method_id')

    let query = supabaseAdmin
      .from('print_method_costs')
      .select(`
        *,
        print_methods (
          id,
          name,
          display_order,
          active
        )
      `)
      .order('created_at', { ascending: true })

    if (activeOnly) {
      query = query.eq('active', true)
    }

    if (printMethodId) {
      query = query.eq('print_method_id', printMethodId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching print method costs:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Druckarten-Preise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethodCosts: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/print-method-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/print-method-costs
 * Erstellt neue Druckarten-Preise (nur für Admins)
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
      print_method_id,
      cost_per_unit,
      cost_50_units,
      cost_100_units,
      active = true,
    } = body

    if (!print_method_id || cost_per_unit === undefined) {
      return NextResponse.json(
        { error: 'print_method_id und cost_per_unit sind erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe ob bereits ein Eintrag für diese Druckart existiert
    const { data: existing } = await supabaseAdmin
      .from('print_method_costs')
      .select('id')
      .eq('print_method_id', print_method_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Für diese Druckart existiert bereits ein Preis-Eintrag. Verwenden Sie PATCH zum Aktualisieren.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('print_method_costs')
      .insert({
        print_method_id,
        cost_per_unit: parseFloat(cost_per_unit),
        cost_50_units: cost_50_units ? parseFloat(cost_50_units) : null,
        cost_100_units: cost_100_units ? parseFloat(cost_100_units) : null,
        active,
      })
      .select(`
        *,
        print_methods (
          id,
          name,
          display_order,
          active
        )
      `)
      .single()

    if (error) {
      console.error('Error creating print method cost:', error)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen der Druckarten-Preise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethodCost: data })
  } catch (error: any) {
    console.error('Error in POST /api/print-method-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

