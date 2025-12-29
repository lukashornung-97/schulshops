import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Hochladen von Vorschau-Bildern für Lead-Konfigurationen
 * POST /api/lead-config/upload-preview-image
 * 
 * Body: FormData mit:
 * - file: Das Vorschau-Bild
 * - textile_id: ID des Textils
 * - color: Farbe des Textils
 * - type: 'front' | 'back' | 'side' (optional, Standard: 'front')
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const textileId = formData.get('textile_id') as string
    const color = formData.get('color') as string
    const type = (formData.get('type') as string) || 'front'

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

    const validTypes = ['front', 'back', 'side']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Ungültiger Typ. Erlaubt: ${validTypes.join(', ')}` },
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

    const fileExt = file.name.split('.').pop() || 'jpg'
    const typeLabel = type === 'front' ? 'front' : type === 'back' ? 'back' : 'side'
    
    // Für Bilder verwende Timestamp für eindeutige Dateinamen (wie bei Bestandsshops)
    // Da die Textilfarbe bereits bekannt ist, können wir sie im Dateinamen verwenden
    const timestamp = Date.now()
    const normalizedColor = normalizeForFile(color)
    // Storage-Pfad im Format: lead-configs/{textileId}/images/{color}/{type}_{timestamp}.{ext}
    // Ähnlich wie bei Bestandsshops: {productId}/images/{shopName}_{productName}_{type}_{timestamp}.{ext}
    const storagePath = `lead-configs/${textileId}/images/${normalizedColor}/${typeLabel}_${timestamp}.${fileExt}`

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
      url: urlData.publicUrl,
      fileName: file.name,
      storagePath,
      type,
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/upload-preview-image:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

