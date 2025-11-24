'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Grid,
  MenuItem,
} from '@mui/material'
import { supabase } from '@/lib/supabase'

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('shops').insert([
        {
          ...formData,
          school_id: params.id,
          shop_open_at: formData.shop_open_at || null,
          shop_close_at: formData.shop_close_at || null,
        },
      ])

      if (error) throw error

      router.push(`/schools/${params.id}`)
    } catch (error) {
      console.error('Error creating shop:', error)
      alert('Fehler beim Erstellen des Shops')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Neuen Shop erstellen
      </Typography>

      <Paper sx={{ p: 4, mt: 3 }}>
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
      </Paper>
    </Container>
  )
}

