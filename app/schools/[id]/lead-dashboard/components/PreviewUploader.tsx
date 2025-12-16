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
  TextField,
  Paper,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Database } from '@/types/database'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

interface SelectedTextile {
  textile_id: string
  textile_name: string
  colors: string[]
  sizes: string[]
}

interface PreviewUploaderProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
  onBack: () => void
  mode?: 'previews' | 'print-files'
}

export default function PreviewUploader({ schoolId, config, onSave, onNext, onBack, mode = 'previews' }: PreviewUploaderProps) {
  const [selectedTextiles, setSelectedTextiles] = useState<SelectedTextile[]>([])
  const [printPositions, setPrintPositions] = useState<any>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('')

  useEffect(() => {
    loadConfig()
  }, [config])

  function loadConfig() {
    if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
      const selected = config.selected_textiles as any
      if (Array.isArray(selected)) {
        setSelectedTextiles(selected)
      }
    }

    if (config?.print_positions && typeof config.print_positions === 'object') {
      setPrintPositions(config.print_positions)
    }
  }

  async function handleFileUpload(textileId: string, position: 'front' | 'back' | 'side', files: FileList | null) {
    if (!files || files.length === 0) return

    if (mode === 'print-files' && !customFileName.trim()) {
      alert('Bitte geben Sie einen Dateinamen für die Druckdatei ein.')
      return
    }

    setUploading(`${textileId}_${position}`)

    try {
      // Für das Lead-Dashboard speichern wir die Dateien zunächst temporär
      // Später werden sie beim Erstellen des Shops den Produkten zugeordnet
      const fileArray = Array.from(files)
      const uploadedFiles: string[] = []

      // Hier würde normalerweise der Upload zu Supabase Storage erfolgen
      // Für jetzt speichern wir nur die Dateinamen in der Konfiguration
      // TODO: Implementiere tatsächlichen Upload zu Storage
      
      for (const file of fileArray) {
        uploadedFiles.push(file.name)
      }

      // Aktualisiere die Konfiguration mit den hochgeladenen Dateien
      const currentUploads = (config as any)?.uploaded_files || {}
      const textileUploads = currentUploads[textileId] || {}
      textileUploads[position] = uploadedFiles
      currentUploads[textileId] = textileUploads

      await onSave({ uploaded_files: currentUploads } as any)

      setCustomFileName('')
    } catch (error: any) {
      console.error('Error uploading files:', error)
      alert(error.message || 'Fehler beim Hochladen')
    } finally {
      setUploading(null)
    }
  }

  function getUploadedFiles(textileId: string, position: 'front' | 'back' | 'side'): string[] {
    const uploads = (config as any)?.uploaded_files || {}
    return uploads[textileId]?.[position] || []
  }

  if (selectedTextiles.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Bitte wählen Sie zuerst Textilien aus.
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        Laden Sie die Druckdateien (PDF, AI, EPS) für die Produktion hoch.
      </Typography>

      {mode === 'print-files' && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Dateiname für Druckdateien"
            value={customFileName}
            onChange={(e) => setCustomFileName(e.target.value)}
            placeholder="z. B. logo_design"
            helperText="Dieser Name wird für alle hochgeladenen Druckdateien verwendet"
          />
        </Box>
      )}

      <Grid container spacing={2}>
        {selectedTextiles.map((textile) => {
          const positions = printPositions[textile.textile_id] || {
            front: false,
            back: false,
            side: false,
          }

          return (
            <Grid item xs={12} key={textile.textile_id}>
              <Card variant="outlined">
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                    {textile.textile_name}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {(['front', 'back', 'side'] as const).map((position) => {
                      if (!positions[position]) return null

                      const uploadedFiles = getUploadedFiles(textile.textile_id, position)
                      const isUploading = uploading === `${textile.textile_id}_${position}`

                      return (
                        <Grid item xs={12} sm={4} key={position}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                              {position === 'front' ? 'Vorne' : position === 'back' ? 'Hinten' : 'Seite'}
                            </Typography>
                            
                            {uploadedFiles.length > 0 && (
                              <Box sx={{ mb: 1 }}>
                                {uploadedFiles.map((fileName, index) => (
                                  <Typography key={index} variant="caption" display="block" sx={{ fontSize: '0.7rem' }}>
                                    {fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName}
                                  </Typography>
                                ))}
                              </Box>
                            )}

                            <input
                              accept={mode === 'print-files' ? '.pdf,.ai,.eps,.psd' : 'image/*'}
                              style={{ display: 'none' }}
                              id={`file-${textile.textile_id}-${position}`}
                              type="file"
                              multiple={mode === 'print-files'}
                              multiple
                              onChange={(e) => handleFileUpload(textile.textile_id, position, e.target.files)}
                              disabled={isUploading}
                            />
                            <label htmlFor={`file-${textile.textile_id}-${position}`}>
                              <Button
                                variant="outlined"
                                component="span"
                                fullWidth
                                size="small"
                                startIcon={isUploading ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 18 }} />}
                                disabled={isUploading || (mode === 'print-files' && !customFileName.trim())}
                              >
                                {isUploading ? 'Wird hochgeladen...' : uploadedFiles.length > 0 ? 'Ersetzen' : 'Hochladen'}
                              </Button>
                            </label>
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Dateien werden automatisch gespeichert
        </Typography>
      </Box>
    </Box>
  )
}

