import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * OAuth Callback Handler
 * Wird von Shopify nach Autorisierung aufgerufen
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const hmac = searchParams.get('hmac')
  const state = searchParams.get('state') // enthält optional unsere interne shopId

  if (!code || !shop) {
    return NextResponse.redirect(
      new URL('/?error=oauth_failed', request.url)
    )
  }

  // Tausche Code gegen Access Token
  try {
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/shopify/oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shop, code }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.success) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(tokenData.error)}`, request.url)
      )
    }

    const accessToken = tokenData.accessToken

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('Kein Access Token von Shopify erhalten')}`, request.url)
      )
    }

    // Speichere Access Token serverseitig in der Datenbank, falls eine interne shopId (state) vorhanden ist
    if (state) {
      try {
        await supabaseAdmin
          .from('shopify_connections')
          .upsert(
            {
              shop_id: state,
              shop_domain: shop,
              access_token: accessToken.trim(),
              active: true,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'shop_id',
            }
          )
      } catch (dbError) {
        console.error('Error saving Shopify connection in callback:', dbError)
        return NextResponse.redirect(
          new URL(
            `/?error=${encodeURIComponent('Fehler beim Speichern der Shopify-Verbindung')}`,
            request.url
          )
        )
      }
    }

    // Redirect zurück zur App (ohne Token in der URL)
    // Wenn state (interne shopId) vorhanden ist, leite zur entsprechenden Shop-Seite weiter,
    // sonst zur Startseite.
    const baseUrl = request.nextUrl.origin

    const targetPath = state
      ? `/shops/${encodeURIComponent(state)}`
      : '/'

    const redirectUrl = new URL(targetPath, baseUrl)
    redirectUrl.searchParams.set('shopify_connected', 'true')

    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}


