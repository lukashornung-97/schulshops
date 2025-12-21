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
  Autocomplete,
  List,
  ListItem,
  ListItemButton,
  ListItemText as MuiListItemText,
} from '@mui/material'
import { supabase } from '@/lib/supabase'

/**
 * Extrahiert Bucket-Namen und Dateipfad aus einer Supabase Storage URL
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url)
    
    // Suche nach dem Bucket-Namen im Pfad
    // Format: /storage/v1/object/public/[bucket]/[path]
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
    
    if (pathMatch) {
      const bucket = pathMatch[2]
      const path = pathMatch[3]
      return { bucket, path }
    }
    
    // Fallback: Suche nach Bucket-Namen direkt im Pfad
    const parts = urlObj.pathname.split('/')
    const bucketIndex = parts.findIndex(part => part === 'product-images' || part === 'print-files')
    if (bucketIndex >= 0 && bucketIndex < parts.length - 1) {
      const bucket = parts[bucketIndex]
      const path = parts.slice(bucketIndex + 1).join('/')
      return { bucket, path }
    }
    
    return null
  } catch (error) {
    console.error('Error parsing storage URL:', error, url)
    return null
  }
}

/**
 * Erstellt eine Proxy-URL für Storage-Dateien, damit sie korrekt angezeigt werden können
 */
function getProxyUrl(storageUrl: string | null): string | null {
  if (!storageUrl) return null
  return `/api/storage/proxy?url=${encodeURIComponent(storageUrl)}`
}

/**
 * Bestimmt den Component-Typ und die Anzeige-Eigenschaften basierend auf dem Dateityp
 */
function getFileDisplayProps(url: string | null): {
  component: 'img' | 'iframe' | 'object'
  src: string | null
  canDisplay: boolean
} {
  if (!url) {
    return { component: 'img', src: null, canDisplay: false }
  }

  const fileExtension = url.split('.').pop()?.toLowerCase()
  const proxyUrl = getProxyUrl(url)

  switch (fileExtension) {
    case 'pdf':
      return {
        component: 'iframe',
        src: proxyUrl,
        canDisplay: true,
      }
    case 'svg':
      return {
        component: 'img',
        src: proxyUrl,
        canDisplay: true,
      }
    case 'eps':
    case 'ai':
    case 'psd':
      // EPS, AI und PSD können nicht direkt im Browser angezeigt werden
      // Zeige einen Download-Link oder Platzhalter
      return {
        component: 'img',
        src: null,
        canDisplay: false,
      }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return {
        component: 'img',
        src: url, // Normale Bilder können direkt angezeigt werden
        canDisplay: true,
      }
    default:
      return {
        component: 'iframe',
        src: proxyUrl,
        canDisplay: true,
      }
  }
}
import { Database } from '@/types/database'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ImageIcon from '@mui/icons-material/Image'
import PrintIcon from '@mui/icons-material/Print'
import SearchIcon from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

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
  const [selectedColorsForAssign, setSelectedColorsForAssign] = useState<Map<string, string[]>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState<string>('')
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState<string>('')
  const [selectedImagesForBulkAssign, setSelectedImagesForBulkAssign] = useState<Set<string>>(new Set())
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false)
  const [bulkAssignColors, setBulkAssignColors] = useState<string[]>([])
  const [bulkAssignImageType, setBulkAssignImageType] = useState<'front' | 'back' | 'side' | null>(null)
  const [searchPrintFilesDialogOpen, setSearchPrintFilesDialogOpen] = useState(false)
  const [availablePrintFiles, setAvailablePrintFiles] = useState<Array<{ 
    name: string
    path: string
    url: string
    usedBy?: Array<{ productName: string; shopName: string; color: string; type: string }>
    usedCount?: number
  }>>([])
  const [searchPrintFileTerm, setSearchPrintFileTerm] = useState('')
  const [loadingPrintFiles, setLoadingPrintFiles] = useState(false)
  const [selectingPrintFileFor, setSelectingPrintFileFor] = useState<{ type: 'front' | 'back' | 'side'; color: string } | null>(null)

  useEffect(() => {
    if (params.productId) {
      loadProduct()
      loadVariants()
      loadProductImages()
    }
  }, [params.productId])

  useEffect(() => {
    if (searchPrintFilesDialogOpen && product) {
      // Lade Druckdateien für den aktuellen Shop
      loadAvailablePrintFiles(searchPrintFileTerm, product.shop_id)
    }
  }, [searchPrintFilesDialogOpen, product])

  useEffect(() => {
    if (searchPrintFilesDialogOpen) {
      loadAvailablePrintFiles(searchPrintFileTerm)
    }
  }, [searchPrintFilesDialogOpen])

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

  async function handleImageUpload(type: 'front' | 'back' | 'side', files: File | File[], isPrintFile: boolean) {
    const fileArray = Array.isArray(files) ? files : [files]
    
    if (fileArray.length === 0) {
      return
    }

    if (isPrintFile && !customFileName.trim()) {
      setError('Bitte geben Sie vor dem Hochladen einer Druckdatei einen Dateinamen ein.')
      return
    }

    setUploading(`${type}_${isPrintFile ? 'print' : 'img'}`)
    setError(null)

    try {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Lade alle Dateien nacheinander hoch
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'edit/page.tsx:355',message:'Before file upload loop iteration',data:{fileIndex:i,totalFiles:fileArray.length,fileName:file.name,fileSize:file.size,fileType:file.type,productId:params.productId,type,isPrintFile},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          const formData = new FormData()
          formData.append('file', file)
          formData.append('type', type)
          formData.append('is_print_file', isPrintFile.toString())
          if (isPrintFile) {
            // Für Druckdateien: Verwende den Dateinamen mit Index falls mehrere Dateien
            const fileName = fileArray.length > 1 
              ? `${customFileName.trim()}_${i + 1}` 
              : customFileName.trim()
            formData.append('custom_file_name', fileName)
          }
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'edit/page.tsx:370',message:'Before fetch request',data:{url:`/api/products/${params.productId}/upload-image`,productId:params.productId,hasFormData:!!formData,formDataKeys:Array.from(formData.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          const response = await fetch(`/api/products/${params.productId}/upload-image`, {
            method: 'POST',
            body: formData,
          })
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'edit/page.tsx:375',message:'After fetch request',data:{status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          const data = await response.json()
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'edit/page.tsx:377',message:'Response data parsed',data:{hasError:!!data.error,error:data.error,hasSuccess:!!data.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          if (!response.ok) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'edit/page.tsx:379',message:'Response not OK - throwing error',data:{status:response.status,error:data.error,fileName:file.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            throw new Error(data.error || 'Fehler beim Hochladen')
          }

          successCount++
        } catch (error: any) {
          console.error(`Error uploading file ${file.name}:`, error)
          errorCount++
          errors.push(`${file.name}: ${error.message || 'Fehler beim Hochladen'}`)
        }
      }

      if (successCount > 0) {
        setSuccess(`${successCount} Datei(en) erfolgreich hochgeladen.${errorCount > 0 ? ` ${errorCount} Fehler.` : ''} Bitte ordnen Sie sie jetzt Textilfarben zu.`)
      } else {
        setError(`Fehler beim Hochladen: ${errors.join(', ')}`)
      }

      if (errorCount > 0 && errors.length > 0) {
        console.error('Upload errors:', errors)
      }

      setCustomFileName('')
      await loadProductImages() // Reload images
    } catch (error: any) {
      console.error('Error uploading images:', error)
      setError(error.message || 'Fehler beim Hochladen der Bilder')
    } finally {
      setUploading(null)
    }
  }

  async function handleAssignImages(imageId: string, colors: string[]) {
    if (colors.length === 0) {
      setError('Bitte wählen Sie mindestens eine Textilfarbe aus')
      return
    }

    setAssigningImageId(imageId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/products/${params.productId}/assign-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_id: imageId,
          textile_colors: colors,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Zuordnen der Bilder')
      }

      setSuccess(`Bild erfolgreich zu ${colors.length} Textilfarbe(n) zugeordnet`)
      // Lösche nur die Farbauswahl für dieses spezifische Bild
      const newMap = new Map(selectedColorsForAssign)
      newMap.delete(imageId)
      setSelectedColorsForAssign(newMap)
      setAssigningImageId(null)
      
      // Lade Bilder neu
      await loadProductImages()
    } catch (error: any) {
      console.error('Error assigning images:', error)
      setError(error.message || 'Fehler beim Zuordnen der Bilder')
      setAssigningImageId(null)
    }
  }

  function handleToggleImageSelection(imageId: string) {
    const newSelection = new Set(selectedImagesForBulkAssign)
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId)
    } else {
      newSelection.add(imageId)
    }
    setSelectedImagesForBulkAssign(newSelection)
  }

  function handleSelectAllImages() {
    const allIds = new Set(unassignedImages.map(img => img.id))
    setSelectedImagesForBulkAssign(allIds)
  }

  function handleDeselectAllImages() {
    setSelectedImagesForBulkAssign(new Set())
  }

  function handleOpenBulkAssignDialog() {
    if (selectedImagesForBulkAssign.size === 0) {
      setError('Bitte wählen Sie mindestens ein Bild aus')
      return
    }
    
    // Prüfe ob alle ausgewählten Bilder denselben Typ haben
    const selectedImageTypes = Array.from(selectedImagesForBulkAssign)
      .map(id => unassignedImages.find(img => img.id === id)?.image_type)
      .filter((type): type is 'front' | 'back' | 'side' => type !== undefined)
    
    const uniqueTypes = Array.from(new Set(selectedImageTypes))
    if (uniqueTypes.length === 1) {
      setBulkAssignImageType(uniqueTypes[0])
    } else {
      setBulkAssignImageType(null)
    }
    
    setBulkAssignColors([])
    setBulkAssignDialogOpen(true)
  }

  async function handleBulkAssignImages() {
    if (bulkAssignColors.length === 0) {
      setError('Bitte wählen Sie mindestens eine Textilfarbe aus')
      return
    }

    if (!bulkAssignImageType) {
      setError('Bitte wählen Sie einen Bildtyp aus')
      return
    }

    setUploading('bulk_assign')
    setError(null)
    setSuccess(null)

    try {
      const imageIds = Array.from(selectedImagesForBulkAssign)
      
      // Verarbeite alle Bilder nacheinander
      const results = []
      for (const imageId of imageIds) {
        try {
          const response = await fetch(`/api/products/${params.productId}/assign-images`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_id: imageId,
              textile_colors: bulkAssignColors,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            results.push({ imageId, success: false, error: data.error })
          } else {
            results.push({ imageId, success: true })
          }
        } catch (error: any) {
          results.push({ imageId, success: false, error: error.message })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        setSuccess(`${successCount} Bild(er) erfolgreich zugeordnet${failCount > 0 ? `, ${failCount} Fehler` : ''}`)
      } else {
        setError('Fehler beim Zuordnen der Bilder')
      }

      setSelectedImagesForBulkAssign(new Set())
      setBulkAssignDialogOpen(false)
      setBulkAssignColors([])
      setBulkAssignImageType(null)
      
      // Lade Bilder neu
      await loadProductImages()
    } catch (error: any) {
      console.error('Error bulk assigning images:', error)
      setError(error.message || 'Fehler beim Zuordnen der Bilder')
    } finally {
      setUploading(null)
    }
  }

  async function loadAvailablePrintFiles(searchTerm: string = '', shopId?: string | null) {
    setLoadingPrintFiles(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      if (shopId) {
        params.append('shop_id', shopId)
      }
      
      const response = await fetch(`/api/storage/list-print-files?${params.toString()}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden der Druckdateien')
      }
      
      setAvailablePrintFiles(data.files || [])
    } catch (error: any) {
      console.error('Error loading print files:', error)
      setError(error.message || 'Fehler beim Laden der Druckdateien')
    } finally {
      setLoadingPrintFiles(false)
    }
  }

  function handleOpenSearchPrintFiles(type: 'front' | 'back' | 'side', color: string) {
    setSelectingPrintFileFor({ type, color })
    setSearchPrintFilesDialogOpen(true)
    setSearchPrintFileTerm('')
    if (product) {
      loadAvailablePrintFiles('', product.shop_id)
    }
  }

  function handleCloseSearchPrintFilesDialog() {
    setSearchPrintFilesDialogOpen(false)
    setSelectingPrintFileFor(null)
    setSearchPrintFileTerm('')
  }

  async function handleSelectPrintFile(fileName: string, fileUrl: string) {
    if (!selectingPrintFileFor) return

    const { type, color } = selectingPrintFileFor
    setUploading(`select_print_${type}`)
    setError(null)
    setSuccess(null)

    try {
      // Prüfe ob bereits ein Eintrag existiert
      const { data: existing } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', params.productId)
        .eq('textile_color_name', color)
        .eq('image_type', type)
        .single()

      if (existing) {
        // Aktualisiere bestehenden Eintrag
        const { error: updateError } = await supabase
          .from('product_images')
          .update({ print_file_url: fileUrl })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        // Erstelle neuen Eintrag
        const { error: insertError } = await supabase
          .from('product_images')
          .insert({
            product_id: params.productId,
            textile_color_name: color,
            image_type: type,
            print_file_url: fileUrl,
          })

        if (insertError) throw insertError
      }

      setSuccess(`Druckdatei "${fileName}" erfolgreich zugeordnet`)
      handleCloseSearchPrintFilesDialog()
      await loadProductImages()
    } catch (error: any) {
      console.error('Error selecting print file:', error)
      setError(error.message || 'Fehler beim Zuordnen der Druckdatei')
    } finally {
      setUploading(null)
    }
  }

  async function handleRenamePrintFile(imageId: string, currentFileName: string) {
    setRenamingImageId(imageId)
    // Extrahiere Dateiname ohne Extension
    const nameWithoutExt = currentFileName.split('.').slice(0, -1).join('.')
    setNewFileName(nameWithoutExt)
  }

  async function handleConfirmRename() {
    if (!renamingImageId || !newFileName.trim()) {
      setError('Bitte geben Sie einen neuen Dateinamen ein')
      return
    }

    setUploading(`rename_${renamingImageId}`)
    setError(null)

    try {
      const response = await fetch(`/api/products/${params.productId}/rename-print-file`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId: renamingImageId,
          newFileName: newFileName.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Umbenennen')
      }

      setSuccess('Druckdatei erfolgreich umbenannt')
      setRenamingImageId(null)
      setNewFileName('')
      await loadProductImages()
    } catch (error: any) {
      console.error('Error renaming print file:', error)
      setError(error.message || 'Fehler beim Umbenennen der Druckdatei')
    } finally {
      setUploading(null)
    }
  }

  function handleCancelRename() {
    setRenamingImageId(null)
    setNewFileName('')
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
        const parsed = parseStorageUrl(url)
        if (parsed) {
          try {
            await supabase.storage.from(parsed.bucket).remove([parsed.path])
          } catch (error) {
            console.error(`Error deleting file from ${parsed.bucket}/${parsed.path}:`, error)
          }
        } else {
          console.warn('Could not parse storage URL:', url)
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
              {(() => {
                const displayProps = isPrintFile ? getFileDisplayProps(imageUrl) : { component: 'img' as const, src: imageUrl, canDisplay: true }
                
                if (!displayProps.canDisplay) {
                  // Dateityp kann nicht angezeigt werden (z.B. EPS, AI, PSD)
                  const fileExtension = imageUrl.split('.').pop()?.toUpperCase() || 'DATEI'
                  return (
                    <Box
                      sx={{
                        width: '100%',
                        height: 200,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}
                    >
                      <Typography variant="h6" color="text.secondary">
                        .{fileExtension}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        component="a"
                        href={imageUrl}
                        target="_blank"
                        download
                      >
                        Datei öffnen
                      </Button>
                    </Box>
                  )
                }
                
                return (
                  <Box
                    component={displayProps.component}
                    src={displayProps.src || undefined}
                    alt={`${label} - ${textileColor}`}
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: '#f8fafc',
                      ...(displayProps.component === 'iframe' && {
                        border: 'none',
                      }),
                    }}
                  />
                )
              })()}
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
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                handleImageUpload(type, files, isPrintFile)
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

        <Box sx={{ mb: 3 }}>
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
        </Box>

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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Bilder und Druckdateien hochladen
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      if (!confirm('Möchten Sie alle bestehenden Frontend-Bilder umbenennen? Dies kann einige Zeit dauern.')) {
                        return
                      }
                      
                      setUploading('rename_all')
                      setError(null)
                      setSuccess(null)
                      
                      try {
                        const response = await fetch('/api/products/rename-all-images', {
                          method: 'POST',
                        })
                        
                        const data = await response.json()
                        
                        if (!response.ok) {
                          throw new Error(data.error || 'Fehler beim Umbenennen')
                        }
                        
                        setSuccess(`${data.renamed} Bild(er) erfolgreich umbenannt${data.errors?.length > 0 ? `. ${data.errors.length} Fehler.` : ''}`)
                        await loadProductImages()
                      } catch (error: any) {
                        console.error('Error renaming all images:', error)
                        setError(error.message || 'Fehler beim Umbenennen der Bilder')
                      } finally {
                        setUploading(null)
                      }
                    }}
                    disabled={uploading === 'rename_all'}
                    startIcon={uploading === 'rename_all' ? <CircularProgress size={16} /> : null}
                  >
                    {uploading === 'rename_all' ? 'Wird umbenannt...' : 'Alle Bilder umbenennen'}
                  </Button>
                </Box>
                {activeTab === 'print' && (
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        required
                        label="Dateiname"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        placeholder="z. B. mein_druckdatei_name"
                        helperText="Wird für die PDF verwendet (ohne Endung, Pflichtfeld)"
                      />
                    </Grid>
                  </Grid>
                )}
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
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || [])
                              if (files.length > 0) {
                                handleImageUpload(type, files, isPrintFile)
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
                              {isUploading ? 'Wird hochgeladen...' : 'Dateien hochladen'}
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Bilder zu Textilfarben zuordnen ({unassignedImages.length} nicht zugeordnet)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {selectedImagesForBulkAssign.size > 0 && (
                        <>
                          <Button
                            size="small"
                            onClick={handleDeselectAllImages}
                            variant="outlined"
                          >
                            Alle abwählen
                          </Button>
                          <Button
                            size="small"
                            onClick={handleOpenBulkAssignDialog}
                            variant="contained"
                            disabled={selectedImagesForBulkAssign.size === 0}
                          >
                            Massenzuordnung ({selectedImagesForBulkAssign.size})
                          </Button>
                        </>
                      )}
                      {selectedImagesForBulkAssign.size === 0 && (
                        <Button
                          size="small"
                          onClick={handleSelectAllImages}
                          variant="outlined"
                        >
                          Alle auswählen
                        </Button>
                      )}
                    </Box>
                  </Box>
                  <Grid container spacing={2}>
                    {unassignedImages.map((image) => {
                      const imageUrl = image.image_url || image.print_file_url
                      const isPrintFile = !!image.print_file_url
                      const typeLabel = image.image_type === 'front' ? 'Vorne' : image.image_type === 'back' ? 'Hinten' : 'Seite'
                      const displayProps = isPrintFile ? getFileDisplayProps(image.print_file_url) : { component: 'img' as const, src: imageUrl, canDisplay: true }

                      return (
                        <Grid item xs={12} sm={6} md={4} key={image.id}>
                          <Paper 
                            sx={{ 
                              p: 2, 
                              border: '2px solid', 
                              borderColor: selectedImagesForBulkAssign.has(image.id) ? 'primary.main' : 'divider',
                              bgcolor: selectedImagesForBulkAssign.has(image.id) ? 'action.selected' : 'background.paper',
                            }}
                          >
                            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                              <Checkbox
                                checked={selectedImagesForBulkAssign.has(image.id)}
                                onChange={() => handleToggleImageSelection(image.id)}
                                sx={{
                                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 1)' },
                                }}
                              />
                            </Box>
                            <Box sx={{ position: 'relative', mb: 2 }}>
                              {displayProps.canDisplay ? (
                                <Box
                                  component={displayProps.component}
                                  src={displayProps.src || undefined}
                                  alt={typeLabel}
                                  sx={{
                                    width: '100%',
                                    height: 150,
                                    objectFit: 'contain',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    background: '#f8fafc',
                                    ...(displayProps.component === 'iframe' && {
                                      border: 'none',
                                    }),
                                  }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: 150,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    background: '#f8fafc',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <Typography variant="body2" color="text.secondary">
                                    {image.print_file_url?.split('.').pop()?.toUpperCase() || 'DATEI'}
                                  </Typography>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    component="a"
                                    href={image.print_file_url || ''}
                                    target="_blank"
                                    download
                                  >
                                    Datei öffnen
                                  </Button>
                                </Box>
                              )}
                              <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                                {isPrintFile && (
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const fileName = image.print_file_url?.split('/').pop() || 'datei'
                                      handleRenamePrintFile(image.id, fileName)
                                    }}
                                    disabled={uploading?.startsWith('rename_') || uploading === `delete_${image.id}`}
                                    sx={{
                                      background: 'rgba(255, 255, 255, 0.9)',
                                      '&:hover': { background: 'rgba(255, 255, 255, 1)' },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={() => handleImageDelete(image.id)}
                                  disabled={uploading === `delete_${image.id}`}
                                  sx={{
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    '&:hover': { background: 'rgba(255, 255, 255, 1)' },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                              {typeLabel} {isPrintFile ? '(Druckdatei)' : '(Bild)'}
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <InputLabel>Textilfarben zuordnen</InputLabel>
                              <Select
                                multiple
                                value={selectedColorsForAssign.get(image.id) || []}
                                onChange={(e) => {
                                  const newMap = new Map(selectedColorsForAssign)
                                  newMap.set(image.id, typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)
                                  setSelectedColorsForAssign(newMap)
                                }}
                                renderValue={(selected) => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as string[]).map((value) => (
                                      <Chip key={value} label={value} size="small" />
                                    ))}
                                  </Box>
                                )}
                                disabled={assigningImageId === image.id}
                              >
                                {textileColors.map((color) => {
                                  const imageColors = selectedColorsForAssign.get(image.id) || []
                                  return (
                                    <MenuItem key={color} value={color}>
                                      <Checkbox checked={imageColors.indexOf(color) > -1} />
                                      <ListItemText primary={color} />
                                    </MenuItem>
                                  )
                                })}
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
                              onClick={() => {
                                const colors = selectedColorsForAssign.get(image.id) || []
                                handleAssignImages(image.id, colors)
                              }}
                              disabled={(selectedColorsForAssign.get(image.id) || []).length === 0 || assigningImageId === image.id}
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
                                {/* Vorne Druckdatei */}
                                {printFrontImages.length === 0 && (
                                  <Grid item xs={4}>
                                    <Paper
                                      sx={{
                                        p: 2,
                                        border: '2px dashed',
                                        borderColor: 'divider',
                                        textAlign: 'center',
                                        height: 150,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Typography variant="caption" color="text.secondary">
                                        Vorne (Druckdatei)
                                      </Typography>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<SearchIcon />}
                                        onClick={() => handleOpenSearchPrintFiles('front', color)}
                                      >
                                        Bestehende suchen
                                      </Button>
                                    </Paper>
                                  </Grid>
                                )}
                                {printFrontImages.map((img) => {
                                  const displayProps = getFileDisplayProps(img.print_file_url)
                                  return (
                                    <Grid item xs={4} key={img.id}>
                                      <Box sx={{ position: 'relative' }}>
                                        {displayProps.canDisplay ? (
                                          <Box
                                            component={displayProps.component}
                                            src={displayProps.src || undefined}
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              objectFit: 'contain',
                                              background: '#f8fafc',
                                              ...(displayProps.component === 'iframe' && {
                                                border: 'none',
                                              }),
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              background: '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: 1,
                                            }}
                                          >
                                            <Typography variant="body2" color="text.secondary">
                                              {img.print_file_url?.split('.').pop()?.toUpperCase() || 'DATEI'}
                                            </Typography>
                                            <Button
                                              variant="outlined"
                                              size="small"
                                              component="a"
                                              href={img.print_file_url || ''}
                                              target="_blank"
                                              download
                                            >
                                              Öffnen
                                            </Button>
                                          </Box>
                                        )}
                                        <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              const fileName = img.print_file_url?.split('/').pop() || 'datei'
                                              handleRenamePrintFile(img.id, fileName)
                                            }}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleImageDelete(img.id)}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Box>
                                      <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                        Vorne (Druckdatei)
                                      </Typography>
                                    </Grid>
                                  )
                                })}
                                {/* Hinten Druckdatei */}
                                {printBackImages.length === 0 && (
                                  <Grid item xs={4}>
                                    <Paper
                                      sx={{
                                        p: 2,
                                        border: '2px dashed',
                                        borderColor: 'divider',
                                        textAlign: 'center',
                                        height: 150,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Typography variant="caption" color="text.secondary">
                                        Hinten (Druckdatei)
                                      </Typography>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<SearchIcon />}
                                        onClick={() => handleOpenSearchPrintFiles('back', color)}
                                      >
                                        Bestehende suchen
                                      </Button>
                                    </Paper>
                                  </Grid>
                                )}
                                {printBackImages.map((img) => {
                                  const displayProps = getFileDisplayProps(img.print_file_url)
                                  return (
                                    <Grid item xs={4} key={img.id}>
                                      <Box sx={{ position: 'relative' }}>
                                        {displayProps.canDisplay ? (
                                          <Box
                                            component={displayProps.component}
                                            src={displayProps.src || undefined}
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              objectFit: 'contain',
                                              background: '#f8fafc',
                                              ...(displayProps.component === 'iframe' && {
                                                border: 'none',
                                              }),
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              background: '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: 1,
                                            }}
                                          >
                                            <Typography variant="body2" color="text.secondary">
                                              {img.print_file_url?.split('.').pop()?.toUpperCase() || 'DATEI'}
                                            </Typography>
                                            <Button
                                              variant="outlined"
                                              size="small"
                                              component="a"
                                              href={img.print_file_url || ''}
                                              target="_blank"
                                              download
                                            >
                                              Öffnen
                                            </Button>
                                          </Box>
                                        )}
                                        <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              const fileName = img.print_file_url?.split('/').pop() || 'datei'
                                              handleRenamePrintFile(img.id, fileName)
                                            }}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleImageDelete(img.id)}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Box>
                                      <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                        Hinten (Druckdatei)
                                      </Typography>
                                    </Grid>
                                  )
                                })}
                                {/* Seite Druckdatei */}
                                {printSideImages.length === 0 && (
                                  <Grid item xs={4}>
                                    <Paper
                                      sx={{
                                        p: 2,
                                        border: '2px dashed',
                                        borderColor: 'divider',
                                        textAlign: 'center',
                                        height: 150,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Typography variant="caption" color="text.secondary">
                                        Seite (Druckdatei)
                                      </Typography>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<SearchIcon />}
                                        onClick={() => handleOpenSearchPrintFiles('side', color)}
                                      >
                                        Bestehende suchen
                                      </Button>
                                    </Paper>
                                  </Grid>
                                )}
                                {printSideImages.map((img) => {
                                  const displayProps = getFileDisplayProps(img.print_file_url)
                                  return (
                                    <Grid item xs={4} key={img.id}>
                                      <Box sx={{ position: 'relative' }}>
                                        {displayProps.canDisplay ? (
                                          <Box
                                            component={displayProps.component}
                                            src={displayProps.src || undefined}
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              objectFit: 'contain',
                                              background: '#f8fafc',
                                              ...(displayProps.component === 'iframe' && {
                                                border: 'none',
                                              }),
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: '100%',
                                              height: 150,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider',
                                              background: '#f8fafc',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: 1,
                                            }}
                                          >
                                            <Typography variant="body2" color="text.secondary">
                                              {img.print_file_url?.split('.').pop()?.toUpperCase() || 'DATEI'}
                                            </Typography>
                                            <Button
                                              variant="outlined"
                                              size="small"
                                              component="a"
                                              href={img.print_file_url || ''}
                                              target="_blank"
                                              download
                                            >
                                              Öffnen
                                            </Button>
                                          </Box>
                                        )}
                                        <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              const fileName = img.print_file_url?.split('/').pop() || 'datei'
                                              handleRenamePrintFile(img.id, fileName)
                                            }}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleImageDelete(img.id)}
                                            sx={{
                                              background: 'rgba(255, 255, 255, 0.9)',
                                            }}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Box>
                                      <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 0.5 }}>
                                        Seite (Druckdatei)
                                      </Typography>
                                    </Grid>
                                  )
                                })}
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

      {/* Dialog für Massenzuordnung */}
      <Dialog open={bulkAssignDialogOpen} onClose={() => setBulkAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Massenzuordnung von Bildern</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedImagesForBulkAssign.size} Bild(er) ausgewählt
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2, mt: 2 }}>
            <InputLabel>Bildtyp</InputLabel>
            <Select
              value={bulkAssignImageType || ''}
              onChange={(e) => setBulkAssignImageType(e.target.value as 'front' | 'back' | 'side')}
              label="Bildtyp"
            >
              <MenuItem value="front">Vorne</MenuItem>
              <MenuItem value="back">Hinten</MenuItem>
              <MenuItem value="side">Seite</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Textilfarben zuordnen</InputLabel>
            <Select
              multiple
              value={bulkAssignColors}
              onChange={(e) => setBulkAssignColors(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {textileColors.map((color) => (
                <MenuItem key={color} value={color}>
                  <Checkbox checked={bulkAssignColors.indexOf(color) > -1} />
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAssignDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={handleBulkAssignImages}
            variant="contained"
            disabled={bulkAssignColors.length === 0 || !bulkAssignImageType || uploading === 'bulk_assign'}
          >
            {uploading === 'bulk_assign' ? 'Wird zugeordnet...' : 'Zuordnen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog zum Suchen nach bestehenden Druckdateien */}
      <Dialog open={searchPrintFilesDialogOpen} onClose={handleCloseSearchPrintFilesDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Bestehende Druckdatei suchen
          {selectingPrintFileFor && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Für: {selectingPrintFileFor.type === 'front' ? 'Vorne' : selectingPrintFileFor.type === 'back' ? 'Hinten' : 'Seite'} - {selectingPrintFileFor.color}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Suche nach Druckdatei"
            value={searchPrintFileTerm}
            onChange={(e) => {
              const term = e.target.value
              setSearchPrintFileTerm(term)
              if (product) {
                loadAvailablePrintFiles(term, product.shop_id)
              }
            }}
            placeholder="z. B. logo, design, muster..."
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          
          {loadingPrintFiles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : availablePrintFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              {searchPrintFileTerm ? 'Keine Druckdateien gefunden' : 'Geben Sie einen Suchbegriff ein'}
            </Typography>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {availablePrintFiles.map((file) => (
                <ListItem key={file.name} disablePadding>
                  <ListItemButton onClick={() => handleSelectPrintFile(file.name, file.url)}>
                    <MuiListItemText
                      primary={file.name}
                      secondary={
                        file.usedCount && file.usedCount > 0
                          ? `Verwendet in ${file.usedCount} Produkt(en)`
                          : 'Neue Datei'
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSearchPrintFilesDialog}>Abbrechen</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog zum Umbenennen von Druckdateien */}
      <Dialog open={renamingImageId !== null} onClose={handleCancelRename} maxWidth="sm" fullWidth>
        <DialogTitle>Druckdatei umbenennen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Neuer Dateiname"
            fullWidth
            variant="outlined"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            helperText="Der Dateiname wird automatisch normalisiert (nur Kleinbuchstaben, Zahlen und Unterstriche)"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRename}>Abbrechen</Button>
          <Button
            onClick={handleConfirmRename}
            variant="contained"
            disabled={!newFileName.trim() || uploading !== null}
          >
            {uploading ? 'Wird umbenannt...' : 'Umbenennen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

