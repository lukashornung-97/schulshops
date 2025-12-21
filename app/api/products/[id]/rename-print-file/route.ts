import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Extrahiert Bucket-Namen und Dateipfad aus einer Supabase Storage URL
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url)
    
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
    
    if (pathMatch) {
      const bucket = pathMatch[2]
      const path = decodeURIComponent(pathMatch[3])
      return { bucket, path }
    }
    
    const parts = urlObj.pathname.split('/')
    const bucketIndex = parts.findIndex(part => part === 'product-images' || part === 'print-files')
    if (bucketIndex >= 0 && bucketIndex < parts.length - 1) {
      const bucket = parts[bucketIndex]
      const path = parts.slice(bucketIndex + 1).join('/')
      return { bucket, path }
    }
    
    return null
  } catch (error) {
    console.error('Error parsing storage URL:', error, url)
    return null
  }
}

/**
 * API Route zum Umbenennen von Druckdateien
 * PATCH /api/products/[id]/rename-print-file
 * 
 * Body: JSON mit:
 * - imageId: Die ID des product_images Eintrags
 * - newFileName: Der neue Dateiname (ohne Extension)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()
    const { imageId, newFileName } = body

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId fehlt' },
        { status: 400 }
      )
    }

    if (!newFileName || !newFileName.trim()) {
      return NextResponse.json(
        { error: 'Neuer Dateiname fehlt' },
        { status: 400 }
      )
    }

    // Lade Bild-Eintrag
    const { data: imageEntry, error: imageError } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', resolvedParams.id)
      .single()

    if (imageError || !imageEntry) {
      return NextResponse.json(
        { error: 'Bild nicht gefunden' },
        { status: 404 }
      )
    }

    if (!imageEntry.print_file_url) {
      return NextResponse.json(
        { error: 'Keine Druckdatei vorhanden' },
        { status: 400 }
      )
    }

    // Parse alte URL
    const parsed = parseStorageUrl(imageEntry.print_file_url)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Konnte Storage URL nicht parsen' },
        { status: 400 }
      )
    }

    // Extrahiere Dateiendung
    const oldPathParts = parsed.path.split('/')
    const oldFileName = oldPathParts[oldPathParts.length - 1]
    const fileExtension = oldFileName.split('.').pop() || ''
    
    // Normalisiere neuen Dateinamen
    const normalizeForFile = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'file'

    const normalizedNewFileName = normalizeForFile(newFileName.trim())
    const newFileNameWithExt = `${normalizedNewFileName}.${fileExtension}`

    // Erstelle neuen Pfad
    const directory = oldPathParts.slice(0, -1).join('/')
    const newPath = directory ? `${directory}/${newFileNameWithExt}` : newFileNameWithExt

    // Lade alte Datei
    const { data: oldFile, error: downloadError } = await supabaseAdmin.storage
      .from(parsed.bucket)
      .download(parsed.path)

    if (downloadError || !oldFile) {
      return NextResponse.json(
        { error: 'Konnte alte Datei nicht laden' },
        { status: 500 }
      )
    }

    // Konvertiere zu Buffer
    const arrayBuffer = await oldFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Bestimme Content-Type
    let contentType = 'application/octet-stream'
    switch (fileExtension.toLowerCase()) {
      case 'pdf':
        contentType = 'application/pdf'
        break
      case 'svg':
        contentType = 'image/svg+xml'
        break
      case 'eps':
      case 'ai':
        contentType = 'application/postscript'
        break
      case 'psd':
        contentType = 'image/vnd.adobe.photoshop'
        break
    }

    // Upload neue Datei
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(parsed.bucket)
      .upload(newPath, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Fehler beim Hochladen der umbenannten Datei' },
        { status: 500 }
      )
    }

    // Erstelle öffentliche URL
    const { data: urlData } = supabaseAdmin.storage
      .from(parsed.bucket)
      .getPublicUrl(newPath)

    const newPublicUrl = urlData.publicUrl

    // Lösche alte Datei
    try {
      await supabaseAdmin.storage
        .from(parsed.bucket)
        .remove([parsed.path])
    } catch (deleteError) {
      console.error('Error deleting old file:', deleteError)
      // Fortfahren, auch wenn Löschen fehlschlägt
    }

    // Aktualisiere Datenbank
    const { data: updatedImage, error: updateError } = await supabaseAdmin
      .from('product_images')
      .update({ print_file_url: newPublicUrl })
      .eq('id', imageId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Datenbank' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image: updatedImage,
      newFileName: newFileNameWithExt,
    })
  } catch (error: any) {
    console.error('Error renaming print file:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Umbenennen der Druckdatei' },
      { status: 500 }
    )
  }
}






