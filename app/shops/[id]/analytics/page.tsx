'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  IconButton,
  Button,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BarChartIcon from '@mui/icons-material/BarChart'
import DownloadIcon from '@mui/icons-material/Download'
import ExcelJS from 'exceljs'

type OrderItem = Database['public']['Tables']['order_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ProductVariant = Database['public']['Tables']['product_variants']['Row']
type Order = Database['public']['Tables']['orders']['Row']

interface OrderItemWithDetails extends OrderItem {
  product?: Product
  variant?: ProductVariant | null
  order?: Order
}

interface ProductAnalytics {
  product: Product
  totalQuantity: number
  bySize: Map<string, number> // Größe -> Menge
  byColor: Map<string, number> // Farbe -> Menge
  bySizeAndColor: Map<string, Map<string, number>> // Größe -> (Farbe -> Menge)
  orders: Set<string> // Order IDs
}

interface CustomerOrderItem {
  customer_name: string
  customer_email: string | null
  class_name: string | null
  product_name: string
  size: string | null
  color: string | null
  quantity: number
  order_id: string
}

export default function ShopAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<ProductAnalytics[]>([])
  const [customerItems, setCustomerItems] = useState<CustomerOrderItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      loadAnalytics()
    }
  }, [params.id])

  async function loadAnalytics() {
    try {
      setLoading(true)
      setError(null)

      // Lade Shop-Daten mit Öffnungszeiten
      const { data: shopData } = await supabase
        .from('shops')
        .select('shop_open_at, shop_close_at')
        .eq('id', params.id)
        .single()

      if (!shopData) {
        setError('Shop nicht gefunden')
        setLoading(false)
        return
      }

      // Lade alle Order Items für diesen Shop
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_name, customer_email, class_name, created_at')
        .eq('shop_id', params.id)
        .in('status', ['pending', 'paid', 'fulfilled']) // Nur aktive Bestellungen

      // Filtere nach Öffnungszeitraum
      if (shopData.shop_open_at) {
        ordersQuery = ordersQuery.gte('created_at', shopData.shop_open_at)
      }
      if (shopData.shop_close_at) {
        ordersQuery = ordersQuery.lte('created_at', shopData.shop_close_at)
      }

      const { data: ordersData } = await ordersQuery

      if (!ordersData || ordersData.length === 0) {
        setAnalytics([])
        setCustomerItems([])
        setLoading(false)
        return
      }

      const orderIds = ordersData.map(o => o.id)

      // Lade Order Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      if (itemsError) throw itemsError

      // Lade Produkte
      const productIds = Array.from(new Set(itemsData?.map(item => item.product_id) || []))
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)

      // Lade Varianten
      const variantIds = itemsData
        ?.map(item => item.variant_id)
        .filter((id): id is string => id !== null) || []
      
      const { data: variantsData } = variantIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('*')
            .in('id', variantIds)
        : { data: null }

      const productsMap = new Map(productsData?.map(p => [p.id, p]) || [])
      const variantsMap = new Map(variantsData?.map(v => [v.id, v]) || [])
      const ordersMap = new Map(ordersData.map(o => [o.id, o]))
      
      // Erstelle Customer Items Liste für Fulfillment
      const customerItemsList: CustomerOrderItem[] = []

      // Kombiniere Items mit Produkten und Varianten
      const itemsWithDetails: OrderItemWithDetails[] = (itemsData || []).map(item => ({
        ...item,
        product: productsMap.get(item.product_id),
        variant: item.variant_id ? variantsMap.get(item.variant_id) || null : null,
        order: ordersMap.get(item.order_id),
      }))

      // Gruppiere nach Produkt und analysiere
      const analyticsMap = new Map<string, ProductAnalytics>()

      itemsWithDetails.forEach(item => {
        if (!item.product) return

        const productId = item.product.id
        if (!analyticsMap.has(productId)) {
          analyticsMap.set(productId, {
            product: item.product,
            totalQuantity: 0,
            bySize: new Map(),
            byColor: new Map(),
            bySizeAndColor: new Map(),
            orders: new Set(),
          })
        }

        const analytics = analyticsMap.get(productId)!
        analytics.totalQuantity += item.quantity
        analytics.orders.add(item.order_id)

        // Parse Größe und Farbe aus Variante
        let size: string | null = null
        let color: string | null = null

        if (item.variant) {
          // Kombinations-Variante: name = Größe, color_name = Farbe
          if (item.variant.name && item.variant.name.trim() && item.variant.color_name && item.variant.color_name.trim()) {
            size = item.variant.name
            color = item.variant.color_name
          }
          // Fallback: Parse Format "Größe / Farbe" im name-Feld
          else if (item.variant.name && item.variant.name.includes('/')) {
            const parts = item.variant.name.split('/').map(s => s.trim())
            if (parts.length >= 2) {
              size = parts[0] || null
              color = parts[1] || null
            } else if (parts.length === 1) {
              const singleValue = parts[0]
              if (/^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i.test(singleValue)) {
                size = singleValue
              } else {
                color = singleValue
              }
            }
          } else if (item.variant.name && item.variant.name.trim() && !item.variant.color_name) {
            size = item.variant.name
          } else if (item.variant.color_name && item.variant.color_name.trim()) {
            color = item.variant.color_name
          }
        }

        // Aggregiere nach Größe
        if (size) {
          analytics.bySize.set(size, (analytics.bySize.get(size) || 0) + item.quantity)
        }

        // Aggregiere nach Farbe
        if (color) {
          analytics.byColor.set(color, (analytics.byColor.get(color) || 0) + item.quantity)
        }

        // Aggregiere nach Größe UND Farbe
        if (size && color) {
          if (!analytics.bySizeAndColor.has(size)) {
            analytics.bySizeAndColor.set(size, new Map())
          }
          const colorMap = analytics.bySizeAndColor.get(size)!
          colorMap.set(color, (colorMap.get(color) || 0) + item.quantity)
        }

        // Füge zu Customer Items hinzu
        if (item.order && item.product) {
          for (let i = 0; i < item.quantity; i++) {
            customerItemsList.push({
              customer_name: item.order.customer_name,
              customer_email: item.order.customer_email || null,
              class_name: item.order.class_name || null,
              product_name: item.product.name,
              size: size,
              color: color,
              quantity: 1,
              order_id: item.order_id,
            })
          }
        }
      })

      // Konvertiere Map zu Array und sortiere nach Produktname
      const analyticsArray = Array.from(analyticsMap.values()).sort((a, b) =>
        a.product.name.localeCompare(b.product.name)
      )

      // Sortiere Customer Items nach Name, dann Klasse
      customerItemsList.sort((a, b) => {
        const nameCompare = a.customer_name.localeCompare(b.customer_name)
        if (nameCompare !== 0) return nameCompare
        const classA = a.class_name || ''
        const classB = b.class_name || ''
        return classA.localeCompare(classB)
      })

      setAnalytics(analyticsArray)
      setCustomerItems(customerItemsList)
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      setError(error.message || 'Fehler beim Laden der Auswertung')
    } finally {
      setLoading(false)
    }
  }

  function sortSizes(sizes: string[]): string[] {
    // Standard-Größenfolge
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL']
    
    return sizes.sort((a, b) => {
      const aIndex = sizeOrder.findIndex(s => s.toUpperCase() === a.toUpperCase())
      const bIndex = sizeOrder.findIndex(s => s.toUpperCase() === b.toUpperCase())
      
      // Wenn beide in der Standard-Liste sind, sortiere nach Index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      // Wenn nur a in der Liste ist, kommt es zuerst
      if (aIndex !== -1) return -1
      // Wenn nur b in der Liste ist, kommt es zuerst
      if (bIndex !== -1) return 1
      
      // Wenn beide nicht in der Liste sind, prüfe ob es Zahlen sind
      const aNum = parseInt(a)
      const bNum = parseInt(b)
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum
      }
      
      // Sonst alphabetisch
      return a.localeCompare(b)
    })
  }

  function getAllSizes(analytics: ProductAnalytics): string[] {
    const sizes = new Set<string>()
    analytics.bySize.forEach((_, size) => sizes.add(size))
    analytics.bySizeAndColor.forEach((_, size) => sizes.add(size))
    return sortSizes(Array.from(sizes))
  }

  function getAllColors(analytics: ProductAnalytics): string[] {
    const colors = new Set<string>()
    analytics.byColor.forEach((_, color) => colors.add(color))
    analytics.bySizeAndColor.forEach((colorMap) => {
      colorMap.forEach((_, color) => colors.add(color))
    })
    return Array.from(colors).sort()
  }

  async function exportToExcel() {
    if (analytics.length === 0) {
      alert('Keine Daten zum Exportieren vorhanden')
      return
    }

    // Lade Shop-Daten mit Öffnungszeiten
    const { data: shopData } = await supabase
      .from('shops')
      .select('shop_open_at, shop_close_at')
      .eq('id', params.id)
      .single()

    if (!shopData) {
      alert('Shop nicht gefunden')
      return
    }

    // Lade die vollständigen Daten für Fulfillment
    let ordersQuery = supabase
      .from('orders')
      .select('id, customer_name, customer_email, class_name, created_at')
      .eq('shop_id', params.id)
      .in('status', ['pending', 'paid', 'fulfilled'])

    // Filtere nach Öffnungszeitraum
    if (shopData.shop_open_at) {
      ordersQuery = ordersQuery.gte('created_at', shopData.shop_open_at)
    }
    if (shopData.shop_close_at) {
      ordersQuery = ordersQuery.lte('created_at', shopData.shop_close_at)
    }

    const { data: ordersData } = await ordersQuery

    if (!ordersData || ordersData.length === 0) {
      alert('Keine Bestellungen im Öffnungszeitraum gefunden')
      return
    }

    const orderIds = ordersData.map(o => o.id)
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)

    const productIds = Array.from(new Set(itemsData?.map(item => item.product_id) || []))
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    const variantIds = itemsData
      ?.map(item => item.variant_id)
      .filter((id): id is string => id !== null) || []
    
    const { data: variantsData } = variantIds.length > 0
      ? await supabase
          .from('product_variants')
          .select('*')
          .in('id', variantIds)
      : { data: null }

    const productsMap = new Map(productsData?.map(p => [p.id, p]) || [])
    const variantsMap = new Map(variantsData?.map(v => [v.id, v]) || [])
    const ordersMap = new Map(ordersData.map(o => [o.id, o]))

    // Erstelle Customer Items Liste für Fulfillment
    const fulfillmentItemsList: CustomerOrderItem[] = []

    itemsData?.forEach((item) => {
      const product = productsMap.get(item.product_id)
      const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
      const order = ordersMap.get(item.order_id)

      if (!product || !order) return

      // Parse Größe und Farbe aus Variante
      let size: string | null = null
      let color: string | null = null

      if (variant) {
        if (variant.name && variant.name.trim() && variant.color_name && variant.color_name.trim()) {
          size = variant.name
          color = variant.color_name
        } else if (variant.name && variant.name.includes('/')) {
          const parts = variant.name.split('/').map(s => s.trim())
          if (parts.length >= 2) {
            size = parts[0] || null
            color = parts[1] || null
          } else if (parts.length === 1) {
            const singleValue = parts[0]
            if (/^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i.test(singleValue)) {
              size = singleValue
            } else {
              color = singleValue
            }
          }
        } else if (variant.name && variant.name.trim() && !variant.color_name) {
          size = variant.name
        } else if (variant.color_name && variant.color_name.trim()) {
          color = variant.color_name
        }
      }

      // Füge zu Customer Items hinzu
      for (let i = 0; i < item.quantity; i++) {
        fulfillmentItemsList.push({
          customer_name: order.customer_name,
          customer_email: order.customer_email || null,
          class_name: order.class_name || null,
          product_name: product.name,
          size: size,
          color: color,
          quantity: 1,
          order_id: item.order_id,
        })
      }
    })

    // Sortiere Customer Items nach Name, dann Klasse
    fulfillmentItemsList.sort((a, b) => {
      const nameCompare = a.customer_name.localeCompare(b.customer_name)
      if (nameCompare !== 0) return nameCompare
      const classA = a.class_name || ''
      const classB = b.class_name || ''
      return classA.localeCompare(classB)
    })

    // Erstelle ein neues Workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Auswertung')

    // Style-Definitionen
    const headerStyle = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FF667EEA' },
      },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      border: {
        top: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    }

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FF667EEA' } },
      alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    }

    const productHeaderStyle = {
      font: { bold: true, size: 13, color: { argb: 'FF333333' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFF0F0F0' },
      },
      border: {
        top: { style: 'medium' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    }

    const tableHeaderStyle = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FF764BA2' },
      },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      border: {
        top: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    }

    const totalRowStyle = {
      font: { bold: true, size: 11 },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFE8E8E8' },
      },
      border: {
        top: { style: 'medium' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    }

    const cellStyle = {
      border: {
        top: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    }

    let currentRow = 1

    // Header für die gesamte Auswertung
    const titleRow = worksheet.addRow(['Shop Auswertungsübersicht'])
    titleRow.height = 25
    titleRow.getCell(1).style = titleStyle
    worksheet.mergeCells(currentRow, 1, currentRow, 5)
    currentRow++

    const dateRow = worksheet.addRow([`Erstellt am: ${new Date().toLocaleString('de-DE')}`])
    dateRow.getCell(1).style = {
      font: { italic: true, size: 10, color: { argb: 'FF666666' } },
    }
    worksheet.mergeCells(currentRow, 1, currentRow, 5)
    currentRow++

    // Leerzeile
    worksheet.addRow([])
    currentRow++

    // Iteriere über alle Produkte
    analytics.forEach((productAnalytics, productIndex) => {
      // Produkt-Header
      const productNameRow = worksheet.addRow([`Produkt: ${productAnalytics.product.name}`])
      productNameRow.height = 22
      productNameRow.getCell(1).style = productHeaderStyle
      worksheet.mergeCells(currentRow, 1, currentRow, 5)
      currentRow++

      const infoRow = worksheet.addRow([
        `Gesamtmenge: ${productAnalytics.totalQuantity} Stück`,
      ])
      infoRow.getCell(1).style = {
        font: { size: 10, color: { argb: 'FF666666' } },
      }
      worksheet.mergeCells(currentRow, 1, currentRow, 5)
      currentRow++

      // Leerzeile
      worksheet.addRow([])
      currentRow++

      const sizes = getAllSizes(productAnalytics)
      const colors = getAllColors(productAnalytics)
      const hasSizeAndColor = sizes.length > 0 && colors.length > 0

      if (hasSizeAndColor) {
        // Erstelle Matrix-Tabelle: Größen x Farben
        // Header-Zeile
        const headerRow = worksheet.addRow(['Größe', ...colors, 'Gesamt'])
        headerRow.height = 20
        headerRow.eachCell((cell, colNumber) => {
          cell.style = tableHeaderStyle
        })
        currentRow++

        // Daten-Zeilen
        sizes.forEach((size) => {
          const colorMap = productAnalytics.bySizeAndColor.get(size) || new Map()
          const sizeTotal = productAnalytics.bySize.get(size) || 0
          const rowData = [size]

          colors.forEach((color) => {
            const quantity = colorMap.get(color) || 0
            rowData.push(quantity > 0 ? quantity : '')
          })

          rowData.push(sizeTotal)
          const dataRow = worksheet.addRow(rowData)
          dataRow.height = 18

          dataRow.eachCell((cell, colNumber) => {
            cell.style = cellStyle
            if (colNumber === 1) {
              // Erste Spalte (Größe) - links ausrichten
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              // Zahlen - rechts ausrichten
              if (typeof cell.value === 'number') {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            }
          })

          currentRow++
        })

        // Gesamt-Zeile
        const totalRowData = ['Gesamt']
        colors.forEach((color) => {
          const colorTotal = productAnalytics.byColor.get(color) || 0
          totalRowData.push(colorTotal > 0 ? colorTotal : '')
        })
        totalRowData.push(productAnalytics.totalQuantity)

        const totalRow = worksheet.addRow(totalRowData)
        totalRow.height = 20
        totalRow.eachCell((cell, colNumber) => {
          cell.style = totalRowStyle
          if (colNumber === 1) {
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else if (typeof cell.value === 'number') {
            cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        currentRow++
      } else if (sizes.length > 0) {
        // Nur Größen vorhanden
        const headerRow = worksheet.addRow(['Größe', 'Menge'])
        headerRow.height = 20
        headerRow.eachCell((cell) => {
          cell.style = tableHeaderStyle
        })
        currentRow++

        sizes.forEach((size) => {
          const dataRow = worksheet.addRow([size, productAnalytics.bySize.get(size) || 0])
          dataRow.height = 18
          dataRow.eachCell((cell, colNumber) => {
            cell.style = cellStyle
            if (colNumber === 1) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })
          currentRow++
        })

        const totalRow = worksheet.addRow(['Gesamt', productAnalytics.totalQuantity])
        totalRow.height = 20
        totalRow.eachCell((cell, colNumber) => {
          cell.style = totalRowStyle
          if (colNumber === 1) {
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        currentRow++
      } else if (colors.length > 0) {
        // Nur Farben vorhanden
        const headerRow = worksheet.addRow(['Farbe', 'Menge'])
        headerRow.height = 20
        headerRow.eachCell((cell) => {
          cell.style = tableHeaderStyle
        })
        currentRow++

        colors.forEach((color) => {
          const dataRow = worksheet.addRow([color, productAnalytics.byColor.get(color) || 0])
          dataRow.height = 18
          dataRow.eachCell((cell, colNumber) => {
            cell.style = cellStyle
            if (colNumber === 1) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })
          currentRow++
        })

        const totalRow = worksheet.addRow(['Gesamt', productAnalytics.totalQuantity])
        totalRow.height = 20
        totalRow.eachCell((cell, colNumber) => {
          cell.style = totalRowStyle
          if (colNumber === 1) {
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        currentRow++
      } else {
        const infoRow = worksheet.addRow(['Keine Varianten-Informationen verfügbar'])
        infoRow.getCell(1).style = {
          font: { italic: true, size: 10, color: { argb: 'FF999999' } },
          alignment: { horizontal: 'left', vertical: 'middle' },
        }
        worksheet.mergeCells(currentRow, 1, currentRow, 5)
        currentRow++
      }

      // Leerzeilen zwischen Produkten (außer beim letzten)
      if (productIndex < analytics.length - 1) {
        worksheet.addRow([])
        currentRow++
        worksheet.addRow([])
        currentRow++
      }
    })

    // Setze Spaltenbreiten
    worksheet.columns.forEach((column, index) => {
      if (index === 0) {
        column.width = 20 // Erste Spalte breiter
      } else {
        column.width = 12
      }
    })

    // Zweites Worksheet: Fulfillment - Zuordnung Person zu Produkten
    const fulfillmentWorksheet = workbook.addWorksheet('Fulfillment')

    let fulfillmentRow = 1

    // Header für Fulfillment
    const fulfillmentTitleRow = fulfillmentWorksheet.addRow(['Fulfillment - Zuordnung Person zu Produkten'])
    fulfillmentTitleRow.height = 25
    fulfillmentTitleRow.getCell(1).style = titleStyle
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    const fulfillmentDateRow = fulfillmentWorksheet.addRow([`Erstellt am: ${new Date().toLocaleString('de-DE')}`])
    fulfillmentDateRow.getCell(1).style = {
      font: { italic: true, size: 10, color: { argb: 'FF666666' } },
    }
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    // Leerzeile
    fulfillmentWorksheet.addRow([])
    fulfillmentRow++

    // Header-Zeile
    const fulfillmentHeaderRow = fulfillmentWorksheet.addRow([
      'Name',
      'Klasse',
      'Produkt',
      'Größe',
      'Farbe',
    ])
    fulfillmentHeaderRow.height = 20
    fulfillmentHeaderRow.eachCell((cell) => {
      cell.style = tableHeaderStyle
    })
    fulfillmentRow++

    // Gruppiere nach Person
    const groupedByCustomer = new Map<string, CustomerOrderItem[]>()
    fulfillmentItemsList.forEach((item) => {
      const key = `${item.customer_name}|${item.class_name || ''}`
      if (!groupedByCustomer.has(key)) {
        groupedByCustomer.set(key, [])
      }
      groupedByCustomer.get(key)!.push(item)
    })

    // Iteriere über alle Personen
    groupedByCustomer.forEach((items, key) => {
      const firstItem = items[0]
      const customerName = firstItem.customer_name
      const className = firstItem.class_name || ''

      // Person-Header
      const personHeaderRow = fulfillmentWorksheet.addRow([
        customerName,
        className,
        '',
        '',
        '',
      ])
      personHeaderRow.height = 22
      personHeaderRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.style = productHeaderStyle
        } else {
          cell.style = {
            fill: {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: 'FFF0F0F0' },
            },
            border: {
              top: { style: 'thin' as const },
              bottom: { style: 'thin' as const },
              left: { style: 'thin' as const },
              right: { style: 'thin' as const },
            },
          }
        }
      })
      fulfillmentRow++

      // Produkt-Zeilen für diese Person
      items.forEach((item) => {
        const productRow = fulfillmentWorksheet.addRow([
          '', // Name leer (wird durch Header abgedeckt)
          '', // Klasse leer
          item.product_name,
          item.size || '-',
          item.color || '-',
        ])
        productRow.height = 18
        productRow.eachCell((cell, colNumber) => {
          cell.style = cellStyle
          if (colNumber <= 2) {
            // Leere Zellen für Name/Klasse
            cell.style.fill = {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: 'FFF9F9F9' },
            }
          } else if (colNumber === 3) {
            // Produktname - links ausrichten
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            // Größe/Farbe - zentriert
            cell.style.alignment = { horizontal: 'center', vertical: 'middle' }
          }
        })
        fulfillmentRow++
      })

      // Leerzeile zwischen Personen
      fulfillmentWorksheet.addRow([])
      fulfillmentRow++
    })

    // Setze Spaltenbreiten für Fulfillment
    fulfillmentWorksheet.columns = [
      { width: 25 }, // Name
      { width: 12 }, // Klasse
      { width: 25 }, // Produkt
      { width: 10 }, // Größe
      { width: 15 }, // Farbe
    ]

    // Validierung: Prüfe ob Summen übereinstimmen
    const totalFromAnalytics = analytics.reduce((sum, productAnalytics) => sum + productAnalytics.totalQuantity, 0)
    const totalFromFulfillment = fulfillmentItemsList.length

    // Füge Validierung am Ende des Fulfillment-Blattes hinzu
    fulfillmentRow++
    fulfillmentWorksheet.addRow([])
    fulfillmentRow++
    
    const validationRow = fulfillmentWorksheet.addRow([
      'VALIDIERUNG',
      '',
      '',
      '',
      '',
    ])
    validationRow.height = 20
    validationRow.getCell(1).style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: totalFromAnalytics === totalFromFulfillment ? 'FF10B981' : 'FFEF4444' },
      },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: {
        top: { style: 'medium' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    }
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    const validationDetailsRow = fulfillmentWorksheet.addRow([
      `Gesamtmenge Blatt 1 (Auswertung): ${totalFromAnalytics} Stück`,
      '',
      '',
      '',
      '',
    ])
    validationDetailsRow.getCell(1).style = {
      font: { size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle' },
    }
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    const validationDetailsRow2 = fulfillmentWorksheet.addRow([
      `Gesamtmenge Blatt 2 (Fulfillment): ${totalFromFulfillment} Stück`,
      '',
      '',
      '',
      '',
    ])
    validationDetailsRow2.getCell(1).style = {
      font: { size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle' },
    }
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    const validationStatusRow = fulfillmentWorksheet.addRow([
      totalFromAnalytics === totalFromFulfillment
        ? `✓ Übereinstimmung: Beide Blätter enthalten ${totalFromAnalytics} Artikel`
        : `⚠ FEHLER: Differenz von ${Math.abs(totalFromAnalytics - totalFromFulfillment)} Artikel!`,
      '',
      '',
      '',
      '',
    ])
    validationStatusRow.getCell(1).style = {
      font: { 
        bold: true, 
        size: 11, 
        color: { argb: totalFromAnalytics === totalFromFulfillment ? 'FF10B981' : 'FFEF4444' } 
      },
      alignment: { horizontal: 'left', vertical: 'middle' },
    }
    fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
    fulfillmentRow++

    // Generiere Dateiname mit Shop-ID und Datum
    const fileName = `shop-auswertung-${params.id}-${new Date().toISOString().split('T')[0]}.xlsx`

    // Warnung in der Konsole und als Alert wenn nicht übereinstimmend
    if (totalFromAnalytics !== totalFromFulfillment) {
      console.warn('VALIDIERUNGSFEHLER:', {
        blatt1: totalFromAnalytics,
        blatt2: totalFromFulfillment,
        differenz: Math.abs(totalFromAnalytics - totalFromFulfillment),
      })
      alert(
        `⚠ VALIDIERUNGSWARNUNG:\n\n` +
        `Blatt 1 (Auswertung): ${totalFromAnalytics} Artikel\n` +
        `Blatt 2 (Fulfillment): ${totalFromFulfillment} Artikel\n` +
        `Differenz: ${Math.abs(totalFromAnalytics - totalFromFulfillment)} Artikel\n\n` +
        `Bitte überprüfen Sie die Daten. Die Validierung wurde auch im Excel dokumentiert.`
      )
    }

    // Exportiere Datei
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.URL.revokeObjectURL(url)
    })
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => router.push(`/shops/${params.id}`)}
            sx={{
              background: 'white',
              boxShadow: 1,
              '&:hover': {
                background: '#f8fafc',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant="h3" 
              component="h1"
              sx={{ 
                fontWeight: 700,
                mb: 0.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Auswertungsübersicht
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gesamtmengen nach Produkten, Größen und Farben
            </Typography>
          </Box>
          {analytics.length > 0 && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={exportToExcel}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #653a8f 100%)',
                },
              }}
            >
              Als Excel exportieren
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {analytics.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <BarChartIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Keine Bestellungen vorhanden
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Sobald Bestellungen vorhanden sind, werden hier die Auswertungen angezeigt.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {analytics.map((productAnalytics) => {
              const sizes = getAllSizes(productAnalytics)
              const colors = getAllColors(productAnalytics)
              const hasSizeAndColor = sizes.length > 0 && colors.length > 0

              return (
                <Grid item xs={12} key={productAnalytics.product.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                          {productAnalytics.product.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Chip
                            label={`Gesamt: ${productAnalytics.totalQuantity} Stück`}
                            color="primary"
                            sx={{ fontWeight: 600 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {productAnalytics.product.base_price.toFixed(2)} € Grundpreis
                          </Typography>
                        </Box>
                      </Box>

                      {hasSizeAndColor ? (
                        // Tabelle: Größen als Zeilen, Farben als Spalten
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ background: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600 }}>Größe</TableCell>
                                {colors.map((color) => (
                                  <TableCell key={color} align="right" sx={{ fontWeight: 600 }}>
                                    {color}
                                  </TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  Gesamt
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sizes.map((size) => {
                                const colorMap = productAnalytics.bySizeAndColor.get(size) || new Map()
                                const sizeTotal = productAnalytics.bySize.get(size) || 0

                                return (
                                  <TableRow key={size}>
                                    <TableCell sx={{ fontWeight: 500 }}>{size}</TableCell>
                                    {colors.map((color) => {
                                      const quantity = colorMap.get(color) || 0
                                      return (
                                        <TableCell key={color} align="right">
                                          {quantity > 0 ? (
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                              {quantity}
                                            </Typography>
                                          ) : (
                                            <Typography variant="body2" color="text.secondary">
                                              -
                                            </Typography>
                                          )}
                                        </TableCell>
                                      )
                                    })}
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                      {sizeTotal}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                              <TableRow sx={{ background: '#f8fafc', borderTop: '2px solid', borderColor: 'divider' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Gesamt</TableCell>
                                {colors.map((color) => {
                                  const colorTotal = productAnalytics.byColor.get(color) || 0
                                  return (
                                    <TableCell key={color} align="right" sx={{ fontWeight: 700 }}>
                                      {colorTotal > 0 ? colorTotal : '-'}
                                    </TableCell>
                                  )
                                })}
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                  {productAnalytics.totalQuantity}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : sizes.length > 0 ? (
                        // Nur Größen vorhanden
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ background: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600 }}>Größe</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Menge</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sizes.map((size) => (
                                <TableRow key={size}>
                                  <TableCell sx={{ fontWeight: 500 }}>{size}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                                    {productAnalytics.bySize.get(size) || 0}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow sx={{ background: '#f8fafc', borderTop: '2px solid', borderColor: 'divider' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Gesamt</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                  {productAnalytics.totalQuantity} Stück
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : colors.length > 0 ? (
                        // Nur Farben vorhanden
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ background: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600 }}>Farbe</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Menge</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {colors.map((color) => (
                                <TableRow key={color}>
                                  <TableCell sx={{ fontWeight: 500 }}>{color}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                                    {productAnalytics.byColor.get(color) || 0}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow sx={{ background: '#f8fafc', borderTop: '2px solid', borderColor: 'divider' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Gesamt</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                  {productAnalytics.totalQuantity} Stück
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="info">
                          Keine Varianten-Informationen verfügbar
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Container>
    </Box>
  )
}

