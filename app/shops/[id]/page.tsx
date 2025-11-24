'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type Shop = Database['public']['Tables']['shops']['Row']
type Product = Database['public']['Tables']['products']['Row']

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

  useEffect(() => {
    if (params.id) {
      loadShop()
      loadProducts()
    }
  }, [params.id])

  async function loadShop() {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setShop(data)
    } catch (error) {
      console.error('Error loading shop:', error)
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Lade Shop...</Typography>
      </Container>
    )
  }

  if (!shop) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Shop nicht gefunden</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StoreIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1">
              {shop.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {shop.slug}
            </Typography>
          </Box>
          <Chip
            label={shop.status}
            color={getStatusColor(shop.status) as any}
          />
        </Box>
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
                      <Button
                        size="small"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        Öffnen
                      </Button>
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
    </Container>
  )
}

