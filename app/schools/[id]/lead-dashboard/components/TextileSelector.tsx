'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  TextField,
  Chip,
  Autocomplete,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
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
  Grid,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PrintIcon from '@mui/icons-material/Print'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { Database } from '@/types/database'

type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']
type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

interface PrintFile {
  id: string
  url: string
  fileName: string
}

interface PreviewImage {
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
  preview_images?: {
    [color: string]: PreviewImage[]
  }
}

// Druckarten werden aus der Datenbank geladen

interface TextileSelectorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
}

export default function TextileSelector({ schoolId, config, onSave, onNext }: TextileSelectorProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TextileSelector.tsx:90',message:'TextileSelector component render START',data:{hasSchoolId:!!schoolId,hasConfig:!!config},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const [textiles, setTextiles] = useState<TextileCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTextiles, setSelectedTextiles] = useState<Map<string, SelectedTextile>>(new Map())
  const [saving, setSaving] = useState(false)
  const [searchValue, setSearchValue] = useState<TextileCatalog | null>(null)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [currentTextileId, setCurrentTextileId] = useState<string | null>(null)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [printPositions, setPrintPositions] = useState<{ front: boolean; back: boolean; side: boolean }>({
    front: false,
    back: false,
    side: false,
  })
  const [printFiles, setPrintFiles] = useState<{ front?: { [color: string]: PrintFile[] }; back?: { [color: string]: PrintFile[] }; side?: { [color: string]: PrintFile[] } }>({})
  const [printMethods, setPrintMethods] = useState<{ front?: { [color: string]: string }; back?: { [color: string]: string }; side?: { [color: string]: string } }>({})
  const [printMethodsList, setPrintMethodsList] = useState<string[]>([])
  const [previewImages, setPreviewImages] = useState<{ [color: string]: PreviewImage[] }>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false)
  const [fileBrowserPosition, setFileBrowserPosition] = useState<'front' | 'back' | 'side'>('front')
  const [fileBrowserColor, setFileBrowserColor] = useState<string>('')
  const [availableFiles, setAvailableFiles] = useState<PrintFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  useEffect(() => {
    loadTextiles()
  }, [])

  useEffect(() => {
    if (config) {
      loadConfig()
    }
  }, [config])

  async function loadTextiles() {
    try {
      const [textilesResponse, printMethodsResponse] = await Promise.all([
        fetch('/api/textile-catalog'),
        fetch('/api/print-methods'),
      ])

      const textilesData = await textilesResponse.json()
      if (textilesResponse.ok) {
        setTextiles(textilesData.textiles || [])
      }

      const printMethodsData = await printMethodsResponse.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TextileSelector.tsx:133',message:'loadTextiles printMethodsData received',data:{ok:printMethodsResponse.ok,hasData:!!printMethodsData,methodsCount:printMethodsData?.printMethods?.length||0,hasSetPrintMethodsList:typeof setPrintMethodsList!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (printMethodsResponse.ok) {
        const methods = (printMethodsData.printMethods || []).map((m: { name: string }) => m.name)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TextileSelector.tsx:135',message:'About to call setPrintMethodsList',data:{methodsLength:methods.length,methodsSample:methods.slice(0,3),setPrintMethodsListExists:typeof setPrintMethodsList!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setPrintMethodsList(methods)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TextileSelector.tsx:137',message:'setPrintMethodsList called',data:{methodsLength:methods.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function loadConfig() {
    if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
      const selected = config.selected_textiles as any
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TextileSelector.tsx:117',
          message: 'loadConfig START',
          data: {
            selectedTextilesRaw: JSON.stringify(selected).substring(0, 500),
            isArray: Array.isArray(selected),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
      
      if (Array.isArray(selected)) {
        const map = new Map<string, SelectedTextile>()
        selected.forEach((item: SelectedTextile) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'TextileSelector.tsx:135',
              message: 'loadConfig loading textile',
              data: {
                textileId: item.textile_id,
                colors: item.colors,
                colorsLength: item.colors?.length || 0,
                printFiles: JSON.stringify(item.print_files || {}).substring(0, 300),
                printFilesKeys: Object.keys(item.print_files || {}),
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'C',
            }),
          }).catch(() => {});
          // #endregion
          
          map.set(item.textile_id, {
            ...item,
            colors: item.colors || [],
            sizes: item.sizes || [],
            print_positions: item.print_positions || {
              front: false,
              back: false,
              side: false,
            },
            print_files: item.print_files || {},
            print_methods: item.print_methods || {},
            preview_images: item.preview_images || {},
          })
        })
        setSelectedTextiles(map)
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'TextileSelector.tsx:155',
            message: 'loadConfig COMPLETE',
            data: {
              mapSize: map.size,
              firstTextilePrintFiles: map.size > 0 
                ? JSON.stringify(Array.from(map.values())[0].print_files || {}).substring(0, 300)
                : 'no textiles',
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TextileSelector.tsx:167',
          message: 'loadConfig NO DATA',
          data: { configExists: !!config, selectedTextilesExists: !!config?.selected_textiles },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  function handleOpenPrintDialog(textileId: string, preSelectedColors?: string[]) {
    const textile = selectedTextiles.get(textileId)
    if (textile) {
      setCurrentTextileId(textileId)
      setSelectedColors(preSelectedColors || [])
      
      // Wenn eine Farbe vorgewählt ist, lade die Druckpositionen basierend auf vorhandenen Dateien
      if (preSelectedColors && preSelectedColors.length > 0) {
        const printFiles = textile.print_files || {}
        const color = preSelectedColors[0]
        
        // Prüfe welche Positionen für diese Farbe bereits Dateien haben
        const hasFront = printFiles.front?.[color] && printFiles.front[color].length > 0
        const hasBack = printFiles.back?.[color] && printFiles.back[color].length > 0
        const hasSide = printFiles.side?.[color] && printFiles.side[color].length > 0
        
        setPrintPositions({
          front: hasFront || textile.print_positions?.front || false,
          back: hasBack || textile.print_positions?.back || false,
          side: hasSide || textile.print_positions?.side || false,
        })
        
        // Lade nur die Dateien für diese Farbe
        const colorFiles: typeof printFiles = {}
        if (printFiles.front?.[color]) colorFiles.front = { [color]: printFiles.front[color] }
        if (printFiles.back?.[color]) colorFiles.back = { [color]: printFiles.back[color] }
        if (printFiles.side?.[color]) colorFiles.side = { [color]: printFiles.side[color] }
        setPrintFiles(colorFiles)
        
        // Lade Druckarten für diese Farbe
        const printMethods = textile.print_methods || {}
        const colorMethods: typeof printMethods = {}
        if (printMethods.front?.[color]) colorMethods.front = { [color]: printMethods.front[color] }
        if (printMethods.back?.[color]) colorMethods.back = { [color]: printMethods.back[color] }
        if (printMethods.side?.[color]) colorMethods.side = { [color]: printMethods.side[color] }
        setPrintMethods(colorMethods)
        
        // Lade Vorschau-Bilder für diese Farbe
        const previewImages = textile.preview_images || {}
        const colorPreviews: typeof previewImages = {}
        if (previewImages[color]) {
          colorPreviews[color] = previewImages[color]
        }
        setPreviewImages(colorPreviews)
      } else {
        setPrintPositions(textile.print_positions || {
          front: false,
          back: false,
          side: false,
        })
        setPrintFiles(textile.print_files || {})
        setPrintMethods(textile.print_methods || {})
        setPreviewImages(textile.preview_images || {})
      }
      
      setPrintDialogOpen(true)
    }
  }

  function handleClosePrintDialog() {
    setPrintDialogOpen(false)
    setCurrentTextileId(null)
    setSelectedColors([])
    setPrintFiles({})
    setPrintMethods({})
    setPreviewImages({})
  }

  async function handleSavePrintPositions() {
    if (!currentTextileId) return

    const textile = selectedTextiles.get(currentTextileId)
    if (!textile) return

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'TextileSelector.tsx:193',
        message: 'handleSavePrintPositions START',
        data: {
          currentTextileId,
          selectedColors,
          printFilesKeys: Object.keys(printFiles),
          existingPrintFiles: JSON.stringify(textile.print_files || {}).substring(0, 200),
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion

    // Merge die neuen Dateien mit den bestehenden (für andere Farben)
    const existingFiles = textile.print_files || {}
    const mergedFiles = { ...existingFiles }

    // Merge die neuen Druckarten mit den bestehenden (für andere Farben)
    const existingMethods = textile.print_methods || {}
    const mergedMethods = { ...existingMethods }

    // Merge die neuen Vorschau-Bilder mit den bestehenden (für andere Farben)
    const existingPreviews = textile.preview_images || {}
    const mergedPreviews = { ...existingPreviews }

    // Aktualisiere nur die Dateien und Druckarten für die ausgewählten Farben
    selectedColors.forEach(color => {
      if (printFiles.front) {
        if (!mergedFiles.front) mergedFiles.front = {}
        mergedFiles.front[color] = printFiles.front[color] || []
      }
      if (printFiles.back) {
        if (!mergedFiles.back) mergedFiles.back = {}
        mergedFiles.back[color] = printFiles.back[color] || []
      }
      if (printFiles.side) {
        if (!mergedFiles.side) mergedFiles.side = {}
        mergedFiles.side[color] = printFiles.side[color] || []
      }
      
      // Aktualisiere Druckarten
      if (printMethods.front) {
        if (!mergedMethods.front) mergedMethods.front = {}
        if (printMethods.front[color]) {
          mergedMethods.front[color] = printMethods.front[color]
        }
      }
      if (printMethods.back) {
        if (!mergedMethods.back) mergedMethods.back = {}
        if (printMethods.back[color]) {
          mergedMethods.back[color] = printMethods.back[color]
        }
      }
      if (printMethods.side) {
        if (!mergedMethods.side) mergedMethods.side = {}
        if (printMethods.side[color]) {
          mergedMethods.side[color] = printMethods.side[color]
        }
      }
      
      // Aktualisiere Vorschau-Bilder
      if (previewImages[color]) {
        mergedPreviews[color] = previewImages[color]
      }
    })

    // Aktualisiere die Druckpositionen (Union aller Positionen)
    const updatedPositions = {
      front: printPositions.front || textile.print_positions?.front || false,
      back: printPositions.back || textile.print_positions?.back || false,
      side: printPositions.side || textile.print_positions?.side || false,
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'TextileSelector.tsx:226',
        message: 'handleSavePrintPositions BEFORE save',
        data: {
          mergedFiles: JSON.stringify(mergedFiles).substring(0, 300),
          updatedPositions,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion

    // Erstelle das aktualisierte Textil-Objekt direkt (nicht aus State, da State noch nicht aktualisiert ist)
    const updatedTextile: SelectedTextile = {
      ...textile,
      print_positions: updatedPositions,
      print_files: mergedFiles,
      print_methods: mergedMethods,
      preview_images: mergedPreviews,
    }

    // Aktualisiere lokalen State
    handleUpdateTextile(currentTextileId, { 
      print_positions: updatedPositions,
      print_files: mergedFiles,
      print_methods: mergedMethods,
      preview_images: mergedPreviews,
    })
    
    // Speichere sofort in Supabase - verwende das aktualisierte Objekt direkt
    try {
      const newSelectedMap = new Map(selectedTextiles)
      newSelectedMap.set(currentTextileId, updatedTextile)
      const selectedArray = Array.from(newSelectedMap.values())
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TextileSelector.tsx:250',
          message: 'handleSavePrintPositions CALLING onSave',
          data: {
            selectedArrayLength: selectedArray.length,
            updatedTextilePrintFiles: JSON.stringify(updatedTextile.print_files || {}).substring(0, 300),
            selectedArrayPrintFiles: JSON.stringify(selectedArray[0]?.print_files || {}).substring(0, 300),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion

      await onSave({ selected_textiles: selectedArray })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TextileSelector.tsx:265',
          message: 'handleSavePrintPositions AFTER onSave',
          data: { success: true },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TextileSelector.tsx:272',
          message: 'handleSavePrintPositions ERROR',
          data: { error: error instanceof Error ? error.message : String(error) },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      console.error('Fehler beim Speichern der Druckdaten:', error)
      alert('Fehler beim Speichern der Druckdaten. Bitte versuchen Sie es erneut.')
      return
    }
    
    handleClosePrintDialog()
  }

  function handlePrintPositionChange(position: 'front' | 'back' | 'side', checked: boolean) {
    setPrintPositions({
      ...printPositions,
      [position]: checked,
    })
    // Wenn Position deaktiviert wird, entferne auch die Dateien
    if (!checked) {
      setPrintFiles({
        ...printFiles,
        [position]: undefined,
      })
    }
  }

  async function handleDeletePrintDataForColor(textileId: string, color: string) {
    const textile = selectedTextiles.get(textileId)
    if (!textile) return

    const printFiles = textile.print_files || {}
    const filesToDelete: string[] = []
    
    // Sammle alle Dateipfade, die gelöscht werden sollen
    if (printFiles.front?.[color]) {
      printFiles.front[color].forEach((file: PrintFile) => {
        // Extrahiere den Storage-Pfad aus der URL
        const urlMatch = file.url.match(/\/storage\/v1\/object\/public\/print-files\/(.+)/)
        if (urlMatch) {
          filesToDelete.push(urlMatch[1])
        }
      })
    }
    if (printFiles.back?.[color]) {
      printFiles.back[color].forEach((file: PrintFile) => {
        const urlMatch = file.url.match(/\/storage\/v1\/object\/public\/print-files\/(.+)/)
        if (urlMatch) {
          filesToDelete.push(urlMatch[1])
        }
      })
    }
    if (printFiles.side?.[color]) {
      printFiles.side[color].forEach((file: PrintFile) => {
        const urlMatch = file.url.match(/\/storage\/v1\/object\/public\/print-files\/(.+)/)
        if (urlMatch) {
          filesToDelete.push(urlMatch[1])
        }
      })
    }

    // Lösche Dateien aus Storage
    if (filesToDelete.length > 0) {
      try {
        const response = await fetch('/api/lead-config/delete-print-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: filesToDelete }),
        })
        if (!response.ok) {
          console.error('Fehler beim Löschen der Dateien aus Storage')
        }
      } catch (error) {
        console.error('Fehler beim Löschen der Dateien:', error)
      }
    }

    const updatedFiles = { ...printFiles }
    
    // Entferne Dateien für diese Farbe aus allen Positionen
    if (updatedFiles.front?.[color]) {
      delete updatedFiles.front[color]
      if (Object.keys(updatedFiles.front).length === 0) {
        delete updatedFiles.front
      }
    }
    if (updatedFiles.back?.[color]) {
      delete updatedFiles.back[color]
      if (Object.keys(updatedFiles.back).length === 0) {
        delete updatedFiles.back
      }
    }
    if (updatedFiles.side?.[color]) {
      delete updatedFiles.side[color]
      if (Object.keys(updatedFiles.side).length === 0) {
        delete updatedFiles.side
      }
    }

    // Aktualisiere lokalen State
    handleUpdateTextile(textileId, { print_files: updatedFiles })
    
    // Speichere sofort in Supabase
    try {
      const updatedTextile = selectedTextiles.get(textileId)
      if (updatedTextile) {
        const selectedArray = Array.from(selectedTextiles.values())
        await onSave({ selected_textiles: selectedArray })
      }
    } catch (error) {
      console.error('Fehler beim Speichern nach Löschen:', error)
      alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    }
  }

  async function handleFileUpload(position: 'front' | 'back' | 'side', files: FileList | null, color: string) {
    if (!files || files.length === 0 || !currentTextileId || !color) return

    setUploading(`${position}_${color}`)

    try {
      const fileArray = Array.from(files)
      const uploadedFiles: PrintFile[] = []

      // Upload jede Datei zu Supabase Storage
      for (const file of fileArray) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('textile_id', currentTextileId)
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

      // Speichere Dateien für die spezifische Farbe
      const updatedFiles = { ...printFiles }
      if (!updatedFiles[position]) {
        updatedFiles[position] = {}
      }
      if (!updatedFiles[position]![color]) {
        updatedFiles[position]![color] = []
      }
      updatedFiles[position]![color] = [
        ...(updatedFiles[position]![color] || []),
        ...uploadedFiles,
      ]

      setPrintFiles(updatedFiles)
    } catch (error: any) {
      console.error('Error uploading files:', error)
      alert(error.message || 'Fehler beim Hochladen')
    } finally {
      setUploading(null)
    }
  }

  async function handlePreviewImageUpload(files: FileList | null, color: string) {
    if (!files || files.length === 0 || !currentTextileId || !color) return

    setUploading(`preview_${color}`)

    try {
      const fileArray = Array.from(files)
      const uploadedImages: PreviewImage[] = []

      // Upload jedes Bild zu Supabase Storage
      for (const file of fileArray) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('textile_id', currentTextileId)
        formData.append('color', color)

        const response = await fetch('/api/lead-config/upload-preview-image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Fehler beim Hochladen')
        }

        const data = await response.json()
        uploadedImages.push({
          id: data.fileId,
          url: data.url,
          fileName: data.fileName,
        })
      }

      // Speichere Bilder für die spezifische Farbe
      const updatedPreviews = { ...previewImages }
      if (!updatedPreviews[color]) {
        updatedPreviews[color] = []
      }
      updatedPreviews[color] = [
        ...(updatedPreviews[color] || []),
        ...uploadedImages,
      ]

      setPreviewImages(updatedPreviews)
    } catch (error: any) {
      console.error('Error uploading preview images:', error)
      alert(error.message || 'Fehler beim Hochladen')
    } finally {
      setUploading(null)
    }
  }

  async function handleOpenFileBrowser(position: 'front' | 'back' | 'side', color: string) {
    if (!currentTextileId) return
    
    setFileBrowserPosition(position)
    setFileBrowserColor(color)
    setFileBrowserOpen(true)
    setLoadingFiles(true)
    
    try {
      // Lade nur Dateien für dieses Textil
      const response = await fetch(`/api/storage/list-print-files?textile_id=${currentTextileId}`)
      if (response.ok) {
        const data = await response.json()
        // Filtere auch nach Position und Farbe falls möglich
        const filteredFiles = data.files
          .filter((f: any) => {
            // Dateipfad sollte lead-configs/{textileId}/{position}/{color}/ enthalten
            const path = f.path || f.folder || ''
            return path.includes(`lead-configs/${currentTextileId}/${position}/`)
          })
          .map((f: any) => ({
            id: f.id,
            url: f.url,
            fileName: f.name,
          }))
        setAvailableFiles(filteredFiles)
      }
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoadingFiles(false)
    }
  }

  function handleSelectExistingFile(file: PrintFile) {
    // Füge die ausgewählte Datei zu den Druckdateien hinzu
    const updatedFiles = { ...printFiles }
    if (!updatedFiles[fileBrowserPosition]) {
      updatedFiles[fileBrowserPosition] = {}
    }
    if (!updatedFiles[fileBrowserPosition]![fileBrowserColor]) {
      updatedFiles[fileBrowserPosition]![fileBrowserColor] = []
    }
    
    // Prüfe ob Datei bereits hinzugefügt wurde
    const exists = updatedFiles[fileBrowserPosition]![fileBrowserColor].some(f => f.url === file.url)
    if (!exists) {
      updatedFiles[fileBrowserPosition]![fileBrowserColor] = [
        ...updatedFiles[fileBrowserPosition]![fileBrowserColor],
        file,
      ]
      setPrintFiles(updatedFiles)
    }
    
    setFileBrowserOpen(false)
  }

  function handleAddTextile(textile: TextileCatalog | null) {
    if (!textile) return
    
    if (selectedTextiles.has(textile.id)) {
      // Bereits ausgewählt
      setSearchValue(null)
      return
    }

    const newSelected = new Map(selectedTextiles)
    // Farben müssen manuell ausgewählt werden
    newSelected.set(textile.id, {
      textile_id: textile.id,
      textile_name: textile.name,
      colors: [], // Farben werden über das Dropdown ausgewählt
      sizes: [], // Größen bleiben leer, müssen manuell ausgewählt werden
    })
    
    setSelectedTextiles(newSelected)
    setSearchValue(null) // Reset search field
  }

  function handleRemoveTextile(textileId: string) {
    const newSelected = new Map(selectedTextiles)
    newSelected.delete(textileId)
    setSelectedTextiles(newSelected)
  }

  function handleUpdateTextile(textileId: string, updates: Partial<SelectedTextile>) {
    const newSelected = new Map(selectedTextiles)
    const existing = newSelected.get(textileId)
    
    if (existing) {
      newSelected.set(textileId, { ...existing, ...updates })
      setSelectedTextiles(newSelected)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const selectedArray = Array.from(selectedTextiles.values())
      await onSave({ selected_textiles: selectedArray })
    } catch (error) {
      // Error wird bereits in onSave behandelt
    } finally {
      setSaving(false)
    }
  }

  // Filtere bereits ausgewählte Textilien aus den Optionen
  const availableTextiles = textiles.filter(
    textile => !selectedTextiles.has(textile.id)
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Wählen Sie die Textilien aus, die Sie für Ihren Shop verwenden möchten. Sie können später Farben und Größen pro Textil festlegen.
      </Typography>

      {textiles.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Keine Textilien im Katalog verfügbar. Bitte kontaktieren Sie einen Administrator.
        </Alert>
      )}

      {/* Suchfeld mit Autocomplete */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          value={searchValue}
          onChange={(_, newValue) => {
            handleAddTextile(newValue)
          }}
          options={availableTextiles}
          getOptionLabel={(option) => `${option.name}${option.brand ? ` - ${option.brand}` : ''}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Textil suchen und hinzufügen"
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
                {option.available_colors && option.available_colors.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {option.available_colors.length} Farben verfügbar
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          noOptionsText="Keine Textilien gefunden"
          loading={loading}
        />
      </Box>

      {/* Ausgewählte Textilien */}
      {selectedTextiles.size > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Ausgewählte Textilien ({selectedTextiles.size})
          </Typography>
          
          {Array.from(selectedTextiles.values()).map((selected) => {
            const textile = textiles.find(t => t.id === selected.textile_id)
            if (!textile) return null

            return (
              <Box key={selected.textile_id} sx={{ mb: 1, position: 'relative' }}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 4 }}>
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          {selected.textile_name}
                        </Typography>
                        {textile.brand && (
                          <Typography variant="body2" color="text.secondary">
                            {textile.brand}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                  <Box sx={{ pt: 1 }}>
                    {/* Farben-Auswahl */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Verfügbare Farben auswählen:
                      </Typography>
                      <Autocomplete
                        multiple
                        options={textile.available_colors || []}
                        value={selected.colors || []}
                        onChange={(_, newValue) => {
                          handleUpdateTextile(selected.textile_id, { colors: newValue })
                        }}
                        filterSelectedOptions
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            size="small" 
                            placeholder="Farben suchen und auswählen..."
                            fullWidth
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option}
                              label={option}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))
                        }
                        renderOption={(props, option) => (
                          <Box component="li" {...props} key={option}>
                            <Typography>{option}</Typography>
                          </Box>
                        )}
                        noOptionsText="Keine Farben gefunden"
                        sx={{ width: '100%' }}
                      />
                      {selected.colors && selected.colors.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {selected.colors.length} von {textile.available_colors?.length || 0} Farben ausgewählt
                        </Typography>
                      )}
                    </Box>

                    {/* Größen-Auswahl */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Verfügbare Größen:
                      </Typography>
                      <Autocomplete
                        multiple
                        options={textile.available_sizes || []}
                        value={selected.sizes || []}
                        onChange={(_, newValue) => {
                          handleUpdateTextile(selected.textile_id, { sizes: newValue })
                        }}
                        renderInput={(params) => (
                          <TextField {...params} size="small" placeholder="Größen auswählen" />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option}
                              label={option}
                              size="small"
                            />
                          ))
                        }
                      />
                    </Box>

                    {/* Druckdaten pro Farbe */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Druckdaten pro Farbe:
                      </Typography>
                      {selected.colors && selected.colors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {selected.colors.map((color) => {
                            const printFilesForColor = selected.print_files || {}
                            const hasFront = printFilesForColor.front?.[color] && printFilesForColor.front[color].length > 0
                            const hasBack = printFilesForColor.back?.[color] && printFilesForColor.back[color].length > 0
                            const hasSide = printFilesForColor.side?.[color] && printFilesForColor.side[color].length > 0
                            const hasAnyFiles = hasFront || hasBack || hasSide
                            
                            return (
                              <Paper
                                key={color}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                    {color}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                    {hasFront ? (
                                      <Chip
                                        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                        label="Vorne"
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                      />
                                    ) : (
                                      <Chip
                                        label="Vorne"
                                        size="small"
                                        variant="outlined"
                                        sx={{ opacity: 0.5 }}
                                      />
                                    )}
                                    {hasBack ? (
                                      <Chip
                                        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                        label="Hinten"
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                      />
                                    ) : (
                                      <Chip
                                        label="Hinten"
                                        size="small"
                                        variant="outlined"
                                        sx={{ opacity: 0.5 }}
                                      />
                                    )}
                                    {hasSide ? (
                                      <Chip
                                        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                        label="Seite"
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                      />
                                    ) : (
                                      <Chip
                                        label="Seite"
                                        size="small"
                                        variant="outlined"
                                        sx={{ opacity: 0.5 }}
                                      />
                                    )}
                                  </Box>
                                  {/* Vorschau-Bilder anzeigen */}
                                  {selected.preview_images?.[color] && selected.preview_images[color].length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                      {selected.preview_images[color].map((preview) => (
                                        <Box
                                          key={preview.id}
                                          sx={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            position: 'relative',
                                          }}
                                        >
                                          <img
                                            src={preview.url}
                                            alt={preview.fileName}
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                            }}
                                          />
                                        </Box>
                                      ))}
                                    </Box>
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      // Öffne Dialog mit der angeklickten Farbe vorausgewählt
                                      handleOpenPrintDialog(selected.textile_id, [color])
                                    }}
                                    color="primary"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  {hasAnyFiles && (
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        if (confirm(`Möchten Sie alle Druckdaten für die Farbe "${color}" löschen?`)) {
                                          handleDeletePrintDataForColor(selected.textile_id, color)
                                        }
                                      }}
                                      color="error"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Box>
                              </Paper>
                            )
                          })}
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ mb: 1 }}>
                          Bitte wählen Sie zuerst Farben aus.
                        </Alert>
                      )}
                      
                      {/* Button zum Hinzufügen von Druckdaten für neue Farben */}
                      {selected.colors && selected.colors.length > 0 && (
                        <Button
                          variant="outlined"
                          startIcon={<PrintIcon />}
                          onClick={() => {
                            setSelectedColors([])
                            handleOpenPrintDialog(selected.textile_id)
                          }}
                          size="small"
                          fullWidth
                          sx={{ mt: 1.5 }}
                        >
                          Druck für neue Farben festlegen
                        </Button>
                      )}
                    </Box>
                  </Box>
                </AccordionDetails>
                </Accordion>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveTextile(selected.textile_id)}
                  sx={{ 
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    zIndex: 1,
                    backgroundColor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      )}

      {selectedTextiles.size === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Noch keine Textilien ausgewählt. Verwenden Sie das Suchfeld oben, um Textilien hinzuzufügen.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || selectedTextiles.size === 0}
          size="small"
        >
          {saving ? <CircularProgress size={20} /> : 'Speichern'}
        </Button>
      </Box>

      {/* Dialog für Druckfestlegung */}
      <Dialog
        open={printDialogOpen}
        onClose={handleClosePrintDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Druck festlegen
          {currentTextileId && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {selectedTextiles.get(currentTextileId)?.textile_name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {/* Farbauswahl */}
          {currentTextileId && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                Farben auswählen
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Wählen Sie die Farben aus, für die der Druck gelten soll.
              </Typography>
              <Autocomplete
                multiple
                options={selectedTextiles.get(currentTextileId)?.colors || []}
                value={selectedColors}
                onChange={(_, newValue) => setSelectedColors(newValue)}
                filterSelectedOptions
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    placeholder="Farben auswählen..."
                    fullWidth
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))
                }
              />
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Druckpositionen */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Druckpositionen auswählen
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wählen Sie die Positionen aus, an denen für dieses Textil gedruckt werden soll.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printPositions.front}
                    onChange={(e) => handlePrintPositionChange('front', e.target.checked)}
                  />
                }
                label="Vorne"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printPositions.back}
                    onChange={(e) => handlePrintPositionChange('back', e.target.checked)}
                  />
                }
                label="Hinten"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printPositions.side}
                    onChange={(e) => handlePrintPositionChange('side', e.target.checked)}
                  />
                }
                label="Seite"
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Druckdateien */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Druckdateien hochladen
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Laden Sie die Druckdateien (PDF, AI, EPS) für die ausgewählten Positionen hoch.
            </Typography>

            {/* Upload-Bereiche für jede Position */}
            <Grid container spacing={2}>
              {(['front', 'back', 'side'] as const).map((position) => {
                if (!printPositions[position]) return null

                const positionLabel = position === 'front' ? 'Vorne' : position === 'back' ? 'Hinten' : 'Seite'
                const positionFiles = printFiles[position] || {}
                const positionMethods = printMethods[position] || {}

                return (
                  <Grid item xs={12} sm={4} key={position}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, textAlign: 'center' }}>
                        {positionLabel}
                      </Typography>
                      
                      {/* Für jede ausgewählte Farbe: Druckart-Dropdown und Upload */}
                      {selectedColors.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {selectedColors.map((color) => {
                            const currentMethod = positionMethods[color] || ''
                            const isUploading = uploading === `${position}_${color}`
                            
                            return (
                              <Box key={color} sx={{ mb: 1 }}>
                                <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 1 }}>
                                  {color}
                                </Typography>
                                
                                {/* Druckart-Dropdown */}
                                {/* #region agent log */}
                                {(()=>{try{fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TextileSelector.tsx:1305',message:'Autocomplete render - checking printMethodsList',data:{printMethodsListExists:typeof printMethodsList!=='undefined',printMethodsListLength:printMethodsList?.length||0,currentMethod,color,position},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});}catch(e){}return null;})()}
                                {/* #endregion */}
                                <Autocomplete
                                  options={printMethodsList}
                                  value={currentMethod}
                                  onChange={(_, newValue) => {
                                    setPrintMethods(prev => {
                                      const newMethods = { ...prev }
                                      if (!newMethods[position]) newMethods[position] = {}
                                      if (newValue) {
                                        newMethods[position]![color] = newValue
                                      } else {
                                        delete newMethods[position]![color]
                                        if (Object.keys(newMethods[position]!).length === 0) {
                                          delete newMethods[position]
                                        }
                                      }
                                      return newMethods
                                    })
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      size="small"
                                      placeholder="Druckart wählen..."
                                      fullWidth
                                    />
                                  )}
                                  sx={{ mb: 1 }}
                                />
                                
                                {/* Zeige hochgeladene Dateien für diese Farbe */}
                                {positionFiles[color] && positionFiles[color].length > 0 && (
                                  <Box sx={{ mb: 1 }}>
                                    {positionFiles[color].map((file) => (
                                      <Typography key={file.id} variant="caption" display="block" sx={{ fontSize: '0.7rem', ml: 1 }}>
                                        {file.fileName.length > 20 ? file.fileName.substring(0, 20) + '...' : file.fileName}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                                
                                {/* Upload-Button und Bibliothek-Button für diese Farbe */}
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <input
                                    accept=".pdf,.ai,.eps,.psd"
                                    style={{ display: 'none' }}
                                    id={`print-file-${position}-${color}`}
                                    type="file"
                                    multiple
                                    onChange={(e) => handleFileUpload(position, e.target.files, color)}
                                    disabled={isUploading}
                                  />
                                  <label htmlFor={`print-file-${position}-${color}`} style={{ flex: 1 }}>
                                    <Button
                                      variant="outlined"
                                      component="span"
                                      fullWidth
                                      size="small"
                                      startIcon={isUploading ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 16 }} />}
                                      disabled={isUploading}
                                      sx={{ fontSize: '0.7rem', px: 1 }}
                                    >
                                      {isUploading ? '...' : 'Upload'}
                                    </Button>
                                  </label>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleOpenFileBrowser(position, color)}
                                    sx={{ minWidth: 'auto', px: 1 }}
                                    title="Aus Bibliothek wählen"
                                  >
                                    <FolderOpenIcon sx={{ fontSize: 16 }} />
                                  </Button>
                                </Box>
                              </Box>
                            )
                          })}
                        </Box>
                      ) : (
                        <Alert severity="info" size="small">
                          Bitte wählen Sie zuerst Farben aus.
                        </Alert>
                      )}
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>

            {Object.values(printPositions).every(p => !p) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Bitte wählen Sie zuerst mindestens eine Druckposition aus.
              </Alert>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Vorschau-Bilder */}
          {selectedColors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                Druckvorschau hochladen
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Laden Sie Vorschau-Bilder hoch, die zeigen, wie die Textilien mit dem Druck aussehen werden.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedColors.map((color) => {
                  const colorPreviews = previewImages[color] || []
                  const isUploading = uploading === `preview_${color}`

                  return (
                    <Box key={color} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                        {color}
                      </Typography>
                      
                      {/* Bereits hochgeladene Vorschau-Bilder anzeigen */}
                      {colorPreviews.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          {colorPreviews.map((preview) => (
                            <Box
                              key={preview.id}
                              sx={{
                                width: 100,
                                height: 100,
                                borderRadius: 1,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider',
                                position: 'relative',
                              }}
                            >
                              <img
                                src={preview.url}
                                alt={preview.fileName}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Upload-Button für Vorschau-Bilder */}
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id={`preview-image-${color}`}
                        type="file"
                        multiple
                        onChange={(e) => handlePreviewImageUpload(e.target.files, color)}
                        disabled={isUploading}
                      />
                      <label htmlFor={`preview-image-${color}`}>
                        <Button
                          variant="outlined"
                          component="span"
                          fullWidth
                          size="small"
                          startIcon={isUploading ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 18 }} />}
                          disabled={isUploading}
                        >
                          {isUploading ? 'Wird hochgeladen...' : colorPreviews.length > 0 ? 'Weitere Bilder hinzufügen' : 'Vorschau-Bilder hochladen'}
                        </Button>
                      </label>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePrintDialog}>Abbrechen</Button>
          <Button
            onClick={handleSavePrintPositions}
            variant="contained"
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Datei-Bibliothek */}
      <Dialog
        open={fileBrowserOpen}
        onClose={() => setFileBrowserOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Druckdatei aus Bibliothek wählen
          <Typography variant="body2" color="text.secondary">
            Position: {fileBrowserPosition === 'front' ? 'Vorne' : fileBrowserPosition === 'back' ? 'Hinten' : 'Seite'} | Farbe: {fileBrowserColor}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {loadingFiles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : availableFiles.length === 0 ? (
            <Alert severity="info">
              Keine Druckdateien in der Bibliothek gefunden. Bitte laden Sie zuerst Dateien hoch.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              {availableFiles.map((file) => (
                <Paper
                  key={file.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleSelectExistingFile(file)}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {file.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {file.url.length > 60 ? '...' + file.url.slice(-60) : file.url}
                    </Typography>
                  </Box>
                  <Button variant="outlined" size="small">
                    Auswählen
                  </Button>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileBrowserOpen(false)}>Abbrechen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
