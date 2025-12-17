import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/lead-config/[id]
 * Lädt eine spezifische Lead-Konfiguration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('lead_configurations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching lead config:', error)
      return NextResponse.json(
        { error: 'Konfiguration nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe Zugriff
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', data.school_id)
      .single()

    const admin = await getCurrentAdmin()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Konfiguration' },
        { status: 403 }
      )
    }

    return NextResponse.json({ config: data })
  } catch (error: any) {
    console.error('Error in GET /api/lead-config/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/lead-config/[id]
 * Aktualisiert eine Lead-Konfiguration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Lade bestehende Konfiguration
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('lead_configurations')
      .select('school_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Konfiguration nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe Zugriff
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', existing.school_id)
      .single()

    const admin = await getCurrentAdmin()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Konfiguration' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.selected_textiles !== undefined) updateData.selected_textiles = body.selected_textiles
    if (body.print_positions !== undefined) updateData.print_positions = body.print_positions
    if (body.price_calculation !== undefined) updateData.price_calculation = body.price_calculation
    if (body.status !== undefined) updateData.status = body.status
    if (body.shop_id !== undefined) updateData.shop_id = body.shop_id
    if (body.sponsoring !== undefined) updateData.sponsoring = body.sponsoring
    if (body.margin !== undefined) updateData.margin = body.margin

    const { data, error } = await supabaseAdmin
      .from('lead_configurations')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating lead config:', error)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Konfiguration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ config: data })
  } catch (error: any) {
    console.error('Error in PATCH /api/lead-config/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

