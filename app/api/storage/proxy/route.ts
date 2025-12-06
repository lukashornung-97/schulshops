import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Proxy-Route für Storage-Dateien
 * GET /api/storage/proxy?url=[storage-url]
 * 
 * Lädt Dateien aus Supabase Storage und serviert sie mit den richtigen Content-Type Headern,
 * damit sie im Browser angezeigt werden können (z.B. PDFs, SVGs)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileUrl = searchParams.get('url')

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'URL-Parameter fehlt' },
        { status: 400 }
      )
    }

    // Parse die Storage URL
    let bucket: string | null = null
    let path: string | null = null

    try {
      // Decode URL falls sie encoded ist
      let decodedUrl = fileUrl
      try {
        decodedUrl = decodeURIComponent(fileUrl)
      } catch {
        // URL ist bereits decoded oder ungültig, verwende Original
        decodedUrl = fileUrl
      }

      const urlObj = new URL(decodedUrl)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
      
      if (pathMatch) {
        bucket = pathMatch[2]
        // Decode den Pfad, da er möglicherweise encoded ist
        path = decodeURIComponent(pathMatch[3])
      } else {
        // Fallback
        const parts = urlObj.pathname.split('/')
        const bucketIndex = parts.findIndex(part => part === 'product-images' || part === 'print-files')
        if (bucketIndex >= 0 && bucketIndex < parts.length - 1) {
          bucket = parts[bucketIndex]
          path = parts.slice(bucketIndex + 1).join('/')
          // Decode den Pfad
          try {
            path = decodeURIComponent(path)
          } catch {
            // Pfad ist bereits decoded
          }
        }
      }
    } catch (error) {
      console.error('Error parsing URL:', error, 'URL:', fileUrl)
      return NextResponse.json(
        { error: 'Ungültige URL', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      )
    }

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'Konnte Bucket und Pfad nicht aus URL extrahieren' },
        { status: 400 }
      )
    }

    // Lade Datei aus Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path)

    if (error || !data) {
      console.error('Error downloading file:', error)
      return NextResponse.json(
        { error: 'Datei nicht gefunden' },
        { status: 404 }
      )
    }

    // Bestimme Content-Type basierend auf Dateiendung
    const fileExtension = path.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'

    switch (fileExtension) {
      case 'pdf':
        contentType = 'application/pdf'
        break
      case 'svg':
        contentType = 'image/svg+xml'
        break
      case 'eps':
        contentType = 'application/postscript'
        break
      case 'ai':
        contentType = 'application/postscript'
        break
      case 'psd':
        contentType = 'image/vnd.adobe.photoshop'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'webp':
        contentType = 'image/webp'
        break
    }

    // Konvertiere Blob zu ArrayBuffer
    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Serviere Datei mit richtigem Content-Type
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('Error in storage proxy:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Laden der Datei' },
      { status: 500 }
    )
  }
}

