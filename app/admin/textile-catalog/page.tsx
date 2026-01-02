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
  Autocomplete,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import InventoryIcon from '@mui/icons-material/Inventory'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']

export default function TextileCatalogPage() {
  const [textiles, setTextiles] = useState<TextileCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTextile, setEditingTextile] = useState<TextileCatalog | null>(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    article_number: '',
    base_price: '0',
    available_colors: [] as string[],
    available_sizes: [] as string[],
    image_url: '',
    description: '',
    active: true,
  })
  const [loadingFromLshop, setLoadingFromLshop] = useState(false)
  const [colorInput, setColorInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    stats?: any
  } | null>(null)

  const fetchTextiles = async () => {
    try {
      const response = await fetch('/api/textile-catalog?active=false')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setTextiles(data.textiles || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTextiles()
  }, [])

  const handleOpenDialog = (textile?: TextileCatalog) => {
    if (textile) {
      setEditingTextile(textile)
      setFormData({
        name: textile.name,
        brand: textile.brand || '',
        article_number: textile.article_number || '',
        base_price: textile.base_price.toString(),
        available_colors: textile.available_colors || [],
        available_sizes: textile.available_sizes || [],
        image_url: textile.image_url || '',
        description: textile.description || '',
        active: textile.active,
      })
    } else {
      setEditingTextile(null)
      setFormData({
        name: '',
        brand: '',
        article_number: '',
        base_price: '',
        available_colors: [],
        available_sizes: [],
        image_url: '',
        description: '',
        active: true,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTextile(null)
    setColorInput('')
    setSizeInput('')
  }

  const handleAddColor = () => {
    if (colorInput.trim() && !formData.available_colors.includes(colorInput.trim())) {
      setFormData({
        ...formData,
        available_colors: [...formData.available_colors, colorInput.trim()],
      })
      setColorInput('')
    }
  }

  const handleRemoveColor = (color: string) => {
    setFormData({
      ...formData,
      available_colors: formData.available_colors.filter(c => c !== color),
    })
  }

  const handleAddSize = () => {
    if (sizeInput.trim() && !formData.available_sizes.includes(sizeInput.trim())) {
      setFormData({
        ...formData,
        available_sizes: [...formData.available_sizes, sizeInput.trim()],
      })
      setSizeInput('')
    }
  }

  const handleRemoveSize = (size: string) => {
    setFormData({
      ...formData,
      available_sizes: formData.available_sizes.filter(s => s !== size),
    })
  }

  const handleLoadFromLshop = async () => {
    if (!editingTextile) {
      setSnackbar({
        open: true,
        message: 'Bitte speichern Sie zuerst das Textil',
        severity: 'error',
      })
      return
    }

    if (!formData.brand) {
      setSnackbar({
        open: true,
        message: 'Bitte geben Sie zuerst eine Marke/Artikelnummer ein',
        severity: 'error',
      })
      return
    }

    setLoadingFromLshop(true)
    try {
      const response = await fetch('/api/textile-catalog/fetch-from-lshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textile_id: editingTextile.id,
          article_code: formData.brand, // Verwende brand als article_code
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden von l-shop-team.de')
      }

      if (data.success && data.fetched) {
        // Aktualisiere Formular mit geladenen Daten
        setFormData({
          ...formData,
          image_url: data.fetched.image_url || formData.image_url,
          description: data.fetched.description || formData.description,
        })

        setSnackbar({
          open: true,
          message: 'Daten erfolgreich von l-shop-team.de geladen',
          severity: 'success',
        })

        // Lade Textilien neu, um aktualisierte Daten zu erhalten
        await fetchTextiles()
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Keine Daten gefunden',
          severity: 'warning',
        })
      }
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Laden von l-shop-team.de',
        severity: 'error',
      })
    } finally {
      setLoadingFromLshop(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSnackbar({
        open: true,
        message: 'Name ist erforderlich',
        severity: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const url = editingTextile
        ? `/api/textile-catalog/${editingTextile.id}`
        : '/api/textile-catalog'
      
      const method = editingTextile ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            brand: formData.brand || null,
            article_number: formData.article_number || null,
            base_price: formData.base_price ? parseFloat(formData.base_price) : 0,
            available_colors: formData.available_colors,
            available_sizes: formData.available_sizes,
            image_url: formData.image_url || null,
            description: formData.description || null,
            active: formData.active,
          }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      setSnackbar({
        open: true,
        message: editingTextile ? 'Textil erfolgreich aktualisiert' : 'Textil erfolgreich erstellt',
        severity: 'success',
      })
      handleCloseDialog()
      fetchTextiles()
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

  const handleDelete = async (textile: TextileCatalog) => {
    if (!confirm(`Möchten Sie "${textile.name}" wirklich löschen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/textile-catalog/${textile.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      setSnackbar({
        open: true,
        message: 'Textil erfolgreich gelöscht',
        severity: 'success',
      })
      fetchTextiles()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Löschen',
        severity: 'error',
      })
    }
  }

  const handleImport = async () => {
    if (!confirm('Möchten Sie Textilien aus der CSV-Datei importieren? Bestehende Einträge werden aktualisiert.')) {
      return
    }

    setImporting(true)
    setImportResult(null)
    setError(null)

    try {
      const response = await fetch('/api/textile-catalog/import', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Import')
      }

      setImportResult({
        success: true,
        message: data.message,
        stats: data.stats,
      })

      setSnackbar({
        open: true,
        message: data.message,
        severity: 'success',
      })

      // Lade Textilien neu
      await fetchTextiles()
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.message || 'Fehler beim Import',
      })
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Import',
        severity: 'error',
      })
    } finally {
      setImporting(false)
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
            <InventoryIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Textilkatalog
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verwalten Sie verfügbare Textilien für Lead-Schulen
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {importResult && (
        <Alert 
          severity={importResult.success ? 'success' : 'error'} 
          sx={{ mb: 3 }}
          onClose={() => setImportResult(null)}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
            {importResult.message}
          </Typography>
          {importResult.stats && (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Erstellt: {importResult.stats.created}</li>
              <li>Aktualisiert: {importResult.stats.updated}</li>
              <li>Übersprungen: {importResult.stats.skipped}</li>
              {importResult.stats.errors > 0 && (
                <li>Fehler: {importResult.stats.errors}</li>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Textiles List Card */}
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
              Textilien ({textiles.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
                onClick={handleImport}
                disabled={importing}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                }}
              >
                {importing ? 'Importiere...' : 'Aus CSV importieren'}
              </Button>
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
                Textil hinzufügen
              </Button>
            </Box>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Marke</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Grundpreis</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Farben</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Größen</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {textiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Keine Textilien gefunden.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  textiles.map((textile) => (
                    <TableRow key={textile.id} hover>
                      <TableCell>{textile.name}</TableCell>
                      <TableCell>{textile.brand || '-'}</TableCell>
                      <TableCell>{textile.base_price.toFixed(2)} €</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(textile.available_colors || []).slice(0, 3).map((color) => (
                            <Chip key={color} label={color} size="small" />
                          ))}
                          {(textile.available_colors || []).length > 3 && (
                            <Chip label={`+${(textile.available_colors || []).length - 3}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(textile.available_sizes || []).slice(0, 3).map((size) => (
                            <Chip key={size} label={size} size="small" />
                          ))}
                          {(textile.available_sizes || []).length > 3 && (
                            <Chip label={`+${(textile.available_sizes || []).length - 3}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={textile.active ? 'Aktiv' : 'Inaktiv'}
                          size="small"
                          color={textile.active ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            onClick={() => handleOpenDialog(textile)}
                            color="primary"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton
                            onClick={() => handleDelete(textile)}
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
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingTextile ? 'Textil bearbeiten' : 'Neues Textil hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Marke"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Artikelnummer"
                value={formData.article_number}
                onChange={(e) => setFormData({ ...formData, article_number: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Grundpreis (€)"
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                inputProps={{ step: '0.01', min: '0' }}
                helperText="Optional - kann später gesetzt werden"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bild-URL"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                  label="Produktbeschreibung"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={4}
                  placeholder="Produktbeschreibung..."
                  helperText="Beschreibung des Textils, kann von l-shop-team.de geladen werden"
                />
                {editingTextile && formData.brand && (
                  <Button
                    variant="outlined"
                    onClick={handleLoadFromLshop}
                    disabled={loadingFromLshop}
                    sx={{ mt: 1, whiteSpace: 'nowrap' }}
                    startIcon={loadingFromLshop ? <CircularProgress size={16} /> : null}
                  >
                    {loadingFromLshop ? 'Lädt...' : 'Von l-shop-team.de laden'}
                  </Button>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Verfügbare Farben
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {formData.available_colors.map((color) => (
                  <Chip
                    key={color}
                    label={color}
                    onDelete={() => handleRemoveColor(color)}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Farbe hinzufügen"
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddColor()
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Button variant="outlined" onClick={handleAddColor} size="small">
                  Hinzufügen
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Verfügbare Größen
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {formData.available_sizes.map((size) => (
                  <Chip
                    key={size}
                    label={size}
                    onDelete={() => handleRemoveSize(size)}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Größe hinzufügen"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSize()
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Button variant="outlined" onClick={handleAddSize} size="small">
                  Hinzufügen
                </Button>
              </Box>
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
            disabled={saving || !formData.name.trim()}
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

