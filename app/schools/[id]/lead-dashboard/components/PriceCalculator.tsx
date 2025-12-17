'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
} from '@mui/material'
import { Database } from '@/types/database'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']
type PrintCost = Database['public']['Tables']['print_costs']['Row']
type PrintMethodCost = Database['public']['Tables']['print_method_costs']['Row'] & {
  print_methods?: { id: string; name: string; display_order: number; active: boolean }
}
type PrintMethod = Database['public']['Tables']['print_methods']['Row']
type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']
type TextilePrice = Database['public']['Tables']['textile_prices']['Row']
type HandlingCost = Database['public']['Tables']['handling_costs']['Row']

interface PrintFile {
  id: string
  url: string
  fileName: string
}

interface SelectedTextile {
  textile_id: string
  textile_name: string
  colors: string[]
  sizes: string[]
  print_positions?: {
    front: boolean
    back: boolean
    side: boolean
  }
  print_files?: {
    front?: { [color: string]: PrintFile[] }
    back?: { [color: string]: PrintFile[] }
    side?: { [color: string]: PrintFile[] }
  }
  print_methods?: {
    front?: { [color: string]: string }
    back?: { [color: string]: string }
    side?: { [color: string]: string }
  }
}

interface PriceCalculation {
  [textileId: string]: {
    textile_name: string
    base_price: number
    print_costs: {
      front: number
      back: number
      side: number
    }
    total_print_cost: number
    handling_cost: number
    final_price: number
    ek_netto: number
    vk_brutto: number
  }
}

interface PriceCalculatorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
  onBack: () => void
}

export default function PriceCalculator({ schoolId, config, onSave, onNext, onBack }: PriceCalculatorProps) {
  const [selectedTextiles, setSelectedTextiles] = useState<SelectedTextile[]>([])
  const [printPositions, setPrintPositions] = useState<any>({})
  const [printCosts, setPrintCosts] = useState<PrintCost[]>([])
  const [printMethodCosts, setPrintMethodCosts] = useState<PrintMethodCost[]>([])
  const [printMethods, setPrintMethods] = useState<Map<string, PrintMethod>>(new Map())
  const [textiles, setTextiles] = useState<Map<string, TextileCatalog>>(new Map())
  const [textilePrices, setTextilePrices] = useState<Map<string, TextilePrice>>(new Map())
  const [handlingCost, setHandlingCost] = useState<HandlingCost | null>(null)
  const [priceCalculation, setPriceCalculation] = useState<PriceCalculation>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sponsoring, setSponsoring] = useState<number>(0)
  const [margin, setMargin] = useState<number>(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedTextiles.length > 0 && printMethodCosts.length > 0 && printMethods.size > 0 && textiles.size > 0) {
      // Aktualisiere printPositions aus selected_textiles falls vorhanden
      const positionsFromTextiles: any = {}
      selectedTextiles.forEach((textile) => {
        if (textile.print_positions) {
          positionsFromTextiles[textile.textile_id] = textile.print_positions
        }
      })
      if (Object.keys(positionsFromTextiles).length > 0) {
        setPrintPositions(positionsFromTextiles)
      }
      calculatePrices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTextiles.length, JSON.stringify(printPositions), printMethodCosts.length, printMethods.size, textiles.size, textilePrices.size, handlingCost?.cost_per_order, margin, sponsoring, JSON.stringify(selectedTextiles)])

  async function loadData() {
    try {
      // Lade Druckkosten (für Fallback)
      const costsResponse = await fetch('/api/print-costs')
      const costsData = await costsResponse.json()
      if (costsResponse.ok) {
        setPrintCosts(costsData.printCosts || [])
      }

      // Lade Druckarten-Preise
      const printMethodCostsResponse = await fetch('/api/print-method-costs')
      const printMethodCostsData = await printMethodCostsResponse.json()
      if (printMethodCostsResponse.ok) {
        setPrintMethodCosts(printMethodCostsData.printMethodCosts || [])
      }

      // Lade Druckarten
      const printMethodsResponse = await fetch('/api/print-methods')
      const printMethodsData = await printMethodsResponse.json()
      if (printMethodsResponse.ok) {
        const printMethodsMap = new Map<string, PrintMethod>()
        printMethodsData.printMethods.forEach((method: PrintMethod) => {
          printMethodsMap.set(method.name, method)
        })
        setPrintMethods(printMethodsMap)
      }

      // Lade Textilien
      const textilesResponse = await fetch('/api/textile-catalog')
      const textilesData = await textilesResponse.json()
      if (textilesResponse.ok) {
        const textilesMap = new Map<string, TextileCatalog>()
        textilesData.textiles.forEach((textile: TextileCatalog) => {
          textilesMap.set(textile.id, textile)
        })
        setTextiles(textilesMap)
      }

      // Lade Textilpreise aus Admin-Preisverwaltung
      const pricesResponse = await fetch('/api/textile-prices')
      const pricesData = await pricesResponse.json()
      if (pricesResponse.ok) {
        const pricesMap = new Map<string, TextilePrice>()
        pricesData.prices?.forEach((price: TextilePrice) => {
          pricesMap.set(price.textile_id, price)
        })
        setTextilePrices(pricesMap)
      }

      // Lade Handlingkosten
      const handlingResponse = await fetch('/api/handling-costs')
      const handlingData = await handlingResponse.json()
      if (handlingResponse.ok && handlingData.handlingCost) {
        setHandlingCost(handlingData.handlingCost)
      }

      // Lade Konfiguration
      if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
        const selected = config.selected_textiles as any
        if (Array.isArray(selected)) {
          setSelectedTextiles(selected)
        }
      }

      // Lade Druckpositionen aus config.print_positions ODER aus selected_textiles
      if (config?.print_positions && typeof config.print_positions === 'object') {
        setPrintPositions(config.print_positions)
      } else if (selectedTextiles.length > 0) {
        // Fallback: Extrahiere Positionen aus selected_textiles
        const positionsFromTextiles: any = {}
        selectedTextiles.forEach((textile) => {
          if (textile.print_positions) {
            positionsFromTextiles[textile.textile_id] = textile.print_positions
          }
        })
        if (Object.keys(positionsFromTextiles).length > 0) {
          setPrintPositions(positionsFromTextiles)
        }
      }

      if (config?.price_calculation && typeof config.price_calculation === 'object') {
        setPriceCalculation(config.price_calculation as PriceCalculation)
      }

      // Lade Sponsoring und Marge aus Konfiguration
      if (config?.sponsoring !== undefined && config.sponsoring !== null) {
        const sponsoringValue = typeof config.sponsoring === 'number' 
          ? config.sponsoring 
          : parseFloat(config.sponsoring as any)
        setSponsoring(isNaN(sponsoringValue) ? 0 : sponsoringValue)
      }
      if (config?.margin !== undefined && config.margin !== null) {
        setMargin(typeof config.margin === 'number' ? config.margin : parseFloat(config.margin as any))
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function calculatePrices() {
    const calculation: PriceCalculation = {}

    selectedTextiles.forEach((textile) => {
      const textileData = textiles.get(textile.textile_id)
      if (!textileData) return

      // Prüfe ob Druckdateien für jede Position vorhanden sind
      const hasFrontFiles = textile.print_files?.front && Object.keys(textile.print_files.front).length > 0
      const hasBackFiles = textile.print_files?.back && Object.keys(textile.print_files.back).length > 0
      const hasSideFiles = textile.print_files?.side && Object.keys(textile.print_files.side).length > 0

      // Verwende Positionen aus selected_textiles ODER prüfe ob Druckdateien vorhanden sind
      const positions = textile.print_positions || printPositions[textile.textile_id] || {
        front: false,
        back: false,
        side: false,
      }

      // Eine Position ist aktiv wenn: Position-Checkbox aktiv ODER Druckdateien vorhanden
      const activeFront = positions.front || hasFrontFiles
      const activeBack = positions.back || hasBackFiles
      const activeSide = positions.side || hasSideFiles

      const printMethods = textile.print_methods || {}
      
      // Berechne Kosten basierend auf Druckarten pro Position/Farbe
      let frontCost = 0
      let backCost = 0
      let sideCost = 0

      // Hilfsfunktion: Berechne Kosten für eine Position
      const calculatePositionCost = (position: 'front' | 'back' | 'side', methods: { [color: string]: string } | undefined): number => {
        let cost = 0
        
        if (methods && Object.keys(methods).length > 0) {
          // Wenn Druckarten gewählt sind, berechne Kosten pro Farbe
          // methods enthält Druckart-Namen (z.B. "2 farbig Siebdruck")
          Object.values(methods).forEach(methodName => {
            // Finde Druckart-ID über Namen
            const printMethod = printMethods.get(methodName)
            if (printMethod) {
              // Finde Preis für diese Druckart
              const methodCost = printMethodCosts.find(c => c.print_method_id === printMethod.id && c.active)
              if (methodCost) {
                // Verwende cost_50_units falls vorhanden, sonst cost_per_unit
                cost += methodCost.cost_50_units ?? methodCost.cost_per_unit ?? 0
              }
            }
          })
        }
        
        // Fallback: Wenn keine Kosten berechnet, verwende Standard-Druckkosten für diese Position
        if (cost === 0) {
          const defaultCost = printCosts.find(c => c.position === position && c.active)
          if (defaultCost) {
            cost = defaultCost.cost_50_units ?? defaultCost.cost_per_unit ?? 0
          }
        }
        
        return cost
      }

      // Berechne Kosten nur für aktive Positionen
      if (activeFront) {
        frontCost = calculatePositionCost('front', printMethods.front)
      }
      if (activeBack) {
        backCost = calculatePositionCost('back', printMethods.back)
      }
      if (activeSide) {
        sideCost = calculatePositionCost('side', printMethods.side)
      }

      const printCostsByPosition = {
        front: frontCost,
        back: backCost,
        side: sideCost,
      }

      const totalPrintCost = printCostsByPosition.front + printCostsByPosition.back + printCostsByPosition.side
      
      // Verwende Preis aus Admin-Preisverwaltung, falls vorhanden, sonst base_price aus textile_catalog
      const textilePrice = textilePrices.get(textile.textile_id)
      const basePrice = textilePrice?.price ?? textileData.base_price ?? 0
      
      // Handlingkosten pro Textil (wird gleichmäßig auf alle Textilien verteilt)
      const handlingCostPerTextile = handlingCost?.cost_per_order 
        ? handlingCost.cost_per_order / selectedTextiles.length 
        : 0
      
      const ekNetto = basePrice + totalPrintCost + handlingCostPerTextile + sponsoring
      
      // Berechne VK Brutto mit Marge und MwSt
      // Marge ist relativ zum Verkaufspreis (VK), nicht zum EK
      // Wenn Marge = 20%, dann ist EK = VK × (1 - 0.20) = VK × 0.80
      // Umgekehrt: VK Netto = EK / (1 - Marge%)
      const marginFactor = 1 - (margin / 100)
      const vkNetto = marginFactor > 0 ? ekNetto / marginFactor : ekNetto
      const vatMultiplier = 1.19 // 19% MwSt
      const vkBrutto = vkNetto * vatMultiplier

      calculation[textile.textile_id] = {
        textile_name: textile.textile_name,
        base_price: basePrice,
        print_costs: printCostsByPosition,
        total_print_cost: totalPrintCost,
        handling_cost: handlingCostPerTextile,
        final_price: vkBrutto, // Wird jetzt als VK Brutto gespeichert
        ek_netto: ekNetto,
        vk_brutto: vkBrutto,
      }
    })

    setPriceCalculation(calculation)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ 
        price_calculation: priceCalculation,
        sponsoring: sponsoring,
        margin: margin,
      })
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

  if (selectedTextiles.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Bitte wählen Sie zuerst Textilien aus.
      </Alert>
    )
  }

  const totalBasePrice = Object.values(priceCalculation).reduce((sum, calc) => sum + calc.base_price, 0)
  const totalPrintCost = Object.values(priceCalculation).reduce((sum, calc) => sum + calc.total_print_cost, 0)
  const totalHandlingCost = Object.values(priceCalculation).reduce((sum, calc) => sum + (calc.handling_cost ?? 0), 0)
  const totalEkNetto = Object.values(priceCalculation).reduce((sum, calc) => sum + (calc.ek_netto ?? 0), 0)
  const totalVkBrutto = Object.values(priceCalculation).reduce((sum, calc) => sum + (calc.vk_brutto ?? 0), 0)

  const hasZeroPrices = Object.values(priceCalculation).some(calc => calc.base_price === 0)

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Übersicht der berechneten Preise basierend auf Textil-Grundpreis (aus Admin-Preisverwaltung), Druckkosten und Handlingkosten.
      </Typography>
      {hasZeroPrices && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Einige Textilien haben noch keinen Grundpreis gesetzt. Bitte setzen Sie die Preise in der Admin-Verwaltung.
        </Alert>
      )}

      {/* Sponsoring und Marge Felder */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Sponsoring (€)"
          type="number"
          value={sponsoring}
          onChange={(e) => setSponsoring(parseFloat(e.target.value) || 0)}
          fullWidth
          sx={{ flex: '1 1 200px' }}
          size="small"
          placeholder="0.00"
          inputProps={{
            step: '0.01',
            min: '0',
          }}
          helperText="Wird auf jedes Textil aufgeschlagen"
        />
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>Marge</InputLabel>
          <Select
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
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
              <TableCell sx={{ fontWeight: 600 }}>Textil</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Grundpreis</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Druck Vorne</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Druck Hinten</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Druck Seite</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Gesamt Druck</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Handling</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>EK Netto</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>VK Brutto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.values(priceCalculation).map((calc, index) => (
              <TableRow key={index}>
                <TableCell>{calc.textile_name}</TableCell>
                <TableCell align="right">
                  {calc.base_price > 0 ? `${calc.base_price.toFixed(2)} €` : 'Nicht gesetzt'}
                </TableCell>
                <TableCell align="right">{calc.print_costs.front.toFixed(2)} €</TableCell>
                <TableCell align="right">{calc.print_costs.back.toFixed(2)} €</TableCell>
                <TableCell align="right">{calc.print_costs.side.toFixed(2)} €</TableCell>
                <TableCell align="right">{calc.total_print_cost.toFixed(2)} €</TableCell>
                <TableCell align="right">{(calc.handling_cost ?? 0).toFixed(2)} €</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {(calc.ek_netto ?? 0).toFixed(2)} €
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {(calc.vk_brutto ?? 0).toFixed(2)} €
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>Gesamt</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {totalBasePrice.toFixed(2)} €
              </TableCell>
              <TableCell colSpan={3} />
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {totalPrintCost.toFixed(2)} €
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {handlingCost?.cost_per_order ? handlingCost.cost_per_order.toFixed(2) : '0.00'} €
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {totalEkNetto.toFixed(2)} €
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {totalVkBrutto.toFixed(2)} €
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          size="small"
        >
          {saving ? <CircularProgress size={20} /> : 'Speichern'}
        </Button>
      </Box>
    </Box>
  )
}

