import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

/**
 * POST /api/lead-config/[id]/confirm
 * Bestätigt eine Lead-Konfiguration und stellt sicher, dass ein Shop existiert
 * Wird direkt nach der Bestätigung im Lead Dashboard aufgerufen
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

    // Prüfe ob User Zugriff auf diese Schule hat
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
        { error: 'Kein Zugriff auf diese Schule' },
        { status: 403 }
      )
    }

    // Lade Schuldaten für Shop-Erstellung
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id, name, short_code')
      .eq('id', config.school_id)
      .single()

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'Schule nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfe ob bereits ein Shop existiert
    let shopId = config.shop_id

    if (!shopId) {
      // Erstelle Shop falls noch nicht vorhanden
      const shopName = school.name || 'Shop'
      const shopSlug = `${school?.short_code || shopName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')

      const { data: shop, error: shopError } = await supabaseAdmin
        .from('shops')
        .insert({
          school_id: config.school_id,
          name: shopName,
          slug: shopSlug,
          status: 'draft',
          currency: 'EUR',
        })
        .select()
        .single()

      if (shopError || !shop) {
        console.error('Error creating shop:', shopError)
        return NextResponse.json(
          { error: 'Fehler beim Erstellen des Shops' },
          { status: 500 }
        )
      }

      shopId = shop.id
    }

    // Setze Status auf 'approved' und aktualisiere shop_id falls nötig
    const updateData: any = {
      status: 'approved',
    }
    
    if (!config.shop_id && shopId) {
      updateData.shop_id = shopId
    }

    const { data: updatedConfig, error: updateError } = await supabaseAdmin
      .from('lead_configurations')
      .update(updateData)
      .eq('id', configId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating config:', updateError)
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Konfiguration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      shop_id: shopId,
      message: 'Konfiguration erfolgreich bestätigt',
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/[id]/confirm:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

