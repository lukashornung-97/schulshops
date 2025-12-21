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
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SchoolIcon from '@mui/icons-material/School'
import TextileSelector from './components/TextileSelector'
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

      // Lade Config neu, um sicherzustellen, dass shop_id aktualisiert ist
      await loadConfig()
      
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

  // #region agent log
  useEffect(() => {
    const logData = {
      location: 'app/schools/[id]/lead-dashboard/page.tsx:141',
      message: 'LeadDashboard render - checking window width and grid setup',
      data: {
        windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'server',
        containerMaxWidth: 'xl',
        gridItems: 4,
        expectedLayout: '2x2 grid with 50% width each',
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    };
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    }).catch(() => {});
  }, []);
  // #endregion

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

        {/* Layout: Textilauswahl 100% Breite, dann 2x2 Grid */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          {/* Textilauswahl - 100% Breite */}
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                1. Textilien auswählen
              </Typography>
              <TextileSelector
                schoolId={params.id as string}
                config={config}
                onSave={saveConfig}
                onNext={() => {}}
              />
            </CardContent>
          </Card>

          {/* Preiskalkulation - volle Breite */}
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                2. Preiskalkulation
              </Typography>
              <PriceCalculator
                schoolId={params.id as string}
                config={config}
                onSave={saveConfig}
                onNext={() => {}}
                onBack={() => {}}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Zeile 3: Bestätigung (volle Breite) */}
        <Box sx={{ mt: 3, width: '100%' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  4. Bestätigung
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
        </Box>
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
