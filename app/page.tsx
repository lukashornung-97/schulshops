'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Container, Typography, Box, Card, CardContent, Grid, Fab, Chip, Tabs, Tab, Menu, MenuItem, IconButton } from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import AddIcon from '@mui/icons-material/Add'
import SchoolIcon from '@mui/icons-material/School'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'

type School = Database['public']['Tables']['schools']['Row']
type Shop = Database['public']['Tables']['shops']['Row']

interface SchoolWithShops extends School {
  shops: Shop[]
}

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
async function checkAndCloseExpiredShops(shops: Shop[]): Promise<void> {
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
  }
}

export default function Home() {
  const [schools, setSchools] = useState<SchoolWithShops[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<{ element: HTMLElement; schoolId: string } | null>(null)
  const router = useRouter()
  const loadingRef = useRef(false)

  useEffect(() => {
    loadSchools()
  }, [])

  async function updateSchoolStatusIfNeeded(schoolId: string, hasActiveShop: boolean) {
    try {
      // Prüfe aktuellen Status der Schule
      const { data: schoolData, error: fetchError } = await supabase
        .from('schools')
        .select('status')
        .eq('id', schoolId)
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
          .eq('id', schoolId)

        if (updateError) {
          console.error('Error updating school status:', updateError)
        }
      }
      // Wenn kein Shop aktiv ist und Schule aktuell 'active' ist, ändere nichts
      // (behalte den manuell gesetzten Status)
    } catch (error) {
      console.error('Error in updateSchoolStatusIfNeeded:', error)
    }
  }

  async function loadSchools() {
    // Verhindere mehrfache gleichzeitige Aufrufe
    if (loadingRef.current) {
      console.log('loadSchools already in progress, skipping...')
      return
    }
    
    loadingRef.current = true
    setLoading(true)
    
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

          // Prüfe und schließe abgelaufene Shops automatisch
          let finalShopsData = shopsData || []
          if (finalShopsData.length > 0) {
            await checkAndCloseExpiredShops(finalShopsData)
            // Lade Shops erneut, um die aktualisierten Status zu erhalten
            const { data: updatedShopsData } = await supabase
              .from('shops')
              .select('*')
              .eq('school_id', school.id)
              .order('created_at', { ascending: false })
            if (updatedShopsData) {
              finalShopsData = updatedShopsData
            }
          }

          // Prüfe ob ein Shop aktiv ist (wirklich live, nicht nur Status='live')
          const hasActiveShop = finalShopsData.some((shop) => isShopReallyLive(shop)) || false

          // Aktualisiere Schulstatus automatisch wenn nötig (nur wenn Status nicht manuell gesetzt wurde)
          // Vermeide unnötige Updates, die zu Re-Renders führen könnten
          if (hasActiveShop && school.status !== 'production' && school.status !== 'existing') {
            // Nur aktualisieren wenn Status noch nicht 'active' ist
            if (school.status !== 'active') {
              await updateSchoolStatusIfNeeded(school.id, true)
              school.status = 'active'
            }
          }

          return { ...school, shops: finalShopsData }
        })
      )

      setSchools(schoolsWithShops)
    } catch (error) {
      console.error('Error loading schools:', error)
      // Zeige Fehler an, falls vorhanden
      if (error instanceof Error) {
        console.error('Error details:', error.message)
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  function getShopStatus(school: SchoolWithShops) {
    const liveShop = school.shops.find((shop) => isShopReallyLive(shop))
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

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'lead':
        return 'Lead'
      case 'active':
        return 'Aktiv'
      case 'production':
        return 'Produktion'
      case 'existing':
        return 'Bestand'
      default:
        return status
    }
  }

  function getStatusColor(status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
    switch (status) {
      case 'lead':
        return 'warning'
      case 'active':
        return 'success'
      case 'production':
        return 'secondary'
      case 'existing':
        return 'info'
      default:
        return 'default'
    }
  }

  function categorizeSchools(schools: SchoolWithShops[]) {
    return {
      leads: schools.filter((s) => s.status === 'lead'),
      active: schools.filter((s) => s.status === 'active'),
      production: schools.filter((s) => s.status === 'production'),
      existing: schools.filter((s) => s.status === 'existing'),
    }
  }

  function handleStatusMenuOpen(e: React.MouseEvent<HTMLElement>, schoolId: string) {
    e.stopPropagation()
    setStatusMenuAnchor({ element: e.currentTarget, schoolId })
  }

  function handleStatusMenuClose() {
    setStatusMenuAnchor(null)
  }

  async function handleStatusChange(newStatus: 'lead' | 'active' | 'production' | 'existing') {
    if (!statusMenuAnchor) return
    
    const schoolId = statusMenuAnchor.schoolId
    
    try {
      const { error } = await supabase
        .from('schools')
        .update({ status: newStatus })
        .eq('id', schoolId)

      if (error) throw error

      // Aktualisiere lokalen State
      setSchools(schools.map(s => s.id === schoolId ? { ...s, status: newStatus } : s))
      handleStatusMenuClose()
    } catch (error) {
      console.error('Error updating school status:', error)
      alert('Fehler beim Aktualisieren des Status')
    }
  }

  function renderSchoolCard(school: SchoolWithShops) {
    const { liveShop, lastClosedShop } = getShopStatus(school)
    const timeRemaining = liveShop?.shop_close_at
      ? formatTimeRemaining(liveShop.shop_close_at)
      : null

    return (
      <Grid item xs={12} sm={6} md={4} key={school.id}>
        <Card
          sx={{ 
            cursor: 'pointer', 
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            router.push(`/schools/${school.id}`)
          }}
        >
          {/* Status indicator bar */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 
                school.status === 'active' 
                  ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                  : school.status === 'lead'
                  ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
            }}
          />
          
          <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
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
                  <SchoolIcon sx={{ color: 'white', fontSize: 24 }} />
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
                    {school.name}
                  </Typography>
                  {school.short_code && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'text.secondary',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {school.short_code}
                    </Typography>
                  )}
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => handleStatusMenuOpen(e, school.id)}
                sx={{ 
                  ml: 1,
                  '&:hover': {
                    background: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
            
            {school.city && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  📍 {school.city}
                </Typography>
              </Box>
            )}

            {/* Shop Status */}
            <Box sx={{ mt: 'auto', pt: 2 }}>
              {liveShop ? (
                <Box>
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                    label="Shop aktiv"
                    color="success"
                    size="small"
                    sx={{ 
                      mb: 1.5,
                      fontWeight: 500,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                    }}
                  />
                  {liveShop.shop_close_at && timeRemaining ? (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5,
                        p: 1.5,
                        borderRadius: 2,
                        background: 'rgba(16, 185, 129, 0.1)',
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: 16, color: '#10b981' }} />
                      <Typography variant="caption" sx={{ color: '#059669', fontWeight: 500 }}>
                        Läuft noch {timeRemaining}
                      </Typography>
                    </Box>
                  ) : liveShop.shop_close_at ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Schließt: {format(new Date(liveShop.shop_close_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              ) : lastClosedShop ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Letzter Shop geschlossen:{' '}
                    {lastClosedShop.shop_close_at
                      ? format(new Date(lastClosedShop.shop_close_at), 'dd.MM.yyyy', { locale: de })
                      : 'Unbekannt'}
                  </Typography>
                </Box>
              ) : school.shops.length > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {school.shops.length} Shop{school.shops.length !== 1 ? 's' : ''} vorhanden
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Noch keine Shops
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Box sx={{ mb: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
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
              Schulen
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verwalten Sie Ihre Schulen und Shops
            </Typography>
          </Box>
          <Fab
            color="primary"
            aria-label="add"
            onClick={() => router.push('/schools/new')}
            sx={{
              width: 56,
              height: 56,
            }}
          >
            <AddIcon />
          </Fab>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">Lade Schulen...</Typography>
          </Box>
        ) : (
          <>
            <Box 
              sx={{ 
                mb: 4,
                background: 'white',
                borderRadius: 3,
                border: '1px solid rgba(0, 0, 0, 0.05)',
                px: 2,
              }}
            >
              <Tabs 
                value={activeTab} 
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{
                  '& .MuiTab-root': {
                    minHeight: 64,
                    fontSize: '0.9375rem',
                  },
                }}
              >
                <Tab label={`Leads (${categorizeSchools(schools).leads.length})`} />
                <Tab label={`Aktiv (${categorizeSchools(schools).active.length})`} />
                <Tab label={`Produktion (${categorizeSchools(schools).production.length})`} />
                <Tab label={`Bestand (${categorizeSchools(schools).existing.length})`} />
              </Tabs>
            </Box>

            {(() => {
              const categorized = categorizeSchools(schools)
              let schoolsToShow: SchoolWithShops[] = []

              switch (activeTab) {
                case 0:
                  schoolsToShow = categorized.leads
                  break
                case 1:
                  schoolsToShow = categorized.active
                  break
                case 2:
                  schoolsToShow = categorized.production
                  break
                case 3:
                  schoolsToShow = categorized.existing
                  break
                default:
                  schoolsToShow = []
              }

              if (schoolsToShow.length === 0) {
                return (
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
                          <SchoolIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                        </Box>
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                          {activeTab === 0 && 'Keine Leads vorhanden'}
                          {activeTab === 1 && 'Keine aktiven Schulen vorhanden'}
                          {activeTab === 2 && 'Keine Schulen in Produktion vorhanden'}
                          {activeTab === 3 && 'Keine Bestandsschulen vorhanden'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activeTab === 0 && 'Erstellen Sie eine neue Schule, um zu beginnen.'}
                          {activeTab === 1 && 'Aktive Schulen werden hier angezeigt.'}
                          {activeTab === 2 && 'Schulen in Produktion werden hier angezeigt.'}
                          {activeTab === 3 && 'Bestandsschulen werden hier angezeigt.'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                )
              }

              return <Grid container spacing={3}>{schoolsToShow.map(renderSchoolCard)}</Grid>
            })()}
          </>
        )}

        {/* Status Menu */}
        <Menu
          anchorEl={statusMenuAnchor?.element || null}
          open={Boolean(statusMenuAnchor)}
          onClose={handleStatusMenuClose}
        >
          <MenuItem onClick={() => handleStatusChange('lead')}>
            Lead
          </MenuItem>
          <MenuItem onClick={() => handleStatusChange('active')}>
            Aktiv
          </MenuItem>
          <MenuItem onClick={() => handleStatusChange('production')}>
            Produktion
          </MenuItem>
          <MenuItem onClick={() => handleStatusChange('existing')}>
            Bestand
          </MenuItem>
        </Menu>
      </Container>
    </Box>
  )
}

