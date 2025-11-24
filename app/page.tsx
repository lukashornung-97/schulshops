'use client'

import { useEffect, useState } from 'react'
import { Container, Typography, Box, Card, CardContent, Grid, Fab, Chip } from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import AddIcon from '@mui/icons-material/Add'
import SchoolIcon from '@mui/icons-material/School'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale/de'

type School = Database['public']['Tables']['schools']['Row']
type Shop = Database['public']['Tables']['shops']['Row']

interface SchoolWithShops extends School {
  shops: Shop[]
}

export default function Home() {
  const [schools, setSchools] = useState<SchoolWithShops[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadSchools()
  }, [])

  async function loadSchools() {
    try {
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false })

      if (schoolsError) throw schoolsError

      // Lade Shops für jede Schule
      const schoolsWithShops = await Promise.all(
        (schoolsData || []).map(async (school) => {
          const { data: shopsData, error: shopsError } = await supabase
            .from('shops')
            .select('*')
            .eq('school_id', school.id)
            .order('created_at', { ascending: false })

          if (shopsError) {
            console.error('Error loading shops for school:', school.id, shopsError)
            return { ...school, shops: [] }
          }

          return { ...school, shops: shopsData || [] }
        })
      )

      setSchools(schoolsWithShops)
    } catch (error) {
      console.error('Error loading schools:', error)
    } finally {
      setLoading(false)
    }
  }

  function getShopStatus(school: SchoolWithShops) {
    const liveShop = school.shops.find((shop) => shop.status === 'live')
    const closedShops = school.shops
      .filter((shop) => shop.status === 'closed' && shop.shop_close_at)
      .sort((a, b) => {
        const dateA = a.shop_close_at ? new Date(a.shop_close_at).getTime() : 0
        const dateB = b.shop_close_at ? new Date(b.shop_close_at).getTime() : 0
        return dateB - dateA
      })

    return { liveShop, lastClosedShop: closedShops[0] || null }
  }

  function formatTimeRemaining(closeDate: string | null) {
    if (!closeDate) return null
    const close = new Date(closeDate)
    const now = new Date()

    if (close < now) return null

    const distance = formatDistanceToNow(close, { addSuffix: true, locale: de })
    return distance
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Schulen
        </Typography>
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => router.push('/schools/new')}
        >
          <AddIcon />
        </Fab>
      </Box>

      {loading ? (
        <Typography>Lade Schulen...</Typography>
      ) : schools.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SchoolIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Noch keine Schulen vorhanden
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Erstellen Sie Ihre erste Schule, um zu beginnen.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {schools.map((school) => {
            const { liveShop, lastClosedShop } = getShopStatus(school)
            const timeRemaining = liveShop?.shop_close_at
              ? formatTimeRemaining(liveShop.shop_close_at)
              : null

            return (
              <Grid item xs={12} sm={6} md={4} key={school.id}>
                <Card
                  sx={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => router.push(`/schools/${school.id}`)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <SchoolIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" component="h2">
                        {school.name}
                      </Typography>
                    </Box>
                    {school.short_code && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Code: {school.short_code}
                      </Typography>
                    )}
                    {school.city && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {school.city}
                      </Typography>
                    )}

                    {/* Shop Status */}
                    <Box sx={{ mt: 2 }}>
                      {liveShop ? (
                        <Box>
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Shop aktiv"
                            color="success"
                            size="small"
                            sx={{ mb: 1 }}
                          />
                          {liveShop.shop_close_at && timeRemaining ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                Läuft noch {timeRemaining}
                              </Typography>
                            </Box>
                          ) : liveShop.shop_close_at ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Schließt: {format(new Date(liveShop.shop_close_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                              </Typography>
                            </Box>
                          ) : null}
                        </Box>
                      ) : lastClosedShop ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Letzter Shop geschlossen:{' '}
                            {lastClosedShop.shop_close_at
                              ? format(new Date(lastClosedShop.shop_close_at), 'dd.MM.yyyy', { locale: de })
                              : 'Unbekannt'}
                          </Typography>
                        </Box>
                      ) : school.shops.length > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          {school.shops.length} Shop(s) vorhanden
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Noch keine Shops
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Container>
  )
}

