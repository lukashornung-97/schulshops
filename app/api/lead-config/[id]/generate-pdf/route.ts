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
      
      // Farben: bevorzugt vollständige Textil-Farbpalette, sonst Varianten
      const normalizeColorName = (value: any) => {
        if (typeof value === 'string') return value.trim()
        if (value && typeof value.name === 'string') return value.name.trim()
        return ''
      }

      const normalizeColorHex = (value: any): string | null => {
        if (typeof value === 'string') return value
        if (value && typeof value.hex === 'string') return value.hex
        if (value && typeof value.hex_code === 'string') return value.hex_code
        return null
      }

      const textileAvailableColors = Array.isArray(textile?.available_colors)
        ? textile.available_colors
        : []

      const normalizedAvailableColors = textileAvailableColors
        .map((c: any) => ({
          name: normalizeColorName(c),
          hex: normalizeColorHex(c),
        }))
        .filter((c: { name: string; hex: string | null }) => c.name.length > 0)

      // Falls keine Textilfarben vorhanden, nutze Variantenfarben
      const fallbackVariantColors = [...new Set(
        variants
          .map((v: any) => (typeof v.color_name === 'string' ? v.color_name.trim() : ''))
          .filter((c: string): c is string => c.length > 0)
      )].map((name) => ({ name, hex: null as string | null }))

      const colorsSource = normalizedAvailableColors.length > 0
        ? normalizedAvailableColors
        : fallbackVariantColors

      const variantColorSet = new Set(
        variants
          .map((v: any) => (typeof v.color_name === 'string' ? v.color_name.trim() : ''))
          .filter((c: string) => c.length > 0)
      )

      const colors = colorsSource.map((c: { name: string }) => c.name)
      // Normalize sizes (remove non-breaking spaces, collapse whitespace) and filter
      const normalizeSize = (value: any) => {
        if (typeof value !== 'string') return ''
        const cleaned = value
          // Entferne Zero-Width / Steuerzeichen, die Rendering verschieben können
          .replace(/[\u2000-\u200f\uFEFF]/g, '')
          // Vereinheitliche alle Whitespaces (inkl. NBSP) auf einfache Spaces
          .replace(/\s+/gu, ' ')
          .trim()
        // Entferne alle nicht-Text/zahl-Bestandteile (lässt gängige Größen wie 3XL, 4XL, XS, S, M, L, XL, XXL, XXXL zu)
        return cleaned.replace(/[^\p{L}\p{N}+\-./]/gu, '')
      }

      const sizes: string[] = [
        ...new Set<string>(
          variants
            .map((v: any) => normalizeSize(v.name))
            .filter(
              (n: string): n is string =>
                n.length > 0 && n !== 'Standard'
            )
        ),
      ]

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

      // Erstelle Farb-Info mit Hex-Werten: bevorzugt Textilfarben mit Hex, sonst Varianten-Hex
      const colorInfo = colorsSource.map((c: { name: string; hex?: string | null }) => {
        let hexValue = normalizeColorHex(c.hex)

        // Fallback: finde Hex aus Varianten, wenn nicht vorhanden
        if (!hexValue) {
          const variant = variants.find(
            (v: any) =>
              typeof v.color_name === 'string' &&
              v.color_name.trim() === c.name
          )
          if (variant?.color_hex && typeof variant.color_hex === 'string') {
            hexValue = variant.color_hex
          }
        }

        return {
          name: c.name,
          hex: hexValue,
          selected: variantColorSet.has(c.name),
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
    colors: Array<{ name: string; hex?: string | null; selected?: boolean }>
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
    
    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    doc.on('error', (error: Error) => {
      reject(error)
    })

    // Hauptfarbe für Header
    const primaryColor = '#667eea'
    const textColor = '#333333'
    const lightGray = '#f5f5f5'
    const borderGray = '#e0e0e0'
    const pageMargin = 40
    const contentWidth = 515
    const previewBoxWidth = Math.floor(contentWidth * 0.5) // Vorschau ~ halbe Seitenbreite
    const previewBoxHeight = 260
    const columnGutter = 20
    const leftColumnWidth = contentWidth - previewBoxWidth - columnGutter
    const leftColumnX = pageMargin
    const rightColumnX = leftColumnX + leftColumnWidth + columnGutter
    const cleanSizeForRender = (value: string) =>
      value
        .replace(/[\u2000-\u200f\uFEFF]/g, '')
        .replace(/\s+/gu, ' ')
        .trim()
        .replace(/[^\p{L}\p{N}+\-./]/gu, '')

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
        .moveTo(pageMargin, doc.y)
        .lineTo(pageMargin + contentWidth, doc.y)
        .stroke()
        .moveDown(1.5)

      // Ausgangsposition für zweispaltiges Layout
      const sectionTopY = doc.y

      // Vorschaubild rechts in einem Kasten
      const previewBoxY = sectionTopY
      doc
        .roundedRect(
          rightColumnX,
          previewBoxY,
          previewBoxWidth,
          previewBoxHeight,
          6
        )
        .fillColor('#fafafa')
        .fill()
        .strokeColor(borderGray)
        .lineWidth(1)
        .roundedRect(
          rightColumnX,
          previewBoxY,
          previewBoxWidth,
          previewBoxHeight,
          6
        )
        .stroke()

      // Produktbild (falls vorhanden) in der Box anzeigen
      const imageBuffer = productImages.get(index)
      if (imageBuffer) {
        try {
          doc.image(imageBuffer, rightColumnX + 6, previewBoxY + 6, {
            fit: [previewBoxWidth - 12, previewBoxHeight - 12],
            align: 'center',
            valign: 'center',
          })
        } catch (error) {
          console.warn(`Could not add image to PDF for product ${product.name}:`, error)
          // Weiter ohne Bild
        }
      } else {
        doc
          .fontSize(10)
          .fillColor('#999999')
          .font('Helvetica')
          .text(
            'Keine Vorschau verfügbar',
            rightColumnX + 10,
            previewBoxY + previewBoxHeight / 2 - 5,
            {
              width: previewBoxWidth - 20,
              align: 'center',
            }
          )
      }

      // Linke Spalte: Preis oben, darunter Größen, dann Farben
      // Preis-Box direkt unter dem Headerbereich
      const priceBoxX = leftColumnX
      const priceBoxWidth = leftColumnWidth
      const priceBoxY = sectionTopY
      doc
        .roundedRect(priceBoxX, priceBoxY, priceBoxWidth, 60, 4)
        .fillColor('#f8f9fa')
        .fill()
        .strokeColor(borderGray)
        .lineWidth(1)
        .roundedRect(priceBoxX, priceBoxY, priceBoxWidth, 60, 4)
        .stroke()

      doc
        .fontSize(11)
        .fillColor('#666666')
        .font('Helvetica')
        .text('Verkaufspreis (inkl. MwSt.)', priceBoxX + 10, priceBoxY + 10, {
          width: priceBoxWidth - 20,
          align: 'left',
        })

      const priceText = `${product.price.toFixed(2)} €`
      doc
        .fontSize(28)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text(priceText, priceBoxX + 10, priceBoxY + 25, {
          width: priceBoxWidth - 20,
          align: 'left',
        })

      // Position nach Preisbox
      doc.y = priceBoxY + 60 + 10

      // Größen
      if (product.sizes && product.sizes.length > 0) {
        doc
          .fontSize(12)
          .fillColor(textColor)
          .font('Helvetica-Bold')
          .text('Verfügbare Größen:', leftColumnX, doc.y, {
            width: leftColumnWidth,
            align: 'left',
          })
          .moveDown(0.3)

        const sizeChipHeight = 20
        const sizeChipPadding = 8
        let sizeX = leftColumnX
        let sizeY = doc.y
        const maxRowWidth = leftColumnX + leftColumnWidth

        product.sizes.forEach((sizeRaw) => {
          const size = cleanSizeForRender(sizeRaw)
          if (!size) {
            return
          }

          doc.fontSize(10).font('Helvetica')
          const rawTextWidth = doc.widthOfString(size)
          const sizeTextWidth = rawTextWidth + sizeChipPadding * 2

          if (sizeX + sizeTextWidth > maxRowWidth) {
            sizeX = leftColumnX
            sizeY += sizeChipHeight + 5
          }

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
          const textHeight = doc.currentLineHeight()
          const textX = sizeX + (sizeTextWidth - rawTextWidth) / 2
          const textY = sizeY + (sizeChipHeight - textHeight) / 2
          doc
            .fontSize(10)
            .fillColor(textColor)
            .font('Helvetica')
            .text(size, textX, textY + 0.5) // kleiner Ausgleich für font ascent/descent

          sizeX += sizeTextWidth + 5
        })

        // Setze Y-Position nach Größen
        doc.y = sizeY + sizeChipHeight + 10
        doc.moveDown(0.5)
      }

      // Farben (nach Größen)
      if (product.colors && product.colors.length > 0) {
        doc
          .fontSize(12)
          .fillColor(textColor)
          .font('Helvetica-Bold')
          .text('Verfügbare Farben:', leftColumnX, doc.y, {
            width: leftColumnWidth,
            align: 'left',
          })
          .moveDown(0.3)

        const colorBoxSize = 30
        const colorBoxSpacing = 40
        const startX = leftColumnX
        let colorX = startX
        let colorY = doc.y
        const maxColorsPerRow = 6
        let colorsInRow = 0

        product.colors.forEach((color) => {
          if (colorsInRow >= maxColorsPerRow) {
            colorX = startX
            colorY += colorBoxSize + 20
            colorsInRow = 0
          }

          // Farbbox zeichnen (rund) und ausgewählte Farbe highlighten
          const hexColor = color.hex || '#cccccc'
          const radius = colorBoxSize / 2
          const centerX = colorX + radius
          const centerY = colorY + radius

          doc
            .circle(centerX, centerY, radius)
            .fillColor(hexColor)
            .fill()

          if (color.selected) {
            doc
              .strokeColor(primaryColor)
              .lineWidth(2)
              .circle(centerX, centerY, radius)
              .stroke()
          } else {
            doc
              .strokeColor(borderGray)
              .lineWidth(1)
              .circle(centerX, centerY, radius)
              .stroke()
          }

          // Farbname unter der Box
          doc
            .fontSize(6)
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

      // Unterkante der zweispaltigen Sektion
      const sectionBottomY = Math.max(doc.y, previewBoxY + previewBoxHeight)
      doc.y = sectionBottomY + 10

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
