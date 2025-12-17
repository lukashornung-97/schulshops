'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Autocomplete,
  Divider,
  Grid,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { Database } from '@/types/database'

type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']
type TextilePrice = Database['public']['Tables']['textile_prices']['Row'] & {
  textile_catalog?: { name: string; brand: string | null }
}
type PrintCost = Database['public']['Tables']['print_costs']['Row']
type HandlingCost = Database['public']['Tables']['handling_costs']['Row']
type PrintMethod = Database['public']['Tables']['print_methods']['Row']
type PrintMethodCost = Database['public']['Tables']['print_method_costs']['Row'] & {
  print_methods?: { id: string; name: string; display_order: number; active: boolean }
}

export default function PricingPage() {
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:44',message:'PricingPage component render',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
  
  const [textilePrices, setTextilePrices] = useState<TextilePrice[]>([])
  const [textiles, setTextiles] = useState<TextileCatalog[]>([])
  const [printCosts, setPrintCosts] = useState<PrintCost[]>([])
  const [printMethodCosts, setPrintMethodCosts] = useState<PrintMethodCost[]>([])
  const [printMethods, setPrintMethods] = useState<PrintMethod[]>([])
  const [handlingCost, setHandlingCost] = useState<HandlingCost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Dialog States
  const [textilePriceDialogOpen, setTextilePriceDialogOpen] = useState(false)
  const [editingTextilePrice, setEditingTextilePrice] = useState<TextilePrice | null>(null)
  const [selectedTextile, setSelectedTextile] = useState<TextileCatalog | null>(null)
  const [priceValue, setPriceValue] = useState('')
  
  const [printCostDialogOpen, setPrintCostDialogOpen] = useState(false)
  const [editingPrintCost, setEditingPrintCost] = useState<PrintCost | null>(null)
  
  const [printMethodDialogOpen, setPrintMethodDialogOpen] = useState(false)
  const [editingPrintMethod, setEditingPrintMethod] = useState<PrintMethod | null>(null)
  const [printMethodName, setPrintMethodName] = useState('')
  const [printMethodDisplayOrder, setPrintMethodDisplayOrder] = useState('0')
  
  const [handlingCostDialogOpen, setHandlingCostDialogOpen] = useState(false)
  const [handlingCostValue, setHandlingCostValue] = useState('')
  
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:77',message:'loadData started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Lade Textilpreise
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:82',message:'fetching textile-prices',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const pricesResponse = await fetch('/api/textile-prices')
      const pricesData = await pricesResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:84',message:'textile-prices response',data:{ok:pricesResponse.ok,status:pricesResponse.status,hasData:!!pricesData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (pricesResponse.ok) {
        setTextilePrices(pricesData.prices || [])
      }

      // Lade Textilien
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:89',message:'fetching textile-catalog',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const textilesResponse = await fetch('/api/textile-catalog')
      const textilesData = await textilesResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:91',message:'textile-catalog response',data:{ok:textilesResponse.ok,status:textilesResponse.status,hasData:!!textilesData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (textilesResponse.ok) {
        setTextiles(textilesData.textiles || [])
      }

      // Lade Druckkosten
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:96',message:'fetching print-costs',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const printCostsResponse = await fetch('/api/print-costs')
      const printCostsData = await printCostsResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:98',message:'print-costs response',data:{ok:printCostsResponse.ok,status:printCostsResponse.status,hasData:!!printCostsData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (printCostsResponse.ok) {
        setPrintCosts(printCostsData.printCosts || [])
      }

      // Lade Druckarten
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:103',message:'fetching print-methods',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const printMethodsResponse = await fetch('/api/print-methods')
      const printMethodsData = await printMethodsResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:105',message:'print-methods response',data:{ok:printMethodsResponse.ok,status:printMethodsResponse.status,hasData:!!printMethodsData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (printMethodsResponse.ok) {
        setPrintMethods(printMethodsData.printMethods || [])
      }

      // Lade Druckarten-Preise
      const printMethodCostsResponse = await fetch('/api/print-method-costs')
      const printMethodCostsData = await printMethodCostsResponse.json()
      if (printMethodCostsResponse.ok) {
        setPrintMethodCosts(printMethodCostsData.printMethodCosts || [])
      }

      // Lade Handlingkosten
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:110',message:'fetching handling-costs',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const handlingResponse = await fetch('/api/handling-costs')
      const handlingData = await handlingResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:112',message:'handling-costs response',data:{ok:handlingResponse.ok,status:handlingResponse.status,hasData:!!handlingData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (handlingResponse.ok) {
        setHandlingCost(handlingData.handlingCost)
        setHandlingCostValue(handlingData.handlingCost?.cost_per_order?.toString() || '0')
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:116',message:'loadData completed successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:117',message:'loadData error caught',data:{errorMessage:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('Error loading data:', error)
      setError('Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenTextilePriceDialog(price?: TextilePrice) {
    if (price) {
      setEditingTextilePrice(price)
      setSelectedTextile(textiles.find(t => t.id === price.textile_id) || null)
      setPriceValue(price.price.toString())
    } else {
      setEditingTextilePrice(null)
      setSelectedTextile(null)
      setPriceValue('')
    }
    setTextilePriceDialogOpen(true)
  }

  function handleCloseTextilePriceDialog() {
    setTextilePriceDialogOpen(false)
    setEditingTextilePrice(null)
    setSelectedTextile(null)
    setPriceValue('')
  }

  async function handleSaveTextilePrice() {
    if (!selectedTextile || !priceValue) {
      setError('Bitte wählen Sie ein Textil und geben Sie einen Preis ein')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/textile-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textile_id: selectedTextile.id,
          price: parseFloat(priceValue),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setSuccess('Textilpreis gespeichert')
      handleCloseTextilePriceDialog()
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Speichern des Textilpreises')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTextilePrice(id: string) {
    if (!confirm('Möchten Sie diesen Textilpreis wirklich löschen?')) return

    try {
      const response = await fetch(`/api/textile-prices/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Löschen')
      }

      setSuccess('Textilpreis gelöscht')
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Löschen des Textilpreises')
    }
  }

  function handleOpenPrintCostDialog(cost?: PrintCost) {
    setEditingPrintCost(cost || null)
    setPrintCostDialogOpen(true)
  }

  function handleClosePrintCostDialog() {
    setPrintCostDialogOpen(false)
    setEditingPrintCost(null)
  }

  async function handleSavePrintCost(formData: FormData) {
    setSaving(true)
    try {
      const costData: any = {
        name: formData.get('name') as string,
        position: formData.get('position') as string,
        cost_per_unit: parseFloat(formData.get('cost_per_unit') as string),
        cost_50_units: formData.get('cost_50_units') ? parseFloat(formData.get('cost_50_units') as string) : null,
        cost_100_units: formData.get('cost_100_units') ? parseFloat(formData.get('cost_100_units') as string) : null,
      }

      const url = editingPrintCost 
        ? `/api/print-costs/${editingPrintCost.id}`
        : '/api/print-costs'
      const method = editingPrintCost ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(costData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setSuccess('Druckkosten gespeichert')
      handleClosePrintCostDialog()
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Speichern der Druckkosten')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePrintCost(id: string) {
    if (!confirm('Möchten Sie diese Zeile wirklich löschen?')) return

    try {
      const response = await fetch(`/api/print-costs/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Löschen')
      }

      setSuccess('Druckkosten gelöscht')
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Löschen der Druckkosten')
    }
  }

  async function handleSaveAllPrintMethodCosts(changes: Record<string, Record<string, number | null>>) {
    const promises: Promise<void>[] = []

    for (const [rowId, rowChanges] of Object.entries(changes)) {
      const methodId = (rowChanges as any).methodId
      const costId = (rowChanges as any).costId
      const updateData: Record<string, number | null> = {}
      
      // Entferne methodId und costId aus updateData
      Object.keys(rowChanges).forEach((key) => {
        if (key !== 'methodId' && key !== 'costId') {
          updateData[key] = rowChanges[key]
        }
      })

      if (costId) {
        // Update existing cost
        promises.push(
          fetch(`/api/print-method-costs/${costId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          }).then(async (response) => {
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Fehler beim Speichern')
            }
          })
        )
      } else if (methodId) {
        // Create new cost
        promises.push(
          fetch('/api/print-method-costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              print_method_id: methodId,
              cost_per_unit: updateData.cost_per_unit ?? 0,
              cost_50_units: updateData.cost_50_units ?? null,
              cost_100_units: updateData.cost_100_units ?? null,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Fehler beim Speichern')
            }
          })
        )
      }
    }

    await Promise.all(promises)
    setSuccess('Alle Änderungen erfolgreich gespeichert')
  }

  async function handleDeletePrintMethodCost(id: string) {
    if (!confirm('Möchten Sie diese Druckarten-Preise wirklich löschen?')) return

    try {
      const response = await fetch(`/api/print-method-costs/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Löschen')
      }

      setSuccess('Druckarten-Preise gelöscht')
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Löschen der Druckarten-Preise')
    }
  }

  function handleOpenHandlingCostDialog() {
    setHandlingCostDialogOpen(true)
  }

  function handleCloseHandlingCostDialog() {
    setHandlingCostDialogOpen(false)
  }

  async function handleSaveHandlingCost() {
    if (!handlingCostValue) {
      setError('Bitte geben Sie Handlingkosten ein')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/handling-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_per_order: parseFloat(handlingCostValue),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setSuccess('Handlingkosten gespeichert')
      handleCloseHandlingCostDialog()
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Speichern der Handlingkosten')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenPrintMethodDialog(method?: PrintMethod) {
    if (method) {
      setEditingPrintMethod(method)
      setPrintMethodName(method.name)
      setPrintMethodDisplayOrder(method.display_order.toString())
    } else {
      setEditingPrintMethod(null)
      setPrintMethodName('')
      setPrintMethodDisplayOrder('0')
    }
    setPrintMethodDialogOpen(true)
  }

  function handleClosePrintMethodDialog() {
    setPrintMethodDialogOpen(false)
    setEditingPrintMethod(null)
    setPrintMethodName('')
    setPrintMethodDisplayOrder('0')
  }

  async function handleSavePrintMethod() {
    if (!printMethodName) {
      setError('Bitte geben Sie einen Namen für die Druckart ein')
      return
    }

    setSaving(true)
    try {
      const url = editingPrintMethod 
        ? `/api/print-methods/${editingPrintMethod.id}`
        : '/api/print-methods'
      const method = editingPrintMethod ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: printMethodName,
          display_order: parseInt(printMethodDisplayOrder) || 0,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setSuccess('Druckart gespeichert')
      handleClosePrintMethodDialog()
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Speichern der Druckart')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePrintMethod(id: string) {
    if (!confirm('Möchten Sie diese Druckart wirklich löschen?')) return

    try {
      const response = await fetch(`/api/print-methods/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fehler beim Löschen')
      }

      setSuccess('Druckart gelöscht')
      loadData()
    } catch (error: any) {
      setError(error.message || 'Fehler beim Löschen der Druckart')
    }
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  const availableTextilesForPrice = textiles.filter(
    t => !textilePrices.some(tp => tp.textile_id === t.id)
  )

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
          Preisverwaltung
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Verwalten Sie Textilpreise, Handlingkosten und Druckkosten mit Mengenstaffelung
        </Typography>
      </Box>

      {/* Textilpreise */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Textilpreise
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenTextilePriceDialog()}
              size="small"
            >
              Preis hinzufügen
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Textil</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Marke</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Preis</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {textilePrices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Noch keine Textilpreise hinterlegt
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  textilePrices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell>{price.textile_catalog?.name || 'Unbekannt'}</TableCell>
                      <TableCell>{price.textile_catalog?.brand || '-'}</TableCell>
                      <TableCell align="right">{price.price.toFixed(2)} €</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenTextilePriceDialog(price)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteTextilePrice(price.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Handlingkosten */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Handlingkosten
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktuell: {handlingCost?.cost_per_order?.toFixed(2) || '0.00'} € pro Bestellung
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={handleOpenHandlingCostDialog}
              size="small"
            >
              Bearbeiten
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Druckarten und Staffelpreise */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Druckarten und Staffelpreise
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenPrintCostDialog()}
              size="small"
            >
              Neue Zeile hinzufügen
            </Button>
          </Box>
          <PrintMethodsPricingTable
            printMethods={printMethods}
            printMethodCosts={printMethodCosts}
            onDelete={handleDeletePrintMethodCost}
            onReload={loadData}
            onSaveAll={handleSaveAllPrintMethodCosts}
          />
        </CardContent>
      </Card>

      {/* Dialog: Textilpreis */}
      <Dialog open={textilePriceDialogOpen} onClose={handleCloseTextilePriceDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTextilePrice ? 'Textilpreis bearbeiten' : 'Textilpreis hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Autocomplete
              options={editingTextilePrice ? [selectedTextile!].filter(Boolean) : availableTextilesForPrice}
              value={selectedTextile}
              onChange={(_, newValue) => setSelectedTextile(newValue)}
              getOptionLabel={(option) => `${option.name}${option.brand ? ` (${option.brand})` : ''}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Textil auswählen"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
              )}
              disabled={!!editingTextilePrice}
            />
            <TextField
              label="Preis (€)"
              type="number"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTextilePriceDialog}>Abbrechen</Button>
          <Button onClick={handleSaveTextilePrice} variant="contained" disabled={saving || !selectedTextile || !priceValue}>
            {saving ? <CircularProgress size={20} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Handlingkosten */}
      <Dialog open={handlingCostDialogOpen} onClose={handleCloseHandlingCostDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Handlingkosten bearbeiten</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Kosten pro Bestellung (€)"
              type="number"
              value={handlingCostValue}
              onChange={(e) => setHandlingCostValue(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHandlingCostDialog}>Abbrechen</Button>
          <Button onClick={handleSaveHandlingCost} variant="contained" disabled={saving || !handlingCostValue}>
            {saving ? <CircularProgress size={20} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Druckkosten */}
      <Dialog open={printCostDialogOpen} onClose={handleClosePrintCostDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPrintCost ? 'Druckkosten bearbeiten' : 'Druckkosten hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <PrintCostForm
            cost={editingPrintCost}
            onSave={handleSavePrintCost}
            onClose={handleClosePrintCostDialog}
            saving={saving}
          />
        </DialogContent>
      </Dialog>


      {/* Snackbars */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Container>
  )
}

type CostField = 'cost_per_unit' | 'cost_50_units' | 'cost_100_units'

function PrintMethodsPricingTable({
  printMethods,
  printMethodCosts,
  onDelete,
  onReload,
  onSaveAll,
}: {
  printMethods: PrintMethod[]
  printMethodCosts: PrintMethodCost[]
  onDelete: (id: string) => void
  onReload: () => void
  onSaveAll: (changes: Record<string, Record<string, number | null>>) => Promise<void>
}) {
  {// #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricing/page.tsx:680',message:'PrintMethodsPricingTable render',data:{printMethods:printMethods.length,printMethodCosts:printMethodCosts.length},sessionId:'debug-session',runId:'run1',hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
  }// #endregion
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditValues({})
  }, [printMethodCosts])

  const fieldConfigs: { key: CostField; label: string }[] = [
    { key: 'cost_per_unit', label: 'Standard (€)' },
    { key: 'cost_50_units', label: '50 Stück (€)' },
    { key: 'cost_100_units', label: '100 Stück (€)' },
  ]

  const formatKey = (rowId: string, field: CostField) => `${rowId}_${field}`

  const getFieldValue = (method: PrintMethod, cost: PrintMethodCost | undefined, field: CostField) => {
    const rowId = cost?.id || method.id
    const key = formatKey(rowId, field)
    if (key in editValues) {
      return editValues[key]
    }

    if (!cost) {
      return ''
    }

    const fieldValue = cost[field]
    if (fieldValue === null || fieldValue === undefined) {
      return ''
    }

    return fieldValue.toString()
  }

  const parseNumeric = (rawValue: string, defaultValue: number | null = null) => {
    const normalized = rawValue.replace(',', '.').trim()
    if (!normalized) {
      return defaultValue
    }
    const parsed = parseFloat(normalized)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  const hasAnyChanges = () => {
    return Object.keys(editValues).length > 0
  }

  const handleSaveAll = async () => {
    if (!hasAnyChanges() || saving) {
      return
    }

    const changes: Record<string, Record<string, number | null>> = {}

    // Sammle alle Änderungen für alle Zeilen
    printMethods
      .filter((method) => method.active)
      .forEach((method) => {
        const cost = printMethodCosts.find((c) => c.print_method_id === method.id)
        const rowId = cost?.id || method.id
        const rowChanges: Record<string, number | null> = {}

        fieldConfigs.forEach((field) => {
          const key = formatKey(rowId, field.key)
          if (key in editValues) {
            const currentValue = editValues[key]
            const numericValue = parseNumeric(currentValue, null)

            if (cost) {
              const existingValue = cost[field.key]
              const isEqual =
                (numericValue === null && existingValue === null) ||
                numericValue === existingValue

              if (!isEqual) {
                rowChanges[field.key] = numericValue
              }
            } else {
              // Für neue Zeilen können alle Felder gesetzt werden
              if (numericValue !== null && !Number.isNaN(numericValue)) {
                rowChanges[field.key] = numericValue
              }
            }
          }
        })

        if (Object.keys(rowChanges).length > 0) {
          changes[rowId] = {
            ...rowChanges,
            methodId: method.id,
            costId: cost?.id,
          } as any
        }
      })

    if (Object.keys(changes).length === 0) {
      return
    }

    try {
      setSaving(true)
      await onSaveAll(changes)
      setEditValues({})
      onReload()
    } catch (error: any) {
      alert(error.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (rowId: string, field: CostField, value: string) => {
    const key = formatKey(rowId, field)
    setEditValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveAll}
          disabled={!hasAnyChanges() || saving}
          size="small"
        >
          {saving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Alle Änderungen speichern
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Druckart</TableCell>
              {fieldConfigs.map((field) => (
                <TableCell key={field.key} align="right" sx={{ fontWeight: 600 }}>
                  {field.label}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Aktionen
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {printMethods
              .filter((method) => method.active)
              .sort((a, b) => a.display_order - b.display_order)
              .map((method) => {
                const cost = printMethodCosts.find((c) => c.print_method_id === method.id)
                const rowId = cost?.id || method.id

                return (
                  <TableRow key={rowId}>
                    <TableCell>{method.name}</TableCell>
                    {fieldConfigs.map((field) => {
                      const value = getFieldValue(method, cost, field.key)
                      return (
                        <TableCell key={field.key} align="right">
                          <TextField
                            type="number"
                            value={value}
                            onChange={(e) => handleInputChange(rowId, field.key, e.target.value)}
                            size="small"
                            variant="standard"
                            disabled={saving}
                            inputProps={{
                              step: '0.01',
                              min: '0',
                              style: { textAlign: 'right', width: '90px' },
                            }}
                            placeholder={!cost ? '–' : undefined}
                            fullWidth
                          />
                        </TableCell>
                      )
                    })}
                    <TableCell align="right">
                      {cost && (
                        <IconButton
                          size="small"
                          onClick={() => onDelete(cost.id)}
                          color="error"
                          disabled={saving}
                          title="Löschen"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

// Separate Form Component für Druckkosten
function PrintCostForm({
  cost,
  onSave,
  onClose,
  saving,
}: {
  cost: PrintCost | null
  onSave: (formData: FormData) => void
  onClose: () => void
  saving: boolean
}) {
  const [name, setName] = useState(cost?.name || '')
  const [position, setPosition] = useState<'front' | 'back' | 'side'>(cost?.position || 'front')
  const [costPerUnit, setCostPerUnit] = useState(cost?.cost_per_unit?.toString() || '')
  const [cost50Units, setCost50Units] = useState(cost?.cost_50_units?.toString() || '')
  const [cost100Units, setCost100Units] = useState(cost?.cost_100_units?.toString() || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData()
    formData.append('name', name)
    formData.append('position', position)
    formData.append('cost_per_unit', costPerUnit)
    if (cost50Units) formData.append('cost_50_units', cost50Units)
    if (cost100Units) formData.append('cost_100_units', cost100Units)
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          required
        />
        <Autocomplete
          options={['front', 'back', 'side']}
          value={position}
          onChange={(_, newValue) => setPosition(newValue || 'front')}
          getOptionLabel={(option) => 
            option === 'front' ? 'Vorne' : option === 'back' ? 'Hinten' : 'Seite'
          }
          renderInput={(params) => (
            <TextField {...params} label="Position" size="small" required />
          )}
        />
        <TextField
          label="Kosten pro Stück (€)"
          type="number"
          value={costPerUnit}
          onChange={(e) => setCostPerUnit(e.target.value)}
          fullWidth
          size="small"
          inputProps={{ step: '0.01', min: '0' }}
          required
        />
        <TextField
          label="Kosten für 50 Stück (€)"
          type="number"
          value={cost50Units}
          onChange={(e) => setCost50Units(e.target.value)}
          fullWidth
          size="small"
          inputProps={{ step: '0.01', min: '0' }}
        />
        <TextField
          label="Kosten für 100 Stück (€)"
          type="number"
          value={cost100Units}
          onChange={(e) => setCost100Units(e.target.value)}
          fullWidth
          size="small"
          inputProps={{ step: '0.01', min: '0' }}
        />
      </Box>
      <DialogActions sx={{ mt: 2 }}>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button type="submit" variant="contained" disabled={saving || !name || !costPerUnit}>
          {saving ? <CircularProgress size={20} /> : 'Speichern'}
        </Button>
      </DialogActions>
    </form>
  )
}

