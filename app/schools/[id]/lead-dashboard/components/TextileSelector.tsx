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
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Database } from '@/types/database'

type TextileCatalog = Database['public']['Tables']['textile_catalog']['Row']
type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

interface SelectedTextile {
  textile_id: string
  textile_name: string
  colors: string[]
  sizes: string[]
}

interface TextileSelectorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
}

export default function TextileSelector({ schoolId, config, onSave, onNext }: TextileSelectorProps) {
  const [textiles, setTextiles] = useState<TextileCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTextiles, setSelectedTextiles] = useState<Map<string, SelectedTextile>>(new Map())
  const [saving, setSaving] = useState(false)
  const [searchValue, setSearchValue] = useState<TextileCatalog | null>(null)

  useEffect(() => {
    loadTextiles()
    loadConfig()
  }, [])

  async function loadTextiles() {
    try {
      const response = await fetch('/api/textile-catalog')
      const data = await response.json()

      if (response.ok) {
        setTextiles(data.textiles || [])
      }
    } catch (error) {
      console.error('Error loading textiles:', error)
    } finally {
      setLoading(false)
    }
  }

  function loadConfig() {
    if (config?.selected_textiles && typeof config.selected_textiles === 'object') {
      const selected = config.selected_textiles as any
      if (Array.isArray(selected)) {
        const map = new Map<string, SelectedTextile>()
        selected.forEach((item: SelectedTextile) => {
          map.set(item.textile_id, item)
        })
        setSelectedTextiles(map)
      }
    }
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
                    <Box>
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
    </Box>
  )
}
