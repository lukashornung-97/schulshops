'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Grid,
  Divider,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SchoolIcon from '@mui/icons-material/School'
import TextileSelector from './components/TextileSelector'
import PrintDataEditor from './components/PrintDataEditor'
import PreviewUploader from './components/PreviewUploader'
import PriceCalculator from './components/PriceCalculator'

type School = Database['public']['Tables']['schools']['Row']
type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

export default function LeadDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const [school, setSchool] = useState<School | null>(null)
  const [config, setConfig] = useState<LeadConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    if (params.id) {
      loadSchool()
      loadConfig()
    }
  }, [params.id])

  async function loadSchool() {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Prüfe Status case-insensitive
      if (data.status?.toLowerCase() !== 'lead') {
        router.replace(`/schools/${params.id}`)
        return
      }

      setSchool(data)
    } catch (error: any) {
      console.error('Error loading school:', error)
      setLoading(false)
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch(`/api/lead-config?school_id=${params.id}`)
      const data = await response.json()

      if (response.ok && data.config) {
        setConfig(data.config)
      }
    } catch (error: any) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig(updates: Partial<LeadConfig>) {
    setSaving(true)
    try {
      const response = await fetch('/api/lead-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: params.id,
          ...updates,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      setConfig(data.config)
      setSnackbar({
        open: true,
        message: 'Änderungen gespeichert',
        severity: 'success',
      })
      return data.config
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || 'Fehler beim Speichern',
        severity: 'error',
      })
      throw error
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!school) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error">Schule nicht gefunden oder kein Lead-Status</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/schools/${params.id}`)}
            sx={{ mb: 2 }}
          >
            Zurück
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SchoolIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {school.name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Lead-Dashboard: Textilien, Druckvorschauen und Preiskalkulation
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Layout: Vier Bereiche in zwei Zeilen, jeweils 50% Breite */}
        <Grid container spacing={3}>
          {/* Zeile 1: Textilauswahl + Druckdaten */}
          <Grid item xs={12} sm={12} md={6} lg={6}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  1. Textilien auswählen
                </Typography>
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <TextileSelector
                    schoolId={params.id as string}
                    config={config}
                    onSave={saveConfig}
                    onNext={() => {}}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={12} md={6} lg={6}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  2. Druckdaten
                </Typography>
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <PrintDataEditor
                    schoolId={params.id as string}
                    config={config}
                    onSave={saveConfig}
                    onNext={() => {}}
                    onBack={() => {}}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Zeile 2: Preiskalkulation + Druckvorschauen */}
          <Grid item xs={12} sm={12} md={6} lg={6}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  3. Preiskalkulation
                </Typography>
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <PriceCalculator
                    schoolId={params.id as string}
                    config={config}
                    onSave={saveConfig}
                    onNext={() => {}}
                    onBack={() => {}}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={12} md={6} lg={6}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  4. Druckvorschauen
                </Typography>
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <PreviewUploader
                    schoolId={params.id as string}
                    config={config}
                    onSave={saveConfig}
                    onNext={() => {}}
                    onBack={() => {}}
                    mode="previews"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Zeile 3: Bestätigung (volle Breite) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  5. Bestätigung
                </Typography>
                {config?.status === 'pending_approval' ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Ihre Konfiguration wartet auf Bestätigung durch einen Administrator.
                  </Alert>
                ) : config?.status === 'approved' ? (
                  <>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Ihre Konfiguration wurde bestätigt. Der Shop wurde erstellt.
                    </Alert>
                    {config?.shop_id && (
                      <Button
                        variant="contained"
                        onClick={() => router.push(`/shops/${config.shop_id}`)}
                      >
                        Zum Shop
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Überprüfen Sie alle Bereiche und reichen Sie die Konfiguration zur Bestätigung ein.
                    </Alert>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        try {
                          await saveConfig({ status: 'pending_approval' })
                          setSnackbar({
                            open: true,
                            message: 'Konfiguration zur Bestätigung eingereicht',
                            severity: 'success',
                          })
                        } catch (error) {
                          // Error wird bereits in saveConfig behandelt
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? <CircularProgress size={20} /> : 'Zur Bestätigung einreichen'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

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
    </Box>
  )
}
