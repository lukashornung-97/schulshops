import { NextRequest, NextResponse } from 'next/server'

/**
 * Shopify OAuth Flow
 *
 * Schritt 1: Authorization URL generieren
 * GET /api/shopify/oauth?shop=shop-name.myshopify.com&shopId=UUID
 *
 * Schritt 2: Access Token austauschen (nach Redirect)
 * POST /api/shopify/oauth
 */

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:3000/api/shopify/oauth/callback'

/**
 * Generiert Authorization URL für OAuth Flow
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const shop = searchParams.get('shop')
  const shopId = searchParams.get('shopId') || undefined

  if (!shop) {
    return NextResponse.json(
      { error: 'Shop-Parameter fehlt. Beispiel: ?shop=ihr-shop.myshopify.com' },
      { status: 400 }
    )
  }

  if (!SHOPIFY_CLIENT_ID) {
    return NextResponse.json(
      { error: 'SHOPIFY_CLIENT_ID nicht konfiguriert. Bitte in .env.local setzen.' },
      { status: 500 }
    )
  }

  // Scopes die wir benötigen
  const scopes = 'read_products,write_products'

  // Stelle sicher, dass die Redirect URI korrekt ist
  const redirectUri = SHOPIFY_REDIRECT_URI || `${request.nextUrl.origin}/api/shopify/oauth/callback`

   // Optionaler state-Parameter: interner Shop-ID Kontext
  const state = shopId ?? ''

  // Authorization URL
  const authUrl = `https://${shop}/admin/oauth/authorize?` +
    `client_id=${SHOPIFY_CLIENT_ID}&` +
    `scope=${scopes}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${encodeURIComponent(state)}`

  return NextResponse.json({
    authUrl,
    message: 'Weiterleitung zu Shopify für Autorisierung',
  })
}

/**
 * Tauscht Authorization Code gegen Access Token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shop, code } = body

    if (!shop || !code) {
      return NextResponse.json(
        { error: 'Shop und Code sind erforderlich' },
        { status: 400 }
      )
    }

    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Shopify Credentials nicht konfiguriert' },
        { status: 500 }
      )
    }

    // Tausche Code gegen Access Token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          error: 'Fehler beim Token-Austausch',
          details: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      accessToken: data.access_token,
      scope: data.scope,
      shop: data.shop || shop,
      message: 'Access Token erfolgreich erhalten',
    })
  } catch (error: any) {
    console.error('Error in OAuth token exchange:', error)
    return NextResponse.json(
      {
        error: error.message || 'Fehler beim OAuth-Flow',
      },
      { status: 500 }
    )
  }
}

