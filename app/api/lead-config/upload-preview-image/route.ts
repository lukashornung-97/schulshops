import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

/**
 * API Route zum Hochladen von Vorschau-Bildern für Lead-Konfigurationen
 * POST /api/lead-config/upload-preview-image
 * 
 * Body: FormData mit:
 * - file: Das Vorschau-Bild
 * - textile_id: ID des Textils
 * - color: Farbe des Textils
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const textileId = formData.get('textile_id') as string
    const color = formData.get('color') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (!textileId || !color) {
      return NextResponse.json(
        { error: 'Textil-ID und Farbe sind erforderlich' },
        { status: 400 }
      )
    }

    // Validiere, dass es ein Bild ist
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Datei muss ein Bild sein' },
        { status: 400 }
      )
    }

    // Erstelle eindeutige ID für die Datei
    const fileId = randomUUID()
    const fileExt = file.name.split('.').pop() || 'jpg'
    
    // Normalisiere Dateinamen für Storage
    const normalizeForFile = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'file'

    const baseFileName = normalizeForFile(file.name.replace(/\.[^/.]+$/, ''))
    const normalizedColor = normalizeForFile(color)
    const storagePath = `lead-configs/${textileId}/previews/${normalizedColor}/${fileId}_${baseFileName}.${fileExt}`

    // Konvertiere File zu ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload zu Supabase Storage (product-images Bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(storagePath, buffer, {
        contentType: file.type,
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
      .from('product-images')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      fileId,
      url: urlData.publicUrl,
      fileName: file.name,
      storagePath,
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/upload-preview-image:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

