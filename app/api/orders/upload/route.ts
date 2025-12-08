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
  'Subtotal price'?: string // Neues Feld für Gesamtpreis
  'Order Date'?: string
  'Created at'?: string
  'Created at (UTC)'?: string
  'Line items: Product Tags'?: string
}

interface ParsedOrder {
  orderNumber: string | null // Order Number aus "Name" Feld
  shopId: string | null
  customerName: string
  customerEmail: string | null
  className: string | null
  items: Array<{
    productName: string
    variantName: string | null // Original variant title
    size: string | null // Größe (vor dem /)
    color: string | null // Farbe (nach dem /)
    quantity: number
    unitPrice: number
    productTags?: string
  }>
  totalAmount: number
  totalPriceFromFile: number | null // Total price aus Excel-Datei
  orderDate: string | null
}

/**
 * Konvertiere Excel-Datum zu ISO-String
 */
function excelDateToISO(dateValue: any): string | null {
  if (!dateValue) return null
  
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
    return dateValue
  }
  
  if (dateValue instanceof Date) {
    return dateValue.toISOString()
  }
  
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
    return date.toISOString()
  }
  
  return null
}

/**
 * Normalisiere String für Vergleich (lowercase, trim)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str.toLowerCase().trim()
}

/**
 * Extrahiere alle Product Tags als Array
 * Behandelt auch Tags mit Kommas innerhalb (z.B. "hegy, Helfenstein-Gymnasium-Geislingen")
 */
function extractAllProductTags(productTags: string | null | undefined): string[] {
  if (!productTags) return []
  
  // Teile nach Kommas, aber behandle auch einzelne Tags
  const tags = productTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
  
  // Wenn ein Tag selbst Kommas enthält (z.B. "hegy, Helfenstein-Gymnasium-Geislingen"),
  // versuche es weiter aufzuteilen, aber behalte auch den ganzen String
  const expandedTags: string[] = []
  tags.forEach(tag => {
    expandedTags.push(tag) // Füge den ganzen Tag hinzu
    // Wenn der Tag Leerzeichen oder Bindestriche enthält, könnte es mehrere Tags sein
    if (tag.includes(' ') || tag.includes('-')) {
      // Versuche auch einzelne Wörter als Tags zu behandeln
      const words = tag.split(/[\s,-]+/).filter(w => w.length > 2) // Nur Wörter mit mehr als 2 Zeichen
      expandedTags.push(...words)
    }
  })
  
  return Array.from(new Set(expandedTags)) // Entferne Duplikate
}

/**
 * Finde Shop anhand von Product Tags (matcht auf shop slug, name, school short_code)
 */
function findShopByProductTags(
  shops: Array<{ 
    id: string
    slug: string
    name: string
    schoolShortCode?: string | null
    schoolName?: string | null
  }>, 
  productTags: string | null | undefined
): string | null {
  if (!productTags) return null
  
  const tags = extractAllProductTags(productTags)
  if (tags.length === 0) return null
  
  // PRIORITÄT 1: Versuche exaktes Matching mit slug
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag)
    const shop = shops.find(s => {
      const normalizedSlug = normalizeString(s.slug)
      return normalizedSlug === normalizedTag
    })
    if (shop) {
      console.log(`✓ Exaktes Match (Slug): Tag "${tag}" → Shop "${shop.name}" (Slug: ${shop.slug})`)
      return shop.id
    }
  }
  
  // PRIORITÄT 2: Versuche Matching mit School Short Code
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag)
    const shop = shops.find(s => {
      if (s.schoolShortCode) {
        const normalizedShortCode = normalizeString(s.schoolShortCode)
        return normalizedShortCode === normalizedTag || normalizedShortCode.includes(normalizedTag) || normalizedTag.includes(normalizedShortCode)
      }
      return false
    })
    if (shop) {
      console.log(`✓ Match (School Short Code): Tag "${tag}" → Shop "${shop.name}" (School: ${shop.schoolShortCode})`)
      return shop.id
    }
  }
  
  // PRIORITÄT 3: Versuche Teilübereinstimmung mit slug (Tag enthält Slug oder umgekehrt)
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag)
    const shop = shops.find(s => {
      const normalizedSlug = normalizeString(s.slug)
      // Tag enthält Slug oder Slug enthält Tag
      if (normalizedSlug.includes(normalizedTag) || normalizedTag.includes(normalizedSlug)) {
        return true
      }
      // Auch prüfen ob Tag Teil des Slugs ist (z.B. "weinstadt" in "shop-weinstadt-2024")
      const slugParts = normalizedSlug.split('-')
      if (slugParts.some(part => normalizeString(part) === normalizedTag)) {
        return true
      }
      return false
    })
    if (shop) {
      console.log(`✓ Teilübereinstimmung (Slug): Tag "${tag}" → Shop "${shop.name}" (Slug: ${shop.slug})`)
      return shop.id
    }
  }
  
  // PRIORITÄT 4: Versuche auch mit Shop-Name zu matchen (falls Slug nicht passt)
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag)
    const shop = shops.find(s => {
      const normalizedName = normalizeString(s.name)
      return normalizedName.includes(normalizedTag) || normalizedTag.includes(normalizedName)
    })
    if (shop) {
      console.log(`✓ Match via Name: Tag "${tag}" → Shop "${shop.name}"`)
      return shop.id
    }
  }
  
  // PRIORITÄT 5: Versuche mit School Name zu matchen
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag)
    const shop = shops.find(s => {
      if (s.schoolName) {
        const normalizedSchoolName = normalizeString(s.schoolName)
        return normalizedSchoolName.includes(normalizedTag) || normalizedTag.includes(normalizedSchoolName)
      }
      return false
    })
    if (shop) {
      console.log(`✓ Match via School Name: Tag "${tag}" → Shop "${shop.name}" (School: ${shop.schoolName})`)
      return shop.id
    }
  }
  
  // Debug: Zeige verfügbare Shops und Tags für besseres Troubleshooting
  const availableSlugs = shops.map(s => s.slug).join(', ')
  const availableNames = shops.map(s => s.name).join(', ')
  const availableShortCodes = shops.map(s => s.schoolShortCode).filter(Boolean).join(', ')
  console.warn(`✗ Kein Shop gefunden für Tags: "${tags.join(', ')}"`)
  console.warn(`  Verfügbare Slugs: ${availableSlugs}`)
  console.warn(`  Verfügbare Names: ${availableNames}`)
  console.warn(`  Verfügbare Short Codes: ${availableShortCodes}`)
  return null
}

/**
 * API Route zum Hochladen von Bestellungen für alle Shops
 * POST /api/orders/upload
 * Ordnet Bestellungen automatisch Shops zu basierend auf Product Tags
 */
export async function POST(request: NextRequest) {
  try {
    // Lade alle Shops
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id, slug, name, school_id')
    
    if (shopsError) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Shops' },
        { status: 500 }
      )
    }

    if (!shops || shops.length === 0) {
      return NextResponse.json(
        { error: 'Keine Shops gefunden. Bitte erstellen Sie zuerst einen Shop.' },
        { status: 400 }
      )
    }

    // Lade alle Schulen für besseres Matching
    const schoolIds = Array.from(new Set(shops.map(s => s.school_id).filter(Boolean)))
    const { data: schools } = schoolIds.length > 0 ? await supabase
      .from('schools')
      .select('id, short_code, name')
      .in('id', schoolIds) : { data: null }
    
    const schoolsMap = new Map(schools?.map(s => [s.id, s]) || [])
    
    // Erstelle erweiterte Shop-Liste mit School-Informationen
    const shopsWithSchool = shops.map(s => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      schoolShortCode: schoolsMap.get(s.school_id)?.short_code || null,
      schoolName: schoolsMap.get(s.school_id)?.name || null,
    }))
    
    console.log(`Geladene Shops:`, shopsWithSchool.map(s => `${s.name} (Slug: ${s.slug}, School: ${s.schoolName || 'N/A'}, Short Code: ${s.schoolShortCode || 'N/A'})`))

    if (shopsError) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Shops' },
        { status: 500 }
      )
    }

    if (!shops || shops.length === 0) {
      return NextResponse.json(
        { error: 'Keine Shops gefunden. Bitte erstellen Sie zuerst einen Shop.' },
        { status: 400 }
      )
    }

    // Lade Datei aus Request
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

    // Parse file (CSV or Excel)
    let rows: OrderRow[] = []
    
    if (isExcel) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json<OrderRow>(worksheet, { defval: '' })
    } else {
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
    const ordersMap = new Map<string, ParsedOrder>()

    for (const row of rows) {
      const orderNumber = row['Name']
      const productTags = row['Line items: Product Tags'] || ''
      
      // Finde Shop basierend auf Product Tags
      const shopId = findShopByProductTags(shopsWithSchool, productTags)
      
      // Debug: Zeige Shop-Matching
      if (productTags && shopId) {
        const shopName = shopsWithSchool.find(s => s.id === shopId)?.name || 'Unbekannt'
        console.log(`Product Tags "${productTags}" → Shop: ${shopName} (${shopId})`)
      } else if (productTags && !shopId) {
        // Warnung wird bereits in findShopByProductTags ausgegeben
      }
      
      let orderKey: string
      let customerName: string
      let customerEmail: string | null
      let className: string | null
      let orderDate: string | null
      let totalPriceFromFile: number | null = null

      // Extrahiere Total Price aus Datei falls vorhanden
      const totalPriceStr = row['Subtotal price'] || row['Total Amount'] || row['Total'] || null
      if (totalPriceStr) {
        totalPriceFromFile = parseFloat(totalPriceStr.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || null
      }

      if (orderNumber) {
        // Gruppiere nach Order Number
        orderKey = orderNumber.toString()
        
        customerName = 
          row['Customer Name'] ||
          (row['Customer: First name'] && row['Customer: Last name']
            ? `${row['Customer: First name']} ${row['Customer: Last name']}`
            : '') ||
          ''
        
        customerEmail = row['Customer Email'] || row['Email'] || null
        className = row['Class Name'] || row['Klasse'] || row['Line items: Custom attributes Klasse'] || null
        const rawOrderDate = row['Order Date'] || row['Created at'] || row['Created at (UTC)'] || null
        orderDate = rawOrderDate ? excelDateToISO(rawOrderDate) : null
      } else {
        // Fallback: Gruppiere nach Kunde
        customerName = 
          row['Customer Name'] ||
          (row['Customer: First name'] && row['Customer: Last name']
            ? `${row['Customer: First name']} ${row['Customer: Last name']}`
            : '') ||
          ''

        if (!customerName.trim()) {
          continue
        }

        customerEmail = row['Customer Email'] || row['Email'] || null
        className = row['Class Name'] || row['Klasse'] || row['Line items: Custom attributes Klasse'] || null
        const rawOrderDate = row['Order Date'] || row['Created at'] || row['Created at (UTC)'] || null
        orderDate = rawOrderDate ? excelDateToISO(rawOrderDate) : null
        
        orderKey = `${customerName}-${customerEmail || 'no-email'}-${className || 'no-class'}`
      }

      if (!orderKey || (!orderNumber && !customerName.trim())) {
        continue
      }

      // Wenn Order Number vorhanden, aber kein Customer Name in dieser Zeile, hole aus bestehender Order
      if (orderNumber && !customerName.trim() && ordersMap.has(orderKey)) {
        const existingOrder = ordersMap.get(orderKey)!
        customerName = existingOrder.customerName
        customerEmail = existingOrder.customerEmail
        className = existingOrder.className
        orderDate = existingOrder.orderDate
        // Verwende shopId aus bestehender Order, oder setze neu gefundenen
        if (!existingOrder.shopId && shopId) {
          existingOrder.shopId = shopId
        }
        // Verwende shopId aus bestehender Order für diese Zeile
        if (existingOrder.shopId) {
          // Shop bereits zugeordnet, weiter mit Items
        }
      }

      if (!orderNumber && !customerName.trim()) {
        continue
      }

      if (!ordersMap.has(orderKey)) {
        ordersMap.set(orderKey, {
          orderNumber: orderNumber || null,
          shopId: shopId,
          customerName: customerName.trim() || 'Unbekannt',
          customerEmail: customerEmail ? (typeof customerEmail === 'string' ? customerEmail.trim() : String(customerEmail)) : null,
          className: className ? (typeof className === 'string' ? className.trim() : String(className)) : null,
          items: [],
          totalAmount: 0,
          totalPriceFromFile: totalPriceFromFile,
          orderDate: orderDate,
        })
      }

      const order = ordersMap.get(orderKey)!

      // Aktualisiere totalPriceFromFile falls vorhanden (nimm den letzten/höchsten Wert)
      if (totalPriceFromFile !== null && (order.totalPriceFromFile === null || totalPriceFromFile > (order.totalPriceFromFile || 0))) {
        order.totalPriceFromFile = totalPriceFromFile
      }

      // Wenn shopId noch nicht gesetzt, versuche es jetzt zu setzen (aus dieser Zeile)
      if (!order.shopId && shopId) {
        order.shopId = shopId
        console.log(`Shop-ID für Order ${orderKey} gesetzt: ${shopId}`)
      } else if (!order.shopId) {
        // Versuche Shop aus Product Tags dieser Zeile zu finden
        const shopIdFromTags = findShopByProductTags(shopsWithSchool, productTags)
        if (shopIdFromTags) {
          order.shopId = shopIdFromTags
          console.log(`Shop-ID für Order ${orderKey} aus Tags gesetzt: ${shopIdFromTags}`)
        }
      }

      // Extrahiere Produktdaten
      let productName = row['Product Name'] || row['Line items: Title'] || ''
      
      if (productName.includes('|')) {
        productName = productName.split('|')[0].trim()
      }
      
      const variantTitle = row['Product Variant'] || row['Line items: Variant title'] || null
      const quantityStr = row['Quantity'] || row['Line items: Quantity'] || '1'
      const quantity = parseInt(quantityStr.toString().replace(/[^\d]/g, '')) || 1
      const unitPriceStr = row['Unit Price'] || row['Line items: Price'] || '0'
      const unitPrice = parseFloat(unitPriceStr.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0

      if (!productName.trim() || quantity <= 0) {
        continue
      }

      // Parse Variante: Format "Größe / Farbe" (z.B. "M / Schwarz")
      let size: string | null = null
      let color: string | null = null
      
      if (variantTitle) {
        const variantParts = variantTitle.toString().split('/').map(s => s.trim())
        if (variantParts.length >= 2) {
          size = variantParts[0] || null
          color = variantParts[1] || null
        } else if (variantParts.length === 1) {
          // Falls kein / vorhanden, versuche zu erkennen ob es Größe oder Farbe ist
          const singleValue = variantParts[0]
          // Typische Größen: S, M, L, XL, XXL, etc.
          if (/^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i.test(singleValue)) {
            size = singleValue
          } else {
            // Vermutlich eine Farbe
            color = singleValue
          }
        }
      }

      // Berechne Preis (vereinfacht, da wir Produkte nicht matchen müssen)
      const finalPrice = unitPrice > 0 ? unitPrice : 0

      order.items.push({
        productName: productName.trim(),
        variantName: variantTitle?.trim() || null,
        size: size,
        color: color,
        quantity,
        unitPrice: finalPrice,
        productTags: productTags || undefined,
      })

      order.totalAmount += finalPrice * quantity
    }

    // OPTIMIERUNG: Lade alle Daten auf einmal statt pro Order
    const shopIds = Array.from(new Set(Array.from(ordersMap.values()).map(o => o.shopId).filter(Boolean) as string[]))
    
    // Lade alle Produkte für alle betroffenen Shops auf einmal
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, base_price, shop_id')
      .in('shop_id', shopIds)
      .eq('active', true)
    
    // Gruppiere Produkte nach Shop
    const productsByShop = new Map<string, typeof allProducts>()
    allProducts?.forEach(p => {
      if (!productsByShop.has(p.shop_id)) {
        productsByShop.set(p.shop_id, [])
      }
      productsByShop.get(p.shop_id)!.push(p)
    })
    
    // Lade alle Varianten auf einmal
    const allProductIds = allProducts?.map(p => p.id) || []
    const { data: allVariants } = allProductIds.length > 0 ? await supabase
      .from('product_variants')
      .select('id, product_id, name, color_name, additional_price')
      .in('product_id', allProductIds)
      .eq('active', true) : { data: null }
    
    // Lade alle bestehenden Orders für alle betroffenen Shops auf einmal
    const { data: allExistingOrders } = shopIds.length > 0 ? await supabase
      .from('orders')
      .select('id, shop_id, customer_name, customer_email, total_amount, created_at')
      .in('shop_id', shopIds) : { data: null }
    
    // Lade alle bestehenden Order Items auf einmal
    const existingOrderIds = allExistingOrders?.map(o => o.id) || []
    const { data: allExistingItems } = existingOrderIds.length > 0 ? await supabase
      .from('order_items')
      .select('id, order_id, product_id, variant_id, quantity, unit_price')
      .in('order_id', existingOrderIds) : { data: null }
    
    // Erstelle Maps für schnelles Lookup
    const existingOrdersMap = new Map<string, typeof allExistingOrders[0]>()
    allExistingOrders?.forEach(order => {
      // Erstelle Key basierend auf Shop, Customer Name, Email und Date (ungefähr)
      const orderDate = new Date(order.created_at)
      const dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth()}-${orderDate.getDate()}`
      const key = `${order.shop_id}-${order.customer_name}-${order.customer_email || ''}-${dateKey}`
      // Speichere die neueste Order für diesen Key
      if (!existingOrdersMap.has(key) || new Date(order.created_at) > new Date(existingOrdersMap.get(key)!.created_at)) {
        existingOrdersMap.set(key, order)
      }
    })
    
    const existingItemsByOrderId = new Map<string, typeof allExistingItems>()
    allExistingItems?.forEach(item => {
      if (!existingItemsByOrderId.has(item.order_id)) {
        existingItemsByOrderId.set(item.order_id, [])
      }
      existingItemsByOrderId.get(item.order_id)!.push(item)
    })
    
    // Erstelle Varianten-Map für alle Shops
    const variantsMap = new Map<string, NonNullable<typeof allVariants>[0]>()
    allVariants?.forEach(v => {
      // Erstelle Keys für Kombinations-Varianten (Größe + Farbe)
      if (v.name && v.name.trim() && v.color_name && v.color_name.trim()) {
        const comboKey = `${v.product_id}-combo-${v.name.toLowerCase().trim()} / ${v.color_name.toLowerCase().trim()}`
        variantsMap.set(comboKey, v)
      }
      // Erstelle Keys für Größen-Varianten
      if (v.name && v.name.trim() && !v.color_name) {
        const sizeKey = `${v.product_id}-size-${v.name.toLowerCase().trim()}`
        variantsMap.set(sizeKey, v)
      }
      // Erstelle Keys für Farb-Varianten
      if (v.color_name && v.color_name.trim()) {
        const colorKey = `${v.product_id}-color-${v.color_name.toLowerCase().trim()}`
        variantsMap.set(colorKey, v)
      }
      // Fallback: Original Key für Kompatibilität
      const originalKey = `${v.product_id}-${(v.name || '').toLowerCase().trim()}`
      variantsMap.set(originalKey, v)
    })

    // Erstelle Bestellungen in Datenbank
    const createdOrders = []
    const errors = []
    const shopStats = new Map<string, number>()

    for (const [orderKey, orderData] of ordersMap) {
      try {
        // Überspringe Orders ohne Shop-Zuordnung
        if (!orderData.shopId) {
          errors.push({ orderKey, error: 'Kein Shop gefunden für Product Tags' })
          continue
        }

        // Verwende bereits geladene Produkte für diesen Shop
        const products = productsByShop.get(orderData.shopId) || []
        const productsMap = new Map(products.map(p => [p.name.toLowerCase().trim(), p]))
        
        // Varianten-Map wurde bereits außerhalb der Schleife erstellt und kann direkt verwendet werden

        // Prüfe ob Order bereits existiert (basierend auf Shop, Customer, Email, Date)
        let existingOrder = null
        let existingItemsMap = new Map<string, { id: string; quantity: number }>()
        
        if (orderData.orderDate) {
          const orderDate = new Date(orderData.orderDate)
          const dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth()}-${orderDate.getDate()}`
          const lookupKey = `${orderData.shopId}-${orderData.customerName}-${orderData.customerEmail || ''}-${dateKey}`
          existingOrder = existingOrdersMap.get(lookupKey) || null
        } else {
          // Fallback: Suche ohne Date
          const lookupKey = `${orderData.shopId}-${orderData.customerName}-${orderData.customerEmail || ''}-`
          for (const [key, order] of existingOrdersMap.entries()) {
            if (key.startsWith(lookupKey)) {
              existingOrder = order
              break
            }
          }
        }

        let order
        if (existingOrder) {
          // Erweitere bestehende Order
          console.log(`Erweitere bestehende Order ${existingOrder.id} (Order Number: ${orderData.orderNumber || orderKey})`)
          order = existingOrder
          
          // Verwende bereits geladene bestehende Order Items
          const existingItems = existingItemsByOrderId.get(order.id) || []
          
          // Speichere bestehende Items für späteren Vergleich
          existingItems.forEach(item => {
            const key = `${item.product_id}-${item.variant_id || 'no-variant'}`
            existingItemsMap.set(key, { id: item.id, quantity: item.quantity })
          })
          
          // Aktualisiere total_amount falls totalPriceFromFile vorhanden ist
          if (orderData.totalPriceFromFile !== null) {
            const newTotalAmount = Math.round(orderData.totalPriceFromFile * 100) / 100
            await supabase
              .from('orders')
              .update({ total_amount: newTotalAmount })
              .eq('id', order.id)
            order.total_amount = newTotalAmount
          }
        } else {
          // Erstelle neue Order
          // Formatiere total_amount - verwende totalPriceFromFile falls vorhanden, sonst berechne aus Items
          const totalAmount = orderData.totalPriceFromFile !== null 
            ? Math.round(orderData.totalPriceFromFile * 100) / 100
            : Math.round(orderData.totalAmount * 100) / 100
          
          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert([{
              shop_id: orderData.shopId,
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

          if (!newOrder) {
            errors.push({ orderKey, error: 'Order wurde nicht erstellt' })
            continue
          }
          
          order = newOrder
        }

        // Erstelle Order Items
        const orderItems = []
        const createdProducts: string[] = []
        
        for (const item of orderData.items) {
          // Versuche Produkt zu finden
          const normalizedProductName = item.productName.toLowerCase().trim()
          let product = productsMap.get(normalizedProductName)
          
          // KEINE Teilübereinstimmungen mehr - nur exakte Matches
          // Wenn kein exaktes Match gefunden wird, wird ein neues Produkt erstellt
          // Das verhindert falsche Zuordnungen wie "Bio Hoodie Schullogo" → "Bio Hoodie Schullogo + Bock"

          // Wenn Produkt nicht gefunden, erstelle es automatisch
          if (!product) {
            const productName = item.productName.trim()
            const basePrice = item.unitPrice > 0 ? item.unitPrice : 0
            
            console.log(`Erstelle Produkt automatisch: "${productName}" im Shop ${orderData.shopId} mit Preis ${basePrice}`)
            
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert([{
                shop_id: orderData.shopId,
                name: productName,
                base_price: basePrice,
                active: true,
                sort_index: 0,
              }])
              .select()
              .single()

            if (productError) {
              console.error(`Fehler beim Erstellen des Produkts "${productName}":`, productError)
              // Überspringe dieses Item, aber erstelle trotzdem die Order
              continue
            }

            if (newProduct) {
              product = newProduct
              productsMap.set(normalizedProductName, product)
              createdProducts.push(productName)
              console.log(`✓ Produkt erstellt: "${productName}" (ID: ${product.id})`)
            } else {
              // Produkt konnte nicht erstellt werden - überspringe Item
              console.error(`Produkt "${productName}" konnte nicht erstellt werden`)
              continue
            }
          }

          let variantId = null
          
          // Erstelle Varianten für Größe und/oder Farbe
          if (item.size || item.color) {
            // Erstelle eine Kombinations-Variante die beide Informationen enthält
            // Format: "Größe / Farbe" oder nur "Größe" oder nur "Farbe"
            let variantDisplayName = ''
            if (item.size && item.color) {
              variantDisplayName = `${item.size} / ${item.color}`
            } else if (item.size) {
              variantDisplayName = item.size
            } else if (item.color) {
              variantDisplayName = item.color
            }

            // Suche nach bestehender Kombinations-Variante
            const comboKey = `${product.id}-combo-${variantDisplayName.toLowerCase().trim()}`
            let comboVariant = variantsMap.get(comboKey)
            
            if (!comboVariant) {
              console.log(`Erstelle Kombinations-Variante: "${variantDisplayName}" für Produkt "${product.name}"`)
              
              const { data: newComboVariant, error: comboError } = await supabase
                .from('product_variants')
                .insert([{
                  product_id: product.id,
                  name: item.size || '', // Größe im name-Feld
                  color_name: item.color || null, // Farbe im color_name-Feld
                  active: true,
                  additional_price: 0,
                }])
                .select()
                .single()

              if (comboError) {
                console.error(`Fehler beim Erstellen der Kombinations-Variante "${variantDisplayName}":`, comboError)
              } else if (newComboVariant) {
                comboVariant = newComboVariant
                variantsMap.set(comboKey, comboVariant)
                console.log(`✓ Kombinations-Variante erstellt: "${variantDisplayName}" (ID: ${comboVariant.id})`)
              }
            }
            
            if (comboVariant) {
              variantId = comboVariant.id
            }
          } else if (item.variantName) {
            // Fallback: Falls keine Größe/Farbe erkannt wurde, verwende Original-Variante
            const variantName = item.variantName.trim()
            const variantKey = `${product.id}-${variantName.toLowerCase().trim()}`
            let variant = variantsMap.get(variantKey)
            
            if (!variant) {
              console.log(`Erstelle Variante automatisch: "${variantName}" für Produkt "${product.name}"`)
              
              const { data: newVariant, error: variantError } = await supabase
                .from('product_variants')
                .insert([{
                  product_id: product.id,
                  name: variantName,
                  active: true,
                  additional_price: 0,
                }])
                .select()
                .single()

              if (variantError) {
                console.error(`Fehler beim Erstellen der Variante "${variantName}":`, variantError)
              } else if (newVariant) {
                variant = newVariant
                variantsMap.set(variantKey, variant)
                console.log(`✓ Variante erstellt: "${variantName}" (ID: ${variant.id})`)
              }
            }
            
            if (variant) {
              variantId = variant.id
            }
          }

          const quantity = Math.floor(Math.abs(item.quantity)) || 1
          const unitPrice = Math.round(item.unitPrice * 100) / 100
          const lineTotal = Math.round(unitPrice * quantity * 100) / 100

          // Prüfe ob dieses Item bereits existiert (nur bei bestehenden Orders)
          const itemKey = `${product.id}-${variantId || 'no-variant'}`
          const existingItem = existingItemsMap.get(itemKey)
          
          if (existingItem) {
            // Item existiert bereits - aktualisiere Quantity und Preis falls nötig
            console.log(`Item bereits vorhanden: Produkt ${product.id}, Variante ${variantId || 'keine'}. Überspringe Duplikat.`)
            // Optional: Könnte hier die Quantity aktualisieren, aber wir überspringen es erstmal
            continue
          }

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
            console.error('Order items that failed:', JSON.stringify(orderItems, null, 2))
            errors.push({ orderKey, error: `Order Items: ${itemsError.message}` })
            // Lösche Order nur wenn es eine neue Order ist
            if (!existingOrder) {
              await supabase.from('orders').delete().eq('id', order.id)
            }
            continue
          }
          
          if (existingOrder) {
            console.log(`✓ Bestehende Order ${orderKey} erweitert: ${orderItems.length} neue Item(s) hinzugefügt`)
          } else {
            console.log(`✓ Order ${orderKey}: ${orderItems.length} Item(s) erfolgreich erstellt`)
          }
          
          // Info wenn Produkte automatisch erstellt wurden
          if (createdProducts.length > 0) {
            console.log(`Order ${orderKey}: ${createdProducts.length} Produkt(e) automatisch erstellt:`, createdProducts)
          }
        } else {
          // Wenn keine neuen Items hinzugefügt werden konnten
          if (existingOrder) {
            // Bei bestehenden Orders: Alle Items waren bereits vorhanden - das ist OK
            console.log(`✓ Bestehende Order ${orderKey}: Alle Items waren bereits vorhanden, keine neuen Items hinzugefügt`)
          } else {
            // Bei neuen Orders: Wenn keine Items erstellt werden konnten, lösche die Order
            console.warn(`⚠ Order ${orderKey}: Keine Items konnten erstellt werden. Ursprüngliche Items:`, orderData.items.length)
            await supabase.from('orders').delete().eq('id', order.id)
            errors.push({ orderKey, error: `Order hat keine gültigen Items - ${orderData.items.length} Item(s) in CSV, aber 0 konnten verarbeitet werden` })
            continue
          }
        }

        // Zähle neue Items (nicht bestehende Items)
        const newItemCount = orderItems.length
        const existingItemCount = existingOrder ? (existingItemsMap.size) : 0
        const finalTotalAmount = order.total_amount || (orderData.totalPriceFromFile !== null 
          ? Math.round(orderData.totalPriceFromFile * 100) / 100
          : Math.round(orderData.totalAmount * 100) / 100)
        
        createdOrders.push({
          id: order.id,
          shopId: orderData.shopId,
          customerName: orderData.customerName,
          totalAmount: finalTotalAmount,
          itemCount: newItemCount,
          existingItemCount: existingItemCount,
          isExtended: !!existingOrder,
        })

        // Statistiken - zähle nur neue Orders, nicht erweiterte
        if (!existingOrder) {
          const shopName = shopsWithSchool.find(s => s.id === orderData.shopId)?.name || 'Unbekannt'
          shopStats.set(shopName, (shopStats.get(shopName) || 0) + 1)
        }
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
      shopStats: Object.fromEntries(shopStats),
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

