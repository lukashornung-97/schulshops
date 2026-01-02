import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * PUT /api/textile-prices/[id]
 * Aktualisiert einen Textilpreis (nur für Admins)
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
    const { price, active } = body

    const updateData: any = {}
    if (price !== undefined) updateData.price = parseFloat(price)
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabaseAdmin
      .from('textile_prices')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating textile price:', error)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren des Textilpreises' },
        { status: 500 }
      )
    }

    return NextResponse.json({ price: data })
  } catch (error: any) {
    console.error('Error in PUT /api/textile-prices/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/textile-prices/[id]
 * Löscht einen Textilpreis (nur für Admins)
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
      .from('textile_prices')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting textile price:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen des Textilpreises' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/textile-prices/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}



