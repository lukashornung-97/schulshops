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
  Chip,
  Tooltip,
  Grid,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PrintIcon from '@mui/icons-material/Print'
import { Database } from '@/types/database'

type PrintCost = Database['public']['Tables']['print_costs']['Row']

export default function PrintCostsPage() {
  const [printCosts, setPrintCosts] = useState<PrintCost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<PrintCost | null>(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [formData, setFormData] = useState({
    name: '',
    position: 'front' as 'front' | 'back' | 'side',
    cost_per_unit: '',
    setup_fee: '',
    active: true,
  })

  const fetchPrintCosts = async () => {
    try {
      const response = await fetch('/api/print-costs?active=false')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setPrintCosts(data.printCosts || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrintCosts()
  }, [])

  const handleOpenDialog = (cost?: PrintCost) => {
    if (cost) {
      setEditingCost(cost)
      setFormData({
        name: cost.name,
        position: cost.position,
        cost_per_unit: cost.cost_per_unit.toString(),
        setup_fee: cost.setup_fee.toString(),
        active: cost.active,
      })
    } else {
      setEditingCost(null)
      setFormData({
        name: '',
        position: 'front',
        cost_per_unit: '',
        setup_fee: '',
        active: true,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCost(null)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.cost_per_unit) {
      setSnackbar({
        open: true,
        message: 'Name und Kosten pro Einheit sind erforderlich',
        severity: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const url = editingCost
        ? `/api/print-costs/${editingCost.id}`
        : '/api/print-costs'
      
      const method = editingCost ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          position: formData.position,
          cost_per_unit: parseFloat(formData.cost_per_unit),
          setup_fee: parseFloat(formData.setup_fee) || 0,
          active: formData.active,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      setSnackbar({
        open: true,
        message: editingCost ? 'Druckkosten erfolgreich aktualisiert' : 'Druckkosten erfolgreich erstellt',
        severity: 'success',
      })
      handleCloseDialog()
      fetchPrintCosts()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Speichern',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cost: PrintCost) => {
    if (!confirm(`Möchten Sie "${cost.name}" wirklich löschen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/print-costs/${cost.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      setSnackbar({
        open: true,
        message: 'Druckkosten erfolgreich gelöscht',
        severity: 'success',
      })
      fetchPrintCosts()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Löschen',
        severity: 'error',
      })
    }
  }

  const getPositionLabel = (position: string) => {
    switch (position) {
      case 'front':
        return 'Vorne'
      case 'back':
        return 'Hinten'
      case 'side':
        return 'Seite'
      default:
        return position
    }
  }

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'front':
        return 'primary'
      case 'back':
        return 'secondary'
      case 'side':
        return 'info'
      default:
        return 'default'
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PrintIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Druckkosten
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verwalten Sie die Druckkosten pro Position
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Print Costs List Card */}
      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              Druckkosten ({printCosts.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              Druckkosten hinzufügen
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Position</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kosten pro Stück</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Einrichtungsgebühr</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {printCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Keine Druckkosten gefunden.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  printCosts.map((cost) => (
                    <TableRow key={cost.id} hover>
                      <TableCell>{cost.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={getPositionLabel(cost.position)}
                          size="small"
                          color={getPositionColor(cost.position) as any}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{cost.cost_per_unit.toFixed(2)} €</TableCell>
                      <TableCell>{cost.setup_fee.toFixed(2)} €</TableCell>
                      <TableCell>
                        <Chip
                          label={cost.active ? 'Aktiv' : 'Inaktiv'}
                          size="small"
                          color={cost.active ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            onClick={() => handleOpenDialog(cost)}
                            color="primary"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton
                            onClick={() => handleDelete(cost)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingCost ? 'Druckkosten bearbeiten' : 'Neue Druckkosten hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Position *</InputLabel>
                <Select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as 'front' | 'back' | 'side' })}
                  label="Position *"
                >
                  <MenuItem value="front">Vorne</MenuItem>
                  <MenuItem value="back">Hinten</MenuItem>
                  <MenuItem value="side">Seite</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Kosten pro Stück (€) *"
                type="number"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                inputProps={{ step: '0.01', min: '0' }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Einrichtungsgebühr (€)"
                type="number"
                value={formData.setup_fee}
                onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                }
                label="Aktiv"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !formData.name.trim() || !formData.cost_per_unit}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {saving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}


