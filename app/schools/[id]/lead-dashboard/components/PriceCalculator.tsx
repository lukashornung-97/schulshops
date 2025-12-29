'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Database } from '@/types/database'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']
type Product = Database['public']['Tables']['products']['Row'] & {
  textile_catalog?: Database['public']['Tables']['textile_catalog']['Row']
  product_variants?: Array<{ id: string; name: string; color_name: string | null }>
}

interface PriceCalculatorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
  onBack: () => void
}

export default function PriceCalculator({ schoolId, config, onSave, onNext, onBack }: PriceCalculatorProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sponsoring, setSponsoring] = useState<number>(0)
  const [margin, setMargin] = useState<number>(0)
  const [recalculating, setRecalculating] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [userChangedValues, setUserChangedValues] = useState(false)

  useEffect(() => {
    if (isInitialLoad) {
      loadData()
    }
  }, [config])

  useEffect(() => {
    // Wenn Sponsoring oder Marge vom Benutzer geändert werden (nicht beim initialen Laden), berechne Preise neu
    if (!isInitialLoad && userChangedValues && config?.id && config?.shop_id && products.length > 0) {
      // Verzögere Neuberechnung, um mehrfache Aufrufe zu vermeiden
      const timeout = setTimeout(() => {
        recalculatePrices()
        setUserChangedValues(false)
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [sponsoring, margin, isInitialLoad, userChangedValues, config?.id, config?.shop_id, products.length])

  async function loadData() {
    if (!config?.shop_id) {
      setLoading(false)
      return
    }

    try {
      // Lade Produkte
      const productsResponse = await fetch(`/api/products?shop_id=${config.shop_id}`)
      const productsData = await productsResponse.json()
      if (productsResponse.ok) {
        setProducts(productsData.products || [])
        
        // #region agent log
        if (productsData.products && productsData.products.length > 0) {
          productsData.products.forEach((p: any) => {
            fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/schools/[id]/lead-dashboard/components/PriceCalculator.tsx:80',message:'loadData - Products loaded in frontend',data:{productId:p.id,displayed_ek_netto:p.calculated_ek_netto,displayed_vk_brutto:p.calculated_vk_brutto,displayed_quantity:(p.print_config as any)?.quantity},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          });
        }
        // #endregion
      }

      // Lade Sponsoring und Marge aus Konfiguration (nur beim initialen Laden oder wenn sich die Werte wirklich geändert haben)
      const newSponsoring = config.sponsoring !== undefined && config.sponsoring !== null
        ? (typeof config.sponsoring === 'number' ? config.sponsoring : parseFloat(config.sponsoring as any))
        : 0
      const newMargin = config.margin !== undefined && config.margin !== null
        ? (typeof config.margin === 'number' ? config.margin : parseFloat(config.margin as any))
        : 0

      // Nur aktualisieren, wenn sich die Werte wirklich geändert haben (mit Toleranz für Rundungsfehler)
      // UND wenn der Benutzer die Werte nicht gerade ändert
      if (!userChangedValues && (Math.abs(newSponsoring - sponsoring) > 0.01 || Math.abs(newMargin - margin) > 0.01)) {
        setSponsoring(newSponsoring)
        setMargin(newMargin)
      }

      if (isInitialLoad) {
        setIsInitialLoad(false)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function recalculatePrices() {
    if (!config?.id || !config?.shop_id || products.length === 0) return

    setRecalculating(true)
    try {
      // Speichere Sponsoring und Marge zuerst
      await onSave({
        sponsoring: sponsoring,
        margin: margin,
      })

      // Aktualisiere jedes Produkt (dies löst automatische Neuberechnung aus)
      for (const product of products) {
        const variants = product.product_variants || []
        const colors = [...new Set(variants.map(v => v.color_name).filter(Boolean) as string[])]
        const sizes = [...new Set(variants.map(v => v.name).filter(n => n !== 'Standard'))]

        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: product.id,
            shop_id: product.shop_id,
            textile_id: product.textile_id,
            name: product.name,
            print_config: product.print_config,
            selected_colors: colors,
            selected_sizes: sizes,
            sort_index: product.sort_index,
          }),
        })
      }

      // Lade Produkte neu
      await loadData()
    } catch (error) {
      console.error('Error recalculating prices:', error)
    } finally {
      setRecalculating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        sponsoring: sponsoring,
        margin: margin,
      })

      // Berechne Preise neu
      await recalculatePrices()
    } catch (error) {
      // Error wird bereits in onSave behandelt
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!config?.shop_id) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Shop wird erstellt... Bitte warten Sie einen Moment.
      </Alert>
    )
  }

  if (products.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Bitte erstellen Sie zuerst Produkte in der Textilauswahl.
      </Alert>
    )
  }

  const totalEkNetto = products.reduce((sum, p) => sum + (p.calculated_ek_netto || 0), 0)
  const totalVkBrutto = products.reduce((sum, p) => sum + (p.calculated_vk_brutto || 0), 0)
  
  // Berechne Gewinn Netto für jedes Produkt und Gesamtsumme
  const calculateProfitNetto = (ekNetto: number | null, vkBrutto: number | null): number => {
    if (!ekNetto || !vkBrutto) return 0
    const vkNetto = vkBrutto / 1.19 // 19% MwSt abziehen
    return vkNetto - ekNetto
  }
  
  const totalProfitNetto = products.reduce((sum, p) => {
    return sum + calculateProfitNetto(p.calculated_ek_netto, p.calculated_vk_brutto)
  }, 0)

  const hasZeroPrices = products.some(p => !p.calculated_ek_netto || !p.calculated_vk_brutto)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Übersicht der berechneten Preise für alle Produkte. Preise werden automatisch basierend auf Textilpreis, Druckkosten, Handlingkosten, Sponsoring und Marge berechnet.
        </Typography>
        <IconButton
          onClick={async () => {
            setLoading(true)
            await loadData()
          }}
          disabled={loading || recalculating}
          size="small"
          title="Produkte aktualisieren"
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {hasZeroPrices && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Einige Produkte haben noch keine Preise. Bitte überprüfen Sie die Konfiguration.
        </Alert>
      )}

      {recalculating && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Preise werden neu berechnet...
        </Alert>
      )}

      {/* Sponsoring und Marge Felder */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Sponsoring (€)"
          type="number"
          value={sponsoring}
          onChange={(e) => {
            setSponsoring(parseFloat(e.target.value) || 0)
            setUserChangedValues(true)
          }}
          fullWidth
          sx={{ flex: '1 1 200px' }}
          size="small"
          placeholder="0.00"
          inputProps={{
            step: '0.01',
            min: '0',
          }}
          helperText="Wird auf jedes Produkt aufgeschlagen"
        />
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>Marge</InputLabel>
          <Select
            value={margin}
            onChange={(e) => {
              setMargin(Number(e.target.value))
              setUserChangedValues(true)
            }}
            label="Marge"
          >
            <MenuItem value={0}>0%</MenuItem>
            <MenuItem value={5}>5%</MenuItem>
            <MenuItem value={10}>10%</MenuItem>
            <MenuItem value={15}>15%</MenuItem>
            <MenuItem value={20}>20%</MenuItem>
            <MenuItem value={25}>25%</MenuItem>
            <MenuItem value={30}>30%</MenuItem>
            <MenuItem value={35}>35%</MenuItem>
            <MenuItem value={40}>40%</MenuItem>
            <MenuItem value={50}>50%</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Produkt</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Textil</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Farben</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Größen</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Menge</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>EK Netto</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>VK Brutto</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Gewinn Netto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => {
              const printConfig = product.print_config as any
              const hasFront = !!printConfig?.front
              const hasBack = !!printConfig?.back
              const hasSide = !!printConfig?.side
              const positions = []
              if (hasFront) positions.push('Vorne')
              if (hasBack) positions.push('Hinten')
              if (hasSide) positions.push('Seite')

              const variants = product.product_variants || []
              const colors = [...new Set(variants.map(v => v.color_name).filter(Boolean))]
              const sizes = [...new Set(variants.map(v => v.name).filter(n => n !== 'Standard'))]
              
              // Lade Menge aus print_config (Standard: 50)
              const quantity = (printConfig as any)?.quantity || 50

              const handleQuantityChange = async (newQuantity: number) => {
                // Aktualisiere print_config mit neuer Menge
                // Stelle sicher, dass alle bestehenden Felder erhalten bleiben
                const updatedPrintConfig = {
                  ...(printConfig || {}),
                  quantity: newQuantity,
                }

                console.log('Updating quantity:', newQuantity, 'for product:', product.id)
                console.log('Updated print_config:', updatedPrintConfig)

                // Aktualisiere Produkt
                try {
                  const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: product.id,
                      shop_id: product.shop_id,
                      textile_id: product.textile_id,
                      name: product.name,
                      print_config: updatedPrintConfig,
                      selected_colors: colors,
                      selected_sizes: sizes,
                      sort_index: product.sort_index,
                    }),
                  })

                  const data = await response.json()
                  
                  if (!response.ok) {
                    throw new Error(data.error || 'Fehler beim Aktualisieren')
                  }

                  console.log('Product updated successfully:', data)
                  console.log('[DEBUG] Response product prices:', {
                    ek_netto: data.product?.calculated_ek_netto,
                    vk_brutto: data.product?.calculated_vk_brutto,
                    quantity: (data.product?.print_config as any)?.quantity
                  })
                  
                  // Finde das aktuelle Produkt im State
                  const currentProduct = products.find(p => p.id === product.id)
                  console.log('[DEBUG] Current product prices before update:', {
                    ek_netto: currentProduct?.calculated_ek_netto,
                    vk_brutto: currentProduct?.calculated_vk_brutto,
                    quantity: (currentProduct?.print_config as any)?.quantity
                  })

                  // Aktualisiere das Produkt direkt im State mit den neuen Preisen
                  if (data.product) {
                    setProducts(prevProducts => {
                      const updated = prevProducts.map(p => {
                        if (p.id === product.id) {
                          const updatedProduct = { ...p, ...data.product, print_config: data.product.print_config }
                          console.log('[DEBUG] Updated product in state:', {
                            id: updatedProduct.id,
                            ek_netto: updatedProduct.calculated_ek_netto,
                            vk_brutto: updatedProduct.calculated_vk_brutto,
                            quantity: (updatedProduct.print_config as any)?.quantity
                          })
                          return updatedProduct
                        }
                        return p
                      })
                      return updated
                    })
                  } else {
                    console.warn('[DEBUG] No product in response, falling back to loadData()')
                    // Fallback: Lade Produkte neu
                    await loadData()
                  }
                } catch (error) {
                  console.error('Error updating quantity:', error)
                  alert('Fehler beim Aktualisieren der Menge: ' + (error as Error).message)
                }
              }

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {product.name}
                    </Typography>
                    {positions.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Druck: {positions.join(', ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.textile_catalog?.name || 'Unbekannt'}
                    {product.textile_catalog?.brand && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {product.textile_catalog.brand}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {colors.length}
                  </TableCell>
                  <TableCell align="right">
                    {sizes.length}
                  </TableCell>
                  <TableCell align="right">
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={quantity}
                        onChange={(e) => handleQuantityChange(Number(e.target.value))}
                        disabled={recalculating}
                      >
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {product.calculated_ek_netto
                      ? `${product.calculated_ek_netto.toFixed(2)} €`
                      : 'Nicht berechnet'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {product.calculated_vk_brutto
                      ? `${product.calculated_vk_brutto.toFixed(2)} €`
                      : 'Nicht berechnet'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {product.calculated_ek_netto && product.calculated_vk_brutto
                      ? `${calculateProfitNetto(product.calculated_ek_netto, product.calculated_vk_brutto).toFixed(2)} €`
                      : 'Nicht berechnet'}
                  </TableCell>
                </TableRow>
              )
            })}
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell colSpan={5} sx={{ fontWeight: 600 }}>Gesamt</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {totalEkNetto.toFixed(2)} €
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {totalVkBrutto.toFixed(2)} €
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {totalProfitNetto.toFixed(2)} €
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || recalculating}
          size="small"
        >
          {saving || recalculating ? <CircularProgress size={20} /> : 'Speichern & Preise neu berechnen'}
        </Button>
      </Box>
    </Box>
  )
}
