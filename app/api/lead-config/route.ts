import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

/**
 * GET /api/lead-config?school_id=[id]
 * Lädt Lead-Konfiguration für eine Schule
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('school_id')

    if (!schoolId) {
      return NextResponse.json(
        { error: 'school_id ist erforderlich' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Schule' },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('lead_configurations')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching lead config:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Konfiguration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ config: data })
  } catch (error: any) {
    console.error('Error in GET /api/lead-config:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lead-config
 * Erstellt oder aktualisiert eine Lead-Konfiguration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      school_id,
      selected_textiles,
      print_positions,
      price_calculation,
      status = 'draft',
    } = body

    if (!school_id) {
      return NextResponse.json(
        { error: 'school_id ist erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', school_id)
      .single()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Schule' },
        { status: 403 }
      )
    }

    // Prüfe ob bereits eine Konfiguration existiert
    const { data: existing } = await supabaseAdmin
      .from('lead_configurations')
      .select('id')
      .eq('school_id', school_id)
      .eq('status', 'draft')
      .maybeSingle()

    let result
    if (existing) {
      // Aktualisiere bestehende Konfiguration
      const updateData: any = {}
      if (selected_textiles !== undefined) updateData.selected_textiles = selected_textiles
      if (print_positions !== undefined) updateData.print_positions = print_positions
      if (price_calculation !== undefined) updateData.price_calculation = price_calculation
      if (status !== undefined) updateData.status = status

      const { data, error } = await supabaseAdmin
        .from('lead_configurations')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating lead config:', error)
        return NextResponse.json(
          { error: 'Fehler beim Aktualisieren der Konfiguration' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Erstelle neue Konfiguration
      const { data, error } = await supabaseAdmin
        .from('lead_configurations')
        .insert({
          school_id,
          selected_textiles: selected_textiles || [],
          print_positions: print_positions || {},
          price_calculation: price_calculation || null,
          status,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating lead config:', error)
        return NextResponse.json(
          { error: 'Fehler beim Erstellen der Konfiguration' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({ config: result })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

