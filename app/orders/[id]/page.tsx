'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Grid,
  Divider,
  Paper,
  IconButton,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PersonIcon from '@mui/icons-material/Person'
import EmailIcon from '@mui/icons-material/Email'
import StoreIcon from '@mui/icons-material/Store'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ProductVariant = Database['public']['Tables']['product_variants']['Row']
type Shop = Database['public']['Tables']['shops']['Row']

interface OrderItemWithProduct extends OrderItem {
  product?: Product
  variant?: ProductVariant | null
  size?: string | null
  color?: string | null
}

interface OrderWithDetails extends Order {
  shop?: Shop | null
  items?: OrderItemWithProduct[]
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadOrder()
    }
  }, [params.id])

  async function loadOrder() {
    try {
      // Load order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', params.id)
        .single()

      if (orderError) throw orderError
      if (!orderData) {
        setLoading(false)
        return
      }

      // Load shop
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', orderData.shop_id)
        .single()

      // Load order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderData.id)

      if (itemsError) {
        console.error('Error loading order items:', itemsError)
      }

      if (itemsData && itemsData.length > 0) {
        console.log(`Loading ${itemsData.length} order items for order ${orderData.id}`)
        
        // Load products
        const productIds = Array.from(new Set(itemsData.map(item => item.product_id)))
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds)

        if (productsError) {
          console.error('Error loading products:', productsError)
        }

        // Load variants
        const variantIds = itemsData
          .map(item => item.variant_id)
          .filter((id): id is string => id !== null)
        const { data: variantsData, error: variantsError } = variantIds.length > 0
          ? await supabase
              .from('product_variants')
              .select('*')
              .in('id', variantIds)
          : { data: null, error: null }

        if (variantsError) {
          console.error('Error loading variants:', variantsError)
        }

        // Lade auch alle Varianten für die Produkte, um Größe und Farbe zu finden
        const { data: allVariantsData } = productIds.length > 0
          ? await supabase
              .from('product_variants')
              .select('*')
              .in('product_id', productIds)
              .eq('active', true)
          : { data: null }

        const productsMap = new Map(productsData?.map(p => [p.id, p]) || [])
        const variantsMap = new Map(variantsData?.map(v => [v.id, v]) || [])
        
        // Erstelle Maps für Größen- und Farb-Varianten pro Produkt
        const sizeVariantsMap = new Map<string, ProductVariant[]>()
        const colorVariantsMap = new Map<string, ProductVariant[]>()
        
        allVariantsData?.forEach(v => {
          if (v.name && v.name.trim() && !v.color_name) {
            // Größen-Variante
            const key = v.product_id
            if (!sizeVariantsMap.has(key)) {
              sizeVariantsMap.set(key, [])
            }
            sizeVariantsMap.get(key)!.push(v)
          }
          if (v.color_name && v.color_name.trim()) {
            // Farb-Variante
            const key = v.product_id
            if (!colorVariantsMap.has(key)) {
              colorVariantsMap.set(key, [])
            }
            colorVariantsMap.get(key)!.push(v)
          }
        })

        // Combine items with products and variants
        const itemsWithProducts: OrderItemWithProduct[] = itemsData.map(item => {
          const product = productsMap.get(item.product_id)
          const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
          
          // Finde Größe und Farbe basierend auf der Variante
          let size: string | null = null
          let color: string | null = null
          
          if (variant) {
            // Kombinations-Variante: name enthält Größe, color_name enthält Farbe
            if (variant.name && variant.name.trim() && variant.color_name && variant.color_name.trim()) {
              size = variant.name
              color = variant.color_name
            }
            // Prüfe ob Variante im Format "Größe / Farbe" im name-Feld gespeichert ist (Fallback für alte Daten)
            else if (variant.name && variant.name.includes('/')) {
              // Parse Format "Größe / Farbe" - splitte am "/"
              const parts = variant.name.split('/').map(s => s.trim())
              if (parts.length >= 2) {
                size = parts[0] || null
                color = parts[1] || null
              } else if (parts.length === 1) {
                // Nur ein Teil vorhanden - prüfe ob es Größe oder Farbe ist
                const singleValue = parts[0]
                if (/^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i.test(singleValue)) {
                  size = singleValue
                } else {
                  color = singleValue
                }
              }
            } else if (variant.name && variant.name.trim() && !variant.color_name) {
              // Es ist eine reine Größen-Variante
              size = variant.name
            } else if (variant.color_name && variant.color_name.trim()) {
              // Es ist eine Farb-Variante
              color = variant.color_name
            }
          }
          
          // Versuche die fehlende Variante zu finden, falls nur eine vorhanden ist
          if (size && !color) {
            // Wir haben eine Größe, versuche eine Farbe zu finden
            const colorVariants = colorVariantsMap.get(item.product_id) || []
            if (colorVariants.length === 1) {
              // Nur eine Farbe verfügbar - verwende diese
              color = colorVariants[0].color_name || null
            }
          } else if (color && !size) {
            // Wir haben eine Farbe, versuche eine Größe zu finden
            const sizeVariants = sizeVariantsMap.get(item.product_id) || []
            if (sizeVariants.length === 1) {
              // Nur eine Größe verfügbar - verwende diese
              size = sizeVariants[0].name || null
            }
          }
          
          if (!product) {
            console.warn(`Product not found for order item ${item.id}: product_id=${item.product_id}`)
          }
          
          return {
            ...item,
            product,
            variant,
            size,
            color,
          }
        })

        console.log(`Loaded ${itemsWithProducts.length} items with product info`)

        setOrder({
          ...orderData,
          shop: shopData || null,
          items: itemsWithProducts,
        })
      } else {
        console.warn(`No order items found for order ${orderData.id}`)
        setOrder({
          ...orderData,
          shop: shopData || null,
          items: [],
        })
      }
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'cancelled':
        return 'error'
      case 'fulfilled':
        return 'info'
      default:
        return 'warning'
    }
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return 'Nicht festgelegt'
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Lade Bestellung...</Typography>
      </Box>
    )
  }

  if (!order) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Bestellung nicht gefunden
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/orders')}
          >
            Zurück zur Übersicht
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      
      <Container maxWidth="xl" sx={{ py: 6 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => router.push('/orders')}
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
              Bestelldetails
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {order.id}
            </Typography>
          </Box>
          <Chip
            label={order.status}
            color={getStatusColor(order.status) as any}
            sx={{ 
              fontWeight: 600,
              fontSize: '0.875rem',
              height: 32,
              background: order.status === 'paid'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : order.status === 'cancelled'
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : order.status === 'fulfilled'
                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
            }}
          />
        </Box>

        <Grid container spacing={3}>
          {/* Customer Information */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Kundeninformationen
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {order.customer_name}
                    </Typography>
                  </Box>
                  {order.customer_email && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        E-Mail
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body1">
                          {order.customer_email}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {order.class_name && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Klasse
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                        {order.class_name}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Order Information */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ShoppingCartIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Bestellinformationen
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {order.shop && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Shop
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <StoreIcon fontSize="small" color="action" />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {order.shop.name}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Bestelldatum
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <CalendarTodayIcon fontSize="small" color="action" />
                      <Typography variant="body1">
                        {formatDateTime(order.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Anzahl Artikel
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {order.items?.length || 0} Artikel
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Total Amount */}
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="caption" sx={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Gesamtbetrag
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                  {order.total_amount.toFixed(2)} €
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Order Items */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Bestellpositionen
            </Typography>
            {order.items && order.items.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Produkt</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Größe</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Farbe</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Menge</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Einzelpreis</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Gesamtpreis</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {item.product?.name || 'Unbekanntes Produkt'}
                          </Typography>
                          {item.product?.description && (
                            <Typography variant="caption" color="text.secondary">
                              {item.product.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.size ? (
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {item.size}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.color ? (
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {item.color}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1">
                            {item.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1">
                            {item.unit_price.toFixed(2)} €
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {item.line_total.toFixed(2)} €
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ background: '#f8fafc' }}>
                      <TableCell colSpan={5} align="right" sx={{ fontWeight: 600, py: 2 }}>
                        Gesamtbetrag:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, py: 2, fontSize: '1.1rem' }}>
                        {order.total_amount.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  Keine Artikel in dieser Bestellung
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

