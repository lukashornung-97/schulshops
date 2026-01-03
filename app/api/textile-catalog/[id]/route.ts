import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/textile-catalog/[id]
 * Lädt ein einzelnes Textil
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { data, error } = await supabaseAdmin
      .from('textile_catalog')
      .select('*')
      .eq('id', resolvedParams.id)
      .single()

    if (error) {
      console.error('Error fetching textile:', error)
      return NextResponse.json(
        { error: 'Textil nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ textile: data })
  } catch (error: any) {
    console.error('Error in GET /api/textile-catalog/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/textile-catalog/[id]
 * Aktualisiert ein Textil (nur für Admins)
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

    if (body.name !== undefined) updateData.name = body.name
    if (body.brand !== undefined) updateData.brand = body.brand
    if (body.article_number !== undefined) updateData.article_number = body.article_number
    if (body.base_price !== undefined) updateData.base_price = parseFloat(String(body.base_price))
    if (body.available_colors !== undefined) {
      // Bereinige Farben: entferne undefined-Werte
      updateData.available_colors = Array.isArray(body.available_colors)
        ? body.available_colors.map((c: any) => {
            const color: any = { name: c.name }
            if (c.hex) color.hex = c.hex
            return color
          })
        : body.available_colors
    }
    if (body.available_sizes !== undefined) updateData.available_sizes = body.available_sizes
    if (body.image_url !== undefined) updateData.image_url = body.image_url
    if (body.description !== undefined) updateData.description = body.description
    if (body.active !== undefined) updateData.active = body.active

    const { data, error } = await supabaseAdmin
      .from('textile_catalog')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating textile:', error)
      console.error('Update data:', JSON.stringify(updateData, null, 2))
      return NextResponse.json(
        { error: `Fehler beim Aktualisieren des Textils: ${error.message || 'Unbekannter Fehler'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ textile: data })
  } catch (error: any) {
    console.error('Error in PATCH /api/textile-catalog/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/textile-catalog/[id]
 * Löscht ein Textil (nur für Admins)
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
      .from('textile_catalog')
      .delete()
      .eq('id', resolvedParams.id)

    if (error) {
      console.error('Error deleting textile:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen des Textils' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/textile-catalog/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}


