import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'

interface CSVOrderRow {
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
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text/csv')) {
      return NextResponse.json(
        { error: 'Nur CSV-Dateien sind erlaubt' },
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

    // Parse CSV
    const csvText = await file.text()
    
    return new Promise((resolve) => {
      Papa.parse<CSVOrderRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          try {
            const rows = results.data
            if (rows.length === 0) {
              return resolve(NextResponse.json(
                { error: 'CSV-Datei ist leer' },
                { status: 400 }
              ))
            }

            // Gruppiere Zeilen nach Bestellung (gleicher Kunde, gleiches Datum)
            const ordersMap = new Map<string, ParsedOrder>()

            for (const row of rows) {
              // Extrahiere Kundendaten
              const customerName = 
                row['Customer Name'] ||
                (row['Customer: First name'] && row['Customer: Last name']
                  ? `${row['Customer: First name']} ${row['Customer: Last name']}`
                  : null) ||
                ''

              if (!customerName.trim()) {
                continue // Überspringe Zeilen ohne Kundennamen
              }

              const customerEmail = row['Customer Email'] || row['Email'] || null
              const className = row['Class Name'] || row['Klasse'] || row['Line items: Custom attributes Klasse'] || null

              // Erstelle eindeutigen Schlüssel für Bestellung
              const orderKey = `${customerName}-${customerEmail || 'no-email'}-${className || 'no-class'}`

              if (!ordersMap.has(orderKey)) {
                ordersMap.set(orderKey, {
                  customerName: customerName.trim(),
                  customerEmail: customerEmail?.trim() || null,
                  className: className?.trim() || null,
                  items: [],
                  totalAmount: 0,
                  orderDate: row['Order Date'] || row['Created at'] || row['Created at (UTC)'] || null,
                })
              }

              const order = ordersMap.get(orderKey)!

              // Extrahiere Produktdaten
              const productName = row['Product Name'] || row['Line items: Title'] || ''
              const variantName = row['Product Variant'] || row['Line items: Variant title'] || null
              const quantity = parseInt(row['Quantity'] || row['Line items: Quantity'] || '1')
              const unitPriceStr = row['Unit Price'] || row['Line items: Price'] || '0'
              const unitPrice = parseFloat(unitPriceStr.replace(',', '.').replace(/[^\d.-]/g, ''))

              if (!productName.trim() || quantity <= 0) {
                continue // Überspringe ungültige Zeilen
              }

              // Finde Produkt
              const product = productsMap.get(productName.toLowerCase().trim())
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

              // Verwende Preis aus CSV falls vorhanden, sonst berechne
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
                // Erstelle Order
                const { data: order, error: orderError } = await supabase
                  .from('orders')
                  .insert([{
                    shop_id: shopId,
                    customer_name: orderData.customerName,
                    customer_email: orderData.customerEmail,
                    class_name: orderData.className,
                    status: 'pending',
                    total_amount: orderData.totalAmount,
                    created_at: orderData.orderDate || new Date().toISOString(),
                  }])
                  .select()
                  .single()

                if (orderError) {
                  errors.push({ orderKey, error: orderError.message })
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

                  orderItems.push({
                    order_id: order.id,
                    product_id: product.id,
                    variant_id: variantId,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    line_total: item.unitPrice * item.quantity,
                  })
                }

                if (orderItems.length > 0) {
                  const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems)

                  if (itemsError) {
                    errors.push({ orderKey, error: `Order Items: ${itemsError.message}` })
                    // Lösche Order falls Items nicht erstellt werden konnten
                    await supabase.from('orders').delete().eq('id', order.id)
                    continue
                  }
                }

                createdOrders.push({
                  id: order.id,
                  customerName: orderData.customerName,
                  totalAmount: orderData.totalAmount,
                  itemCount: orderItems.length,
                })
              } catch (error: any) {
                errors.push({ orderKey, error: error.message })
              }
            }

            return resolve(NextResponse.json({
              success: true,
              imported: createdOrders.length,
              skipped: ordersMap.size - createdOrders.length,
              orders: createdOrders,
              errors: errors.length > 0 ? errors : undefined,
            }))
          } catch (error: any) {
            return resolve(NextResponse.json(
              { error: `Fehler beim Verarbeiten der CSV-Datei: ${error.message}` },
              { status: 500 }
            ))
          }
        },
        error: (error) => {
          return resolve(NextResponse.json(
            { error: `Fehler beim Parsen der CSV-Datei: ${error.message}` },
            { status: 400 }
          ))
        },
      })
    })
  } catch (error: any) {
    console.error('Error uploading orders:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Hochladen der Bestellungen' },
      { status: 500 }
    )
  }
}

