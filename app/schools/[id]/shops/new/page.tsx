'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Card,
  Grid,
  MenuItem,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type Shop = Database['public']['Tables']['shops']['Row']

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

export default function NewShop() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'draft' as 'draft' | 'live' | 'closed',
    currency: 'EUR',
    shop_open_at: '',
    shop_close_at: '',
  })

  function convertLocalDateTimeToISO(localDateTime: string): string | null {
    if (!localDateTime) return null
    // datetime-local gibt Format zurück: "YYYY-MM-DDTHH:mm"
    // Wir müssen es zu ISO-8601 mit Zeitzone konvertieren
    // Erstelle ein Date-Objekt aus dem lokalen Datum/Zeit
    const date = new Date(localDateTime)
    // Konvertiere zu ISO-String (enthält Zeitzone)
    return date.toISOString()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const shopData = {
        name: formData.name,
        slug: formData.slug,
        status: formData.status,
        currency: formData.currency,
        school_id: params.id as string,
        shop_open_at: convertLocalDateTimeToISO(formData.shop_open_at),
        shop_close_at: convertLocalDateTimeToISO(formData.shop_close_at),
      }

      console.log('Saving shop data:', shopData)
      console.log('shop_open_at:', shopData.shop_open_at)
      console.log('shop_close_at:', shopData.shop_close_at)

      const { data, error } = await supabase.from('shops').insert([shopData]).select()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Shop created successfully:', data)

      // Wenn der Shop wirklich 'live' ist (Status 'live' UND shop_close_at nicht in der Vergangenheit),
      // setze die Schule auf 'active'
      if (data && data[0] && isShopReallyLive(data[0])) {
        try {
          await supabase
            .from('schools')
            .update({ status: 'active' })
            .eq('id', params.id)
        } catch (statusError) {
          console.error('Error updating school status:', statusError)
          // Fehler beim Status-Update sollte nicht das Erstellen des Shops verhindern
        }
      }

      router.push(`/schools/${params.id}`)
    } catch (error) {
      console.error('Error creating shop:', error)
      alert(`Fehler beim Erstellen des Shops: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="md" sx={{ py: 6 }}>
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
          Neuen Shop erstellen
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Erstellen Sie einen neuen Shop für diese Schule
        </Typography>

        <Card sx={{ background: 'white', p: 4 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Shop-Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Slug *"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="z.B. abitur-2026-gsg-hh"
                required
                helperText="Eindeutiger Identifier für den Shop"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="live">Live</MenuItem>
                <MenuItem value="closed">Geschlossen</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Währung"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Shop-Öffnung"
                value={formData.shop_open_at}
                onChange={(e) => setFormData({ ...formData, shop_open_at: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Shop-Schließung"
                value={formData.shop_close_at}
                onChange={(e) => setFormData({ ...formData, shop_close_at: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !formData.name || !formData.slug}
                >
                  {loading ? 'Wird erstellt...' : 'Erstellen'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
        </Card>
      </Container>
    </Box>
  )
}

