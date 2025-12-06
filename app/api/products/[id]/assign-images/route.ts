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
 * API Route zum Zuordnen von Bildern zu Textilfarben
 * POST /api/products/[id]/assign-images
 * 
 * Body: JSON mit:
 * - image_id: UUID des Bildes aus product_images
 * - textile_colors: Array von Textilfarben-Namen (z.B. ["Schwarz", "Weiß"])
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { image_id, textile_colors } = body

    if (!image_id) {
      return NextResponse.json(
        { error: 'image_id fehlt' },
        { status: 400 }
      )
    }

    if (!textile_colors || !Array.isArray(textile_colors) || textile_colors.length === 0) {
      return NextResponse.json(
        { error: 'textile_colors muss ein Array mit mindestens einem Element sein' },
        { status: 400 }
      )
    }

    // Prüfe ob Bild existiert und zum Produkt gehört
    const { data: imageEntry, error: imageError } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('id', image_id)
      .eq('product_id', params.id)
      .single()

    if (imageError || !imageEntry) {
      return NextResponse.json(
        { error: 'Bild nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade Produkt- und Shop-Daten für Dateinamen
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, shop_id')
      .eq('id', params.id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Produkt nicht gefunden' },
        { status: 404 }
      )
    }

    let shopSlug = 'shop'
    if (product.shop_id) {
      const { data: shop } = await supabaseAdmin
        .from('shops')
        .select('slug')
        .eq('id', product.shop_id)
        .single()
      
      if (shop?.slug) {
        shopSlug = shop.slug
      }
    }

    // Wenn es ein Frontend-Bild ist und noch nicht zugeordnet war, bereite Umbenennung vor
    const shouldRename = imageEntry.image_url && !imageEntry.textile_color_name && textile_colors.length > 0
    let originalFileBuffer: Buffer | null = null
    let originalFileType: string = 'image/jpeg'
    let originalParsed: { bucket: string; path: string } | null = null

    if (shouldRename) {
      try {
        const parsed = parseStorageUrl(imageEntry.image_url)
        if (parsed && parsed.bucket === 'product-images') {
          originalParsed = parsed
          // Lade ursprüngliche Datei für spätere Kopien
          const { data: oldFile, error: downloadError } = await supabaseAdmin.storage
            .from(parsed.bucket)
            .download(parsed.path)

          if (!downloadError && oldFile) {
            const arrayBuffer = await oldFile.arrayBuffer()
            originalFileBuffer = Buffer.from(arrayBuffer)
            originalFileType = oldFile.type || 'image/jpeg'
          }
        }
      } catch (error) {
        console.error('Error loading original file:', error)
      }
    }

    // Für jede Textilfarbe einen Eintrag erstellen oder aktualisieren
    const results = []
    for (const color of textile_colors) {
      // Prüfe ob bereits ein Eintrag existiert
      const { data: existing } = await supabaseAdmin
        .from('product_images')
        .select('id')
        .eq('product_id', params.id)
        .eq('textile_color_name', color)
        .eq('image_type', imageEntry.image_type)
        .single()

      let imageUrl = imageEntry.image_url
      let printFileUrl = imageEntry.print_file_url

      // Wenn es ein Frontend-Bild ist und noch nicht zugeordnet war, benenne es um
      if (shouldRename && originalFileBuffer && originalParsed) {
        try {
          // Extrahiere Dateiendung
          const oldPathParts = originalParsed.path.split('/')
          const oldFileName = oldPathParts[oldPathParts.length - 1]
          const fileExtension = oldFileName.split('.').pop() || ''
          
          // Erstelle neuen Dateinamen: [schulkürzel]_[produkt]_[farbe]_[druckseite]
          const normalizedShopSlug = normalizeForFile(shopSlug)
          const normalizedProductName = normalizeForFile(product.name)
          const normalizedColor = normalizeForFile(color)
          const typeLabel = imageEntry.image_type === 'front' ? 'front' : imageEntry.image_type === 'back' ? 'back' : 'side'
          const newFileName = `${normalizedShopSlug}_${normalizedProductName}_${normalizedColor}_${typeLabel}.${fileExtension}`

          // Erstelle neuen Pfad
          const directory = oldPathParts.slice(0, -1).join('/')
          const newPath = directory ? `${directory}/${newFileName}` : newFileName

          // Upload Datei mit neuem Namen (Kopie der ursprünglichen Datei)
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(originalParsed.bucket)
            .upload(newPath, originalFileBuffer, {
              contentType: originalFileType,
              upsert: true,
            })

          if (!uploadError) {
            // Erstelle öffentliche URL
            const { data: urlData } = supabaseAdmin.storage
              .from(originalParsed.bucket)
              .getPublicUrl(newPath)

            imageUrl = urlData.publicUrl

            // Lösche alte Datei nur beim ersten Durchlauf (erste Farbe)
            if (color === textile_colors[0]) {
              try {
                await supabaseAdmin.storage
                  .from(originalParsed.bucket)
                  .remove([originalParsed.path])
              } catch (deleteError) {
                console.error('Error deleting old file:', deleteError)
              }
            }
          }
        } catch (renameError) {
          console.error('Error renaming image file for color:', color, renameError)
          // Fortfahren mit alter URL falls Umbenennung fehlschlägt
        }
      }

      if (existing) {
        // Update bestehenden Eintrag
        const updateData: any = {}
        if (imageUrl) {
          updateData.image_url = imageUrl
        }
        if (printFileUrl) {
          updateData.print_file_url = printFileUrl
        }

        const { error: updateError } = await supabaseAdmin
          .from('product_images')
          .update(updateData)
          .eq('id', existing.id)

        if (updateError) {
          results.push({ color, success: false, error: updateError.message })
        } else {
          results.push({ color, success: true })
        }
      } else {
        // Erstelle neuen Eintrag für diese Farbe
        const newEntry: any = {
          product_id: params.id,
          textile_color_name: color,
          image_type: imageEntry.image_type,
        }

        if (imageUrl) {
          newEntry.image_url = imageUrl
        }
        if (printFileUrl) {
          newEntry.print_file_url = printFileUrl
        }

        // Finde Varianten-ID falls vorhanden
        const { data: variant } = await supabaseAdmin
          .from('product_variants')
          .select('id')
          .eq('product_id', params.id)
          .eq('color_name', color)
          .single()

        if (variant) {
          newEntry.textile_color_id = variant.id
        }

        const { error: insertError } = await supabaseAdmin
          .from('product_images')
          .insert([newEntry])

        if (insertError) {
          results.push({ color, success: false, error: insertError.message })
        } else {
          results.push({ color, success: true })
        }
      }
    }

    // Lösche das ursprüngliche Bild ohne Textilfarbe (falls vorhanden)
    if (!imageEntry.textile_color_name) {
      await supabaseAdmin
        .from('product_images')
        .delete()
        .eq('id', image_id)
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error('Error assigning images:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Zuordnen der Bilder' },
      { status: 500 }
    )
  }
}





