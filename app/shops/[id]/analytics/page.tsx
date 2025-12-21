'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  TextField,
  Grid,
  Divider,
  Chip,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BarChartIcon from '@mui/icons-material/BarChart'
import DownloadIcon from '@mui/icons-material/Download'
import StoreIcon from '@mui/icons-material/Store'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'

type Shop = Database['public']['Tables']['shops']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ProductVariant = Database['public']['Tables']['product_variants']['Row']

interface ProductSizeInfo {
  product: Product
  sizes: Set<string>
}

interface SizeOverride {
  original: string
  override: string
}

export default function ShopAnalytics() {
  const params = useParams()
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [productsWithSizes, setProductsWithSizes] = useState<ProductSizeInfo[]>([])
  const [loadingSizes, setLoadingSizes] = useState(false)
  const [sizeOverrides, setSizeOverrides] = useState<Map<string, Map<string, string>>>(new Map())
  const [editingSize, setEditingSize] = useState<{ productId: string; originalSize: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    const shopId = params?.id as string
    if (shopId) {
      loadShop(shopId)
      loadSizeOverrides(shopId)
    } else {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    const shopId = params?.id as string
    if (shopId && shop) {
      loadProductsWithSizes(shopId)
    }
  }, [shop, params])

  function loadSizeOverrides(shopId: string) {
    try {
      const stored = localStorage.getItem(`sizeOverrides_${shopId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        const overridesMap = new Map<string, Map<string, string>>()
        Object.keys(parsed).forEach(productId => {
          const productOverrides = new Map<string, string>()
          Object.keys(parsed[productId]).forEach(originalSize => {
            productOverrides.set(originalSize, parsed[productId][originalSize])
          })
          overridesMap.set(productId, productOverrides)
        })
        setSizeOverrides(overridesMap)
      }
    } catch (error) {
      console.error('Error loading size overrides:', error)
    }
  }

  function saveSizeOverrides(shopId: string, overrides: Map<string, Map<string, string>>) {
    try {
      const serialized: Record<string, Record<string, string>> = {}
      overrides.forEach((productOverrides, productId) => {
        serialized[productId] = {}
        productOverrides.forEach((override, originalSize) => {
          serialized[productId][originalSize] = override
        })
      })
      localStorage.setItem(`sizeOverrides_${shopId}`, JSON.stringify(serialized))
    } catch (error) {
      console.error('Error saving size overrides:', error)
    }
  }

  async function loadProductsWithSizes(shopId: string) {
    setLoadingSizes(true)
    try {
      // Lade alle Produkte des Shops
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('active', true)

      if (productsError) throw productsError

      // Lade alle Varianten dieser Produkte
      const productIds = products?.map(p => p.id) || []
      if (productIds.length === 0) {
        setProductsWithSizes([])
        setLoadingSizes(false)
        return
      }

      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('*')
        .in('product_id', productIds)
        .eq('active', true)

      if (variantsError) throw variantsError

      // Gruppiere Varianten nach Produkt und sammle Größen
      const productsMap = new Map<string, ProductSizeInfo>()
      
      products?.forEach(product => {
        productsMap.set(product.id, {
          product,
          sizes: new Set<string>(),
        })
      })

      variants?.forEach(variant => {
        const productInfo = productsMap.get(variant.product_id)
        if (productInfo) {
          // Parse Größe aus Variante
          let size: string | null = null
          
          if (variant.name && variant.name.trim() && variant.color_name && variant.color_name.trim()) {
            size = variant.name.trim()
          } else if (variant.name && variant.name.includes('/')) {
            const parts = variant.name.split('/').map(s => s.trim())
            if (parts.length >= 2) {
              size = parts[0] || null
            }
          } else if (variant.name && variant.name.trim() && !variant.color_name) {
            size = variant.name.trim()
          }
          
          if (size) {
            productInfo.sizes.add(size)
          }
        }
      })

      setProductsWithSizes(Array.from(productsMap.values()).filter(p => p.sizes.size > 0))
    } catch (error) {
      console.error('Error loading products with sizes:', error)
      setSnackbar({
        open: true,
        message: 'Fehler beim Laden der Produktgrößen',
        severity: 'error',
      })
    } finally {
      setLoadingSizes(false)
    }
  }

  function handleStartEdit(productId: string, originalSize: string) {
    const productOverrides = sizeOverrides.get(productId)
    const currentOverride = productOverrides?.get(originalSize) || originalSize
    setEditingSize({ productId, originalSize })
    setEditValue(currentOverride)
  }

  function handleCancelEdit() {
    setEditingSize(null)
    setEditValue('')
  }

  function handleSaveEdit() {
    if (!editingSize || !shop) return

    const { productId, originalSize } = editingSize
    const newOverride = editValue.trim()

    // Wenn der neue Wert leer ist oder gleich dem Original, entferne die Überschreibung
    const newOverrides = new Map(sizeOverrides)
    if (!newOverrides.has(productId)) {
      newOverrides.set(productId, new Map())
    }
    
    const productOverrides = new Map(newOverrides.get(productId)!)
    
    if (newOverride === '' || newOverride === originalSize) {
      productOverrides.delete(originalSize)
    } else {
      productOverrides.set(originalSize, newOverride)
    }
    
    newOverrides.set(productId, productOverrides)
    setSizeOverrides(newOverrides)
    saveSizeOverrides(shop.id, newOverrides)
    
    setEditingSize(null)
    setEditValue('')
    
    setSnackbar({
      open: true,
      message: 'Größennamen erfolgreich gespeichert',
      severity: 'success',
    })
  }

  async function loadShop(shopId: string) {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single()

      if (error) throw error
      setShop(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading shop:', error)
      setSnackbar({
        open: true,
        message: 'Fehler beim Laden des Shops',
        severity: 'error',
      })
      setLoading(false)
    }
  }

  async function handleExportAnalytics() {
    if (exporting || !shop) {
      if (!shop) {
        setSnackbar({
          open: true,
          message: 'Shop-Daten nicht verfügbar',
          severity: 'error',
        })
      }
      return
    }

    setExporting(true)

    try {
      const shopId = shop.id
      // Lade Shop-Daten mit Öffnungszeiten
      const { data: shopData } = await supabase
        .from('shops')
        .select('shop_open_at, shop_close_at')
        .eq('id', shopId)
        .single()

      if (!shopData) {
        setSnackbar({
          open: true,
          message: 'Shop-Daten nicht gefunden',
          severity: 'error',
        })
        return
      }

      // Lade alle Order Items für diesen Shop
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_name, customer_email, class_name, created_at')
        .eq('shop_id', shopId)
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
        setSnackbar({
          open: true,
          message: 'Keine Bestellungen im Öffnungszeitraum gefunden',
          severity: 'error',
        })
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

      // Lade Produktbilder für Druckdateien und Bilder
      const { data: productImagesData } = await supabase
        .from('product_images')
        .select('product_id, textile_color_name, print_file_url, image_url, image_type')
        .in('product_id', productIds)

      // Erstelle Map: productId -> color -> print file filename
      const printFilesMap = new Map<string, Map<string, string>>()
      productImagesData?.forEach((img) => {
        if (!img.product_id || !img.textile_color_name || !img.print_file_url) return
        
        if (!printFilesMap.has(img.product_id)) {
          printFilesMap.set(img.product_id, new Map())
        }
        const colorMap = printFilesMap.get(img.product_id)!
        
        // Extrahiere Dateinamen aus URL
        const urlParts = img.print_file_url.split('/')
        const filename = urlParts[urlParts.length - 1] || ''
        colorMap.set(img.textile_color_name, filename)
      })

      const productsMap = new Map(productsData?.map(p => [p.id, p]) || [])
      const variantsMap = new Map(variantsData?.map(v => [v.id, v]) || [])
      const ordersMap = new Map(ordersData.map(o => [o.id, o]))

      /**
       * Lädt manuelle Überschreibungen aus localStorage für dieses Produkt
       */
      function getManualSizeOverrides(productId: string): Record<string, string> {
        const productOverrides = sizeOverrides.get(productId)
        if (!productOverrides) return {}
        
        const result: Record<string, string> = {}
        productOverrides.forEach((override, original) => {
          result[original] = override
        })
        return result
      }

      /**
       * Normalisiert Größennamen für die Auswertung
       * - Entfernt Whitespace
       * - Normalisiert Standardgrößen (XS, S, M, L, XL, XXL, XXXL, XXXXL)
       * - Behält Zahlenformate bei (z.B. "36", "38", "40")
       * - Normalisiert Groß-/Kleinschreibung für Standardgrößen
       * - Wendet manuelle Überschreibungen an (aus localStorage)
       */
      function normalizeSizeName(size: string | null, productId: string): string | null {
        if (!size) return null
        
        // Entferne Whitespace
        const trimmed = size.trim()
        if (!trimmed) return null
        
        // Normalisiere Standardgrößen (case-insensitive)
        const sizeUpper = trimmed.toUpperCase()
        const standardSizes: Record<string, string> = {
          'XS': 'XS',
          'S': 'S',
          'M': 'M',
          'L': 'L',
          'XL': 'XL',
          'XXL': 'XXL',
          'XXXL': 'XXXL',
          'XXXXL': 'XXXXL',
          // Unterstütze auch Varianten mit Leerzeichen oder Bindestrich
          'X-S': 'XS',
          'X-SMALL': 'XS',
          'SMALL': 'S',
          'MEDIUM': 'M',
          'LARGE': 'L',
          'X-L': 'XL',
          'X-LARGE': 'XL',
          'XX-L': 'XXL',
          'XX-LARGE': 'XXL',
          'XXX-L': 'XXXL',
          'XXX-LARGE': 'XXXL',
          'XXXX-L': 'XXXXL',
          'XXXX-LARGE': 'XXXXL',
        }
        
        let normalized: string
        
        // Prüfe ob es eine Standardgröße ist
        if (standardSizes[sizeUpper]) {
          normalized = standardSizes[sizeUpper]
        }
        // Prüfe ob es eine Zahl ist (z.B. "36", "38", "40")
        else if (trimmed.match(/^(\d+)$/)) {
          normalized = trimmed // Behalte Zahlenformat bei
        }
        // Für andere Formate: Normalisiere Groß-/Kleinschreibung (erster Buchstabe groß, Rest klein)
        // aber nur wenn es nicht bereits gemischt ist
        else if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) {
          normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
        }
        // Behalte Original bei wenn es bereits gemischt ist
        else {
          normalized = trimmed
        }
        
        // Wende manuelle Überschreibungen an (aus localStorage, case-insensitive)
        const manualOverrides = getManualSizeOverrides(productId)
        const overrideKey = Object.keys(manualOverrides).find(
          key => key.toUpperCase() === normalized.toUpperCase()
        )
        if (overrideKey) {
          return manualOverrides[overrideKey]
        }
        
        return normalized
      }

      // Erstelle Analytics-Daten
      const analyticsMap = new Map<string, any>()
      
      itemsData?.forEach((item) => {
        const product = productsMap.get(item.product_id)
        const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
        if (!product) return

        const productId = product.id
        if (!analyticsMap.has(productId)) {
          analyticsMap.set(productId, {
            product: product,
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

        // Parse Größe und Farbe
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
            }
          } else if (variant.name && variant.name.trim() && !variant.color_name) {
            size = variant.name
          } else if (variant.color_name && variant.color_name.trim()) {
            color = variant.color_name
          }
        }

        // Normalisiere Größenname
        const normalizedSize = normalizeSizeName(size, productId)

        if (normalizedSize) {
          analytics.bySize.set(normalizedSize, (analytics.bySize.get(normalizedSize) || 0) + item.quantity)
        }
        if (color) {
          analytics.byColor.set(color, (analytics.byColor.get(color) || 0) + item.quantity)
        }
        if (normalizedSize && color) {
          if (!analytics.bySizeAndColor.has(normalizedSize)) {
            analytics.bySizeAndColor.set(normalizedSize, new Map())
          }
          const colorMap = analytics.bySizeAndColor.get(normalizedSize)!
          colorMap.set(color, (colorMap.get(color) || 0) + item.quantity)
        }
      })

      const analytics = Array.from(analyticsMap.values()).sort((a, b) =>
        a.product.name.localeCompare(b.product.name)
      )

      // Erstelle Fulfillment-Daten
      const fulfillmentItemsList: any[] = []
      itemsData?.forEach((item) => {
        const product = productsMap.get(item.product_id)
        const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
        const order = ordersMap.get(item.order_id)

        if (!product || !order) return

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
            }
          } else if (variant.name && variant.name.trim() && !variant.color_name) {
            size = variant.name
          } else if (variant.color_name && variant.color_name.trim()) {
            color = variant.color_name
          }
        }

        // Normalisiere Größenname für Fulfillment-Daten
        const normalizedSize = normalizeSizeName(size, product.id)

        for (let i = 0; i < item.quantity; i++) {
          fulfillmentItemsList.push({
            customer_name: order.customer_name,
            customer_email: order.customer_email || null,
            class_name: order.class_name || null,
            product_name: product.name,
            size: normalizedSize,
            color: color,
            quantity: 1,
            order_id: item.order_id,
          })
        }
      })

      fulfillmentItemsList.sort((a, b) => {
        const nameCompare = a.customer_name.localeCompare(b.customer_name)
        if (nameCompare !== 0) return nameCompare
        const classA = a.class_name || ''
        const classB = b.class_name || ''
        return classA.localeCompare(classB)
      })

      // Importiere ExcelJS dynamisch
      const ExcelJS = (await import('exceljs')).default

      // Erstelle Workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Auswertung')

      // Style-Definitionen
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

      // Header
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

      worksheet.addRow([])
      currentRow++

      // Helper-Funktionen für Sortierung
      function sortSizes(sizes: string[]): string[] {
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL']
        return sizes.sort((a, b) => {
          const aIndex = sizeOrder.findIndex(s => s.toUpperCase() === a.toUpperCase())
          const bIndex = sizeOrder.findIndex(s => s.toUpperCase() === b.toUpperCase())
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          const aNum = parseInt(a)
          const bNum = parseInt(b)
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
          return a.localeCompare(b)
        })
      }

      function getAllSizes(analytics: any): string[] {
        const sizes = new Set<string>()
        analytics.bySize.forEach((_: any, size: string) => sizes.add(size))
        analytics.bySizeAndColor.forEach((_: any, size: string) => sizes.add(size))
        return sortSizes(Array.from(sizes))
      }

      function getAllColors(analytics: any): string[] {
        const colors = new Set<string>()
        analytics.byColor.forEach((_: any, color: string) => colors.add(color))
        analytics.bySizeAndColor.forEach((colorMap: Map<string, number>) => {
          colorMap.forEach((_: any, color: string) => colors.add(color))
        })
        return Array.from(colors).sort()
      }

      // Produkte
      analytics.forEach((productAnalytics: any, productIndex: number) => {
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

        worksheet.addRow([])
        currentRow++

        const sizes = getAllSizes(productAnalytics)
        const colors = getAllColors(productAnalytics)
        const hasSizeAndColor = sizes.length > 0 && colors.length > 0

        if (hasSizeAndColor) {
          const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
          const headerRow = worksheet.addRow(['Größe', ...colors, 'Gesamt'])
          headerRow.height = 20
          headerRow.eachCell((cell) => {
            cell.style = tableHeaderStyle
          })
          currentRow++
          
          // Zweite Header-Zeile mit Druckdatei-Dateinamen
          const printFileRowData = ['']
          colors.forEach((color) => {
            const printFileName = colorPrintFilesMap?.get(color) || ''
            printFileRowData.push(printFileName)
          })
          printFileRowData.push('')
          const printFileHeaderRow = worksheet.addRow(printFileRowData)
          printFileHeaderRow.height = 18
          printFileHeaderRow.eachCell((cell, colNumber) => {
            cell.style = {
              font: { bold: true, size: 9, italic: true, color: { argb: 'FFFFFFFF' } },
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
            if (colNumber === 1) {
              cell.value = 'Druckdatei'
            }
          })
          currentRow++

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
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else if (typeof cell.value === 'number') {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            })
            currentRow++
          })

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
          const headerRow = worksheet.addRow(['Farbe', 'Menge', 'Druckdatei'])
          headerRow.height = 20
          headerRow.eachCell((cell) => {
            cell.style = tableHeaderStyle
          })
          currentRow++

          colors.forEach((color) => {
            // Hole Druckdatei-Dateinamen für diese Farbe
            const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
            const printFileName = colorPrintFilesMap?.get(color) || ''
            
            const dataRow = worksheet.addRow([color, productAnalytics.byColor.get(color) || 0, printFileName])
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

        if (productIndex < analytics.length - 1) {
          worksheet.addRow([])
          currentRow++
          worksheet.addRow([])
          currentRow++
        }
      })

      // Berechne maximale Anzahl von Farben über alle Produkte
      let maxColors = 0
      analytics.forEach((productAnalytics: any) => {
        const colors = getAllColors(productAnalytics)
        if (colors.length > maxColors) {
          maxColors = colors.length
        }
      })
      
      // Berechne dynamische Startspalte für Druckdatei-Auswertung
      // Format: [Größe] [Farbe1] [Farbe2] ... [FarbeN] [Gesamt]
      // Also: 1 (Größe) + maxColors (Farben) + 1 (Gesamt) + 2 (Abstand) = maxColors + 4
      const printFileStartColumn = Math.max(7, maxColors + 4) // Mindestens Spalte G (7), sonst dynamisch

      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          column.width = 20
        } else {
          column.width = 12
        }
      })

      // Auswertung nach Druckdateien (rechts im Worksheet, dynamisch positioniert)
      let printFileRow = 1

      // Sammle Daten nach Druckdateien
      const printFileAnalytics = new Map<string, Array<{
        productName: string
        color: string
        quantity: number
      }>>()

      analytics.forEach((productAnalytics: any) => {
        const colors = getAllColors(productAnalytics)
        const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
        
        colors.forEach((color) => {
          const printFileName = colorPrintFilesMap?.get(color) || ''
          if (!printFileName) return // Überspringe Farben ohne Druckdatei
          
          const quantity = productAnalytics.byColor.get(color) || 0
          if (quantity === 0) return // Überspringe Farben ohne Menge
          
          if (!printFileAnalytics.has(printFileName)) {
            printFileAnalytics.set(printFileName, [])
          }
          
          printFileAnalytics.get(printFileName)!.push({
            productName: productAnalytics.product.name,
            color: color,
            quantity: quantity
          })
        })
      })

      // Sortiere Druckdateien alphabetisch
      const sortedPrintFiles = Array.from(printFileAnalytics.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
      )

      // Header für Druckdatei-Auswertung
      const printFileTitleRow = worksheet.getRow(printFileRow)
      printFileTitleRow.getCell(printFileStartColumn).value = 'Auswertung nach Druckdateien'
      printFileTitleRow.getCell(printFileStartColumn).style = titleStyle
      worksheet.mergeCells(printFileRow, printFileStartColumn, printFileRow, printFileStartColumn + 3)
      printFileRow++

      const printFileDateRow = worksheet.getRow(printFileRow)
      printFileDateRow.getCell(printFileStartColumn).value = `Erstellt am: ${new Date().toLocaleString('de-DE')}`
      printFileDateRow.getCell(printFileStartColumn).style = {
        font: { italic: true, size: 10, color: { argb: 'FF666666' } },
      }
      worksheet.mergeCells(printFileRow, printFileStartColumn, printFileRow, printFileStartColumn + 3)
      printFileRow++

      printFileRow++ // Leerzeile

      // Header für Tabelle
      const printFileHeaderRow = worksheet.getRow(printFileRow)
      printFileHeaderRow.getCell(printFileStartColumn).value = 'Druckdatei'
      printFileHeaderRow.getCell(printFileStartColumn + 1).value = 'Produkt'
      printFileHeaderRow.getCell(printFileStartColumn + 2).value = 'Farbe'
      printFileHeaderRow.getCell(printFileStartColumn + 3).value = 'Menge'
      printFileHeaderRow.height = 20
      for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
        const cell = printFileHeaderRow.getCell(col)
        cell.style = tableHeaderStyle
      }
      printFileRow++

      // Daten für jede Druckdatei
      sortedPrintFiles.forEach(([printFileName, items]) => {
        // Sortiere Items nach Produktname und dann nach Farbe
        items.sort((a, b) => {
          const productCompare = a.productName.localeCompare(b.productName)
          if (productCompare !== 0) return productCompare
          return a.color.localeCompare(b.color)
        })

        let printFileTotal = 0

        items.forEach((item, index) => {
          const dataRow = worksheet.getRow(printFileRow)
          
          // Druckdatei-Name nur in der ersten Zeile
          if (index === 0) {
            dataRow.getCell(printFileStartColumn).value = printFileName
            dataRow.getCell(printFileStartColumn).style = {
              ...productHeaderStyle,
              alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
            }
          }
          
          dataRow.getCell(printFileStartColumn + 1).value = item.productName
          dataRow.getCell(printFileStartColumn + 2).value = item.color
          dataRow.getCell(printFileStartColumn + 3).value = item.quantity
          
          dataRow.height = 18
          
          // Style für alle Zellen
          for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
            const cell = dataRow.getCell(col)
            if (col === printFileStartColumn && index === 0) {
              // Bereits oben gesetzt
            } else {
              cell.style = cellStyle
              if (col === printFileStartColumn + 1 || col === printFileStartColumn + 2) {
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else if (col === printFileStartColumn + 3) {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            }
          }
          
          printFileTotal += item.quantity
          printFileRow++
        })

        // Gesamtzeile für diese Druckdatei
        const totalRow = worksheet.getRow(printFileRow)
        totalRow.getCell(printFileStartColumn).value = 'Gesamt'
        totalRow.getCell(printFileStartColumn + 3).value = printFileTotal
        totalRow.height = 20
        
        for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
          const cell = totalRow.getCell(col)
          cell.style = totalRowStyle
          if (col === printFileStartColumn) {
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else if (col === printFileStartColumn + 3) {
            cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
          } else {
            cell.style.fill = {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: 'FFE8E8E8' },
            }
          }
        }
        
        printFileRow++
        printFileRow++ // Leerzeile zwischen Druckdateien
      })

      // Setze Spaltenbreiten für Druckdatei-Auswertung
      worksheet.getColumn(printFileStartColumn).width = 30 // Druckdatei
      worksheet.getColumn(printFileStartColumn + 1).width = 20 // Produkt
      worksheet.getColumn(printFileStartColumn + 2).width = 15 // Farbe
      worksheet.getColumn(printFileStartColumn + 3).width = 12 // Menge

      // Fulfillment Worksheet
      const fulfillmentWorksheet = workbook.addWorksheet('Fulfillment')
      let fulfillmentRow = 1

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

      fulfillmentWorksheet.addRow([])
      fulfillmentRow++

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

      const groupedByCustomer = new Map<string, any[]>()
      fulfillmentItemsList.forEach((item) => {
        const key = `${item.customer_name}|${item.class_name || ''}`
        if (!groupedByCustomer.has(key)) {
          groupedByCustomer.set(key, [])
        }
        groupedByCustomer.get(key)!.push(item)
      })

      groupedByCustomer.forEach((items) => {
        const firstItem = items[0]
        const customerName = firstItem.customer_name
        const className = firstItem.class_name || ''

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

        items.forEach((item) => {
          const productRow = fulfillmentWorksheet.addRow([
            '',
            '',
            item.product_name,
            item.size || '-',
            item.color || '-',
          ])
          productRow.height = 18
          productRow.eachCell((cell, colNumber) => {
            cell.style = cellStyle
            if (colNumber <= 2) {
              cell.style.fill = {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: 'FFF9F9F9' },
              }
            } else if (colNumber === 3) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'center', vertical: 'middle' }
            }
          })
          fulfillmentRow++
        })

        fulfillmentWorksheet.addRow([])
        fulfillmentRow++
      })

      fulfillmentWorksheet.columns = [
        { width: 25 },
        { width: 12 },
        { width: 25 },
        { width: 10 },
        { width: 15 },
      ]

      // Validierung
      const totalFromAnalytics = analytics.reduce((sum: number, productAnalytics: any) => sum + productAnalytics.totalQuantity, 0)
      const totalFromFulfillment = fulfillmentItemsList.length

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

      // Importiere JSZip dynamisch
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const shopSlug = shop?.slug || 'shop'

      // Füge Excel-Datei zur ZIP hinzu
      const excelBuffer = await workbook.xlsx.writeBuffer()
      const excelFileName = `shop-auswertung-${shopId}-${new Date().toISOString().split('T')[0]}.xlsx`
      zip.file(excelFileName, excelBuffer)

      // Sammle alle eindeutigen Druckdateien und Produktbilder
      const zipPrintFilesSet = new Set<string>()
      const zipImageFilesSet = new Set<string>()
      const zipPrintFilesMap = new Map<string, { url: string; filename: string }>()
      const zipImageFilesMap = new Map<string, { url: string; filename: string; productId: string }>()

      // Normalisiere Produktnamen für Ordnerstruktur
      const normalizeForFolder = (value: string | null | undefined, fallback = 'produkt'): string => {
        return (value || fallback)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || fallback
      }

      const productNamesMap = new Map<string, string>()
      productsData?.forEach((product) => {
        productNamesMap.set(product.id, normalizeForFolder(product.name))
      })

      productImagesData?.forEach((img) => {
        if (img.print_file_url) {
          const urlParts = img.print_file_url.split('/')
          const filename = urlParts[urlParts.length - 1] || ''
          const key = `${img.product_id}_${img.textile_color_name}_${img.image_type}_print`
          if (!zipPrintFilesSet.has(key)) {
            zipPrintFilesSet.add(key)
            zipPrintFilesMap.set(key, { url: img.print_file_url, filename })
          }
        }
        if (img.image_url) {
          const urlParts = img.image_url.split('/')
          const filename = urlParts[urlParts.length - 1] || ''
          const key = `${img.product_id}_${img.textile_color_name}_${img.image_type}_image`
          if (!zipImageFilesSet.has(key)) {
            zipImageFilesSet.add(key)
            zipImageFilesMap.set(key, { url: img.image_url, filename, productId: img.product_id })
          }
        }
      })

      // Lade Druckdateien herunter und füge sie zur ZIP hinzu
      for (const [key, fileInfo] of zipPrintFilesMap.entries()) {
        try {
          // Parse Storage URL
          const urlObj = new URL(fileInfo.url)
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
          
          if (pathMatch) {
            const bucket = pathMatch[2]
            const path = decodeURIComponent(pathMatch[3])
            
            const { data, error } = await supabase.storage
              .from(bucket)
              .download(path)

            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer()
              zip.file(`druckdateien/${fileInfo.filename}`, arrayBuffer)
            }
          }
        } catch (error) {
          console.error(`Fehler beim Herunterladen der Druckdatei ${fileInfo.filename}:`, error)
        }
      }

      // Lade Produktbilder herunter und füge sie zur ZIP hinzu (nach Produkten sortiert)
      for (const [key, fileInfo] of zipImageFilesMap.entries()) {
        try {
          // Parse Storage URL
          const urlObj = new URL(fileInfo.url)
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
          
          if (pathMatch) {
            const bucket = pathMatch[2]
            const path = decodeURIComponent(pathMatch[3])
            
            const { data, error } = await supabase.storage
              .from(bucket)
              .download(path)

            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer()
              // Organisiere nach Produktnamen
              const productFolderName = productNamesMap.get(fileInfo.productId) || 'unbekannt'
              zip.file(`produktbilder/${productFolderName}/${fileInfo.filename}`, arrayBuffer)
            }
          }
        } catch (error) {
          console.error(`Fehler beim Herunterladen des Produktbildes ${fileInfo.filename}:`, error)
        }
      }

      // Erstelle ZIP-Datei
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const dateStr = new Date().toISOString().split('T')[0]
      const zipFileName = `shop_${shopSlug}_${dateStr}.zip`
      
      const url = window.URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = zipFileName
      link.click()
      window.URL.revokeObjectURL(url)

      setSnackbar({
        open: true,
        message: 'Auswertung erfolgreich exportiert',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error exporting analytics:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Exportieren der Auswertung',
        severity: 'error',
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Lade Shop...</Typography>
      </Box>
    )
  }

  if (!shop) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Shop nicht gefunden</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <IconButton
              onClick={() => router.push(`/shops/${shop.id}`)}
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
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BarChartIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
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
                Auswertung: {shop.name}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Größenbearbeitung */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Größennamen bearbeiten
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bearbeiten Sie die Größennamen für jedes Produkt. Die Änderungen werden bei der Auswertung verwendet.
            </Typography>
            
            {loadingSizes ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : productsWithSizes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Keine Produkte mit Größen gefunden.
              </Typography>
            ) : (
              <Box>
                {productsWithSizes.map((productInfo, index) => {
                  const productOverrides = sizeOverrides.get(productInfo.product.id) || new Map()
                  const sortedSizes = Array.from(productInfo.sizes).sort()
                  
                  return (
                    <Box key={productInfo.product.id} sx={{ mb: index < productsWithSizes.length - 1 ? 4 : 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                        {productInfo.product.name}
                      </Typography>
                      <Grid container spacing={2}>
                        {sortedSizes.map((size) => {
                          const isEditing = editingSize?.productId === productInfo.product.id && editingSize?.originalSize === size
                          const override = productOverrides.get(size)
                          const displaySize = override || size
                          
                          return (
                            <Grid item xs={12} sm={6} md={4} key={size}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  p: 1.5,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  bgcolor: override ? 'action.selected' : 'background.paper',
                                }}
                              >
                                {isEditing ? (
                                  <>
                                    <TextField
                                      size="small"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveEdit()
                                        } else if (e.key === 'Escape') {
                                          handleCancelEdit()
                                        }
                                      }}
                                      autoFocus
                                      sx={{ flexGrow: 1 }}
                                    />
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={handleSaveEdit}
                                    >
                                      <SaveIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={handleCancelEdit}
                                    >
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </>
                                ) : (
                                  <>
                                    <Box sx={{ flexGrow: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {displaySize}
                                      </Typography>
                                      {override && (
                                        <Typography variant="caption" color="text.secondary">
                                          Original: {size}
                                        </Typography>
                                      )}
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleStartEdit(productInfo.product.id, size)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </>
                                )}
                              </Box>
                            </Grid>
                          )
                        })}
                      </Grid>
                      {index < productsWithSizes.length - 1 && <Divider sx={{ mt: 3 }} />}
                    </Box>
                  )
                })}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                Shop-Auswertung exportieren
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Exportieren Sie eine detaillierte Excel-Auswertung mit allen Bestellungen,
                Produkten, Größen und Farben für diesen Shop.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                onClick={handleExportAnalytics}
                disabled={exporting}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #653a91 100%)',
                  },
                }}
              >
                {exporting ? 'Exportiere...' : 'Auswertung exportieren'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  )
}
