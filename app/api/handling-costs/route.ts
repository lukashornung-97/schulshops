import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/handling-costs
 * Lädt die aktuellen Handlingkosten
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('handling_costs')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // Wenn kein Eintrag existiert, gib Standardwerte zurück
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          handlingCost: {
            id: null,
            cost_per_order: 0,
            active: true,
          },
        })
      }
      console.error('Error fetching handling costs:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Handlingkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ handlingCost: data })
  } catch (error: any) {
    console.error('Error in GET /api/handling-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/handling-costs
 * Erstellt oder aktualisiert die Handlingkosten (nur für Admins)
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
    const { cost_per_order } = body

    if (cost_per_order === undefined) {
      return NextResponse.json(
        { error: 'Kosten pro Bestellung sind erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe ob bereits ein aktiver Eintrag existiert
    const { data: existing } = await supabaseAdmin
      .from('handling_costs')
      .select('id')
      .eq('active', true)
      .limit(1)
      .single()

    let data, error

    if (existing) {
      // Aktualisiere bestehenden Eintrag
      const result = await supabaseAdmin
        .from('handling_costs')
        .update({
          cost_per_order: parseFloat(cost_per_order),
        })
        .eq('id', existing.id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // Deaktiviere alle bestehenden Einträge und erstelle neuen
      await supabaseAdmin
        .from('handling_costs')
        .update({ active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Dummy, um alle zu aktualisieren

      const result = await supabaseAdmin
        .from('handling_costs')
        .insert({
          cost_per_order: parseFloat(cost_per_order),
          active: true,
        })
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Error creating/updating handling costs:', error)
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Handlingkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ handlingCost: data })
  } catch (error: any) {
    console.error('Error in POST /api/handling-costs:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}


