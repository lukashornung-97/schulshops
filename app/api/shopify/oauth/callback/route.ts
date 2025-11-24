import { NextRequest, NextResponse } from 'next/server'

/**
 * OAuth Callback Handler
 * Wird von Shopify nach Autorisierung aufgerufen
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const hmac = searchParams.get('hmac')

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

    // Redirect zurück zur App mit Access Token
    // In Produktion sollte der Token sicher gespeichert werden (z.B. in Datenbank)
    return NextResponse.redirect(
      new URL(
        `/?shopify_connected=true&shop=${encodeURIComponent(shop)}&token=${encodeURIComponent(tokenData.accessToken)}`,
        request.url
      )
    )
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}

