import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * API Route zum Hochladen von Produktbildern
 * POST /api/products/[id]/upload-image
 * 
 * Body: FormData mit:
 * - file: Die Bilddatei
 * - type: 'front' | 'back' | 'side'
 * - is_print_file: 'true' | 'false' - ob es eine Druckdatei ist
 * 
 * Die Textilfarbe wird später zugeordnet via /assign-images
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const isPrintFile = formData.get('is_print_file') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Typ fehlt (front, back, side)' },
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

    // Prüfe ob Produkt existiert
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, shop_id')
      .eq('id', params.id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Produkt nicht gefunden' },
        { status: 404 }
      )
    }

    // Erstelle eindeutigen Dateinamen (ohne Textilfarbe, wird später zugeordnet)
    const fileExt = file.name.split('.').pop()
    const fileName = `${params.id}/unassigned/${type}_${Date.now()}.${fileExt}`
    
    // Bestimme Storage Bucket basierend auf Typ
    const bucket = isPrintFile ? 'print-files' : 'product-images'

    // Konvertiere File zu ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload zu Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: `Fehler beim Hochladen: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Hole öffentliche URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // Speichere in product_images Tabelle OHNE Textilfarbe (wird später zugeordnet)
    const imageData: any = {
      product_id: params.id,
      textile_color_name: null, // Wird später zugeordnet
      image_type: type,
    }

    if (isPrintFile) {
      imageData.print_file_url = publicUrl
    } else {
      imageData.image_url = publicUrl
    }

    // Erstelle neuen Eintrag ohne Textilfarbe
    const { data: newImage, error: insertError } = await supabase
      .from('product_images')
      .insert([imageData])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      // Lösche hochgeladene Datei bei Fehler
      await supabase.storage.from(bucket).remove([fileName])
      return NextResponse.json(
        { error: `Fehler beim Speichern: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image_id: newImage.id,
      url: publicUrl,
      type,
      is_print_file: isPrintFile,
    })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Hochladen des Bildes' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/upload-image?type=front&textile_color=Schwarz
 * Löscht ein Bild
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const textileColor = searchParams.get('textile_color')

    if (!type) {
      return NextResponse.json(
        { error: 'Typ fehlt' },
        { status: 400 }
      )
    }

    if (!textileColor) {
      return NextResponse.json(
        { error: 'Textilfarbe fehlt' },
        { status: 400 }
      )
    }

    // Lade Bild-Eintrag
    const { data: imageEntry, error: imageError } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', params.id)
      .eq('textile_color_name', textileColor)
      .eq('image_type', type)
      .single()

    if (imageError || !imageEntry) {
      return NextResponse.json(
        { error: 'Bild nicht gefunden' },
        { status: 404 }
      )
    }

    // Lösche Dateien aus Storage
    const urlsToDelete: string[] = []
    if (imageEntry.image_url) {
      urlsToDelete.push(imageEntry.image_url)
    }
    if (imageEntry.print_file_url) {
      urlsToDelete.push(imageEntry.print_file_url)
    }

    for (const url of urlsToDelete) {
      const urlParts = url.split('/')
      const bucketIndex = urlParts.findIndex(part => part === 'product-images' || part === 'print-files')
      if (bucketIndex >= 0) {
        const bucket = urlParts[bucketIndex]
        const fileName = urlParts.slice(bucketIndex + 1).join('/')
        
        await supabase.storage
          .from(bucket)
          .remove([fileName])
      }
    }

    // Lösche Eintrag aus Datenbank
    const { error: deleteError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageEntry.id)

    if (deleteError) {
      return NextResponse.json(
        { error: `Fehler beim Löschen: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting image:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Löschen des Bildes' },
      { status: 500 }
    )
  }
}

