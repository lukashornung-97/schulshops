import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route zum Testen der Shopify-Verbindung
 * POST /api/shopify/test-connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shopDomain, accessToken } = body

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: shopDomain und accessToken sind erforderlich' },
        { status: 400 }
      )
    }

    // Teste die Verbindung mit einer einfachen GraphQL Query
    const query = `
      query {
        shop {
          name
          myshopifyDomain
          plan {
            displayName
          }
        }
      }
    `

    // Stelle sicher, dass die Domain das richtige Format hat
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')

    const response = await fetch(`https://${cleanDomain}/admin/api/2025-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Shopify API Error: ${response.status} ${response.statusText}`
      let troubleshooting: any = null

      if (response.status === 401) {
        errorMessage = `401 Unauthorized - Authentifizierung fehlgeschlagen`
        troubleshooting = {
          possibleCauses: [
            'Der Access Token ist falsch oder abgelaufen',
            'Sie verwenden einen Session Token (shpss_) statt Admin API Token (shpat_)',
            'Die Shop Domain ist falsch formatiert',
            'Der Token hat nicht die erforderlichen Berechtigungen (read_products oder write_products)',
          ],
          tokenPrefix: accessToken.substring(0, 10) + '...',
          expectedTokenFormat: 'shpat_... (Admin API Access Token)',
          expectedDomainFormat: 'shop-name.myshopify.com',
          currentDomain: cleanDomain,
          howToCreateToken: {
            step1: 'Gehen Sie zu Shopify Admin → Settings → Apps and sales channels',
            step2: 'Klicken Sie auf "Develop apps" → "Create an app"',
            step3: 'Geben Sie einen App-Namen ein und klicken Sie auf "Create app"',
            step4: 'Gehen Sie zu "API credentials" → "Admin API access token"',
            step5: 'Aktivieren Sie die Scopes: read_products und write_products',
            step6: 'Klicken Sie auf "Install app" und kopieren Sie den Token (beginnt mit shpat_)',
          },
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: errorText,
          troubleshooting,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.errors) {
      return NextResponse.json(
        {
          success: false,
          error: 'GraphQL Errors',
          details: data.errors,
        },
        { status: 400 }
      )
    }

    if (data.data && data.data.shop) {
      return NextResponse.json({
        success: true,
        shop: {
          name: data.data.shop.name,
          domain: data.data.shop.myshopifyDomain,
          plan: data.data.shop.plan?.displayName || 'Unknown',
        },
        message: 'Verbindung erfolgreich!',
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unerwartete Antwort von Shopify',
        details: data,
      },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Error testing Shopify connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Fehler beim Testen der Verbindung',
      },
      { status: 500 }
    )
  }
}

