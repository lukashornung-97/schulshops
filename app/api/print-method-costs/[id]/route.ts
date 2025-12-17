import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/print-method-costs/[id]
 * Lädt einzelne Druckarten-Preise
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { data, error } = await supabaseAdmin
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
      .eq('id', resolvedParams.id)
      .single()

    if (error) {
      console.error('Error fetching print method cost:', error)
      return NextResponse.json(
        { error: 'Druckarten-Preis nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ printMethodCost: data })
  } catch (error: any) {
    console.error('Error in GET /api/print-method-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/print-method-costs/[id]
 * Aktualisiert Druckarten-Preise (nur für Admins)
 */
export async function PATCH(
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

    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()
    const updateData: any = {}

    if (body.print_method_id !== undefined) {
      updateData.print_method_id = body.print_method_id
    }
    if (body.cost_per_unit !== undefined) {
      const parsed = parseFloat(body.cost_per_unit)
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { error: 'Kosten pro Einheit muss eine gültige Zahl sein' },
          { status: 400 }
        )
      }
      updateData.cost_per_unit = parsed
    }
    if (body.cost_50_units !== undefined) {
      if (body.cost_50_units === null || body.cost_50_units === '') {
        updateData.cost_50_units = null
      } else {
        const parsed = parseFloat(body.cost_50_units)
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { error: 'Kosten für 50 Stück muss eine gültige Zahl sein' },
            { status: 400 }
          )
        }
        updateData.cost_50_units = parsed
      }
    }
    if (body.cost_100_units !== undefined) {
      if (body.cost_100_units === null || body.cost_100_units === '') {
        updateData.cost_100_units = null
      } else {
        const parsed = parseFloat(body.cost_100_units)
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { error: 'Kosten für 100 Stück muss eine gültige Zahl sein' },
            { status: 400 }
          )
        }
        updateData.cost_100_units = parsed
      }
    }
    if (body.active !== undefined) updateData.active = body.active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Keine Felder zum Aktualisieren' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('print_method_costs')
      .update(updateData)
      .eq('id', resolvedParams.id)
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
      console.error('Error updating print method cost:', error)
      return NextResponse.json(
        { error: error.message || 'Fehler beim Aktualisieren der Druckarten-Preise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethodCost: data })
  } catch (error: any) {
    console.error('Error in PATCH /api/print-method-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/print-method-costs/[id]
 * Löscht Druckarten-Preise (nur für Admins)
 */
export async function DELETE(
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

    const resolvedParams = await Promise.resolve(params)
    const { error } = await supabaseAdmin
      .from('print_method_costs')
      .delete()
      .eq('id', resolvedParams.id)

    if (error) {
      console.error('Error deleting print method cost:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen der Druckarten-Preise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/print-method-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

