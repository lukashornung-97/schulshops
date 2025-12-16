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
} from '@mui/material'
import { Database } from '@/types/database'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']
type PrintCost = Database['public']['Tables']['print_costs']['Row']
type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']

interface SelectedTextile {
  textile_id: string
  textile_name: string
  colors: string[]
  sizes: string[]
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
    final_price: number
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
  const [textiles, setTextiles] = useState<Map<string, TextileCatalog>>(new Map())
  const [priceCalculation, setPriceCalculation] = useState<PriceCalculation>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedTextiles.length > 0 && printCosts.length > 0 && textiles.size > 0) {
      calculatePrices()
    }
  }, [selectedTextiles, printPositions, printCosts, textiles])

  async function loadData() {
    try {
      // Lade Druckkosten
      const costsResponse = await fetch('/api/print-costs')
      const costsData = await costsResponse.json()
      if (costsResponse.ok) {
        setPrintCosts(costsData.printCosts || [])
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

      // Lade Konfiguration
      if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
        const selected = config.selected_textiles as any
        if (Array.isArray(selected)) {
          setSelectedTextiles(selected)
        }
      }

      if (config?.print_positions && typeof config.print_positions === 'object') {
        setPrintPositions(config.print_positions)
      }

      if (config?.price_calculation && typeof config.price_calculation === 'object') {
        setPriceCalculation(config.price_calculation as PriceCalculation)
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

      const positions = printPositions[textile.textile_id] || {
        front: false,
        back: false,
        side: false,
      }

      // Finde Druckkosten pro Position
      const frontCost = printCosts.find(c => c.position === 'front' && c.active)?.cost_per_unit || 0
      const backCost = printCosts.find(c => c.position === 'back' && c.active)?.cost_per_unit || 0
      const sideCost = printCosts.find(c => c.position === 'side' && c.active)?.cost_per_unit || 0

      const printCostsByPosition = {
        front: positions.front ? frontCost : 0,
        back: positions.back ? backCost : 0,
        side: positions.side ? sideCost : 0,
      }

      const totalPrintCost = printCostsByPosition.front + printCostsByPosition.back + printCostsByPosition.side
      const finalPrice = textileData.base_price + totalPrintCost

      calculation[textile.textile_id] = {
        textile_name: textile.textile_name,
        base_price: textileData.base_price,
        print_costs: printCostsByPosition,
        total_print_cost: totalPrintCost,
        final_price: finalPrice,
      }
    })

    setPriceCalculation(calculation)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ price_calculation: priceCalculation })
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

  const totalFinalPrice = Object.values(priceCalculation).reduce((sum, calc) => sum + calc.final_price, 0)
  const totalBasePrice = Object.values(priceCalculation).reduce((sum, calc) => sum + calc.base_price, 0)
  const totalPrintCost = Object.values(priceCalculation).reduce((sum, calc) => sum + calc.total_print_cost, 0)

  const hasZeroPrices = Object.values(priceCalculation).some(calc => calc.base_price === 0)

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Übersicht der berechneten Preise basierend auf Textil-Grundpreis und Druckkosten.
      </Typography>
      {hasZeroPrices && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Einige Textilien haben noch keinen Grundpreis gesetzt. Bitte setzen Sie die Preise in der Admin-Verwaltung.
        </Alert>
      )}

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
              <TableCell align="right" sx={{ fontWeight: 600 }}>Endpreis</TableCell>
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
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {calc.final_price.toFixed(2)} €
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
                {totalFinalPrice.toFixed(2)} €
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

