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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import AddIcon from '@mui/icons-material/Add'
import StoreIcon from '@mui/icons-material/Store'
import SchoolIcon from '@mui/icons-material/School'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import PersonIcon from '@mui/icons-material/Person'

type School = Database['public']['Tables']['schools']['Row']
type Shop = Database['public']['Tables']['shops']['Row']
type SchoolContact = Database['public']['Tables']['school_contacts']['Row']

export default function SchoolDetail() {
  const params = useParams()
  const router = useRouter()
  const [school, setSchool] = useState<School | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [contacts, setContacts] = useState<SchoolContact[]>([])
  const [loading, setLoading] = useState(true)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<SchoolContact | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    title: '',
    role: '',
    email: '',
    phone: '',
    mobile: '',
    notes: '',
  })

  useEffect(() => {
    if (params.id) {
      loadSchool()
      loadShops()
      loadContacts()
    }
  }, [params.id])

  async function loadSchool() {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setSchool(data)
    } catch (error) {
      console.error('Error loading school:', error)
    }
  }

  async function loadShops() {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('school_id', params.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setShops(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading shops:', error)
      setLoading(false)
    }
  }

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('school_contacts')
        .select('*')
        .eq('school_id', params.id)
        .order('last_name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  function handleOpenContactDialog(contact?: SchoolContact) {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title || '',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        notes: contact.notes || '',
      })
    } else {
      setEditingContact(null)
      setContactForm({
        first_name: '',
        last_name: '',
        title: '',
        role: '',
        email: '',
        phone: '',
        mobile: '',
        notes: '',
      })
    }
    setContactDialogOpen(true)
  }

  function handleCloseContactDialog() {
    setContactDialogOpen(false)
    setEditingContact(null)
    setContactForm({
      first_name: '',
      last_name: '',
      title: '',
      role: '',
      email: '',
      phone: '',
      mobile: '',
      notes: '',
    })
  }

  async function handleSaveContact() {
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      setSnackbar({
        open: true,
        message: 'Bitte geben Sie Vor- und Nachname ein',
        severity: 'error',
      })
      return
    }

    setSavingContact(true)
    try {
      const contactData = {
        first_name: contactForm.first_name.trim(),
        last_name: contactForm.last_name.trim(),
        title: contactForm.title.trim() || null,
        role: contactForm.role || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        mobile: contactForm.mobile.trim() || null,
        notes: contactForm.notes.trim() || null,
      }

      if (editingContact) {
        const { data, error } = await supabase
          .from('school_contacts')
          .update(contactData)
          .eq('id', editingContact.id)
          .select()

        if (error) {
          console.error('Supabase update error:', error)
          throw new Error(error.message || 'Fehler beim Aktualisieren des Kontakts')
        }
        
        setSnackbar({
          open: true,
          message: 'Kontakt erfolgreich aktualisiert',
          severity: 'success',
        })
      } else {
        const { data, error } = await supabase
          .from('school_contacts')
          .insert([{ ...contactData, school_id: params.id as string }])
          .select()

        if (error) {
          console.error('Supabase insert error:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          throw new Error(error.message || 'Fehler beim Erstellen des Kontakts')
        }
        
        setSnackbar({
          open: true,
          message: 'Kontakt erfolgreich hinzugefügt',
          severity: 'success',
        })
      }

      await loadContacts()
      handleCloseContactDialog()
    } catch (error: any) {
      console.error('Error saving contact:', error)
      const errorMessage = error?.message || 'Unbekannter Fehler beim Speichern des Kontakts'
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      })
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('school_contacts')
        .delete()
        .eq('id', contactId)

      if (error) {
        console.error('Supabase delete error:', error)
        throw new Error(error.message || 'Fehler beim Löschen des Kontakts')
      }
      
      await loadContacts()
      setSnackbar({
        open: true,
        message: 'Kontakt erfolgreich gelöscht',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Löschen des Kontakts',
        severity: 'error',
      })
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Lade Schule...</Typography>
      </Container>
    )
  }

  if (!school) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Schule nicht gefunden</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SchoolIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1">
              {school.name}
            </Typography>
            {school.short_code && (
              <Typography variant="body1" color="text.secondary">
                {school.short_code}
              </Typography>
            )}
          </Box>
        </Box>
        {school.city && (
          <Typography variant="body2" color="text.secondary">
            {school.city}, {school.country}
          </Typography>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Shops Spalte */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StoreIcon color="primary" />
                  <Typography variant="h5" component="h2">
                    Shops
                  </Typography>
                </Box>
                <Fab
                  color="primary"
                  size="small"
                  aria-label="add shop"
                  onClick={() => router.push(`/schools/${school.id}/shops/new`)}
                >
                  <AddIcon />
                </Fab>
              </Box>

              {shops.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Noch keine Shops vorhanden
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => router.push(`/schools/${school.id}/shops/new`)}
                    sx={{ mt: 2 }}
                  >
                    Ersten Shop erstellen
                  </Button>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Aktionen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shops.map((shop) => (
                        <TableRow
                          key={shop.id}
                          sx={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/shops/${shop.id}`)}
                          hover
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {shop.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {shop.slug}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={shop.status}
                              color={getStatusColor(shop.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/shops/${shop.id}`)
                              }}
                            >
                              Öffnen
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* CRM Spalte */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ContactMailIcon color="primary" />
                  <Typography variant="h5" component="h2">
                    Ansprechpartner & Kontaktdaten
                  </Typography>
                </Box>
                <Fab
                  color="primary"
                  size="small"
                  aria-label="add contact"
                  onClick={() => handleOpenContactDialog()}
                >
                  <AddIcon />
                </Fab>
              </Box>

              {contacts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ContactMailIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Noch keine Kontakte vorhanden
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenContactDialog()}
                    sx={{ mt: 2 }}
                  >
                    Ersten Kontakt hinzufügen
                  </Button>
                </Box>
              ) : (
                <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Grid container spacing={2}>
                    {contacts.map((contact) => (
                      <Grid item xs={12} key={contact.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                <PersonIcon color="primary" />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="medium">
                                    {contact.first_name} {contact.last_name}
                                  </Typography>
                                  {contact.title && (
                                    <Typography variant="body2" color="text.secondary">
                                      {contact.title}
                                    </Typography>
                                  )}
                                  {contact.role && (
                                    <Chip label={contact.role} size="small" sx={{ mt: 0.5 }} />
                                  )}
                                </Box>
                              </Box>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenContactDialog(contact)}
                                  sx={{ mr: 0.5 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteContact(contact.id)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>

                            <Box sx={{ mt: 2 }}>
                              {contact.email && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <EmailIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`mailto:${contact.email}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      {contact.email}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.phone && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`tel:${contact.phone}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      {contact.phone}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.mobile && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`tel:${contact.mobile}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      Mobil: {contact.mobile}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.notes && (
                                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {contact.notes}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={contactDialogOpen} onClose={handleCloseContactDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vorname"
                value={contactForm.first_name}
                onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nachname"
                value={contactForm.last_name}
                onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Titel"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                placeholder="z.B. Schulleiter, Sekretärin"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rolle"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                select
                SelectProps={{ native: false }}
              >
                <MenuItem value="">Keine</MenuItem>
                <MenuItem value="Schulleitung">Schulleitung</MenuItem>
                <MenuItem value="Verwaltung">Verwaltung</MenuItem>
                <MenuItem value="IT">IT</MenuItem>
                <MenuItem value="Finanzen">Finanzen</MenuItem>
                <MenuItem value="Sonstiges">Sonstiges</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Telefon"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Mobil"
                value={contactForm.mobile}
                onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notizen"
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseContactDialog} disabled={savingContact}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSaveContact}
            variant="contained"
            disabled={!contactForm.first_name.trim() || !contactForm.last_name.trim() || savingContact}
            startIcon={savingContact ? <CircularProgress size={20} /> : null}
          >
            {savingContact ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

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
  )
}

