'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  Chip,
  Autocomplete,
  Alert,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  IconButton,
  Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import EditIcon from '@mui/icons-material/Edit'
import { Database } from '@/types/database'

type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']
type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']
type Product = Database['public']['Tables']['products']['Row'] & {
  textile_catalog?: TextileCatalog
  product_variants?: Array<{ id: string; name: string; color_name: string | null }>
}

interface PrintFile {
  id: string
  url: string
  fileName: string
}

interface PrintConfig {
  front?: {
    method_id?: string
    method_name?: string
    files?: { [color: string]: PrintFile[] }
  }
  back?: {
    method_id?: string
    method_name?: string
    files?: { [color: string]: PrintFile[] }
  }
  side?: {
    method_id?: string
    method_name?: string
    files?: { [color: string]: PrintFile[] }
  }
}

interface TextileSelectorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
}

export default function TextileSelector({ schoolId, config, onSave, onNext }: TextileSelectorProps) {
  const [textiles, setTextiles] = useState<TextileCatalog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchValue, setSearchValue] = useState<TextileCatalog | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<{
    name: string
    textile_id: string | null
    selected_colors: string[]
    selected_sizes: string[]
    print_config: PrintConfig
  } | null>(null)
  const [printMethods, setPrintMethods] = useState<Array<{ id: string; name: string }>>([])
  const [printPositions, setPrintPositions] = useState<{ front: boolean; back: boolean; side: boolean }>({
    front: false,
    back: false,
    side: false,
  })
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [config])

  async function loadData() {
    try {
      // Lade Textilien
      const textilesResponse = await fetch('/api/textile-catalog')
      const textilesData = await textilesResponse.json()
      if (textilesResponse.ok) {
        setTextiles(textilesData.textiles || [])
      }

      // Lade Druckarten
      const printMethodsResponse = await fetch('/api/print-methods')
      const printMethodsData = await printMethodsResponse.json()
      if (printMethodsResponse.ok) {
        setPrintMethods(printMethodsData.printMethods || [])
      }

      // Lade Produkte wenn shop_id vorhanden
      if (config?.shop_id) {
        const productsResponse = await fetch(`/api/products?shop_id=${config.shop_id}`)
        const productsData = await productsResponse.json()
        if (productsResponse.ok) {
          setProducts(productsData.products || [])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleAddTextile(textile: TextileCatalog | null) {
    if (!textile || !config?.shop_id) return

    // Öffne Dialog zum Erstellen eines neuen Produkts
    setCurrentProduct(null)
    setEditingProduct({
      name: `${textile.name} | `,
      textile_id: textile.id,
      selected_colors: [],
      selected_sizes: [],
      print_config: {},
    })
    setPrintPositions({ front: false, back: false, side: false })
    setDialogOpen(true)
    setSearchValue(null)
  }

  function handleEditProduct(product: Product) {
    // Extrahiere Farben und Größen aus Varianten
    const variants = product.product_variants || []
    const colors = [...new Set(variants.map(v => v.color_name).filter(Boolean) as string[])]
    const sizes = [...new Set(variants.map(v => v.name).filter(n => n !== 'Standard'))]

    const printConfig = (product.print_config as PrintConfig) || {}

    setCurrentProduct(product)
    setEditingProduct({
      name: product.name,
      textile_id: product.textile_id,
      selected_colors: colors,
      selected_sizes: sizes,
      print_config: printConfig,
    })
    setPrintPositions({
      front: !!printConfig.front,
      back: !!printConfig.back,
      side: !!printConfig.side,
    })
    setDialogOpen(true)
  }

  function handleCloseDialog() {
    setDialogOpen(false)
    setCurrentProduct(null)
    setEditingProduct(null)
    setPrintPositions({ front: false, back: false, side: false })
  }

  function handlePrintPositionChange(position: 'front' | 'back' | 'side', checked: boolean) {
    setPrintPositions({
      ...printPositions,
      [position]: checked,
    })

    if (editingProduct) {
      const newConfig = { ...editingProduct.print_config }
      if (!checked) {
        delete newConfig[position]
      } else {
        if (!newConfig[position]) {
          newConfig[position] = { files: {} }
        }
      }
      setEditingProduct({
        ...editingProduct,
        print_config: newConfig,
      })
    }
  }

  async function handleSaveProduct() {
    if (!editingProduct || !config?.shop_id) return

    setSaving(true)
    try {
      const printConfigToSave: PrintConfig = {}

      // Speichere nur aktive Positionen
      if (printPositions.front && editingProduct.print_config.front) {
        printConfigToSave.front = editingProduct.print_config.front
      }
      if (printPositions.back && editingProduct.print_config.back) {
        printConfigToSave.back = editingProduct.print_config.back
      }
      if (printPositions.side && editingProduct.print_config.side) {
        printConfigToSave.side = editingProduct.print_config.side
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentProduct?.id || undefined,
          shop_id: config.shop_id,
          textile_id: editingProduct.textile_id,
          name: editingProduct.name || 'Unbenanntes Produkt',
          print_config: printConfigToSave,
          selected_colors: editingProduct.selected_colors,
          selected_sizes: editingProduct.selected_sizes,
          sort_index: currentProduct?.sort_index ?? products.length,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      // Lade Produkte neu
      await loadData()
      handleCloseDialog()
    } catch (error: any) {
      console.error('Error saving product:', error)
      alert(error.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) return

    try {
      const response = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      // Lade Produkte neu
      await loadData()
    } catch (error: any) {
      console.error('Error deleting product:', error)
      alert(error.message || 'Fehler beim Löschen')
    }
  }

  async function handleFileUpload(position: 'front' | 'back' | 'side', files: FileList | null, color: string) {
    if (!files || files.length === 0 || !editingProduct || !color) return

    setUploading(`${position}_${color}`)

    try {
      const fileArray = Array.from(files)
      const uploadedFiles: PrintFile[] = []

      for (const file of fileArray) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('textile_id', editingProduct.textile_id || '')
        formData.append('position', position)
        formData.append('color', color)

        const response = await fetch('/api/lead-config/upload-print-file', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Fehler beim Hochladen')
        }

        const data = await response.json()
        uploadedFiles.push({
          id: data.fileId,
          url: data.url,
          fileName: data.fileName,
        })
      }

      // Aktualisiere print_config
      const newConfig = { ...editingProduct.print_config }
      if (!newConfig[position]) {
        newConfig[position] = { files: {} }
      }
      if (!newConfig[position]!.files) {
        newConfig[position]!.files = {}
      }
      if (!newConfig[position]!.files![color]) {
        newConfig[position]!.files![color] = []
      }
      newConfig[position]!.files![color] = [
        ...(newConfig[position]!.files![color] || []),
        ...uploadedFiles,
      ]

      setEditingProduct({
        ...editingProduct,
        print_config: newConfig,
      })
    } catch (error: any) {
      console.error('Error uploading files:', error)
      alert(error.message || 'Fehler beim Hochladen')
    } finally {
      setUploading(null)
    }
  }

  function handlePrintMethodChange(position: 'front' | 'back' | 'side', methodId: string) {
    if (!editingProduct) return

    const method = printMethods.find(m => m.id === methodId)
    if (!method) return

    const newConfig = { ...editingProduct.print_config }
    if (!newConfig[position]) {
      newConfig[position] = { files: {} }
    }
    newConfig[position]!.method_id = methodId
    newConfig[position]!.method_name = method.name
    setEditingProduct({
      ...editingProduct,
      print_config: newConfig,
    })
  }

  // Gruppiere Produkte nach Textil
  const productsByTextile = products.reduce((acc, product) => {
    const textileId = product.textile_id || 'unknown'
    if (!acc[textileId]) {
      acc[textileId] = []
    }
    acc[textileId].push(product)
    return acc
  }, {} as Record<string, Product[]>)

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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Wählen Sie Textilien aus und erstellen Sie Produkte mit individuellen Namen und Druckkonfigurationen.
      </Typography>

      {/* Textil-Suche */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          value={searchValue}
          onChange={(_, newValue) => handleAddTextile(newValue)}
          options={textiles}
          getOptionLabel={(option) => `${option.name}${option.brand ? ` - ${option.brand}` : ''}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Textil suchen und Produkt erstellen"
              placeholder="Textilname oder Marke eingeben..."
              fullWidth
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  {option.name}
                </Typography>
                {option.brand && (
                  <Typography variant="body2" color="text.secondary">
                    {option.brand}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          noOptionsText="Keine Textilien gefunden"
        />
      </Box>

      {/* Produkte nach Textil gruppiert */}
      {Object.keys(productsByTextile).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Produkte ({products.length})
          </Typography>

          {Object.entries(productsByTextile).map(([textileId, textileProducts]) => {
            const textile = textiles.find(t => t.id === textileId)

            return (
              <Accordion key={textileId} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 4 }}>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {textile?.name || 'Unbekanntes Textil'}
                      </Typography>
                      {textile?.brand && (
                        <Typography variant="body2" color="text.secondary">
                          {textile.brand}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {textileProducts.length} Produkt{textileProducts.length !== 1 ? 'e' : ''}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {textileProducts.map((product) => {
                      const variants = product.product_variants || []
                      const colors = [...new Set(variants.map(v => v.color_name).filter(Boolean))]
                      const sizes = [...new Set(variants.map(v => v.name).filter(n => n !== 'Standard'))]

                      return (
                        <Paper key={product.id} variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {product.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Farben: {colors.join(', ') || 'Keine'} | 
                                Größen: {sizes.join(', ') || 'Keine'}
                              </Typography>
                              {product.calculated_vk_brutto && (
                                <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                                  VK: {product.calculated_vk_brutto.toFixed(2)} €
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleEditProduct(product)}
                                color="primary"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteProduct(product.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Paper>
                      )
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )
          })}
        </Box>
      )}

      {products.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Noch keine Produkte erstellt. Verwenden Sie das Suchfeld oben, um ein Textil auszuwählen und ein Produkt zu erstellen.
        </Alert>
      )}

      {/* Dialog für Produkt Bearbeitung */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Produkt {currentProduct ? 'bearbeiten' : 'erstellen'}
        </DialogTitle>
        <DialogContent>
          {editingProduct && (
            <>
              {/* Name */}
              <TextField
                label="Produktname"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  name: e.target.value,
                })}
                fullWidth
                sx={{ mb: 3, mt: 2 }}
                placeholder="z.B. Classic Hoodie | Weinstadt Back Print"
                helperText="Geben Sie einen individuellen Namen für dieses Produkt ein"
              />

              {/* Farben */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Farben auswählen
                </Typography>
                <Autocomplete
                  multiple
                  options={textiles.find(t => t.id === editingProduct.textile_id)?.available_colors || []}
                  value={editingProduct.selected_colors}
                  onChange={(_, newValue) => setEditingProduct({
                    ...editingProduct,
                    selected_colors: newValue,
                  })}
                  filterSelectedOptions
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Farben auswählen..." fullWidth />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                    ))
                  }
                />
              </Box>

              {/* Größen */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Größen auswählen
                </Typography>
                <Autocomplete
                  multiple
                  options={textiles.find(t => t.id === editingProduct.textile_id)?.available_sizes || []}
                  value={editingProduct.selected_sizes}
                  onChange={(_, newValue) => setEditingProduct({
                    ...editingProduct,
                    selected_sizes: newValue,
                  })}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Größen auswählen..." fullWidth />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                    ))
                  }
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Druckpositionen */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                  Druckpositionen konfigurieren
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {(['front', 'back', 'side'] as const).map((position) => {
                    const positionLabel = position === 'front' ? 'Vorne' : position === 'back' ? 'Hinten' : 'Seite'
                    const positionConfig = editingProduct.print_config[position]

                    return (
                      <Box key={position}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={printPositions[position]}
                              onChange={(e) => handlePrintPositionChange(position, e.target.checked)}
                            />
                          }
                          label={positionLabel}
                        />
                        {printPositions[position] && (
                          <Box sx={{ ml: 4, mt: 1 }}>
                            {/* Druckart-Auswahl */}
                            <Autocomplete
                              options={printMethods}
                              getOptionLabel={(option) => option.name}
                              value={printMethods.find(m => m.id === positionConfig?.method_id) || null}
                              onChange={(_, newValue) => {
                                if (newValue) {
                                  handlePrintMethodChange(position, newValue.id)
                                }
                              }}
                              renderInput={(params) => (
                                <TextField {...params} size="small" label="Druckart" fullWidth />
                              )}
                              sx={{ mb: 2 }}
                            />

                            {/* Datei-Upload für jede Farbe */}
                            {editingProduct.selected_colors.length > 0 && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {editingProduct.selected_colors.map((color) => {
                                  const files = positionConfig?.files?.[color] || []
                                  const isUploading = uploading === `${position}_${color}`

                                  return (
                                    <Box key={color} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                                      <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                                        {color}
                                      </Typography>
                                      {files.length > 0 && (
                                        <Box sx={{ mb: 1 }}>
                                          {files.map((file) => (
                                            <Typography key={file.id} variant="caption" display="block" sx={{ fontSize: '0.7rem', ml: 1 }}>
                                              {file.fileName.length > 30 ? file.fileName.substring(0, 30) + '...' : file.fileName}
                                            </Typography>
                                          ))}
                                        </Box>
                                      )}
                                      <input
                                        accept=".pdf,.ai,.eps,.psd"
                                        style={{ display: 'none' }}
                                        id={`print-file-${position}-${color}`}
                                        type="file"
                                        multiple
                                        onChange={(e) => handleFileUpload(position, e.target.files, color)}
                                        disabled={isUploading}
                                      />
                                      <label htmlFor={`print-file-${position}-${color}`}>
                                        <Button
                                          variant="outlined"
                                          component="span"
                                          fullWidth
                                          size="small"
                                          startIcon={isUploading ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 16 }} />}
                                          disabled={isUploading}
                                        >
                                          {isUploading ? '...' : 'Dateien hochladen'}
                                        </Button>
                                      </label>
                                    </Box>
                                  )
                                })}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button
            onClick={handleSaveProduct}
            variant="contained"
            disabled={saving || !editingProduct?.name || editingProduct?.selected_colors.length === 0}
          >
            {saving ? <CircularProgress size={20} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
