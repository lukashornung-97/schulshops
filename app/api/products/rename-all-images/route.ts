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
 * Normalisiert einen String für Dateinamen
 */
function normalizeForFile(value: string | null | undefined, fallback = 'x'): string {
  return (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || fallback
}

/**
 * API Route zum Umbenennen aller bestehenden Frontend-Bilder
 * POST /api/products/rename-all-images
 * 
 * Benennt alle Frontend-Bilder um, die bereits einer Textilfarbe zugeordnet sind
 */
export async function POST(request: NextRequest) {
  try {
    // Lade alle Bilder mit Textilfarbe
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('product_images')
      .select('id, product_id, textile_color_name, image_type, image_url')
      .not('textile_color_name', 'is', null)
      .not('image_url', 'is', null)

    if (imagesError) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Bilder' },
        { status: 500 }
      )
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine Bilder zum Umbenennen gefunden',
        renamed: 0,
        errors: [],
      })
    }

    const results = []
    const errors: string[] = []

    // Gruppiere nach Produkt für effizienteres Laden
    const productIds = Array.from(new Set(images.map(img => img.product_id)))
    
    // Lade alle Produkte und Shops
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, shop_id')
      .in('id', productIds)

    if (!products) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Produkte' },
        { status: 500 }
      )
    }

    const shopIds = Array.from(new Set(products.map(p => p.shop_id).filter((id): id is string => id !== null)))
    const { data: shops } = await supabaseAdmin
      .from('shops')
      .select('id, slug')
      .in('id', shopIds)

    const productsMap = new Map(products.map(p => [p.id, p]))
    const shopsMap = new Map(shops?.map(s => [s.id, s]) || [])

    // Verarbeite jedes Bild
    for (const image of images) {
      try {
        const product = productsMap.get(image.product_id)
        if (!product) {
          errors.push(`Bild ${image.id}: Produkt nicht gefunden`)
          continue
        }

        const shop = product.shop_id ? shopsMap.get(product.shop_id) : null
        const shopSlug = shop?.slug || 'shop'

        // Prüfe ob Dateiname bereits korrekt ist
        const parsed = parseStorageUrl(image.image_url)
        if (!parsed || parsed.bucket !== 'product-images') {
          continue
        }

        const pathParts = parsed.path.split('/')
        const currentFileName = pathParts[pathParts.length - 1]
        const fileExtension = currentFileName.split('.').pop() || ''

        // Erstelle erwarteten Dateinamen
        const normalizedShopSlug = normalizeForFile(shopSlug)
        const normalizedProductName = normalizeForFile(product.name)
        const normalizedColor = normalizeForFile(image.textile_color_name)
        const typeLabel = image.image_type === 'front' ? 'front' : image.image_type === 'back' ? 'back' : 'side'
        const expectedFileName = `${normalizedShopSlug}_${normalizedProductName}_${normalizedColor}_${typeLabel}.${fileExtension}`

        // Prüfe ob Dateiname bereits korrekt ist
        if (currentFileName === expectedFileName) {
          continue // Bereits korrekt benannt
        }

        // Erstelle neuen Pfad
        const directory = pathParts.slice(0, -1).join('/')
        const newPath = directory ? `${directory}/${expectedFileName}` : expectedFileName

        // Prüfe ob Datei mit neuem Namen bereits existiert
        const { data: existingFile } = await supabaseAdmin.storage
          .from(parsed.bucket)
          .list(directory || '', {
            search: expectedFileName,
          })

        if (existingFile && existingFile.length > 0) {
          // Datei existiert bereits, aktualisiere nur die URL in der DB
          const { data: urlData } = supabaseAdmin.storage
            .from(parsed.bucket)
            .getPublicUrl(newPath)

          await supabaseAdmin
            .from('product_images')
            .update({ image_url: urlData.publicUrl })
            .eq('id', image.id)

          results.push({
            imageId: image.id,
            oldName: currentFileName,
            newName: expectedFileName,
            action: 'updated_url',
          })
          continue
        }

        // Lade alte Datei
        const { data: oldFile, error: downloadError } = await supabaseAdmin.storage
          .from(parsed.bucket)
          .download(parsed.path)

        if (downloadError || !oldFile) {
          errors.push(`Bild ${image.id}: Konnte Datei nicht laden`)
          continue
        }

        // Konvertiere zu Buffer
        const arrayBuffer = await oldFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload neue Datei
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(parsed.bucket)
          .upload(newPath, buffer, {
            contentType: oldFile.type || 'image/jpeg',
            upsert: true,
          })

        if (uploadError) {
          errors.push(`Bild ${image.id}: Fehler beim Hochladen - ${uploadError.message}`)
          continue
        }

        // Erstelle öffentliche URL
        const { data: urlData } = supabaseAdmin.storage
          .from(parsed.bucket)
          .getPublicUrl(newPath)

        // Aktualisiere Datenbank
        const { error: updateError } = await supabaseAdmin
          .from('product_images')
          .update({ image_url: urlData.publicUrl })
          .eq('id', image.id)

        if (updateError) {
          errors.push(`Bild ${image.id}: Fehler beim Aktualisieren der DB - ${updateError.message}`)
          continue
        }

        // Lösche alte Datei nur wenn sie nicht mehr verwendet wird
        // Prüfe ob andere Bilder dieselbe URL verwenden
        const { data: otherImages } = await supabaseAdmin
          .from('product_images')
          .select('id')
          .eq('image_url', image.image_url)
          .neq('id', image.id)

        if (!otherImages || otherImages.length === 0) {
          try {
            await supabaseAdmin.storage
              .from(parsed.bucket)
              .remove([parsed.path])
          } catch (deleteError) {
            console.error(`Error deleting old file ${parsed.path}:`, deleteError)
          }
        }

        results.push({
          imageId: image.id,
          oldName: currentFileName,
          newName: expectedFileName,
          action: 'renamed',
        })
      } catch (error: any) {
        console.error(`Error processing image ${image.id}:`, error)
        errors.push(`Bild ${image.id}: ${error.message || 'Unbekannter Fehler'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} Bild(er) erfolgreich umbenannt`,
      renamed: results.length,
      errors: errors.length > 0 ? errors : undefined,
      results: results.slice(0, 100), // Nur erste 100 Ergebnisse zurückgeben
    })
  } catch (error: any) {
    console.error('Error renaming all images:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Umbenennen der Bilder' },
      { status: 500 }
    )
  }
}








