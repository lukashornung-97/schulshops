'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Divider,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import StoreIcon from '@mui/icons-material/Store'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'

type Order = Database['public']['Tables']['orders']['Row']
type Shop = Database['public']['Tables']['shops']['Row']

interface OrderWithShop extends Order {
  shop: Shop | null
}

type OrderGroup = {
  shopOpenAt: string | null
  shopCloseAt: string | null
  shopName: string
  shopId: string
  shopSlug: string
  orders: OrderWithShop[]
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithShop[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('grouped')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      // Load orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Load all shops
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, slug, shop_open_at, shop_close_at, status')

      if (shopsError) throw shopsError

      // Create a map of shops by id
      const shopsMap = new Map((shopsData || []).map(shop => [shop.id, shop]))

      // Combine orders with their shops
      const ordersWithShop = (ordersData || []).map(order => ({
        ...order,
        shop: shopsMap.get(order.shop_id) || null,
      }))
      
      setOrders(ordersWithShop)
    } catch (error) {
      console.error('Error loading orders:', error)
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

  function groupOrdersBySlugAndOpeningTimes(): OrderGroup[] {
    const groups = new Map<string, OrderGroup>()
    const shopsBySlug = new Map<string, Shop>()

    // First pass: collect shops by slug and determine the representative shop for each slug
    // (prefer shops with opening times set)
    orders.forEach(order => {
      const shop = order.shop
      if (!shop || !shop.slug) {
        return
      }

      const slug = shop.slug
      const existingShop = shopsBySlug.get(slug)
      
      // Prefer shops with opening times set, or keep the first one
      if (!existingShop || 
          (!existingShop.shop_open_at && shop.shop_open_at) ||
          (!existingShop.shop_close_at && shop.shop_close_at)) {
        shopsBySlug.set(slug, shop)
      }
    })

    // Second pass: group orders by slug and filter by opening times
    orders.forEach(order => {
      const shop = order.shop
      if (!shop || !shop.slug) {
        // Orders without shop go into a special group
        const key = 'no-shop'
        if (!groups.has(key)) {
          groups.set(key, {
            shopOpenAt: null,
            shopCloseAt: null,
            shopName: 'Kein Shop zugeordnet',
            shopId: '',
            shopSlug: '',
            orders: [],
          })
        }
        groups.get(key)!.orders.push(order)
        return
      }

      const slug = shop.slug
      
      // Filter: only include orders from shops that have opening times set
      const hasOpeningTimes = shop.shop_open_at || shop.shop_close_at
      if (!hasOpeningTimes) {
        // Skip orders from shops without opening times
        return
      }
      
      if (!groups.has(slug)) {
        // Use the representative shop for this slug group
        const representativeShop = shopsBySlug.get(slug) || shop
        groups.set(slug, {
          shopOpenAt: representativeShop.shop_open_at,
          shopCloseAt: representativeShop.shop_close_at,
          shopName: representativeShop.name,
          shopId: representativeShop.id,
          shopSlug: slug,
          orders: [],
        })
      }
      groups.get(slug)!.orders.push(order)
    })

    // Sort groups by opening time (earliest first), then by slug
    return Array.from(groups.values()).sort((a, b) => {
      // First sort by opening time
      if (a.shopOpenAt && b.shopOpenAt) {
        const timeDiff = new Date(a.shopOpenAt).getTime() - new Date(b.shopOpenAt).getTime()
        if (timeDiff !== 0) return timeDiff
      } else if (a.shopOpenAt && !b.shopOpenAt) {
        return -1
      } else if (!a.shopOpenAt && b.shopOpenAt) {
        return 1
      }
      // If opening times are equal or both null, sort by slug
      return a.shopSlug.localeCompare(b.shopSlug)
    })
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

  function getOpeningTimeStatus(group: OrderGroup): { label: string; color: 'success' | 'warning' | 'error' | 'info' } {
    if (!group.shopOpenAt && !group.shopCloseAt) {
      return { label: 'Keine Öffnungszeiten', color: 'info' }
    }

    const now = new Date()
    const openAt = group.shopOpenAt ? new Date(group.shopOpenAt) : null
    const closeAt = group.shopCloseAt ? new Date(group.shopCloseAt) : null

    if (openAt && now < openAt) {
      return { label: 'Noch nicht geöffnet', color: 'warning' }
    }

    if (closeAt && now > closeAt) {
      return { label: 'Geschlossen', color: 'error' }
    }

    if (openAt && closeAt && now >= openAt && now <= closeAt) {
      return { label: 'Aktuell geöffnet', color: 'success' }
    }

    return { label: 'Unbekannt', color: 'info' }
  }

  const orderGroups = groupOrdersBySlugAndOpeningTimes()

  function renderOrderRow(order: OrderWithShop) {
    return (
      <TableRow 
        key={order.id}
        sx={{
          '&:hover': {
            background: '#f8fafc',
          },
          transition: 'background 0.2s ease-in-out',
        }}
      >
        <TableCell sx={{ py: 2.5 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            {order.id.substring(0, 8)}...
          </Typography>
        </TableCell>
        <TableCell sx={{ py: 2.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {order.customer_name}
          </Typography>
        </TableCell>
        <TableCell sx={{ py: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            {order.customer_email || '-'}
          </Typography>
        </TableCell>
        <TableCell sx={{ py: 2.5 }}>{order.class_name || '-'}</TableCell>
        <TableCell sx={{ py: 2.5 }}>
          <Chip
            label={order.status}
            color={getStatusColor(order.status) as any}
            size="small"
            sx={{ 
              fontWeight: 500,
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
        </TableCell>
        <TableCell sx={{ py: 2.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {order.total_amount.toFixed(2)} €
          </Typography>
        </TableCell>
        <TableCell sx={{ py: 2.5 }}>
          {new Date(order.created_at).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </TableCell>
        <TableCell align="right" sx={{ py: 2.5 }}>
          <Button
            size="small"
            onClick={() => router.push(`/orders/${order.id}`)}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
            }}
          >
            Details
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Box sx={{ mb: 5 }}>
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
            Bestellübersicht
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Übersicht aller Bestellungen nach Shop-Öffnungszeiten
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">Lade Bestellungen...</Typography>
          </Box>
        ) : orders.length === 0 ? (
          <Card sx={{ background: 'white' }}>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  <ShoppingCartIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Noch keine Bestellungen vorhanden
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <>
            <Box sx={{ mb: 3 }}>
              <Tabs 
                value={viewMode} 
                onChange={(_, newValue) => setViewMode(newValue)}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 500,
                  },
                }}
              >
                <Tab label="Nach Öffnungszeiten gruppiert" value="grouped" />
                <Tab label="Alle Bestellungen" value="all" />
              </Tabs>
            </Box>

            {viewMode === 'grouped' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {orderGroups.map((group, index) => {
                  const status = getOpeningTimeStatus(group)
                  const totalAmount = group.orders.reduce((sum, order) => sum + order.total_amount, 0)
                  
                  return (
                    <Accordion 
                      key={`${group.shopSlug}-${index}`}
                      defaultExpanded={index === 0}
                      sx={{
                        '&:before': { display: 'none' },
                        boxShadow: 2,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          px: 3,
                          py: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <StoreIcon sx={{ color: 'white', fontSize: 24 }} />
                          </Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {group.shopName}
                            </Typography>
                            {group.shopSlug && (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'text.secondary',
                                  fontWeight: 500,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  mb: 0.5,
                                  display: 'block',
                                }}
                              >
                                {group.shopSlug}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTimeIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  {formatDateTime(group.shopOpenAt)} - {formatDateTime(group.shopCloseAt)}
                                </Typography>
                              </Box>
                              <Chip
                                label={status.label}
                                color={status.color}
                                size="small"
                                sx={{ fontWeight: 500 }}
                              />
                            </Box>
                          </Box>
                          <Box sx={{ textAlign: 'right', mr: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {group.orders.length} {group.orders.length === 1 ? 'Bestellung' : 'Bestellungen'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {totalAmount.toFixed(2)} € gesamt
                            </Typography>
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow sx={{ background: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Order-ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Kunde</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>E-Mail</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Klasse</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Betrag</TableCell>
                                <TableCell sx={{ fontWeight: 600, py: 2 }}>Datum</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Aktionen</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {group.orders.map(renderOrderRow)}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )
                })}
              </Box>
            ) : (
              <Card sx={{ background: 'white', overflow: 'hidden' }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Order-ID</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Shop</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Kunde</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>E-Mail</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Klasse</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Betrag</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Datum</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Aktionen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell sx={{ py: 2.5 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                              }}
                            >
                              {order.id.substring(0, 8)}...
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {order.shop?.name || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {order.customer_name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              {order.customer_email || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>{order.class_name || '-'}</TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            <Chip
                              label={order.status}
                              color={getStatusColor(order.status) as any}
                              size="small"
                              sx={{ 
                                fontWeight: 500,
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
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {order.total_amount.toFixed(2)} €
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2.5 }}>
                            {new Date(order.created_at).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 2.5 }}>
                            <Button
                              size="small"
                              onClick={() => router.push(`/orders/${order.id}`)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 500,
                                borderRadius: 2,
                              }}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            )}
          </>
        )}
      </Container>
    </Box>
  )
}

