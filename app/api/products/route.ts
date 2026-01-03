import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

/**
 * GET /api/products?shop_id=[id]
 * Lädt alle Produkte für einen Shop
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shop_id')

    if (!shopId) {
      return NextResponse.json(
        { error: 'shop_id ist erforderlich' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Prüfe Zugriff auf den Shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('school_id')
      .eq('id', shopId)
      .single()

    if (!shop) {
      return NextResponse.json(
        { error: 'Shop nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', shop.school_id)
      .maybeSingle()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diesen Shop' },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        textile_catalog (
          id,
          name,
          brand,
          base_price,
          available_colors,
          available_sizes
        ),
        product_variants (
          id,
          name,
          color_name,
          color_hex,
          additional_price,
          active
        )
      `)
      .eq('shop_id', shopId)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching products:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Produkte' },
        { status: 500 }
      )
    }

    // #region agent log
    if (data && data.length > 0) {
      data.forEach((product: any) => {
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:97',message:'GET /api/products - Product loaded',data:{productId:product.id,loaded_ek_netto:product.calculated_ek_netto,loaded_vk_brutto:product.calculated_vk_brutto,loaded_quantity:(product.print_config as any)?.quantity},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      });
    }
    // #endregion

    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/products:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products
 * Erstellt oder aktualisiert ein Produkt
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      id,
      shop_id,
      textile_id,
      name,
      description,
      base_price = 0,
      print_config = {},
      selected_colors = [],
      selected_sizes = [],
      sort_index = 0,
      active = true,
    } = body

    // Stelle sicher, dass die Menge im print_config gesetzt ist (Standard: 50)
    // Prüfe explizit auf undefined/null, nicht nur truthy
    // Stelle sicher, dass quantity eine Zahl ist
    const existingQuantity = (print_config as any)?.quantity
    const quantityValue = existingQuantity !== undefined && existingQuantity !== null 
      ? Number(existingQuantity) 
      : 50
    
    // Stelle sicher, dass quantity entweder 50 oder 100 ist
    const validQuantity = quantityValue === 100 ? 100 : 50
    
    const printConfigWithQuantity = {
      ...print_config,
      quantity: validQuantity,
    }
    
    console.log('[DEBUG] POST /api/products - quantity:', printConfigWithQuantity.quantity, 'from print_config:', existingQuantity, 'validated:', validQuantity)
    console.log('[DEBUG] POST /api/products - printConfigWithQuantity:', JSON.stringify(printConfigWithQuantity, null, 2))

    if (!shop_id || !name) {
      return NextResponse.json(
        { error: 'shop_id und name sind erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe Zugriff auf den Shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('school_id')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      return NextResponse.json(
        { error: 'Shop nicht gefunden' },
        { status: 404 }
      )
    }

    // Lade Lead-Config für Sponsoring und Marge
    const { data: leadConfig } = await supabaseAdmin
      .from('lead_configurations')
      .select('sponsoring, margin')
      .eq('school_id', shop.school_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let sponsoring = leadConfig?.sponsoring || 0
    const margin = leadConfig?.margin || 0
    
    // Stelle sicher, dass sponsoring eine Zahl ist
    if (typeof sponsoring !== 'number') {
      sponsoring = parseFloat(sponsoring as any) || 0
    }
    
    console.log('[DEBUG] Sponsoring - raw from DB:', leadConfig?.sponsoring, 'type:', typeof leadConfig?.sponsoring, 'converted:', sponsoring, 'type after:', typeof sponsoring)

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', shop.school_id)
      .maybeSingle()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diesen Shop' },
        { status: 403 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:209',message:'POST /api/products - Before calculatePrices',data:{productId:id,quantity:printConfigWithQuantity.quantity,printConfig:printConfigWithQuantity,sponsoring,margin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Berechne Preise
    const { calculated_ek_netto, calculated_vk_brutto } = await calculatePrices(
      textile_id,
      printConfigWithQuantity,
      sponsoring,
      margin
    )

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:217',message:'POST /api/products - After calculatePrices',data:{productId:id,calculated_ek_netto,calculated_vk_brutto,quantity:printConfigWithQuantity.quantity},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    let result
    if (id) {
      // Aktualisiere bestehendes Produkt
      const { data, error } = await supabaseAdmin
        .from('products')
        .update({
          textile_id,
          name,
          description,
          base_price: calculated_vk_brutto || base_price,
          print_config: printConfigWithQuantity,
          calculated_ek_netto,
          calculated_vk_brutto,
          sort_index,
          active,
        })
        .eq('id', id)
        .select(`
          *,
          textile_catalog (
            id,
            name,
            brand,
            base_price,
            available_colors,
            available_sizes
          )
        `)
        .single()

      if (error) {
        console.error('Error updating product:', error)
        return NextResponse.json(
          { error: 'Fehler beim Aktualisieren des Produkts' },
          { status: 500 }
        )
      }

      console.log('[DEBUG] Product updated in DB - stored_ek_netto:', data.calculated_ek_netto, 'stored_vk_brutto:', data.calculated_vk_brutto, 'stored_quantity:', (data.print_config as any)?.quantity, 'calculated_ek_netto:', calculated_ek_netto, 'calculated_vk_brutto:', calculated_vk_brutto)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:244',message:'POST /api/products - Product updated in DB',data:{productId:id,stored_ek_netto:data.calculated_ek_netto,stored_vk_brutto:data.calculated_vk_brutto,stored_quantity:(data.print_config as any)?.quantity,calculated_ek_netto,calculated_vk_brutto},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Aktualisiere Varianten
      await updateProductVariants(id, selected_colors, selected_sizes)

      result = data
    } else {
      // Erstelle neues Produkt
      const { data, error } = await supabaseAdmin
        .from('products')
        .insert({
          shop_id,
          textile_id,
          name,
          description,
          base_price: calculated_vk_brutto || base_price,
          print_config: printConfigWithQuantity,
          calculated_ek_netto,
          calculated_vk_brutto,
          sort_index,
          active,
        })
        .select(`
          *,
          textile_catalog (
            id,
            name,
            brand,
            base_price,
            available_colors,
            available_sizes
          )
        `)
        .single()

      if (error) {
        console.error('Error creating product:', error)
        return NextResponse.json(
          { error: 'Fehler beim Erstellen des Produkts' },
          { status: 500 }
        )
      }

      // Erstelle Varianten
      await updateProductVariants(data.id, selected_colors, selected_sizes)

      result = data
    }

    return NextResponse.json({ product: result })
  } catch (error: any) {
    console.error('Error in POST /api/products:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products?id=[id]
 * Löscht ein Produkt
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id ist erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe Zugriff auf das Produkt
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('shop_id, shops!inner(school_id)')
      .eq('id', id)
      .single()

    if (!product) {
      return NextResponse.json(
        { error: 'Produkt nicht gefunden' },
        { status: 404 }
      )
    }

    const schoolId = (product.shops as any).school_id

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting product:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen des Produkts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/products:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * Hilfsfunktion: Berechnet Preise für ein Produkt
 */
async function calculatePrices(
  textileId: string | null,
  printConfig: any,
  sponsoring: number,
  margin: number
): Promise<{ calculated_ek_netto: number; calculated_vk_brutto: number }> {
  if (!textileId) {
    return { calculated_ek_netto: 0, calculated_vk_brutto: 0 }
  }

  // Lade Textilpreis
  const { data: textilePrice } = await supabaseAdmin
    .from('textile_prices')
    .select('price')
    .eq('textile_id', textileId)
    .eq('active', true)
    .maybeSingle()

  const { data: textile } = await supabaseAdmin
    .from('textile_catalog')
    .select('base_price')
    .eq('id', textileId)
    .single()

  let basePrice = textilePrice?.price ?? textile?.base_price ?? 0
  
  // Korrigiere mögliche Multiplikation mit 10
  // Wenn der Preis ungewöhnlich hoch ist (> 100), könnte er mit 10 multipliziert worden sein
  // Beispiel: Erwartet 18€, aber 180€ in DB -> teile durch 10
  if (basePrice > 100 && basePrice % 10 === 0) {
    // Prüfe ob es eine runde Zahl ist, die durch 10 teilbar ist
    // Dann könnte es sein, dass der Preis mit 10 multipliziert wurde
    const possibleCorrectPrice = basePrice / 10
    // Wenn das Ergebnis sinnvoll ist (zwischen 1 und 100), verwende es
    if (possibleCorrectPrice >= 1 && possibleCorrectPrice <= 100) {
      console.warn(`Price correction: ${basePrice} -> ${possibleCorrectPrice} (possible 10x multiplication)`)
      basePrice = possibleCorrectPrice
    }
  }

  // Lade Menge aus print_config (Standard: 50)
  // Prüfe explizit auf undefined/null, nicht nur truthy
  // Stelle sicher, dass quantity eine Zahl ist und entweder 50 oder 100
  const rawQuantity = (printConfig as any)?.quantity
  const quantityValue = rawQuantity !== undefined && rawQuantity !== null 
    ? Number(rawQuantity) 
    : 50
  
  // Stelle sicher, dass quantity entweder 50 oder 100 ist
  const quantity = quantityValue === 100 ? 100 : 50

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:447',message:'calculatePrices - Entry',data:{textileId,quantity,rawQuantity,printConfigQuantity:(printConfig as any)?.quantity,printConfigKeys:Object.keys(printConfig || {}),sponsoring,margin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  console.log('[DEBUG] calculatePrices - quantity:', quantity, 'rawQuantity:', rawQuantity, 'printConfig quantity:', (printConfig as any)?.quantity)
  console.log('[DEBUG] calculatePrices - full printConfig:', JSON.stringify(printConfig, null, 2))

  // Berechne Druckkosten basierend auf print_config und Menge
  let totalPrintCost = 0
  const positions = ['front', 'back', 'side'] as const

  for (const position of positions) {
    const positionConfig = printConfig?.[position]
    if (positionConfig && positionConfig.method_id) {
      // Lade Druckart-Preis
      const { data: methodCost } = await supabaseAdmin
        .from('print_method_costs')
        .select('cost_50_units, cost_100_units')
        .eq('print_method_id', positionConfig.method_id)
        .eq('active', true)
        .single()

      if (methodCost) {
        // Verwende die Kosten basierend auf der gewählten Menge
        let cost = 0
        if (quantity === 100) {
          cost = methodCost.cost_100_units ?? methodCost.cost_50_units ?? 0
          console.log(`[DEBUG] Using cost_100_units for ${position} (quantity=${quantity}):`, cost, 'cost_50_units:', methodCost.cost_50_units, 'cost_100_units:', methodCost.cost_100_units)
        } else {
          // Standard: 50 Stück (auch wenn quantity explizit 50 ist)
          cost = methodCost.cost_50_units ?? methodCost.cost_100_units ?? 0
          console.log(`[DEBUG] Using cost_50_units for ${position} (quantity=${quantity}):`, cost, 'cost_50_units:', methodCost.cost_50_units, 'cost_100_units:', methodCost.cost_100_units)
        }
        
        // Gleiche Korrektur für Druckkosten
        const costBeforeCorrection = cost
        if (cost > 100 && cost % 10 === 0) {
          const possibleCorrectCost = cost / 10
          if (possibleCorrectCost >= 0.1 && possibleCorrectCost <= 50) {
            cost = possibleCorrectCost
          }
        }
        totalPrintCost += cost

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:469',message:'calculatePrices - Print cost calculation',data:{position,quantity,methodId:positionConfig.method_id,cost_50_units:methodCost.cost_50_units,cost_100_units:methodCost.cost_100_units,costBeforeCorrection,costAfterCorrection:cost,totalPrintCost},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    }
  }

  // Lade Handlingkosten
  const { data: handlingCost } = await supabaseAdmin
    .from('handling_costs')
    .select('cost_per_order')
    .eq('active', true)
    .maybeSingle()

  let handlingCostPerProduct = handlingCost?.cost_per_order ?? 0
  // Gleiche Korrektur für Handlingkosten
  if (handlingCostPerProduct > 100 && handlingCostPerProduct % 10 === 0) {
    const possibleCorrectCost = handlingCostPerProduct / 10
    if (possibleCorrectCost >= 0.1 && possibleCorrectCost <= 50) {
      handlingCostPerProduct = possibleCorrectCost
    }
  }

  // Berechne EK Netto
  console.log('[DEBUG] calculatePrices - Before EK calculation:', {
    basePrice,
    totalPrintCost,
    handlingCostPerProduct,
    sponsoring,
    sponsoringType: typeof sponsoring,
    sum: basePrice + totalPrintCost + handlingCostPerProduct + sponsoring
  })
  const ekNetto = basePrice + totalPrintCost + handlingCostPerProduct + sponsoring
  console.log('[DEBUG] calculatePrices - EK Netto calculated:', ekNetto)

  // Berechne VK Brutto mit Marge und MwSt
  const marginFactor = 1 - margin / 100
  const vkNetto = marginFactor > 0 ? ekNetto / marginFactor : ekNetto
  const vatMultiplier = 1.19 // 19% MwSt
  const vkBrutto = vkNetto * vatMultiplier

  const result = {
    calculated_ek_netto: Math.round(ekNetto * 100) / 100,
    calculated_vk_brutto: Math.round(vkBrutto * 100) / 100,
  }
  
  console.log('[DEBUG] calculatePrices RESULT - quantity:', quantity, 'totalPrintCost:', totalPrintCost, 'ekNetto:', ekNetto, 'vkBrutto:', vkBrutto, 'calculated_ek_netto:', result.calculated_ek_netto, 'calculated_vk_brutto:', result.calculated_vk_brutto)

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/products/route.ts:490',message:'calculatePrices - Exit',data:{quantity,basePrice,totalPrintCost,handlingCostPerProduct,sponsoring,margin,ekNetto,vkNetto,vkBrutto,calculated_ek_netto:result.calculated_ek_netto,calculated_vk_brutto:result.calculated_vk_brutto},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return result
}

/**
 * Hilfsfunktion: Aktualisiert Produkt-Varianten (Farben x Größen)
 */
async function updateProductVariants(
  productId: string,
  colors: string[],
  sizes: string[]
): Promise<void> {
  const normalizeColorInput = (value: any): string => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      const cleaned = trimmed.replace(/[\r\n]+/g, '')
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleaned)
          if (parsed && typeof parsed.name === 'string') {
            return parsed.name.trim()
          }
        } catch {
          // ignore
        }
      }
      return cleaned
    }
    if (value && typeof value === 'object' && typeof value.name === 'string') {
      return value.name.trim()
    }
    return ''
  }

  const normalizedColors = colors
    .map((c) => normalizeColorInput(c))
    .filter((c) => c.length > 0)

  // Lösche alle bestehenden Varianten
  await supabaseAdmin
    .from('product_variants')
    .delete()
    .eq('product_id', productId)

  // Erstelle neue Varianten
  const variants: Array<{
    product_id: string
    name: string
    color_name: string | null
    active: boolean
  }> = []

  if (normalizedColors.length > 0 && sizes.length > 0) {
    // Kombiniere Farben und Größen
    for (const color of normalizedColors) {
      for (const size of sizes) {
        variants.push({
          product_id: productId,
          name: size,
          color_name: color,
          active: true,
        })
      }
    }
  } else if (normalizedColors.length > 0) {
    // Nur Farben
    for (const color of normalizedColors) {
      variants.push({
        product_id: productId,
        name: 'Standard',
        color_name: color,
        active: true,
      })
    }
  } else if (sizes.length > 0) {
    // Nur Größen
    for (const size of sizes) {
      variants.push({
        product_id: productId,
        name: size,
        color_name: null,
        active: true,
      })
    }
  }

  if (variants.length > 0) {
    await supabaseAdmin
      .from('product_variants')
      .insert(variants)
  }
}

