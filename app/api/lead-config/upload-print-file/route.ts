import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Hochladen von Druckdateien für Lead-Konfigurationen
 * POST /api/lead-config/upload-print-file
 * 
 * Body: FormData mit:
 * - file: Die Druckdatei
 * - textile_id: ID des Textils
 * - position: 'front' | 'back' | 'side'
 * - color: Farbe des Textils
 * - custom_file_name: Benutzerdefinierter Dateiname (optional, wird empfohlen)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const textileId = formData.get('textile_id') as string
    const position = formData.get('position') as string
    const color = formData.get('color') as string
    const customFileNameRaw = (formData.get('custom_file_name') as string | null)?.trim()

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (!textileId || !position || !color) {
      return NextResponse.json(
        { error: 'Textil-ID, Position und Farbe sind erforderlich' },
        { status: 400 }
      )
    }

    const validPositions = ['front', 'back', 'side']
    if (!validPositions.includes(position)) {
      return NextResponse.json(
        { error: `Ungültige Position. Erlaubt: ${validPositions.join(', ')}` },
        { status: 400 }
      )
    }

    // Normalisiere Dateinamen für Storage (gleiche Funktion wie bei Bestandsshops)
    const normalizeForFile = (value: string | null | undefined, fallback = 'x') =>
      (value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || fallback

    const fileExt = file.name.split('.').pop() || 'dat'
    const typeLabel = position === 'front' ? 'front' : position === 'back' ? 'back' : 'side'
    
    // Für Druckdateien verwende den benutzerdefinierten Dateinamen oder den Originalnamen
    let baseFileName: string
    if (customFileNameRaw && customFileNameRaw.length > 0) {
      baseFileName = normalizeForFile(customFileNameRaw, 'file')
    } else {
      // Fallback: Verwende normalisierten Originalnamen
      baseFileName = normalizeForFile(file.name.replace(/\.[^/.]+$/, ''), 'file')
    }
    
    const normalizedColor = normalizeForFile(color)
    // Storage-Pfad im Format: lead-configs/{textileId}/print/{color}/{position}_{filename}.{ext}
    // Ähnlich wie bei Bestandsshops: {productId}/print/{filename}.{ext}
    const storagePath = `lead-configs/${textileId}/print/${normalizedColor}/${typeLabel}_${baseFileName}.${fileExt}`

    // Konvertiere File zu ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload zu Supabase Storage (print-files Bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('print-files')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Fehler beim Hochladen der Datei' },
        { status: 500 }
      )
    }

    // Erstelle öffentliche URL
    const { data: urlData } = supabaseAdmin.storage
      .from('print-files')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName: file.name,
      storagePath,
      customFileName: customFileNameRaw || null,
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/upload-print-file:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

