import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Extrahiert Bucket-Namen und Dateipfad aus einer Supabase Storage URL
 * Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
 * oder: https://[project].supabase.co/storage/v1/object/sign/[bucket]/[path]?...
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url)
    
    // Suche nach dem Bucket-Namen im Pfad
    // Format: /storage/v1/object/public/[bucket]/[path]
    // oder: /storage/v1/object/sign/[bucket]/[path]
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
    
    if (pathMatch) {
      const bucket = pathMatch[2]
      const path = pathMatch[3]
      return { bucket, path }
    }
    
    // Fallback: Suche nach Bucket-Namen direkt im Pfad
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:51',message:'POST handler entry',data:{paramsId:resolvedParams?.id,paramsType:typeof resolvedParams,paramsKeys:resolvedParams?Object.keys(resolvedParams):null,url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:56',message:'Before FormData parse',data:{contentType:request.headers.get('content-type'),hasBody:!!request.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const formData = await request.formData()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:58',message:'After FormData parse',data:{hasFormData:!!formData,formDataKeys:formData?Array.from(formData.keys()):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const isPrintFile = formData.get('is_print_file') === 'true'
    const customFileNameRaw = (formData.get('custom_file_name') as string | null)?.trim()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:61',message:'FormData fields extracted',data:{hasFile:!!file,fileName:file?.name,type,isPrintFile,customFileNameRaw,paramsId:resolvedParams?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

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

    if (isPrintFile && (!customFileNameRaw || customFileNameRaw.length === 0)) {
      return NextResponse.json(
        { error: 'Für Druckdateien muss ein Dateiname angegeben werden.' },
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:92',message:'Before product lookup',data:{paramsId:resolvedParams?.id,paramsIdType:typeof resolvedParams?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, shop_id')
      .eq('id', resolvedParams.id)
      .single()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:96',message:'After product lookup',data:{hasProduct:!!product,productId:product?.id,productError:productError?.message,productErrorCode:productError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (productError || !product) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:98',message:'Product not found error',data:{paramsId:resolvedParams?.id,productError:productError?.message,productErrorCode:productError?.code,hasProduct:!!product},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Produkt nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade Shop-Daten für Dateinamen
    let shopIdentifier = 'shop'
    if (product.shop_id) {
      const { data: shop } = await supabaseAdmin
        .from('shops')
        .select('name, slug')
        .eq('id', product.shop_id)
        .single()
      
      if (shop) {
        shopIdentifier = (shop.slug || shop.name || 'shop')
      }
    }

    const normalizeForFile = (value: string | null | undefined, fallback = 'x') =>
      (value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || fallback

    const shopName = normalizeForFile(shopIdentifier)
    const productName = normalizeForFile(product.name, 'produkt')
    const typeLabel = type === 'front' ? 'front' : type === 'back' ? 'back' : 'side'

    const fileExt = file.name.split('.').pop() || 'dat'
    
    // Für Druckdateien verwende den benutzerdefinierten Dateinamen, für Bilder den Standard-Namen mit Timestamp
    let baseFileName: string
    if (isPrintFile) {
      baseFileName = normalizeForFile(customFileNameRaw, 'file')
    } else {
      // Füge Timestamp hinzu, um eindeutige Dateinamen zu gewährleisten
      // (da die Textilfarbe erst später zugeordnet wird)
      const timestamp = Date.now()
      baseFileName = `${shopName}_${productName}_${typeLabel}_${timestamp}`
    }
    
    const storagePath = `${resolvedParams.id}/${isPrintFile ? 'print' : 'images'}/${baseFileName}.${fileExt}`
    
    // Bestimme Storage Bucket basierend auf Typ
    const bucket = isPrintFile ? 'print-files' : 'product-images'

    // Konvertiere File zu ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload zu Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      
      // Spezielle Fehlermeldung für fehlenden Bucket
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        return NextResponse.json(
          { 
            error: `Storage Bucket "${bucket}" nicht gefunden. Bitte führe die Migration "create_storage_buckets.sql" in Supabase aus, um die benötigten Buckets zu erstellen.`,
            bucket: bucket,
            hint: 'Die SQL-Datei befindet sich in: supabase/migrations/create_storage_buckets.sql'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Fehler beim Hochladen: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Hole öffentliche URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Speichere in product_images Tabelle OHNE Textilfarbe (wird später zugeordnet)
    const imageData: any = {
      product_id: resolvedParams.id,
      textile_color_name: null, // Wird später zugeordnet
      image_type: type,
    }

    if (isPrintFile) {
      imageData.print_file_url = publicUrl
    } else {
      imageData.image_url = publicUrl
    }

    // Erstelle neuen Eintrag ohne Textilfarbe
    const { data: newImage, error: insertError } = await supabaseAdmin
      .from('product_images')
      .insert([imageData])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      // Lösche hochgeladene Datei bei Fehler
      await supabaseAdmin.storage.from(bucket).remove([storagePath])
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
    // #region agent log
    try {
      const resolvedParams = await Promise.resolve(params)
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:247',message:'Catch block error',data:{errorMessage:error?.message,errorStack:error?.stack,errorName:error?.name,paramsId:resolvedParams?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    } catch {
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'upload-image/route.ts:247',message:'Catch block error - params resolve failed',data:{errorMessage:error?.message,errorStack:error?.stack,errorName:error?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
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
    const { data: imageEntry, error: imageError } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', resolvedParams.id)
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
      const parsed = parseStorageUrl(url)
      if (parsed) {
        try {
          await supabaseAdmin.storage
            .from(parsed.bucket)
            .remove([parsed.path])
        } catch (error) {
          console.error(`Error deleting file from ${parsed.bucket}/${parsed.path}:`, error)
        }
      } else {
        console.warn('Could not parse storage URL:', url)
      }
    }

    // Lösche Eintrag aus Datenbank
    const { error: deleteError } = await supabaseAdmin
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

