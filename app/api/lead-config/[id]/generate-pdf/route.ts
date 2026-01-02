import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

// PDFKit benötigt Node.js Runtime
export const runtime = 'nodejs'

/**
 * POST /api/lead-config/[id]/generate-pdf
 * Generiert ein PDF-Angebotsdokument für eine Lead-Konfiguration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const configId = typeof params === 'object' && 'then' in params 
      ? (await params).id 
      : params.id

    // Lade Lead-Konfiguration
    const { data: config, error: configError } = await supabaseAdmin
      .from('lead_configurations')
      .select('*')
      .eq('id', configId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Konfiguration nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe Zugriff
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', config.school_id)
      .maybeSingle()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Konfiguration' },
        { status: 403 }
      )
    }

    // Lade Schuldaten
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', config.school_id)
      .single()

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'Schule nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade Produkte für diese Konfiguration
    if (!config.shop_id) {
      return NextResponse.json(
        { error: 'Kein Shop für diese Konfiguration vorhanden' },
        { status: 400 }
      )
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        textile_catalog (
          id,
          name,
          brand,
          image_url,
          description,
          available_colors,
          available_sizes
        ),
        product_variants (
          id,
          name,
          color_name,
          color_hex,
          active
        )
      `)
      .eq('shop_id', config.shop_id)
      .order('sort_index', { ascending: true })

    if (productsError || !products || products.length === 0) {
      return NextResponse.json(
        { error: 'Keine Produkte für diese Konfiguration gefunden' },
        { status: 404 }
      )
    }

    // Bereite Produktdaten für PDF vor
    const productData = products.map((product: any) => {
      const variants = product.product_variants || []
      
      // Handle textile_catalog - could be array or single object
      const textile = Array.isArray(product.textile_catalog) 
        ? product.textile_catalog[0] 
        : product.textile_catalog
      
      // Ensure colors are strings only
      const colors = [...new Set(
        variants
          .map((v: any) => v.color_name)
          .filter((c: any): c is string => typeof c === 'string' && c.length > 0)
      )]
      // Ensure sizes are strings only, filter out undefined/null/objects
      const sizes = [...new Set(
        variants
          .map((v: any) => v.name)
          .filter((n: any): n is string => typeof n === 'string' && n !== 'Standard' && n.length > 0)
      )]

      // Finde Bild: zuerst Druckvorschau, dann Textilbild, dann Standard
      let imageUrl: string | null = null
      const printConfig = product.print_config as any
      
      // Prüfe auf Druckvorschauen
      if (printConfig) {
        // Versuche Vorschau von erster Farbe zu nehmen
        const firstColor = colors[0]
        if (firstColor) {
          if (printConfig.front?.previews?.[firstColor]?.[0]?.url) {
            imageUrl = printConfig.front.previews[firstColor][0].url
          } else if (printConfig.back?.previews?.[firstColor]?.[0]?.url) {
            imageUrl = printConfig.back.previews[firstColor][0].url
          } else if (printConfig.side?.previews?.[firstColor]?.[0]?.url) {
            imageUrl = printConfig.side.previews[firstColor][0].url
          }
        }
      }

      // Fallback: Textilbild
      if (!imageUrl && textile?.image_url && typeof textile.image_url === 'string') {
        imageUrl = textile.image_url
      }

      // Erstelle Farb-Info mit Hex-Werten
      const colorInfo = colors.map((colorName: string) => {
        const variant = variants.find((v: any) => v.color_name === colorName)
        // Ensure hex is always a string or null, never an object
        let hexValue: string | null = null
        if (variant?.color_hex) {
          if (typeof variant.color_hex === 'string') {
            hexValue = variant.color_hex
          }
        }
        return {
          name: String(colorName),
          hex: hexValue,
        }
      })

      // Ensure all values are proper primitives
      const safeDescription = textile && typeof textile.description === 'string' 
        ? textile.description 
        : null
      const safeName = typeof product.name === 'string' ? product.name : String(product.name || 'Unbenannt')
      const safeTextileName = textile && typeof textile.name === 'string' 
        ? textile.name 
        : null
      const safeTextileBrand = textile && typeof textile.brand === 'string' 
        ? textile.brand 
        : null
      const safePrice = typeof product.calculated_vk_brutto === 'number' 
        ? product.calculated_vk_brutto 
        : parseFloat(product.calculated_vk_brutto) || 0

      return {
        id: String(product.id),
        name: safeName,
        description: safeDescription,
        imageUrl: imageUrl,
        colors: colorInfo,
        sizes: sizes,
        price: safePrice,
        textileName: safeTextileName,
        textileBrand: safeTextileBrand,
      }
    })

    // Generiere PDF mit PDFKit
    const pdfBuffer = await generatePdfWithPdfKit(school.name, productData)

    // Speichere PDF in Supabase Storage
    const timestamp = Date.now()
    const fileName = `angebot_${school.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pdf`
    const storagePath = `lead-configs/${configId}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('print-files')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return NextResponse.json(
        { error: 'Fehler beim Speichern des PDFs' },
        { status: 500 }
      )
    }

    // Erstelle öffentliche URL
    const { data: urlData } = supabaseAdmin.storage
      .from('print-files')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      pdfUrl: urlData.publicUrl,
      fileName: fileName,
      storagePath: storagePath,
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/[id]/generate-pdf:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
      errorString: String(error),
    })
    
    // Detaillierte Fehlerausgabe für Debugging
    const errorMessage = error.message || 'Unerwarteter Fehler'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? {
          message: errorMessage,
          stack: error.stack,
          name: error.name,
          cause: error.cause,
        }
      : undefined
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    )
  }
}

/**
 * Generiert ein PDF-Dokument mit PDFKit
 */
async function generatePdfWithPdfKit(
  schoolName: string,
  products: Array<{
    id: string
    name: string
    description?: string | null
    imageUrl?: string | null
    colors: Array<{ name: string; hex?: string | null }>
    sizes: string[]
    price: number
    textileName?: string | null
    textileBrand?: string | null
  }>
): Promise<Buffer> {
  // PDFKit ist ein CommonJS-Modul - verwende require() statt import()
  // @ts-ignore - PDFKit ist CommonJS und funktioniert nicht mit ES6-Import
  const PDFDocument = require('pdfkit')

  // Lade alle Bilder im Voraus
  const productImages: Map<number, Buffer | null> = new Map()
  await Promise.all(
    products.map(async (product, index) => {
      if (product.imageUrl) {
        try {
          const imageBuffer = await fetchImageAsBuffer(product.imageUrl)
          productImages.set(index, imageBuffer)
        } catch (error) {
          console.warn(`Could not load image for product ${product.name}:`, error)
          productImages.set(index, null)
        }
      } else {
        productImages.set(index, null)
      }
    })
  )

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    })

    const chunks: Buffer[] = []
    
    doc.on('data', (chunk) => {
      chunks.push(chunk)
    })

    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    doc.on('error', (error) => {
      reject(error)
    })

    // Hauptfarbe für Header
    const primaryColor = '#667eea'
    const textColor = '#333333'
    const lightGray = '#f5f5f5'
    const borderGray = '#e0e0e0'

    // Iteriere über alle Produkte
    products.forEach((product, index) => {
      // Neue Seite für jedes Produkt (außer dem ersten)
      if (index > 0) {
        doc.addPage()
      }

      // Header mit Schulname
      doc
        .fontSize(24)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text(schoolName, { align: 'left' })
        .moveDown(0.5)

      doc
        .fontSize(14)
        .fillColor('#666666')
        .font('Helvetica')
        .text(`Angebot - Seite ${index + 1} von ${products.length}`, { align: 'left' })
        .moveDown(1)

      // Trennlinie unter Header
      doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke()
        .moveDown(1.5)

      // Produktbild (falls vorhanden)
      const imageBuffer = productImages.get(index)
      if (imageBuffer) {
        try {
          doc.image(imageBuffer, {
            fit: [515, 200],
            align: 'center',
          })
          doc.moveDown(0.5)
        } catch (error) {
          console.warn(`Could not add image to PDF for product ${product.name}:`, error)
          // Weiter ohne Bild
        }
      }

      // Produktname
      doc
        .fontSize(20)
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .text(product.name, { align: 'left' })
        .moveDown(0.5)

      // Produktbeschreibung
      if (product.description) {
        doc
          .fontSize(11)
          .fillColor('#666666')
          .font('Helvetica')
          .text(product.description, {
            align: 'left',
            lineGap: 2,
          })
          .moveDown(0.5)
      }

      // Textil-Info
      let textileInfo = ''
      if (product.textileName) {
        textileInfo = product.textileName
      }
      if (product.textileBrand) {
        textileInfo = textileInfo 
          ? `${textileInfo} - ${product.textileBrand}` 
          : product.textileBrand
      }
      if (textileInfo) {
        doc
          .fontSize(11)
          .fillColor('#666666')
          .font('Helvetica')
          .text(textileInfo, { align: 'left' })
          .moveDown(0.5)
      }

      // Farben
      if (product.colors && product.colors.length > 0) {
        doc
          .fontSize(12)
          .fillColor(textColor)
          .font('Helvetica-Bold')
          .text('Verfügbare Farben:', { align: 'left' })
          .moveDown(0.3)

        const colorBoxSize = 30
        const colorBoxSpacing = 40
        const startX = 40
        let colorX = startX
        let colorY = doc.y
        const maxColorsPerRow = Math.floor(515 / colorBoxSpacing)
        let colorsInRow = 0

        product.colors.forEach((color, colorIndex) => {
          if (colorsInRow >= maxColorsPerRow) {
            colorX = startX
            colorY += colorBoxSize + 20
            colorsInRow = 0
          }

          // Farbbox zeichnen
          const hexColor = color.hex || '#cccccc'
          doc
            .rect(colorX, colorY, colorBoxSize, colorBoxSize)
            .fillColor(hexColor)
            .fill()
            .strokeColor(borderGray)
            .lineWidth(1)
            .rect(colorX, colorY, colorBoxSize, colorBoxSize)
            .stroke()

          // Farbname unter der Box
          doc
            .fontSize(9)
            .fillColor('#666666')
            .font('Helvetica')
            .text(color.name, colorX, colorY + colorBoxSize + 4, {
              width: colorBoxSize,
              align: 'center',
            })

          colorX += colorBoxSpacing
          colorsInRow++
        })

        // Setze Y-Position nach Farben
        doc.y = colorY + colorBoxSize + 25
        doc.moveDown(0.5)
      }

      // Größen
      if (product.sizes && product.sizes.length > 0) {
        doc
          .fontSize(12)
          .fillColor(textColor)
          .font('Helvetica-Bold')
          .text('Verfügbare Größen:', { align: 'left' })
          .moveDown(0.3)

        const sizeChipHeight = 20
        const sizeChipPadding = 8
        let sizeX = 40
        let sizeY = doc.y
        const maxSizesPerRow = 8
        let sizesInRow = 0

        product.sizes.forEach((size) => {
          if (sizesInRow >= maxSizesPerRow) {
            sizeX = 40
            sizeY += sizeChipHeight + 5
            sizesInRow = 0
          }

          const sizeTextWidth = doc.widthOfString(size, { fontSize: 10 }) + sizeChipPadding * 2

          // Größen-Chip zeichnen
          doc
            .roundedRect(sizeX, sizeY, sizeTextWidth, sizeChipHeight, 4)
            .fillColor(lightGray)
            .fill()
            .strokeColor(borderGray)
            .lineWidth(1)
            .roundedRect(sizeX, sizeY, sizeTextWidth, sizeChipHeight, 4)
            .stroke()

          // Größen-Text
          doc
            .fontSize(10)
            .fillColor(textColor)
            .font('Helvetica')
            .text(size, sizeX + sizeChipPadding, sizeY + 5, {
              width: sizeTextWidth - sizeChipPadding * 2,
              align: 'center',
            })

          sizeX += sizeTextWidth + 5
          sizesInRow++
        })

        // Setze Y-Position nach Größen
        doc.y = sizeY + sizeChipHeight + 10
        doc.moveDown(0.5)
      }

      // Preis-Box
      const priceBoxY = doc.y
      doc
        .roundedRect(40, priceBoxY, 515, 60, 4)
        .fillColor('#f8f9fa')
        .fill()
        .strokeColor(borderGray)
        .lineWidth(1)
        .roundedRect(40, priceBoxY, 515, 60, 4)
        .stroke()

      doc
        .fontSize(11)
        .fillColor('#666666')
        .font('Helvetica')
        .text('Verkaufspreis (inkl. MwSt.)', 40, priceBoxY + 10, {
          width: 515,
          align: 'left',
        })

      const priceText = `${product.price.toFixed(2)} €`
      doc
        .fontSize(28)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text(priceText, 40, priceBoxY + 25, {
          width: 515,
          align: 'left',
        })

      // Footer auf jeder Seite
      const footerY = 750
      doc
        .fontSize(9)
        .fillColor('#999999')
        .font('Helvetica')
        .text(
          `Seite ${index + 1} von ${products.length}`,
          40,
          footerY,
          {
            width: 515,
            align: 'center',
          }
        )

      // Trennlinie über Footer
      doc
        .strokeColor(borderGray)
        .lineWidth(1)
        .moveTo(40, footerY - 10)
        .lineTo(555, footerY - 10)
        .stroke()
    })

    // Finalisiere PDF
    doc.end()
  })
}

/**
 * Hilfsfunktion zum Laden von Bildern als Buffer
 */
async function fetchImageAsBuffer(imageUrl: string, timeoutMs = 8000): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(imageUrl, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Timeout while fetching image: ${imageUrl}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
