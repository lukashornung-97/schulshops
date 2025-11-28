'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Card,
  Grid,
  FormControlLabel,
  Switch,
  Divider,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tabs,
  Tab,
  Checkbox,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import ImageIcon from '@mui/icons-material/Image'
import PrintIcon from '@mui/icons-material/Print'

type Product = Database['public']['Tables']['products']['Row']
type ProductVariant = Database['public']['Tables']['product_variants']['Row']

interface ProductImage {
  id: string
  product_id: string
  textile_color_id: string | null
  textile_color_name: string
  image_type: 'front' | 'back' | 'side'
  image_url: string | null
  print_file_url: string | null
}

export default function EditProduct() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: '',
    active: true,
    sort_index: 0,
  })
  const [textileColors, setTextileColors] = useState<string[]>([])
  const [newColorName, setNewColorName] = useState<string>('')
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [unassignedImages, setUnassignedImages] = useState<ProductImage[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [activeTab, setActiveTab] = useState<'frontend' | 'print'>('frontend')
  const [assigningImageId, setAssigningImageId] = useState<string | null>(null)
  const [selectedColorsForAssign, setSelectedColorsForAssign] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (params.productId) {
      loadProduct()
      loadVariants()
      loadProductImages()
    }
  }, [params.productId])

  useEffect(() => {
    // Extrahiere eindeutige Textilfarben aus Varianten und zugeordneten Bildern
    const colorsFromVariants = variants
      .filter(v => v.color_name)
      .map(v => v.color_name!)
    const colorsFromImages = productImages
      .filter(img => img.textile_color_name)
      .map(img => img.textile_color_name!)
    const allColors = Array.from(new Set([...colorsFromVariants, ...colorsFromImages]))
    setTextileColors(allColors)
    
    // Trenne zugeordnete und nicht zugeordnete Bilder
    const assigned = productImages.filter(img => img.textile_color_name)
    const unassigned = productImages.filter(img => !img.textile_color_name)
    setUnassignedImages(unassigned)
  }, [variants, productImages])

  async function loadProduct() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.productId)
        .single()

      if (error) throw error
      if (!data) {
        setError('Produkt nicht gefunden')
        return
      }

      setProduct(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        base_price: data.base_price.toString(),
        active: data.active,
        sort_index: data.sort_index || 0,
      })
    } catch (error: any) {
      console.error('Error loading product:', error)
      setError(error.message || 'Fehler beim Laden des Produkts')
    } finally {
      setLoading(false)
    }
  }

  async function loadVariants() {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', params.productId)
        .eq('active', true)

      if (error) throw error
      setVariants(data || [])
    } catch (error: any) {
      console.error('Error loading variants:', error)
    }
  }

  async function loadProductImages() {
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', params.productId)
        .order('textile_color_name', { ascending: true })
        .order('image_type', { ascending: true })

      if (error) throw error
      setProductImages(data || [])
    } catch (error: any) {
      console.error('Error loading product images:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          description: formData.description,
          base_price: parseFloat(formData.base_price),
          active: formData.active,
          sort_index: formData.sort_index,
        })
        .eq('id', params.productId)

      if (error) throw error

      setSuccess('Produkt erfolgreich aktualisiert')
      setTimeout(() => {
        router.push(`/shops/${params.id}`)
      }, 1000)
    } catch (error: any) {
      console.error('Error updating product:', error)
      setError(error.message || 'Fehler beim Aktualisieren des Produkts')
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(type: 'front' | 'back' | 'side', file: File, isPrintFile: boolean) {
    setUploading(`${type}_${isPrintFile ? 'print' : 'img'}`)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('is_print_file', isPrintFile.toString())

      const response = await fetch(`/api/products/${params.productId}/upload-image`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Hochladen')
      }

      setSuccess('Bild erfolgreich hochgeladen. Bitte ordnen Sie es jetzt Textilfarben zu.')
      await loadProductImages() // Reload images
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setError(error.message || 'Fehler beim Hochladen des Bildes')
    } finally {
      setUploading(null)
    }
  }

  async function handleImageDelete(imageId: string) {
    if (!confirm('Möchten Sie dieses Bild wirklich löschen?')) return

    setUploading(`delete_${imageId}`)
    setError(null)

    try {
      // Lade Bild-Eintrag um URLs zu erhalten
      const imageEntry = productImages.find(img => img.id === imageId)
      if (!imageEntry) {
        throw new Error('Bild nicht gefunden')
      }

      // Lösche Dateien aus Storage
      const urlsToDelete: string[] = []
      if (imageEntry.image_url) {
        urlsToDelete.push(imageEntry.image_url)
      }
      if (imageEntry.print_file_url) {
        urlsToDelete.push(imageEntry.print_file_url)
      }

      for (const url of urlsToDelete) {
        const urlParts = url.split('/')
        const bucketIndex = urlParts.findIndex(part => part === 'product-images' || part === 'print-files')
        if (bucketIndex >= 0) {
          const bucket = urlParts[bucketIndex]
          const fileName = urlParts.slice(bucketIndex + 1).join('/')
          await supabase.storage.from(bucket).remove([fileName])
        }
      }

      // Lösche Eintrag aus Datenbank
      const { error: deleteError } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      setSuccess('Bild erfolgreich gelöscht')
      await loadProductImages() // Reload images
    } catch (error: any) {
      console.error('Error deleting image:', error)
      setError(error.message || 'Fehler beim Löschen des Bildes')
    } finally {
      setUploading(null)
    }
  }

  function addNewColor() {
    if (!newColorName.trim()) return
    
    const colorName = newColorName.trim()
    if (!textileColors.includes(colorName)) {
      setTextileColors([...textileColors, colorName])
      setNewColorName('')
    }
  }

  function getImagesForColorAndType(color: string, type: 'front' | 'back' | 'side', isPrintFile: boolean) {
    return productImages.filter(
      img => img.textile_color_name === color &&
             img.image_type === type &&
             (isPrintFile ? !!img.print_file_url : !!img.image_url)
    )
  }

  function ImageUploadSection({
    label,
    type,
    textileColor,
    isPrintFile = false,
  }: {
    label: string
    type: 'front' | 'back' | 'side'
    textileColor: string
    isPrintFile?: boolean
  }) {
    const imageEntry = getImageForColorAndType(textileColor, type, isPrintFile)
    const imageUrl = imageEntry ? (isPrintFile ? imageEntry.print_file_url : imageEntry.image_url) : null
    const inputId = `file-input-${type}-${textileColor}-${isPrintFile ? 'print' : 'img'}`
    const uploadKey = `${type}_${textileColor}`
    const isUploading = uploading === uploadKey || uploading === `delete_${uploadKey}`

    return (
      <Grid item xs={12} sm={6} md={4}>
        <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {isPrintFile ? (
              <PrintIcon color="primary" />
            ) : (
              <ImageIcon color="primary" />
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
            <Chip label={textileColor} size="small" sx={{ ml: 'auto' }} />
          </Box>

          {imageUrl ? (
            <Box sx={{ position: 'relative', mb: 2 }}>
              <Box
                component={isPrintFile ? 'iframe' : 'img'}
                src={imageUrl}
                alt={`${label} - ${textileColor}`}
                sx={{
                  width: '100%',
                  height: 200,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: '#f8fafc',
                }}
              />
              <IconButton
                size="small"
                onClick={() => handleImageDelete(type, textileColor)}
                disabled={isUploading}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255, 255, 255, 0.9)',
                  '&:hover': { background: 'rgba(255, 255, 255, 1)' },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: 200,
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Kein Bild
              </Typography>
            </Box>
          )}

          <input
            accept={isPrintFile ? '.pdf,.ai,.eps,.psd' : 'image/*'}
            style={{ display: 'none' }}
            id={inputId}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleImageUpload(type, file, isPrintFile)
              }
            }}
            disabled={isUploading}
          />
          <label htmlFor={inputId}>
            <Button
              variant="outlined"
              component="span"
              fullWidth
              startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
              disabled={isUploading}
            >
              {isUploading ? 'Wird hochgeladen...' : imageUrl ? 'Ersetzen' : 'Hochladen'}
            </Button>
          </label>
        </Paper>
      </Grid>
    )
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!product) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error">Produkt nicht gefunden</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography 
          variant="h3" 
          component="h1"
          sx={{ 
            fontWeight: 700,
            mb: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Produkt bearbeiten
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Bearbeiten Sie die Produktdetails und laden Sie Bilder hoch
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Produktinformationen */}
            <Grid item xs={12}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Produktinformationen
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Produktname *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Beschreibung"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Grundpreis *"
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                      inputProps={{ step: '0.01', min: '0' }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Sortierindex"
                      value={formData.sort_index}
                      onChange={(e) =>
                        setFormData({ ...formData, sort_index: parseInt(e.target.value) || 0 })
                      }
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
              </Card>
            </Grid>

            {/* Bilder hochladen */}
            <Grid item xs={12}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Bilder und Druckdateien hochladen
                </Typography>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
                  <Tab label="Shopify Frontend Bilder" value="frontend" />
                  <Tab label="Druckdateien" value="print" />
                </Tabs>

                <Grid container spacing={2}>
                  {(['front', 'back', 'side'] as const).map((type) => {
                    const inputId = `upload-${type}-${activeTab}`
                    const isPrintFile = activeTab === 'print'
                    const uploadKey = `${type}_${isPrintFile ? 'print' : 'img'}`
                    const isUploading = uploading === uploadKey

                    return (
                      <Grid item xs={12} sm={6} md={4} key={type}>
                        <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            {isPrintFile ? (
                              <PrintIcon color="primary" />
                            ) : (
                              <ImageIcon color="primary" />
                            )}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {type === 'front' ? 'Vorne' : type === 'back' ? 'Hinten' : 'Seite'}
                            </Typography>
                          </Box>

                          <input
                            accept={isPrintFile ? '.pdf,.ai,.eps,.psd' : 'image/*'}
                            style={{ display: 'none' }}
                            id={inputId}
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleImageUpload(type, file, isPrintFile)
                              }
                            }}
                            disabled={isUploading}
                          />
                          <label htmlFor={inputId}>
                            <Button
                              variant="outlined"
                              component="span"
                              fullWidth
                              startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                              disabled={isUploading}
                            >
                              {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
                            </Button>
                          </label>
                        </Paper>
                      </Grid>
                    )
                  })}
                </Grid>
              </Card>
            </Grid>

            {/* Nicht zugeordnete Bilder */}
            {unassignedImages.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Bilder zu Textilfarben zuordnen ({unassignedImages.length} nicht zugeordnet)
                  </Typography>
                  <Grid container spacing={2}>
                    {unassignedImages.map((image) => {
                      const imageUrl = image.image_url || image.print_file_url
                      const isPrintFile = !!image.print_file_url
                      const typeLabel = image.image_type === 'front' ? 'Vorne' : image.image_type === 'back' ? 'Hinten' : 'Seite'

                      return (
                        <Grid item xs={12} sm={6} md={4} key={image.id}>
                          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ position: 'relative', mb: 2 }}>
                              <Box
                                component={isPrintFile ? 'iframe' : 'img'}
                                src={imageUrl || ''}
                                alt={typeLabel}
                                sx={{
                                  width: '100%',
                                  height: 150,
                                  objectFit: 'contain',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  background: '#f8fafc',
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleImageDelete(image.id)}
                                disabled={uploading === `delete_${image.id}`}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  background: 'rgba(255, 255, 255, 0.9)',
                                  '&:hover': { background: 'rgba(255, 255, 255, 1)' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                              {typeLabel} {isPrintFile ? '(Druckdatei)' : '(Bild)'}
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <InputLabel>Textilfarben zuordnen</InputLabel>
                              <Select
                                multiple
                                value={selectedColorsForAssign}
                                onChange={(e) => setSelectedColorsForAssign(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)
                                }
                                renderValue={(selected) => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as string[]).map((value) => (
                                      <Chip key={value} label={value} size="small" />
                                    ))}
                                  </Box>
                                )}
                                disabled={assigningImageId === image.id}
                              >
                                {textileColors.map((color) => (
                                  <MenuItem key={color} value={color}>
                                    <Checkbox checked={selectedColorsForAssign.indexOf(color) > -1} />
                                    <ListItemText primary={color} />
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                size="small"
                                placeholder="Neue Farbe"
                                value={newColorName}
                                onChange={(e) => setNewColorName(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addNewColor()
                                  }
                                }}
                                sx={{ flexGrow: 1 }}
                              />
                              <Button
                                size="small"
                                onClick={addNewColor}
                                disabled={!newColorName.trim()}
                              >
                                +
                              </Button>
                            </Box>
                            <Button
                              variant="contained"
                              fullWidth
                              sx={{ mt: 1 }}
                              onClick={() => handleAssignImages(image.id, selectedColorsForAssign)}
                              disabled={selectedColorsForAssign.length === 0 || assigningImageId === image.id}
                              startIcon={assigningImageId === image.id ? <CircularProgress size={16} /> : null}
                            >
                              {assigningImageId === image.id ? 'Wird zugeordnet...' : 'Zuordnen'}
                            </Button>
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </Card>
              </Grid>
            )}

            {/* Übersicht zugeordneter Bilder nach Textilfarbe */}
            {textileColors.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Übersicht nach Textilfarben
                  </Typography>
                  <Grid container spacing={2}>
                    {textileColors.map((color) => {
                      const imagesForColor = getImagesForColorAndType(color, 'front', false)
                      const backImages = getImagesForColorAndType(color, 'back', false)
                      const sideImages = getImagesForColorAndType(color, 'side', false)
                      const printFrontImages = getImagesForColorAndType(color, 'front', true)
                      const printBackImages = getImagesForColorAndType(color, 'back', true)
                      const printSideImages = getImagesForColorAndType(color, 'side', true)

                      return (
                        <Grid item xs={12} key={color}>
                          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                              {color}
                            </Typography>
                            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                              <Tab label="Frontend Bilder" value="frontend" />
                              <Tab label="Druckdateien" value="print" />
                            </Tabs>
                            {activeTab === 'frontend' && (
                              <Grid container spacing={2}>
                                {imagesForColor.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="img"
                                        src={img.image_url || ''}
                                        alt={`Vorne - ${color}`}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          objectFit: 'contain',
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Vorne
                                    </Typography>
                                  </Grid>
                                ))}
                                {backImages.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="img"
                                        src={img.image_url || ''}
                                        alt={`Hinten - ${color}`}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          objectFit: 'contain',
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Hinten
                                    </Typography>
                                  </Grid>
                                ))}
                                {sideImages.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="img"
                                        src={img.image_url || ''}
                                        alt={`Seite - ${color}`}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          objectFit: 'contain',
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Seite
                                    </Typography>
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                            {activeTab === 'print' && (
                              <Grid container spacing={2}>
                                {printFrontImages.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="iframe"
                                        src={img.print_file_url || ''}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Vorne (Druckdatei)
                                    </Typography>
                                  </Grid>
                                ))}
                                {printBackImages.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="iframe"
                                        src={img.print_file_url || ''}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Hinten (Druckdatei)
                                    </Typography>
                                  </Grid>
                                ))}
                                {printSideImages.map((img) => (
                                  <Grid item xs={4} key={img.id}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box
                                        component="iframe"
                                        src={img.print_file_url || ''}
                                        sx={{
                                          width: '100%',
                                          height: 150,
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleImageDelete(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 4,
                                          right: 4,
                                          background: 'rgba(255, 255, 255, 0.9)',
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                      Seite (Druckdatei)
                                    </Typography>
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </Card>
              </Grid>
            )}

            {/* Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !formData.name || !formData.base_price}
                  startIcon={saving ? <CircularProgress size={16} /> : null}
                >
                  {saving ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Container>
    </Box>
  )
}

