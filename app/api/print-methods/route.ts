import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/print-methods
 * Lädt alle aktiven Druckarten
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const query = supabaseAdmin
      .from('print_methods')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (activeOnly) {
      query.eq('active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching print methods:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Druckarten' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethods: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/print-methods:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/print-methods
 * Erstellt eine neue Druckart (nur für Admins)
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
      display_order = 0,
      active = true,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name ist erforderlich' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('print_methods')
      .insert({
        name,
        display_order: parseInt(display_order) || 0,
        active,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating print method:', error)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen der Druckart' },
        { status: 500 }
      )
    }

    return NextResponse.json({ printMethod: data })
  } catch (error: any) {
    console.error('Error in POST /api/print-methods:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}


