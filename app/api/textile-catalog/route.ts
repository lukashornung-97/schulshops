import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * GET /api/textile-catalog
 * Lädt alle aktiven Textilien aus dem Katalog
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const query = supabaseAdmin
      .from('textile_catalog')
      .select('*')
      .order('name', { ascending: true })

    if (activeOnly) {
      query.eq('active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching textile catalog:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden des Textilkatalogs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ textiles: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/textile-catalog:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/textile-catalog
 * Erstellt einen neuen Eintrag im Textilkatalog (nur für Admins)
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
      brand,
      article_number,
      base_price = 0,
      available_colors,
      available_sizes,
      image_url,
      description,
      active = true,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name ist erforderlich' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('textile_catalog')
      .insert({
        name,
        brand: brand || null,
        article_number: article_number || null,
        base_price: parseFloat(base_price),
        available_colors: available_colors || [],
        available_sizes: available_sizes || [],
        image_url: image_url || null,
        description: description || null,
        active,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating textile:', error)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Textils' },
        { status: 500 }
      )
    }

    return NextResponse.json({ textile: data })
  } catch (error: any) {
    console.error('Error in POST /api/textile-catalog:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

