import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * PUT /api/print-methods/[id]
 * Aktualisiert eine Druckart (nur für Admins)
 */
export async function PUT(
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
    if (body.display_order !== undefined) updateData.display_order = parseInt(body.display_order) || 0
    if (body.active !== undefined) updateData.active = body.active

    const { data, error } = await supabaseAdmin
      .from('print_methods')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating print method:', error)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Druckart' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethod: data })
  } catch (error: any) {
    console.error('Error in PUT /api/print-methods/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/print-methods/[id]
 * Löscht eine Druckart (nur für Admins)
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
      .from('print_methods')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting print method:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen der Druckart' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/print-methods/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
    }
}

