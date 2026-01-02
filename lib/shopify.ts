/**
 * Shopify GraphQL API Client
 * 
 * Diese Funktionen ermöglichen die Kommunikation mit der Shopify Admin GraphQL API
 * Dokumentation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate
 */

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
  }>
  productOptions?: Array<{
    name: string
    values: Array<{ name: string }>
  }>
}

export interface ShopifyProductVariant {
  name: string
  color_name?: string | null
  color_hex?: string | null
  additional_price: number
  sku?: string | null
  id?: string
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
    mutation productCreate($product: ProductCreateInput!) {
      productCreate(product: $product) {
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

  // Varianten hinzufügen
  if (productInput.variants && productInput.variants.length > 0) {
    shopifyProduct.variants = productInput.variants.map((variant) => {
      const variantData: any = {
        price: variant.price,
      }
      
      if (variant.sku) {
        variantData.sku = variant.sku
      }
      
      if (variant.inventoryPolicy) {
        variantData.inventoryPolicy = variant.inventoryPolicy
      }
      
      if (variant.inventoryQuantity !== undefined) {
        variantData.inventoryQuantities = [
          { availableQuantity: variant.inventoryQuantity }
        ]
      }
      
      return variantData
    })
  }

  const variables = {
    product: shopifyProduct,
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
    // Gruppiere Varianten nach Typ (Größe, Farbe, etc.)
    const sizeVariants = variants.filter((v) => !v.color_name)
    const colorVariants = variants.filter((v) => v.color_name)

    const productOptions: Array<{ name: string; values: Array<{ name: string }> }> = []

    // Größen-Option hinzufügen
    if (sizeVariants.length > 0) {
      const uniqueSizes = Array.from(new Set(sizeVariants.map((v) => v.name)))
      productOptions.push({
        name: 'Größe',
        values: uniqueSizes.map((size) => ({ name: size })),
      })
    }

    // Farb-Option hinzufügen
    if (colorVariants.length > 0) {
      const uniqueColors = Array.from(
        new Set(colorVariants.map((v) => v.color_name).filter(Boolean))
      )
      productOptions.push({
        name: 'Farbe',
        values: uniqueColors.map((color) => ({ name: color! })),
      })
    }

    if (productOptions.length > 0) {
      shopifyProduct.productOptions = productOptions
    }

    // Varianten erstellen - für jede Kombination aus Größe und Farbe
    const variantList: Array<{ price: string; sku?: string }> = []
    
    if (sizeVariants.length > 0 && colorVariants.length > 0) {
      // Kombinationen aus Größe und Farbe
      sizeVariants.forEach((sizeVariant) => {
        colorVariants.forEach((colorVariant) => {
          const variantPrice = (
            product.base_price +
            (sizeVariant.additional_price || 0) +
            (colorVariant.additional_price || 0)
          ).toFixed(2)
          
          variantList.push({
            price: variantPrice,
            sku: sizeVariant.sku || colorVariant.sku || undefined,
          })
        })
      })
    } else if (sizeVariants.length > 0) {
      // Nur Größen
      sizeVariants.forEach((variant) => {
        const variantPrice = (product.base_price + (variant.additional_price || 0)).toFixed(2)
        variantList.push({
          price: variantPrice,
          sku: variant.sku || undefined,
        })
      })
    } else if (colorVariants.length > 0) {
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
      variants.forEach((variant) => {
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
 * Normalisiert eine Varianten-Row aus der DB in ein konsistentes Format.
 */
export function normalizeVariant(variant: any): ShopifyProductVariant {
  return {
    id: variant?.id,
    name: typeof variant?.name === 'string' ? variant.name : '',
    color_name: typeof variant?.color_name === 'string' ? variant.color_name : null,
    color_hex: typeof variant?.color_hex === 'string' ? variant.color_hex : null,
    additional_price: typeof variant?.additional_price === 'number'
      ? variant.additional_price
      : parseFloat(variant?.additional_price) || 0,
    sku: typeof variant?.sku === 'string' ? variant.sku : null,
  }
}

/**
 * Wrapper, der aktuell das normale Produkt-Create nutzt.
 * Bilder werden im bestehenden Mutation-Flow verarbeitet.
 */
export async function createShopifyProductWithImages(
  shopDomain: string,
  accessToken: string,
  productInput: ShopifyProductInput & { images?: Array<{ src: string; altText?: string }> }
) {
  // Der vorhandene createShopifyProduct-Mutation unterstützt bereits Images im Input
  return createShopifyProduct(shopDomain, accessToken, productInput)
}

