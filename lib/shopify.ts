/**
 * Shopify GraphQL API Client
 * 
 * Diese Funktionen ermöglichen die Kommunikation mit der Shopify Admin GraphQL API
 * Dokumentation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate
 */

/**
 * Bereinigt und validiert einen Shopify Access Token
 * 
 * Hinweis:
 * - Tokens aus Custom Apps beginnen oft mit `shpat_`
 * - Tokens aus dem OAuth-Flow können andere Präfixe haben
 * 
 * Deshalb prüfen wir nur minimale Länge und entfernen Whitespace.
 */
function cleanAndValidateToken(accessToken: string): string {
  // Bereinige Token (entferne Leerzeichen, Zeilenumbrüche, etc.)
  const cleanToken = accessToken.trim().replace(/\s+/g, '')
  
  // Validiere Token-Länge (Basis-Sicherheitscheck)
  if (cleanToken.length < 32) {
    throw new Error(
      `Access Token scheint zu kurz zu sein (${cleanToken.length} Zeichen). Erwartet: mindestens 32 Zeichen`
    )
  }
  
  return cleanToken
}

/**
 * Bereinigt eine Shopify Shop Domain
 */
function cleanShopDomain(shopDomain: string): string {
  return shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export interface ShopifyProductInput {
  title: string
  description?: string
  vendor?: string
  productType?: string
  tags?: string[]
  variants?: Array<{
    price: string
    sku?: string
    inventoryPolicy?: 'DENY' | 'CONTINUE'
    inventoryQuantity?: number
    option1?: string
    option2?: string
    option3?: string
  }>
  productOptions?: Array<{
    name: string
    values: Array<{ name: string }>
  }>
  images?: Array<{
    src: string
    altText?: string
    variantIds?: string[]
  }>
}

export interface ShopifyProductVariant {
  name: string
  color_name?: string | null
  color_hex?: string | null
  additional_price: number
  sku?: string | null
}

/**
 * Normalisiert Varianten, die Größe und Farbe im name-Feld kombinieren
 * Erkennt Patterns wie "L/Off-White" oder "L / Off-White" und trennt sie
 */
export function normalizeVariant(variant: ShopifyProductVariant): ShopifyProductVariant {
  // Wenn bereits color_name vorhanden ist, ist die Variante bereits normalisiert
  if (variant.color_name) {
    return variant
  }

  // Prüfe ob name-Feld ein "/" enthält (könnte Größe/Farbe sein)
  const name = variant.name.trim()
  const slashIndex = name.indexOf('/')
  
  if (slashIndex > 0 && slashIndex < name.length - 1) {
    // Teile am "/"
    const parts = name.split('/').map(p => p.trim()).filter(p => p.length > 0)
    
    if (parts.length === 2) {
      // Erste Hälfte ist wahrscheinlich Größe, zweite Farbe
      // Prüfe ob erste Hälfte wie eine Größe aussieht (kurz, oft nur Buchstaben/Zahlen)
      const firstPart = parts[0]
      const secondPart = parts[1]
      
      // Größen sind typischerweise kurz (1-4 Zeichen) und enthalten oft X, S, M, L, oder Zahlen
      const sizePattern = /^[0-9XLSM]+$/i
      const isLikelySize = sizePattern.test(firstPart) || firstPart.length <= 4
      
      if (isLikelySize) {
        return {
          ...variant,
          name: firstPart,
          color_name: secondPart,
        }
      }
    }
  }

  // Keine Normalisierung nötig
  return variant
}

export interface ShopifyCreateProductResponse {
  productCreate: {
    product: {
      id: string
      title: string
    } | null
    userErrors: Array<{
      field: string[]
      message: string
    }>
  }
}

/**
 * Erstellt ein Shopify-Produkt via GraphQL API
 * Dokumentation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate
 */
export async function createShopifyProduct(
  shopDomain: string,
  accessToken: string,
  productInput: ShopifyProductInput
): Promise<ShopifyCreateProductResponse> {
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  // Konvertiere zu Shopify ProductCreateInput Format
  const shopifyProduct: any = {
    title: productInput.title,
  }

  if (productInput.description) {
    shopifyProduct.descriptionHtml = productInput.description
  }

  if (productInput.vendor) {
    shopifyProduct.vendor = productInput.vendor
  }

  if (productInput.productType) {
    shopifyProduct.productType = productInput.productType
  }

  if (productInput.tags && productInput.tags.length > 0) {
    shopifyProduct.tags = productInput.tags
  }

  // Product Options hinzufügen (muss vor Variants kommen)
  if (productInput.productOptions && productInput.productOptions.length > 0) {
    shopifyProduct.productOptions = productInput.productOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }))
  }

  // Hinweis: In neueren Shopify Admin GraphQL Versionen unterstützt ProductInput
  // kein `variants` Feld mehr. Varianten müssen separat via productVariantsBulkCreate
  // angelegt werden. Daher senden wir hier aktuell keine Varianten mehr mit und
  // erstellen nur das Basis-Produkt (Shopify legt dann eine Default-Variante an).

  const variables = {
    input: shopifyProduct,
  }

  // Stelle sicher, dass die Domain das richtige Format hat
  const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const response = await fetch(`https://${cleanDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API Error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`)
  }

  return data.data
}

/**
 * Konvertiert unsere Produktstruktur zu Shopify-Format
 */
export function convertProductToShopify(
  product: {
    name: string
    description?: string | null
    base_price: number
  },
  variants?: ShopifyProductVariant[]
): ShopifyProductInput {
  const shopifyProduct: ShopifyProductInput = {
    title: product.name,
    description: product.description || undefined,
    vendor: 'Schulshop',
  }

  // Wenn Varianten vorhanden sind, erstelle Product Options und Variants
  if (variants && variants.length > 0) {
    // Normalisiere Varianten zuerst (trenne kombinierte Größe/Farbe Werte)
    const normalizedVariants = variants.map(normalizeVariant)
    
    // Gruppiere Varianten nach Typ (Größe, Farbe, etc.)
    // WICHTIG: Eine Variante kann NICHT gleichzeitig Größe und Farbe sein
    // Wenn eine Variante beide hat, wird sie als Kombination behandelt
    const sizeVariants = normalizedVariants.filter((v) => v.name && !v.color_name)
    const colorVariants = normalizedVariants.filter((v) => v.color_name && !v.name)
    
    // Varianten die bereits beide haben (sollten eigentlich nicht vorkommen nach Normalisierung)
    // werden als separate Kombinationen behandelt
    const combinedVariants = normalizedVariants.filter((v) => v.name && v.color_name)

    const productOptions: Array<{ name: string; values: Array<{ name: string }> }> = []

    // Sammle alle eindeutigen Größen (auch aus combinedVariants)
    const allSizes = new Set<string>()
    sizeVariants.forEach((v) => allSizes.add(v.name))
    combinedVariants.forEach((v) => allSizes.add(v.name))
    
    // Sammle alle eindeutigen Farben (auch aus combinedVariants)
    const allColors = new Set<string>()
    colorVariants.forEach((v) => v.color_name && allColors.add(v.color_name))
    combinedVariants.forEach((v) => v.color_name && allColors.add(v.color_name))

    // Größen-Option hinzufügen
    if (allSizes.size > 0) {
      productOptions.push({
        name: 'Größe',
        values: Array.from(allSizes).map((size) => ({ name: size })),
      })
    }

    // Farb-Option hinzufügen
    if (allColors.size > 0) {
      productOptions.push({
        name: 'Farbe',
        values: Array.from(allColors).map((color) => ({ name: color })),
      })
    }

    if (productOptions.length > 0) {
      shopifyProduct.productOptions = productOptions
    }

    // Varianten erstellen - für jede Kombination aus Größe und Farbe
    const variantList: Array<{ price: string; sku?: string }> = []
    
    // Wenn wir kombinierte Varianten haben, verwende diese direkt
    if (combinedVariants.length > 0) {
      combinedVariants.forEach((variant) => {
        const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
        variantList.push({
          price: variantPrice,
          sku: variant.sku || undefined,
        })
      })
    } else if (allSizes.size > 0 && allColors.size > 0) {
      // Kombinationen aus Größe und Farbe erstellen
      // Verwende die ursprünglichen Varianten für Preise, aber kombiniere alle Größen mit allen Farben
      Array.from(allSizes).forEach((size) => {
        Array.from(allColors).forEach((color) => {
          // Finde die ursprüngliche Variante für diese Größe und Farbe
          const sizeVariant = normalizedVariants.find((v) => v.name === size && !v.color_name)
          const colorVariant = normalizedVariants.find((v) => v.color_name === color && !v.name)
          
          const variantPrice = (
            product.base_price +
            (sizeVariant?.additional_price || 0) +
            (colorVariant?.additional_price || 0)
          ).toFixed(2)
          
          variantList.push({
            price: variantPrice,
            sku: sizeVariant?.sku || colorVariant?.sku || undefined,
          })
        })
      })
    } else if (allSizes.size > 0) {
      // Nur Größen
      sizeVariants.forEach((variant) => {
        const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
        variantList.push({
          price: variantPrice,
          sku: variant.sku || undefined,
        })
      })
    } else if (allColors.size > 0) {
      // Nur Farben
      colorVariants.forEach((variant) => {
        const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
        variantList.push({
          price: variantPrice,
          sku: variant.sku || undefined,
        })
      })
    } else {
      // Fallback: alle Varianten
      normalizedVariants.forEach((variant) => {
        const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
        variantList.push({
          price: variantPrice,
          sku: variant.sku || undefined,
        })
      })
    }

    shopifyProduct.variants = variantList
  } else {
    // Keine Varianten - einfaches Produkt mit einem Standard-Variant
    shopifyProduct.variants = [
      {
        price: product.base_price.toFixed(2),
      },
    ]
  }

  return shopifyProduct
}

/**
 * Lädt ein Bild zu Shopify hoch
 * Dokumentation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
 */
export async function uploadImageToShopify(
  shopDomain: string,
  accessToken: string,
  imageUrl: string,
  altText?: string
): Promise<string> {
  const mutation = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          ... on MediaImage {
            image {
              url
              altText
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  // Bereinige Domain und Token
  const cleanDomain = cleanShopDomain(shopDomain)
  const cleanToken = cleanAndValidateToken(accessToken)

  const variables = {
    files: [
      {
        originalSource: imageUrl,
        alt: altText || '',
      },
    ],
  }

  const response = await fetch(`https://${cleanDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': cleanToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API Error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`)
  }

  const fileCreate = data.data.fileCreate

  if (fileCreate.userErrors && fileCreate.userErrors.length > 0) {
    throw new Error(`Shopify User Errors: ${JSON.stringify(fileCreate.userErrors)}`)
  }

  if (!fileCreate.files || fileCreate.files.length === 0) {
    throw new Error('Kein Bild wurde hochgeladen')
  }

  const file = fileCreate.files[0]
  
  // Für MediaImage gibt es image.url, für andere Typen möglicherweise anders
  if (file.image && file.image.url) {
    return file.image.url
  }

  // Fallback: Versuche die ID zu verwenden (kann später zu URL konvertiert werden)
  throw new Error('Bild-URL konnte nicht ermittelt werden')
}

/**
 * Erstellt ein Shopify-Produkt mit Bildern
 */
export async function createShopifyProductWithImages(
  shopDomain: string,
  accessToken: string,
  productInput: ShopifyProductInput
): Promise<ShopifyCreateProductResponse> {
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  // Konvertiere zu Shopify ProductCreateInput Format
  const shopifyProduct: any = {
    title: productInput.title,
  }

  if (productInput.description) {
    shopifyProduct.descriptionHtml = productInput.description
  }

  if (productInput.vendor) {
    shopifyProduct.vendor = productInput.vendor
  }

  if (productInput.productType) {
    shopifyProduct.productType = productInput.productType
  }

  if (productInput.tags && productInput.tags.length > 0) {
    shopifyProduct.tags = productInput.tags
  }

  // Product Options hinzufügen (muss vor Variants kommen)
  if (productInput.productOptions && productInput.productOptions.length > 0) {
    shopifyProduct.productOptions = productInput.productOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }))
  }

  // Hinweis: In neueren Shopify Admin GraphQL Versionen unterstützt ProductInput
  // kein `variants` Feld mehr. Varianten müssen separat via productVariantsBulkCreate
  // angelegt werden. Daher senden wir hier aktuell keine Varianten mehr mit und
  // erstellen nur das Basis-Produkt (Shopify legt dann eine Default-Variante an).

  // Bilder hinzufügen
  if (productInput.images && productInput.images.length > 0) {
    shopifyProduct.images = productInput.images.map((img) => ({
      src: img.src,
      altText: img.altText || '',
      variantIds: img.variantIds || [],
    }))
  }

  const variables = {
    input: shopifyProduct,
  }

  // Bereinige Domain und Token
  const cleanDomain = cleanShopDomain(shopDomain)
  const cleanToken = cleanAndValidateToken(accessToken)

  const response = await fetch(`https://${cleanDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': cleanToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Shopify API Error: ${response.status} ${response.statusText}`
    
    if (response.status === 401) {
      errorMessage = `401 Unauthorized - Access Token ungültig oder abgelaufen`
      console.error('Shopify 401 Error Details:', {
        shopDomain: cleanDomain,
        tokenPrefix: cleanToken.substring(0, 15) + '...',
        tokenLength: cleanToken.length,
        errorResponse: errorText,
      })
    }
    
    throw new Error(`${errorMessage} - ${errorText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`)
  }

  return data.data
}

