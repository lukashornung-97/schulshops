import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/print-costs/[id]
 * Lädt einzelne Druckkosten
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('print_costs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching print cost:', error)
      return NextResponse.json(
        { error: 'Druckkosten nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ printCost: data })
  } catch (error: any) {
    console.error('Error in GET /api/print-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/print-costs/[id]
 * Aktualisiert Druckkosten (nur für Admins)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.position !== undefined) {
      if (!['front', 'back', 'side'].includes(body.position)) {
        return NextResponse.json(
          { error: 'Position muss front, back oder side sein' },
          { status: 400 }
        )
      }
      updateData.position = body.position
    }
    if (body.cost_per_unit !== undefined) updateData.cost_per_unit = parseFloat(body.cost_per_unit)
    if (body.setup_fee !== undefined) updateData.setup_fee = parseFloat(body.setup_fee)
    if (body.active !== undefined) updateData.active = body.active

    const { data, error } = await supabaseAdmin
      .from('print_costs')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating print cost:', error)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Druckkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printCost: data })
  } catch (error: any) {
    console.error('Error in PATCH /api/print-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/print-costs/[id]
 * Löscht Druckkosten (nur für Admins)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { error } = await supabaseAdmin
      .from('print_costs')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting print cost:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen der Druckkosten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/print-costs/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

