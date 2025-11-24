'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

type Order = Database['public']['Tables']['orders']['Row']

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <ShoppingCartIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Bestellungen
        </Typography>
      </Box>

      {loading ? (
        <Typography>Lade Bestellungen...</Typography>
      ) : orders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCartIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Noch keine Bestellungen vorhanden
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kunde</TableCell>
                <TableCell>E-Mail</TableCell>
                <TableCell>Klasse</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Betrag</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {order.customer_email || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{order.class_name || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={order.status}
                      color={getStatusColor(order.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {order.total_amount.toFixed(2)} €
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString('de-DE')}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}

