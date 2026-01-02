import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/supabase-server'

/**
 * POST /api/lead-config/[id]/confirm
 * Bestätigt eine Lead-Konfiguration und generiert ein PDF-Angebotsdokument
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

    // Stelle sicher, dass ein Shop existiert (für Produktdaten)
    let shopId = config.shop_id

    if (!shopId) {
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

      // Speichere shop_id sofort, damit der PDF-Endpoint darauf zugreifen kann
      const { error: updateShopIdError } = await supabaseAdmin
        .from('lead_configurations')
        .update({ shop_id: shopId })
        .eq('id', configId)

      if (updateShopIdError) {
        console.error('Error updating config with shop_id:', updateShopIdError)
        return NextResponse.json(
          { error: 'Fehler beim Aktualisieren der Konfiguration mit Shop' },
          { status: 500 }
        )
      }

      // Aktualisiere lokale Config-Referenz
      ;(config as any).shop_id = shopId
    }

    // Generiere PDF-Angebotsdokument
    const baseUrl = request.nextUrl.origin
    const pdfResponse = await fetch(`${baseUrl}/api/lead-config/${configId}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    })

    if (!pdfResponse.ok) {
      const pdfError = await pdfResponse.json()
      console.error('Error generating PDF:', pdfError)
      return NextResponse.json(
        { error: pdfError.error || 'Fehler beim Generieren des PDFs' },
        { status: 500 }
      )
    }

    const pdfData = await pdfResponse.json()

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
      pdfUrl: pdfData.pdfUrl,
      pdfFileName: pdfData.fileName,
      message: 'PDF-Angebotsdokument erfolgreich erstellt',
    })
  } catch (error: any) {
    console.error('Error in POST /api/lead-config/[id]/confirm:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}

