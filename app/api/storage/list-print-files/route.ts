import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * API Route zum Auflisten aller Druckdateien aus der product_images Tabelle
 * GET /api/storage/list-print-files?search=[search-term]&shop_id=[shop-id]
 * 
 * Gibt eine Liste aller eindeutigen Druckdateien zurück, die bereits in der Datenbank verwendet werden,
 * optional gefiltert nach Suchbegriff und Shop
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const searchTerm = searchParams.get('search')?.toLowerCase() || ''
    const shopId = searchParams.get('shop_id')

    // Lade alle Druckdateien aus der product_images Tabelle
    let query = supabaseAdmin
      .from('product_images')
      .select(`
        print_file_url,
        product_id,
        products!inner (
          id,
          name,
          shop_id,
          shops (
            id,
            name,
            slug
          )
        )
      `)
      .not('print_file_url', 'is', null)

    // Optional: Filter nach Shop
    if (shopId) {
      query = query.eq('products.shop_id', shopId)
    }

    const { data: productImages, error } = await query

    if (error) {
      console.error('Error listing print files:', error)
      return NextResponse.json(
        { error: 'Fehler beim Auflisten der Druckdateien' },
        { status: 500 }
      )
    }

    if (!productImages || productImages.length === 0) {
      return NextResponse.json({ files: [] })
    }

    // Extrahiere eindeutige Druckdateien mit Metadaten
    const printFilesMap = new Map<string, {
      name: string
      url: string
      usedBy: Array<{
        productName: string
        productId: string
        shopName: string
        color: string
        type: string
      }>
    }>()

    productImages.forEach((img: any) => {
      if (!img.print_file_url) return

      // Extrahiere Dateinamen aus URL
      const urlParts = img.print_file_url.split('/')
      const fileName = urlParts[urlParts.length - 1] || ''
      
      // Filtere nach Suchbegriff
      if (searchTerm && !fileName.toLowerCase().includes(searchTerm)) {
        return
      }

      // Nur PDF-Dateien
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        return
      }

      const product = img.products
      const shop = product?.shops

      if (!printFilesMap.has(fileName)) {
        printFilesMap.set(fileName, {
          name: fileName,
          url: img.print_file_url,
          usedBy: []
        })
      }

      const fileEntry = printFilesMap.get(fileName)!
      fileEntry.usedBy.push({
        productName: product?.name || 'Unbekannt',
        productId: product?.id || '',
        shopName: shop?.name || shop?.slug || 'Unbekannt',
        color: img.textile_color_name || 'Unbekannt',
        type: img.image_type || 'Unbekannt'
      })
    })

    // Konvertiere Map zu Array und sortiere
    const files = Array.from(printFilesMap.values())
      .map(file => ({
        name: file.name,
        path: file.url,
        url: file.url,
        usedBy: file.usedBy,
        usedCount: file.usedBy.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Error in list-print-files:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Auflisten der Druckdateien' },
      { status: 500 }
    )
  }
}

