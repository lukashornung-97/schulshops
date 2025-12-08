import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Hilfsfunktion: Normalisiert String für Vergleich
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str.toLowerCase().trim()
}

/**
 * Findet das beste Produkt-Match für einen Produktnamen
 * Verwendet die gleiche Logik wie beim Order-Upload
 */
function findBestProductMatch(
  productName: string,
  productsMap: Map<string, { id: string; name: string }>
): { id: string; name: string } | null {
  const normalizedProductName = normalizeString(productName)
  
  // 1. Exaktes Match
  let product = productsMap.get(normalizedProductName)
  if (product) {
    return product
  }
  
  // 2. Teilübereinstimmung - nur wenn DB-Name den Excel-Namen enthält (nicht umgekehrt)
  // Das verhindert, dass "Bio Hoodie Schullogo" mit "Bio Hoodie Schullogo + Bock" matched
  let bestMatch: { product: { id: string; name: string }; score: number } | null = null
  
  for (const [key, prod] of productsMap.entries()) {
    // Exaktes Match hat höchste Priorität
    if (normalizedProductName === key) {
      return prod
    }
    
    // Teilübereinstimmung: Nur wenn DB-Name den Excel-Namen enthält UND der DB-Name nicht deutlich länger ist
    // Das verhindert, dass "Bio Hoodie Schullogo" mit "Bio Hoodie Schullogo + Bock" matched
    // Beispiel: Excel hat "Bio Hoodie Schullogo", DB hat "Bio Hoodie Schullogo + Bock"
    // Dann: key.includes(normalizedProductName) = true, aber key.length > normalizedProductName.length
    // Also: Wir matchen nur wenn der DB-Name kürzer oder gleich lang ist (max. 3 Zeichen Unterschied)
    if (key.includes(normalizedProductName) && key.length <= normalizedProductName.length + 3) {
      // Erlaube nur kleine Unterschiede (z.B. Leerzeichen, Groß-/Kleinschreibung)
      // Aber nicht wenn DB-Name deutlich länger ist (wie "+ Bock" = 6 Zeichen)
      const score = normalizedProductName.length - Math.abs(key.length - normalizedProductName.length)
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { product: prod, score }
      }
    }
  }
  
  return bestMatch ? bestMatch.product : null
}

/**
 * API Route zum Korrigieren falscher Produktzuordnungen in bestehenden Orders
 * POST /api/orders/fix-product-assignments
 */
export async function POST(request: NextRequest) {
  try {
    const { shopId, dryRun = true } = await request.json().catch(() => ({ shopId: null, dryRun: true }))
    
    // Lade alle Orders (optional gefiltert nach Shop)
    let ordersQuery = supabase
      .from('orders')
      .select('id, shop_id')
    
    if (shopId) {
      ordersQuery = ordersQuery.eq('shop_id', shopId)
    }
    
    const { data: orders, error: ordersError } = await ordersQuery
    
    if (ordersError) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Orders' },
        { status: 500 }
      )
    }
    
    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine Orders gefunden',
        fixed: 0,
        errors: 0,
        details: [],
      })
    }
    
    const corrections: Array<{
      orderId: string
      orderItemId: string
      oldProductId: string
      oldProductName: string
      newProductId: string
      newProductName: string
    }> = []
    
    const errors: Array<{
      orderId: string
      orderItemId: string
      error: string
    }> = []
    
    // Lade alle Shops für Produkt-Lookup
    const shopIds = Array.from(new Set(orders.map(o => o.shop_id)))
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .in('id', shopIds)
    
    // Für jeden Shop: Lade alle Produkte
    const productsByShop = new Map<string, Map<string, { id: string; name: string }>>()
    
    for (const shop of shops || []) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .eq('shop_id', shop.id)
        .eq('active', true)
      
      const productsMap = new Map(
        products?.map(p => [normalizeString(p.name), { id: p.id, name: p.name }]) || []
      )
      productsByShop.set(shop.id, productsMap)
    }
    
    // Gehe durch alle Orders
    for (const order of orders) {
      const productsMap = productsByShop.get(order.shop_id)
      if (!productsMap || productsMap.size === 0) {
        continue
      }
      
      // Lade Order Items für diese Order
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, products!inner(id, name)')
        .eq('order_id', order.id)
      
      if (itemsError) {
        console.error(`Fehler beim Laden der Order Items für Order ${order.id}:`, itemsError)
        continue
      }
      
      if (!orderItems || orderItems.length === 0) {
        continue
      }
      
      // Für jedes Order Item: Prüfe ob das Produkt korrekt zugeordnet ist
      for (const item of orderItems) {
        const currentProduct = item.products as { id: string; name: string; shop_id: string }
        const currentProductName = currentProduct.name.trim()
        const normalizedCurrentProductName = normalizeString(currentProductName)
        
        // Prüfe ob das Produkt zum Order-Shop gehört
        const productBelongsToOrderShop = currentProduct.shop_id === order.shop_id
        
        // Strategie: Wenn das Produkt einen längeren Namen hat (z.B. "Bio Hoodie Schullogo + Bock"),
        // versuche den kürzeren Namen zu extrahieren (z.B. "Bio Hoodie Schullogo")
        // und prüfe ob dieser exakt existiert
        
        // Extrahiere mögliche kürzere Produktnamen
        // Beispiel: "Bio Hoodie Schullogo + Bock" → ["Bio Hoodie Schullogo"]
        const possibleShorterNames: string[] = []
        
        // Wenn der Name "+" enthält, könnte der Teil davor der richtige Name sein
        if (currentProductName.includes('+')) {
          const beforePlus = currentProductName.split('+')[0].trim()
          if (beforePlus.length > 0 && beforePlus.length < currentProductName.length) {
            possibleShorterNames.push(beforePlus)
          }
        }
        
        // Wenn der Name " / " enthält, könnte der Teil davor der richtige Name sein
        if (currentProductName.includes(' / ')) {
          const beforeSlash = currentProductName.split(' / ')[0].trim()
          if (beforeSlash.length > 0 && beforeSlash.length < currentProductName.length) {
            possibleShorterNames.push(beforeSlash)
          }
        }
        
        let bestMatch: { id: string; name: string } | null = null
        
        // Prüfe zuerst im Order-Shop nach exakten Matches für die möglichen kürzeren Namen
        for (const shorterName of possibleShorterNames) {
          const normalizedShorterName = normalizeString(shorterName)
          const exactMatch = productsMap.get(normalizedShorterName)
          
          if (exactMatch && exactMatch.id !== currentProduct.id) {
            bestMatch = exactMatch
            break // Exaktes Match gefunden, verwende dieses
          }
        }
        
        // Wenn kein exaktes Match gefunden wurde, erstelle ein neues Produkt
        if (!bestMatch && possibleShorterNames.length > 0) {
          const newProductName = possibleShorterNames[0] // Verwende den ersten (wahrscheinlichsten) Namen
          
          if (!dryRun) {
            // Hole Preis vom aktuellen Produkt oder verwende 0
            const { data: currentProductData } = await supabase
              .from('products')
              .select('base_price')
              .eq('id', currentProduct.id)
              .single()
            
            const basePrice = currentProductData?.base_price || 0
            
            console.log(`Erstelle neues Produkt: "${newProductName}" im Shop ${order.shop_id} mit Preis ${basePrice}`)
            
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert([{
                shop_id: order.shop_id,
                name: newProductName,
                base_price: basePrice,
                active: true,
                sort_index: 0,
              }])
              .select()
              .single()
            
            if (productError) {
              console.error(`Fehler beim Erstellen des Produkts "${newProductName}":`, productError)
              errors.push({
                orderId: order.id,
                orderItemId: item.id,
                error: `Fehler beim Erstellen des Produkts: ${productError.message}`,
              })
              continue
            }
            
            if (newProduct) {
              bestMatch = { id: newProduct.id, name: newProduct.name }
              // Aktualisiere productsMap für weitere Items
              productsMap.set(normalizeString(newProduct.name), bestMatch)
              console.log(`✓ Produkt erstellt: "${newProductName}" (ID: ${newProduct.id})`)
            }
          } else {
            // Im Dry-Run: Markiere dass ein neues Produkt erstellt werden würde
            bestMatch = { id: 'NEW', name: newProductName } // Placeholder für Dry-Run
          }
        }
        
        if (bestMatch && bestMatch.id !== currentProduct.id) {
          // Zuordnung gefunden oder neues Produkt erstellt!
          corrections.push({
            orderId: order.id,
            orderItemId: item.id,
            oldProductId: currentProduct.id,
            oldProductName: currentProduct.name,
            newProductId: bestMatch.id,
            newProductName: bestMatch.name,
          })
          
          // Aktualisiere Order Item wenn nicht dry run und Produkt wurde erstellt/gefunden
          if (!dryRun && bestMatch.id !== 'NEW') {
            const { error: updateError } = await supabase
              .from('order_items')
              .update({ product_id: bestMatch.id })
              .eq('id', item.id)
            
            if (updateError) {
              errors.push({
                orderId: order.id,
                orderItemId: item.id,
                error: updateError.message,
              })
            } else {
              console.log(`✓ Korrigiert: "${currentProduct.name}" → "${bestMatch.name}" (Order: ${order.id})`)
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      fixed: corrections.length,
      errors: errors.length,
      corrections: corrections.slice(0, 100), // Limitiere auf erste 100 für Response
      totalCorrections: corrections.length,
      message: dryRun 
        ? `Gefunden: ${corrections.length} falsche Zuordnungen. Setze dryRun=false um zu korrigieren.`
        : `${corrections.length} Zuordnungen korrigiert.`,
    })
  } catch (error: any) {
    console.error('Error fixing product assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Korrigieren der Produktzuordnungen' },
      { status: 500 }
    )
  }
}

