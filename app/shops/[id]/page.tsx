'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Fab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import AddIcon from '@mui/icons-material/Add'
import StoreIcon from '@mui/icons-material/Store'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloseIcon from '@mui/icons-material/Close'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import InfoIcon from '@mui/icons-material/Info'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import BarChartIcon from '@mui/icons-material/BarChart'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Snackbar from '@mui/material/Snackbar'

type Shop = Database['public']['Tables']['shops']['Row']
type Product = Database['public']['Tables']['products']['Row']

// Hilfsfunktion: Prüft ob ein Shop wirklich "live" ist
// Ein Shop ist nur live, wenn status='live' UND shop_close_at nicht in der Vergangenheit liegt
function isShopReallyLive(shop: Shop): boolean {
  if (shop.status !== 'live') return false
  if (shop.shop_close_at) {
    const closeDate = new Date(shop.shop_close_at)
    const now = new Date()
    if (closeDate < now) return false
  }
  return true
}

// Funktion: Prüft und schließt Shops automatisch, deren shop_close_at in der Vergangenheit liegt
async function checkAndCloseExpiredShops(shop: Shop | null): Promise<Shop | null> {
  if (!shop) return null
  
  const now = new Date()
  if (shop.status === 'live' && shop.shop_close_at && new Date(shop.shop_close_at) < now) {
    // Schließe den abgelaufenen Shop
    const { data, error } = await supabase
      .from('shops')
      .update({ status: 'closed' })
      .eq('id', shop.id)
      .select()
      .single()

    if (error) {
      console.error(`Error closing shop ${shop.id}:`, error)
      return shop
    }
    
    return data || shop
  }
  
  return shop
}

export default function ShopDetail() {
  const params = useParams()
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [shopifyDialogOpen, setShopifyDialogOpen] = useState(false)
  const [shopifyCredentials, setShopifyCredentials] = useState({
    shopDomain: '',
    accessToken: '',
  })
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean
    message: string
    shopName?: string
  } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [editForm, setEditForm] = useState({
    shop_open_at: '',
    shop_close_at: '',
  })
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugValue, setSlugValue] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadShop()
      loadProducts()
    }
  }, [params.id])

  async function updateSchoolStatusIfNeeded(hasActiveShop: boolean) {
    if (!shop) return

    try {
      // Prüfe aktuellen Status der Schule
      const { data: schoolData, error: fetchError } = await supabase
        .from('schools')
        .select('status')
        .eq('id', shop.school_id)
        .single()

      if (fetchError) {
        console.error('Error fetching school status:', fetchError)
        return
      }

      const currentStatus = schoolData?.status

      // Wenn der Status manuell auf 'production' oder 'existing' gesetzt wurde,
      // überschreibe ihn nicht automatisch
      if (currentStatus === 'production' || currentStatus === 'existing') {
        console.log('School status is manually set to', currentStatus, '- not auto-updating')
        return
      }

      // Wenn ein Shop aktiv ist, setze Schule auf 'active'
      if (hasActiveShop && currentStatus !== 'active') {
        const { error: updateError } = await supabase
          .from('schools')
          .update({ status: 'active' })
          .eq('id', shop.school_id)

        if (updateError) {
          console.error('Error updating school status:', updateError)
        }
      }
    } catch (error) {
      console.error('Error in updateSchoolStatusIfNeeded:', error)
    }
  }

  async function loadShop() {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      console.log('Loaded shop data:', data)
      console.log('shop_open_at:', data?.shop_open_at, 'Type:', typeof data?.shop_open_at)
      console.log('shop_close_at:', data?.shop_close_at, 'Type:', typeof data?.shop_close_at)
      
      // Stelle sicher, dass die Daten korrekt gesetzt sind
      if (data) {
        // Prüfe und schließe Shop automatisch, wenn shop_close_at in der Vergangenheit liegt
        const updatedShop = await checkAndCloseExpiredShops(data)
        setShop(updatedShop)
        setSlugValue(updatedShop.slug)
        // Aktualisiere Schulstatus wenn Shop wirklich aktiv ist
        if (updatedShop && isShopReallyLive(updatedShop)) {
          await updateSchoolStatusIfNeeded(true)
        }
      }
    } catch (error) {
      console.error('Error loading shop:', error)
    }
  }

  async function handleSaveSlug() {
    if (!shop || !slugValue.trim()) {
      setSnackbar({
        open: true,
        message: 'Slug darf nicht leer sein',
        severity: 'error',
      })
      return
    }

    // Validiere Slug-Format (nur Kleinbuchstaben, Zahlen, Bindestriche)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slugValue.toLowerCase())) {
      setSnackbar({
        open: true,
        message: 'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten',
        severity: 'error',
      })
      return
    }

    setSavingSlug(true)
    try {
      const { error } = await supabase
        .from('shops')
        .update({ slug: slugValue.toLowerCase().trim() })
        .eq('id', shop.id)

      if (error) {
        // Prüfe ob es ein Unique-Constraint-Fehler ist
        if (error.code === '23505') {
          setSnackbar({
            open: true,
            message: 'Dieser Slug wird bereits verwendet',
            severity: 'error',
          })
        } else {
          throw error
        }
        return
      }

      // Aktualisiere lokalen State
      setShop({ ...shop, slug: slugValue.toLowerCase().trim() })
      setEditingSlug(false)
      setSnackbar({
        open: true,
        message: 'Slug erfolgreich aktualisiert',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error updating slug:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Aktualisieren des Slugs',
        severity: 'error',
      })
    } finally {
      setSavingSlug(false)
    }
  }

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', params.id)
        .order('sort_index', { ascending: true })

      if (error) throw error
      setProducts(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading products:', error)
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'success'
      case 'closed':
        return 'default'
      default:
        return 'warning'
    }
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function convertISOToLocalDateTime(isoString: string | null): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    // Konvertiere zu YYYY-MM-DDTHH:mm Format für datetime-local input
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function convertLocalDateTimeToISO(localDateTime: string): string | null {
    if (!localDateTime) return null
    const date = new Date(localDateTime)
    return date.toISOString()
  }

  function handleOpenEditDialog() {
    if (shop) {
      setEditForm({
        shop_open_at: convertISOToLocalDateTime(shop.shop_open_at),
        shop_close_at: convertISOToLocalDateTime(shop.shop_close_at),
      })
      setEditDialogOpen(true)
    }
  }

  function handleCloseEditDialog() {
    setEditDialogOpen(false)
    setEditForm({
      shop_open_at: '',
      shop_close_at: '',
    })
  }

  async function handleSaveOpeningHours() {
    if (!shop) return

    setSaving(true)
    try {
      const updateData = {
        shop_open_at: convertLocalDateTimeToISO(editForm.shop_open_at),
        shop_close_at: convertLocalDateTimeToISO(editForm.shop_close_at),
      }

      const { error } = await supabase
        .from('shops')
        .update(updateData)
        .eq('id', shop.id)

      if (error) throw error

      await loadShop()
      handleCloseEditDialog()
      setSnackbar({
        open: true,
        message: 'Öffnungszeiten erfolgreich aktualisiert',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error updating opening hours:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Aktualisieren der Öffnungszeiten',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteShop() {
    if (!shop) return

    setDeleting(true)
    try {
      // Finde die school_id bevor wir den Shop löschen
      const schoolId = shop.school_id

      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shop.id)

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Shop erfolgreich gelöscht',
        severity: 'success',
      })

      // Navigiere zurück zur Schulansicht
      router.push(`/schools/${schoolId}`)
    } catch (error: any) {
      console.error('Error deleting shop:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Löschen des Shops',
        severity: 'error',
      })
      setDeleting(false)
    }
  }

  function getShopStatusInfo() {
    if (!shop) return null

    const now = new Date()
    const openAt = shop.shop_open_at ? new Date(shop.shop_open_at) : null
    const closeAt = shop.shop_close_at ? new Date(shop.shop_close_at) : null

    if (!openAt && !closeAt) {
      return { type: 'no-dates', message: 'Keine Öffnungszeiten festgelegt' }
    }

    if (openAt && now < openAt) {
      const daysUntil = Math.ceil((openAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        type: 'upcoming',
        message: `Öffnet in ${daysUntil} ${daysUntil === 1 ? 'Tag' : 'Tagen'}`,
        date: openAt,
      }
    }

    if (closeAt && now > closeAt) {
      return {
        type: 'closed',
        message: 'Shop ist geschlossen',
        date: closeAt,
      }
    }

    if (openAt && closeAt && now >= openAt && now <= closeAt) {
      const daysRemaining = Math.ceil((closeAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        type: 'open',
        message: daysRemaining > 0 ? `Läuft noch ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tage'}` : 'Läuft heute zu Ende',
        date: closeAt,
      }
    }

    return null
  }

  async function handleShopifyExport(productId: string) {
    if (!shopifyCredentials.shopDomain || !shopifyCredentials.accessToken) {
      setShopifyDialogOpen(true)
      return
    }

    setExporting(productId)
    setExportError(null)
    setExportSuccess(null)

    try {
      const response = await fetch('/api/shopify/create-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          shopId: shop?.id,
          shopDomain: shopifyCredentials.shopDomain,
          accessToken: shopifyCredentials.accessToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Exportieren')
      }

      setExportSuccess(`Produkt erfolgreich zu Shopify exportiert!`)
      setTimeout(() => setExportSuccess(null), 5000)
    } catch (error: any) {
      setExportError(error.message || 'Fehler beim Exportieren zu Shopify')
      setTimeout(() => setExportError(null), 5000)
    } finally {
      setExporting(null)
    }
  }

  async function testShopifyConnection() {
    if (!shopifyCredentials.shopDomain || !shopifyCredentials.accessToken) {
      setConnectionTestResult({
        success: false,
        message: 'Bitte füllen Sie beide Felder aus',
      })
      return
    }

    setTestingConnection(true)
    setConnectionTestResult(null)

    try {
      const response = await fetch('/api/shopify/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopDomain: shopifyCredentials.shopDomain,
          accessToken: shopifyCredentials.accessToken,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setConnectionTestResult({
          success: true,
          message: `Verbindung erfolgreich! Shop: ${data.shop.name}`,
          shopName: data.shop.name,
        })
        // Speichere Credentials bei erfolgreichem Test
        localStorage.setItem('shopify_credentials', JSON.stringify(shopifyCredentials))
      } else {
        let errorMessage = data.error || 'Verbindung fehlgeschlagen'
        
        // Erweitere Fehlermeldung mit Troubleshooting-Info falls vorhanden
        if (data.troubleshooting) {
          const troubleshooting = data.troubleshooting
          errorMessage += '\n\nMögliche Ursachen:\n'
          troubleshooting.possibleCauses?.forEach((cause: string, index: number) => {
            errorMessage += `${index + 1}. ${cause}\n`
          })
          
          if (troubleshooting.howToCreateToken) {
            errorMessage += '\nSo erstellen Sie einen Admin API Token:\n'
            Object.values(troubleshooting.howToCreateToken).forEach((step: string, index: number) => {
              errorMessage += `${index + 1}. ${step}\n`
            })
          }
          
          errorMessage += `\nAktueller Token beginnt mit: ${troubleshooting.tokenPrefix}`
          errorMessage += `\nErwartetes Format: ${troubleshooting.expectedTokenFormat}`
        }
        
        setConnectionTestResult({
          success: false,
          message: errorMessage,
        })
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || 'Fehler beim Testen der Verbindung',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  function handleShopifyDialogSubmit() {
    if (shopifyCredentials.shopDomain && shopifyCredentials.accessToken) {
      // Teste die Verbindung vor dem Speichern
      testShopifyConnection()
    }
  }

  useEffect(() => {
    // Lade gespeicherte Shopify-Credentials
    const saved = localStorage.getItem('shopify_credentials')
    if (saved) {
      try {
        setShopifyCredentials(JSON.parse(saved))
      } catch (e) {
        // Ignore
      }
    } else {
      // Fallback: Verwende Standard-Credentials falls vorhanden
      // Diese können in .env.local gesetzt werden
      const defaultDomain = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN
      const defaultToken = process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN
      
      if (defaultDomain && defaultToken) {
        setShopifyCredentials({
          shopDomain: defaultDomain,
          accessToken: defaultToken,
        })
      }
    }
  }, [])

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Lade Shop...</Typography>
      </Box>
    )
  }

  if (!shop) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Shop nicht gefunden</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <IconButton
              onClick={() => router.push(`/schools/${shop.school_id}`)}
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
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <StoreIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography 
                variant="h3" 
                component="h1"
                sx={{ 
                  fontWeight: 700,
                  mb: 0.5,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {shop.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editingSlug ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                    <TextField
                      size="small"
                      value={slugValue}
                      onChange={(e) => setSlugValue(e.target.value)}
                      sx={{
                        flexGrow: 1,
                        '& .MuiInputBase-input': {
                          textTransform: 'uppercase',
                          fontWeight: 500,
                        },
                      }}
                      disabled={savingSlug}
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleSaveSlug}
                      disabled={savingSlug}
                    >
                      {savingSlug ? <CircularProgress size={20} /> : <EditIcon />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingSlug(false)
                        setSlugValue(shop.slug)
                      }}
                      disabled={savingSlug}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        color: 'text.secondary',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {shop.slug}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setEditingSlug(true)}
                      sx={{ ml: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Link href={`/shops/${params?.id}/analytics`} style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                startIcon={<BarChartIcon />}
                sx={{ mr: 1 }}
              >
                Auswertung
              </Button>
            </Link>
            <Chip
              label={shop.status}
              color={getStatusColor(shop.status) as any}
            />
            <Tooltip title="Shop löschen">
              <IconButton
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Öffnungszeiten Info Card */}
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccessTimeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" component="h3">
                  Geplante Öffnungszeiten
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={handleOpenEditDialog}
                color="primary"
              >
                <EditIcon />
              </IconButton>
            </Box>
            {shop.shop_open_at || shop.shop_close_at ? (
              <Grid container spacing={2}>
                {shop.shop_open_at && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Öffnung
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatDateTime(shop.shop_open_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}
                {shop.shop_close_at && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Schließung
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatDateTime(shop.shop_close_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Keine Öffnungszeiten festgelegt
              </Typography>
            )}
            {(() => {
              const statusInfo = getShopStatusInfo()
              if (statusInfo && statusInfo.type !== 'no-dates') {
                return (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon 
                        fontSize="small" 
                        color={
                          statusInfo.type === 'open' 
                            ? 'success' 
                            : statusInfo.type === 'closed' 
                            ? 'error' 
                            : 'warning'
                        } 
                      />
                      <Typography
                        variant="body2"
                        color={
                          statusInfo.type === 'open'
                            ? 'success.main'
                            : statusInfo.type === 'closed'
                            ? 'error.main'
                            : 'warning.main'
                        }
                        fontWeight="medium"
                      >
                        {statusInfo.message}
                      </Typography>
                    </Box>
                  </Box>
                )
              }
              return null
            })()}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          Produkte
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Shopify Credentials konfigurieren">
            <IconButton
              color="primary"
              onClick={() => setShopifyDialogOpen(true)}
            >
              <CloudUploadIcon />
            </IconButton>
          </Tooltip>
          <Fab
            color="primary"
            size="small"
            aria-label="add"
            onClick={() => router.push(`/shops/${shop.id}/products/new`)}
          >
            <AddIcon />
          </Fab>
        </Box>
      </Box>

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      {exportSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setExportSuccess(null)}>
          {exportSuccess}
        </Alert>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                Noch keine Produkte vorhanden
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Beschreibung</TableCell>
                <TableCell>Grundpreis</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {product.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {product.base_price.toFixed(2)} {shop.currency}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.active ? 'Aktiv' : 'Inaktiv'}
                      color={product.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Tooltip title="Zu Shopify exportieren">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleShopifyExport(product.id)}
                          disabled={exporting === product.id || !product.active}
                        >
                          {exporting === product.id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <CloudUploadIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Bearbeiten">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => router.push(`/shops/${params.id}/products/${product.id}/edit`)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Shopify Credentials Dialog */}
      <Dialog open={shopifyDialogOpen} onClose={() => setShopifyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Shopify Verbindung konfigurieren
          <IconButton
            aria-label="close"
            onClick={() => setShopifyDialogOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Shop Domain"
              value={shopifyCredentials.shopDomain}
              onChange={(e) =>
                setShopifyCredentials({ ...shopifyCredentials, shopDomain: e.target.value })
              }
              placeholder="ihr-shop.myshopify.com"
              helperText="Ihre Shopify Shop-Domain (ohne https://)"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Access Token"
              type="password"
              value={shopifyCredentials.accessToken}
              onChange={(e) =>
                setShopifyCredentials({ ...shopifyCredentials, accessToken: e.target.value })
              }
              placeholder="shpat_... oder via OAuth"
              helperText="Admin API Access Token mit write_products Berechtigung"
            />
            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
              onClick={async () => {
                if (!shopifyCredentials.shopDomain) {
                  alert('Bitte geben Sie zuerst die Shop Domain ein')
                  return
                }
                // Starte OAuth Flow
                const response = await fetch(`/api/shopify/oauth?shop=${shopifyCredentials.shopDomain}`)
                const data = await response.json()
                if (data.authUrl) {
                  window.location.href = data.authUrl
                } else {
                  alert('OAuth nicht konfiguriert. Bitte verwenden Sie Client ID/Secret oder geben Sie den Access Token direkt ein.')
                }
              }}
            >
              OAuth Flow starten (mit Client ID/Secret)
            </Button>
            <Alert severity="info" sx={{ mt: 2 }}>
              Sie finden diese Informationen in Ihrem Shopify Admin unter:
              <br />
              Settings → Apps and sales channels → Develop apps → [Ihre App] → API credentials
            </Alert>

            {/* Test Ergebnis */}
            {connectionTestResult && (
              <Alert
                severity={connectionTestResult.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
                onClose={() => setConnectionTestResult(null)}
              >
                <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
                  {connectionTestResult.message}
                </Typography>
                {connectionTestResult.shopName && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      Shop-Name: <strong>{connectionTestResult.shopName}</strong>
                    </Typography>
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShopifyDialogOpen(false)}>Abbrechen</Button>
          <Button
            onClick={testShopifyConnection}
            variant="outlined"
            disabled={!shopifyCredentials.shopDomain || !shopifyCredentials.accessToken || testingConnection}
            sx={{ mr: 1 }}
          >
            {testingConnection ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Teste...
              </>
            ) : (
              'Verbindung testen'
            )}
          </Button>
          <Button
            onClick={handleShopifyDialogSubmit}
            variant="contained"
            disabled={!shopifyCredentials.shopDomain || !shopifyCredentials.accessToken || testingConnection}
          >
            Speichern & Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Opening Hours Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Öffnungszeiten bearbeiten
          <IconButton
            aria-label="close"
            onClick={handleCloseEditDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Shop-Öffnung"
                  value={editForm.shop_open_at}
                  onChange={(e) => setEditForm({ ...editForm, shop_open_at: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Shop-Schließung"
                  value={editForm.shop_close_at}
                  onChange={(e) => setEditForm({ ...editForm, shop_close_at: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSaveOpeningHours}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Shop Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Shop löschen</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie den Shop "{shop.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Alle Produkte und Bestellungen dieses Shops werden ebenfalls gelöscht.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button
            onClick={handleDeleteShop}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Lösche...' : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Container>
    </Box>
  )
}

