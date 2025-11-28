import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface OrderRow {
  'Name'?: string // Order number (e.g., "#2016")
  'Customer Name'?: string
  'Customer: First name'?: string
  'Customer: Last name'?: string
  'Customer Email'?: string
  'Email'?: string
  'Class Name'?: string
  'Klasse'?: string
  'Line items: Custom attributes Klasse'?: string
  'Product Name'?: string
  'Line items: Title'?: string
  'Product Variant'?: string
  'Line items: Variant title'?: string
  'Quantity'?: string
  'Line items: Quantity'?: string
  'Unit Price'?: string
  'Line items: Price'?: string
  'Total Amount'?: string
  'Total'?: string
  'Order Date'?: string
  'Created at'?: string
  'Created at (UTC)'?: string
  'Line items: Product Tags'?: string
}

interface ParsedOrder {
  customerName: string
  customerEmail: string | null
  className: string | null
  items: Array<{
    productName: string
    variantName: string | null
    quantity: number
    unitPrice: number
  }>
  totalAmount: number
  orderDate: string | null
}

/**
 * Konvertiere Excel-Datum zu ISO-String
 * Excel-Datum kann sein: Excel-Serial-Nummer, Date-Objekt, oder String
 */
function excelDateToISO(dateValue: any): string | null {
  if (!dateValue) return null
  
  // Wenn bereits ein String, versuche zu parsen
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
    return dateValue // Falls Parsing fehlschlägt, gib String zurück
  }
  
  // Wenn Date-Objekt
  if (dateValue instanceof Date) {
    return dateValue.toISOString()
  }
  
  // Wenn Zahl (Excel Serial Number)
  if (typeof dateValue === 'number') {
    // Excel-Datum ist die Anzahl der Tage seit dem 30. Dezember 1899
    const excelEpoch = new Date(1899, 11, 30) // 30. Dezember 1899
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
    return date.toISOString()
  }
  
  return null
}

/**
 * API Route zum Hochladen von CSV-Bestellungen für einen Shop
 * POST /api/shops/[id]/upload-orders
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shopId = params.id

    if (!shopId) {
      return NextResponse.json(
        { error: 'Shop-ID fehlt' },
        { status: 400 }
      )
    }

    // Prüfe ob Shop existiert
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', shopId)
      .single()

    if (shopError || !shop) {
      return NextResponse.json(
        { error: 'Shop nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade CSV-Datei aus Request
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }

    // Prüfe Dateityp
    const isCSV = file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text/csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || 
                     file.type.includes('spreadsheet') || file.type.includes('excel')
    
    if (!isCSV && !isExcel) {
      return NextResponse.json(
        { error: 'Nur CSV- oder Excel-Dateien (.xlsx, .xls) sind erlaubt' },
        { status: 400 }
      )
    }

    // Lade alle Produkte des Shops für Matching
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, base_price')
      .eq('shop_id', shopId)
      .eq('active', true)

    if (productsError) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Produkte' },
        { status: 500 }
      )
    }

    // Lade alle Varianten
    const productIds = products?.map(p => p.id) || []
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, name, additional_price')
      .in('product_id', productIds)
      .eq('active', true)

    // Erstelle Maps für schnelles Lookup
    const productsMap = new Map(products?.map(p => [p.name.toLowerCase().trim(), p]) || [])
    const variantsMap = new Map<string, NonNullable<typeof variants>[0]>()
    variants?.forEach(v => {
      const key = `${v.product_id}-${v.name.toLowerCase().trim()}`
      variantsMap.set(key, v)
    })

    // Parse file (CSV or Excel)
    let rows: OrderRow[] = []
    
    if (isExcel) {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json<OrderRow>(worksheet, { defval: '' })
    } else {
      // Parse CSV file
      const csvText = await file.text()
      await new Promise<void>((resolve, reject) => {
        Papa.parse<OrderRow>(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            rows = results.data
            resolve()
          },
          error: (error) => {
            reject(new Error(`Fehler beim Parsen der CSV-Datei: ${error.message}`))
          },
        })
      })
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Datei ist leer' },
        { status: 400 }
      )
    }

    // Gruppiere Zeilen nach Bestellung
    // Wenn "Name" (Order Number) vorhanden ist, gruppiere danach, sonst nach Kunde
    const ordersMap = new Map<string, ParsedOrder>()

    for (const row of rows) {
      // Prüfe ob Order Number vorhanden ist (wie in Excel-Datei)
      const orderNumber = row['Name']
      
      let orderKey: string
      let customerName: string
      let customerEmail: string | null
      let className: string | null
      let orderDate: string | null

      if (orderNumber) {
        // Gruppiere nach Order Number (wie in Excel-Datei)
        orderKey = orderNumber.toString()
        
        // Extrahiere Kundendaten aus erster Zeile dieser Bestellung
        customerName = 
          row['Customer Name'] ||
          (row['Customer: First name'] && row['Customer: Last name']
            ? `${row['Customer: First name']} ${row['Customer: Last name']}`
            : '') ||
          ''
        
        customerEmail = row['Customer Email'] || row['Email'] || null
        className = row['Class Name'] || row['Klasse'] || row['Line items: Custom attributes Klasse'] || null
        const rawOrderDate1 = row['Order Date'] || row['Created at'] || row['Created at (UTC)'] || null
        orderDate = rawOrderDate1 ? excelDateToISO(rawOrderDate1) : null
      } else {
        // Fallback: Gruppiere nach Kunde (für CSV ohne Order Number)
        customerName = 
          row['Customer Name'] ||
          (row['Customer: First name'] && row['Customer: Last name']
            ? `${row['Customer: First name']} ${row['Customer: Last name']}`
            : '') ||
          ''

        if (!customerName.trim()) {
          continue // Überspringe Zeilen ohne Kundennamen
        }

        customerEmail = row['Customer Email'] || row['Email'] || null
        className = row['Class Name'] || row['Klasse'] || row['Line items: Custom attributes Klasse'] || null
        const rawOrderDate = row['Order Date'] || row['Created at'] || row['Created at (UTC)'] || null
        orderDate = rawOrderDate ? excelDateToISO(rawOrderDate) : null
        
        // Erstelle eindeutigen Schlüssel für Bestellung
        orderKey = `${customerName}-${customerEmail || 'no-email'}-${className || 'no-class'}`
      }

      if (!orderKey) {
        continue // Überspringe ungültige Zeilen
      }

      // Wenn Order Number vorhanden, aber kein Customer Name in dieser Zeile, hole aus bestehender Order
      if (orderNumber && !customerName.trim() && ordersMap.has(orderKey)) {
        const existingOrder = ordersMap.get(orderKey)!
        customerName = existingOrder.customerName
        customerEmail = existingOrder.customerEmail
        className = existingOrder.className
        orderDate = existingOrder.orderDate
      }

      if (!orderNumber && !customerName.trim()) {
        continue // Überspringe ungültige Zeilen ohne Order Number und ohne Customer Name
      }

      if (!ordersMap.has(orderKey)) {
        ordersMap.set(orderKey, {
          customerName: customerName.trim() || 'Unbekannt',
          customerEmail: customerEmail ? (typeof customerEmail === 'string' ? customerEmail.trim() : String(customerEmail)) : null,
          className: className ? (typeof className === 'string' ? className.trim() : String(className)) : null,
          items: [],
          totalAmount: 0,
          orderDate: orderDate,
        })
      }

      const order = ordersMap.get(orderKey)!

      // Extrahiere Produktdaten
      let productName = row['Product Name'] || row['Line items: Title'] || ''
      
      // Entferne Schulname aus Product Title falls vorhanden (Format: "Product Name | School Name")
      if (productName.includes('|')) {
        productName = productName.split('|')[0].trim()
      }
      
      const variantName = row['Product Variant'] || row['Line items: Variant title'] || null
      const quantityStr = row['Quantity'] || row['Line items: Quantity'] || '1'
      const quantity = parseInt(quantityStr.toString().replace(/[^\d]/g, '')) || 1
      const unitPriceStr = row['Unit Price'] || row['Line items: Price'] || '0'
      const unitPrice = parseFloat(unitPriceStr.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0

      if (!productName.trim() || quantity <= 0) {
        continue // Überspringe ungültige Zeilen
      }

      // Finde Produkt (versuche exakte Übereinstimmung und Teilübereinstimmung)
      const normalizedProductName = productName.toLowerCase().trim()
      let product = productsMap.get(normalizedProductName)
      
      // Falls nicht gefunden, versuche Teilübereinstimmung
      if (!product) {
        for (const [key, prod] of productsMap.entries()) {
          if (normalizedProductName.includes(key) || key.includes(normalizedProductName)) {
            product = prod
            break
          }
        }
      }
      
      if (!product) {
        // Produkt nicht gefunden - überspringe oder erstelle Warnung
        continue
      }

      // Finde Variante falls vorhanden
      let variantId = null
      let finalPrice = unitPrice || product.base_price

      if (variantName) {
        const variantKey = `${product.id}-${variantName.toLowerCase().trim()}`
        const variant = variantsMap.get(variantKey)
        if (variant) {
          variantId = variant.id
          finalPrice = product.base_price + (variant.additional_price || 0)
        }
      }

      // Verwende Preis aus Datei falls vorhanden, sonst berechne
      if (unitPrice > 0) {
        finalPrice = unitPrice
      }

      order.items.push({
        productName: productName.trim(),
        variantName: variantName?.trim() || null,
        quantity,
        unitPrice: finalPrice,
      })

      order.totalAmount += finalPrice * quantity
    }

    // Erstelle Bestellungen in Datenbank
    const createdOrders = []
    const errors = []

    for (const [orderKey, orderData] of ordersMap) {
      try {
        // Formatiere total_amount für numeric(10,2) - runde auf 2 Dezimalstellen
        const totalAmount = Math.round(orderData.totalAmount * 100) / 100
        
        // Erstelle Order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert([{
            shop_id: shopId,
            customer_name: orderData.customerName,
            customer_email: orderData.customerEmail || null,
            class_name: orderData.className || null,
            status: 'pending',
            total_amount: totalAmount,
            created_at: orderData.orderDate || new Date().toISOString(),
          }])
          .select()
          .single()

        if (orderError) {
          console.error('Order insertion error:', orderError)
          errors.push({ orderKey, error: orderError.message })
          continue
        }

        // Prüfe ob Order erfolgreich erstellt wurde
        if (!order) {
          errors.push({ orderKey, error: 'Order wurde nicht erstellt' })
          continue
        }

        // Erstelle Order Items
        const orderItems = []
        for (const item of orderData.items) {
          const product = productsMap.get(item.productName.toLowerCase().trim())
          if (!product) continue

          let variantId = null
          if (item.variantName) {
            const variantKey = `${product.id}-${item.variantName.toLowerCase().trim()}`
            const variant = variantsMap.get(variantKey)
            if (variant) {
              variantId = variant.id
            }
          }

          // Stelle sicher, dass quantity ein Integer ist
          const quantity = Math.floor(Math.abs(item.quantity)) || 1
          
          // Formatiere Preise für numeric(10,2) - runde auf 2 Dezimalstellen
          const unitPrice = Math.round(item.unitPrice * 100) / 100
          const lineTotal = Math.round(unitPrice * quantity * 100) / 100

          orderItems.push({
            order_id: order.id,
            product_id: product.id,
            variant_id: variantId,
            quantity: quantity,
            unit_price: unitPrice,
            line_total: lineTotal,
          })
        }

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems)

          if (itemsError) {
            console.error('Order items insertion error:', itemsError)
            errors.push({ orderKey, error: `Order Items: ${itemsError.message}` })
            // Lösche Order falls Items nicht erstellt werden konnten
            await supabase.from('orders').delete().eq('id', order.id)
            continue
          }
        } else {
          // Wenn keine Items vorhanden sind, lösche die Order
          console.warn(`Order ${orderKey} hat keine Items, lösche Order`)
          await supabase.from('orders').delete().eq('id', order.id)
          errors.push({ orderKey, error: 'Order hat keine gültigen Items' })
          continue
        }

        createdOrders.push({
          id: order.id,
          customerName: orderData.customerName,
          totalAmount: totalAmount,
          itemCount: orderItems.length,
        })
      } catch (error: any) {
        console.error(`Error processing order ${orderKey}:`, error)
        errors.push({ orderKey, error: error.message })
      }
            }

    return NextResponse.json({
      success: true,
      imported: createdOrders.length,
      skipped: ordersMap.size - createdOrders.length,
      orders: createdOrders,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Error uploading orders:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Hochladen der Bestellungen' },
      { status: 500 }
    )
  }
}

