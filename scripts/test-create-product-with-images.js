#!/usr/bin/env node

/**
 * Test-Script für die create-product-with-images Route
 * 
 * Verwendung:
 *   node scripts/test-create-product-with-images.js PRODUCT_ID [SHOP_DOMAIN] [ACCESS_TOKEN]
 * 
 * Beispiel:
 *   node scripts/test-create-product-with-images.js abc-123-def-456 graduprint-test.myshopify.com shpat_...
 */

const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  console.log('🧪 Test: Shopify Produkt mit Bildern erstellen\n')

  // Lade Parameter aus Command Line oder frage danach
  const args = process.argv.slice(2)
  let productId = args[0]
  let shopDomain = args[1]
  let accessToken = args[2]

  // Frage nach fehlenden Parametern
  if (!productId) {
    productId = await question('Produkt-ID (UUID): ')
  }

  if (!shopDomain) {
    shopDomain = await question('Shop Domain (z.B. graduprint-test.myshopify.com): ')
  }

  if (!accessToken) {
    accessToken = await question('Access Token (shpat_...): ')
  }

  console.log('\n📋 Parameter:')
  console.log(`  Produkt-ID: ${productId}`)
  console.log(`  Shop Domain: ${shopDomain}`)
  console.log(`  Access Token: ${accessToken.substring(0, 15)}...`)
  console.log('')

  const apiUrl = 'http://localhost:3000/api/shopify/create-product-with-images'

  try {
    console.log('🚀 Sende Request...\n')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        shopDomain,
        accessToken,
      }),
    })

    const data = await response.json()

    console.log('📥 Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    if (response.ok && data.success) {
      console.log('✅ Erfolg!')
      console.log(`   Produkt erstellt: ${data.product.title}`)
      console.log(`   Shopify ID: ${data.product.id}`)
      if (data.message) {
        console.log(`   ${data.message}`)
      }
    } else {
      console.log('❌ Fehler!')
      if (data.error) {
        console.log(`   Fehler: ${data.error}`)
      }
      if (data.userErrors && data.userErrors.length > 0) {
        console.log('\n   Shopify User Errors:')
        data.userErrors.forEach((err, index) => {
          console.log(`   ${index + 1}. ${err.message}`)
          if (err.field && err.field.length > 0) {
            console.log(`      Feld: ${err.field.join(' > ')}`)
          }
        })
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Senden des Requests:')
    console.error(error.message)
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tipp: Stelle sicher, dass der Next.js Server läuft:')
      console.log('   npm run dev')
    }
  } finally {
    rl.close()
  }
}

main().catch(console.error)



