import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Löschen von Druckdateien aus Supabase Storage
 * POST /api/lead-config/delete-print-files
 * 
 * Body: { paths: string[] } - Array von Storage-Pfaden relativ zum Bucket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paths } = body

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'Pfade sind erforderlich' },
        { status: 400 }
      )
    }

    // Lösche alle Dateien aus dem print-files Bucket
    const { data, error } = await supabaseAdmin.storage
      .from('print-files')
      .remove(paths)

    if (error) {
      console.error('Error deleting files:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen der Dateien' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      deleted: data?.length || 0 
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/delete-print-files:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}


