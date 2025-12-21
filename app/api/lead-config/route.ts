import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

/**
 * GET /api/lead-config?school_id=[id]
 * Lädt Lead-Konfiguration für eine Schule
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('school_id')

    if (!schoolId) {
      return NextResponse.json(
        { error: 'school_id ist erforderlich' },
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

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Schule' },
        { status: 403 }
      )
    }

    let config = await supabaseAdmin
      .from('lead_configurations')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (config.error) {
      console.error('Error fetching lead config:', config.error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Konfiguration' },
        { status: 500 }
      )
    }

    // Wenn keine Config existiert oder kein Shop vorhanden, erstelle einen Shop
    if (!config.data || !config.data.shop_id) {
      // Lade Schuldaten
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()

      if (school) {
        // Prüfe ob bereits ein Shop für diese Schule existiert
        const { data: existingShop } = await supabaseAdmin
          .from('shops')
          .select('id')
          .eq('school_id', schoolId)
          .maybeSingle()

        let shopId = existingShop?.id

        if (!shopId) {
          // Erstelle neuen Shop
          const shopName = school.name
          const shopSlug = `${school.short_code || school.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')

          const { data: newShop, error: shopError } = await supabaseAdmin
            .from('shops')
            .insert({
              school_id: schoolId,
              name: shopName,
              slug: shopSlug,
              status: 'draft',
              currency: 'EUR',
            })
            .select()
            .single()

          if (!shopError && newShop) {
            shopId = newShop.id
          }
        }

        // Wenn Config existiert aber kein shop_id, aktualisiere sie
        if (config.data && shopId && !config.data.shop_id) {
          const { data: updatedConfig } = await supabaseAdmin
            .from('lead_configurations')
            .update({ shop_id: shopId })
            .eq('id', config.data.id)
            .select()
            .single()

          if (updatedConfig) {
            config.data = updatedConfig
          }
        } else if (!config.data && shopId) {
          // Erstelle neue Config mit Shop
          const { data: newConfig, error: newConfigError } = await supabaseAdmin
            .from('lead_configurations')
            .insert({
              school_id: schoolId,
              shop_id: shopId,
              status: 'draft',
              selected_textiles: [],
              print_positions: {},
            })
            .select()
            .single()

          if (!newConfigError && newConfig) {
            config.data = newConfig
          }
        }
      }
    }

    return NextResponse.json({ config: config.data || null })
  } catch (error: any) {
    console.error('Error in GET /api/lead-config:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lead-config
 * Erstellt oder aktualisiert eine Lead-Konfiguration
 * Erstellt automatisch einen Shop für die Schule, falls noch nicht vorhanden
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
      school_id,
      selected_textiles,
      print_positions,
      price_calculation,
      status = 'draft',
      sponsoring,
      margin,
    } = body
    
    console.log('[DEBUG] POST /api/lead-config - Received sponsoring:', sponsoring, 'type:', typeof sponsoring)

    if (!school_id) {
      return NextResponse.json(
        { error: 'school_id ist erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe ob User Zugriff auf diese Schule hat
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_id', school_id)
      .single()

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!role && !admin) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Schule' },
        { status: 403 }
      )
    }

    // Lade Schuldaten für Shop-Erstellung
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('*')
      .eq('id', school_id)
      .single()

    // Prüfe ob bereits eine Konfiguration existiert
    const { data: existing } = await supabaseAdmin
      .from('lead_configurations')
      .select('id, shop_id')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Prüfe ob ein Shop existiert, erstelle einen falls nicht
    let shopId = existing?.shop_id
    if (!shopId && school) {
      // Prüfe ob bereits ein Shop für diese Schule existiert
      const { data: existingShop } = await supabaseAdmin
        .from('shops')
        .select('id')
        .eq('school_id', school_id)
        .maybeSingle()

      if (existingShop) {
        shopId = existingShop.id
      } else {
        // Erstelle neuen Shop
        const shopName = school.name
        const shopSlug = `${school.short_code || school.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')

        const { data: newShop, error: shopError } = await supabaseAdmin
          .from('shops')
          .insert({
            school_id: school_id,
            name: shopName,
            slug: shopSlug,
            status: 'draft',
            currency: 'EUR',
          })
          .select()
          .single()

        if (shopError) {
          console.error('Error creating shop:', shopError)
        } else {
          shopId = newShop.id
        }
      }
    }

    let result
    if (existing) {
      // Aktualisiere bestehende Konfiguration
      const updateData: any = {}
      if (selected_textiles !== undefined) {
        updateData.selected_textiles = selected_textiles
        
        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'route.ts:139',
            message: 'API: Updating selected_textiles',
            data: {
              selectedTextilesLength: Array.isArray(selected_textiles) ? selected_textiles.length : 'not array',
              firstTextilePrintFiles: Array.isArray(selected_textiles) && selected_textiles[0] 
                ? JSON.stringify(selected_textiles[0].print_files || {}).substring(0, 300)
                : 'no first textile',
              fullSelectedTextiles: JSON.stringify(selected_textiles).substring(0, 500),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
      }
      if (print_positions !== undefined) updateData.print_positions = print_positions
      if (price_calculation !== undefined) updateData.price_calculation = price_calculation
      if (status !== undefined) updateData.status = status
      if (sponsoring !== undefined) {
        const sponsoringValue = typeof sponsoring === 'number' ? sponsoring : parseFloat(sponsoring as any) || 0
        console.log('[DEBUG] POST /api/lead-config - Saving sponsoring:', sponsoringValue, 'original:', sponsoring, 'type:', typeof sponsoring)
        updateData.sponsoring = sponsoringValue
      }
      if (margin !== undefined) updateData.margin = margin
      if (shopId && !existing.shop_id) updateData.shop_id = shopId

      const { data, error } = await supabaseAdmin
        .from('lead_configurations')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'route.ts:170',
            message: 'API: Error updating',
            data: { error: error.message, code: error.code },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
        console.error('Error updating lead config:', error)
        return NextResponse.json(
          { error: 'Fehler beim Aktualisieren der Konfiguration' },
          { status: 500 }
        )
      }

      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:185',
          message: 'API: Updated successfully',
          data: {
            savedSelectedTextiles: JSON.stringify(data.selected_textiles).substring(0, 500),
            firstTextilePrintFiles: Array.isArray(data.selected_textiles) && data.selected_textiles[0]
              ? JSON.stringify(data.selected_textiles[0].print_files || {}).substring(0, 300)
              : 'no first textile',
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion
      result = data
    } else {
      // Erstelle neue Konfiguration
      const { data, error } = await supabaseAdmin
        .from('lead_configurations')
        .insert({
          school_id,
          shop_id: shopId || null,
          selected_textiles: selected_textiles || [],
          print_positions: print_positions || {},
          price_calculation: price_calculation || null,
          status,
          sponsoring: (() => {
            if (sponsoring === undefined || sponsoring === null) return null
            const value = typeof sponsoring === 'number' ? sponsoring : parseFloat(sponsoring as any) || null
            console.log('[DEBUG] POST /api/lead-config - Insert sponsoring:', value, 'original:', sponsoring)
            return value
          })(),
          margin: margin || 0,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating lead config:', error)
        return NextResponse.json(
          { error: 'Fehler beim Erstellen der Konfiguration' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({ config: result })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

