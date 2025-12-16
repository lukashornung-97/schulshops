'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Database } from '@/types/database'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

interface SelectedTextile {
  textile_id: string
  textile_name: string
  colors: string[]
  sizes: string[]
}

interface PrintPositions {
  [textileId: string]: {
    front: boolean
    back: boolean
    side: boolean
  }
}

interface PrintConfigEditorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
  onBack: () => void
}

export default function PrintConfigEditor({ schoolId, config, onSave, onNext, onBack }: PrintConfigEditorProps) {
  const [selectedTextiles, setSelectedTextiles] = useState<SelectedTextile[]>([])
  const [printPositions, setPrintPositions] = useState<PrintPositions>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [config])

  function loadConfig() {
    if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
      const selected = config.selected_textiles as any
      if (Array.isArray(selected)) {
        setSelectedTextiles(selected)
        
        // Lade Druckpositionen
        if (config.print_positions && typeof config.print_positions === 'object') {
          const positions = config.print_positions as any
          setPrintPositions(positions)
        } else {
          // Initialisiere mit Standardwerten
          const initialPositions: PrintPositions = {}
          selected.forEach((textile: SelectedTextile) => {
            initialPositions[textile.textile_id] = {
              front: false,
              back: false,
              side: false,
            }
          })
          setPrintPositions(initialPositions)
        }
      }
    }
  }

  function handlePositionChange(textileId: string, position: 'front' | 'back' | 'side', checked: boolean) {
    setPrintPositions({
      ...printPositions,
      [textileId]: {
        ...printPositions[textileId],
        [position]: checked,
      },
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ print_positions: printPositions })
    } catch (error) {
      // Error wird bereits in onSave behandelt
    } finally {
      setSaving(false)
    }
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
        Legen Sie für jedes ausgewählte Textil fest, an welchen Positionen gedruckt werden soll (Vorne, Hinten, Seite).
      </Typography>

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
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    {textile.textile_name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={positions.front}
                          onChange={(e) => handlePositionChange(textile.textile_id, 'front', e.target.checked)}
                        />
                      }
                      label="Vorne"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={positions.back}
                          onChange={(e) => handlePositionChange(textile.textile_id, 'back', e.target.checked)}
                        />
                      }
                      label="Hinten"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={positions.side}
                          onChange={(e) => handlePositionChange(textile.textile_id, 'side', e.target.checked)}
                        />
                      }
                      label="Seite"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {selectedTextiles.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            size="small"
          >
            {saving ? <CircularProgress size={20} /> : 'Speichern'}
          </Button>
        </Box>
      )}
    </Box>
  )
}

