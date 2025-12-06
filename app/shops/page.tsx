'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import StoreIcon from '@mui/icons-material/Store'

type Shop = Database['public']['Tables']['shops']['Row']

// Funktion: Prüft und schließt Shops automatisch, deren shop_close_at in der Vergangenheit liegt
async function checkAndCloseExpiredShops(shops: Shop[]): Promise<Shop[]> {
  const now = new Date()
  const shopsToClose = shops.filter(
    (shop) => shop.status === 'live' && shop.shop_close_at && new Date(shop.shop_close_at) < now
  )

  if (shopsToClose.length > 0) {
    // Schließe alle abgelaufenen Shops
    await Promise.all(
      shopsToClose.map(async (shop) => {
        const { error } = await supabase
          .from('shops')
          .update({ status: 'closed' })
          .eq('id', shop.id)

        if (error) {
          console.error(`Error closing shop ${shop.id}:`, error)
        }
      })
    )
    
    // Lade Shops erneut, um die aktualisierten Status zu erhalten
    const { data: updatedShops } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false })
    
    return updatedShops || shops
  }
  
  return shops
}

export default function ShopsPage() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadShops()
  }, [])

  async function loadShops() {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Prüfe und schließe abgelaufene Shops automatisch
      const updatedShops = await checkAndCloseExpiredShops(data || [])
      setShops(updatedShops)
    } catch (error) {
      console.error('Error loading shops:', error)
    } finally {
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
            Alle Shops
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Verwalten Sie alle Ihre Shops
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">Lade Shops...</Typography>
          </Box>
        ) : shops.length === 0 ? (
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
                  <StoreIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Noch keine Shops vorhanden
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {shops.map((shop) => (
              <Grid item xs={12} sm={6} md={4} key={shop.id}>
                <Card
                  sx={{ 
                    cursor: 'pointer', 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  }}
                  onClick={() => router.push(`/shops/${shop.id}`)}
                >
                  <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
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
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h6" 
                          component="h2"
                          sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {shop.name}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {shop.slug}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 'auto' }}>
                      <Chip
                        label={shop.status}
                        color={getStatusColor(shop.status) as any}
                        size="small"
                        sx={{ 
                          fontWeight: 500,
                          background: shop.status === 'live' 
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : shop.status === 'closed'
                            ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: 'white',
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  )
}

