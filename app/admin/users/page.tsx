'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import DeleteIcon from '@mui/icons-material/Delete'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { createBrowserClient } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

interface AdminUser {
  id: string
  user_id: string
  email: string
  created_at: string
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const supabase = createBrowserClient()

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAdmins(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const handleAddAdmin = async () => {
    if (!newEmail.trim()) return

    setAddingAdmin(true)
    try {
      // First, check if a user with this email exists in auth.users
      // Note: This requires the service role or a custom function
      // For now, we'll just add the email and user_id will be null until they sign in
      
      // Check if email already exists
      const { data: existingAdmin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', newEmail.toLowerCase())
        .single()

      if (existingAdmin) {
        setSnackbar({
          open: true,
          message: 'Diese E-Mail ist bereits als Admin registriert.',
          severity: 'error',
        })
        setAddingAdmin(false)
        return
      }

      // Add the new admin
      const { error } = await supabase
        .from('admin_users')
        .insert({
          email: newEmail.toLowerCase(),
          user_id: null, // Will be set when user signs in
        })

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Admin erfolgreich hinzugefügt.',
        severity: 'success',
      })
      setNewEmail('')
      setDialogOpen(false)
      fetchAdmins()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Hinzufügen des Admins.',
        severity: 'error',
      })
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleDeleteAdmin = async (admin: AdminUser) => {
    // Prevent deleting yourself
    if (admin.user_id === user?.id) {
      setSnackbar({
        open: true,
        message: 'Sie können sich nicht selbst entfernen.',
        severity: 'error',
      })
      return
    }

    if (!confirm(`Möchten Sie ${admin.email} wirklich als Admin entfernen?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', admin.id)

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Admin erfolgreich entfernt.',
        severity: 'success',
      })
      fetchAdmins()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.message || 'Fehler beim Entfernen des Admins.',
        severity: 'error',
      })
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminPanelSettingsIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Admin-Verwaltung
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verwalten Sie die Administratoren des Systems
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Admin List Card */}
      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              Administratoren ({admins.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              Admin hinzufügen
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>E-Mail</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hinzugefügt am</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Keine Administratoren gefunden.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {admin.email}
                          {admin.user_id === user?.id && (
                            <Chip
                              label="Sie"
                              size="small"
                              color="primary"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={admin.user_id ? 'Aktiv' : 'Ausstehend'}
                          size="small"
                          color={admin.user_id ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={admin.user_id === user?.id ? 'Sie können sich nicht selbst entfernen' : 'Admin entfernen'}>
                          <span>
                            <IconButton
                              onClick={() => handleDeleteAdmin(admin)}
                              disabled={admin.user_id === user?.id}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !addingAdmin && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Neuen Administrator hinzufügen
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Geben Sie die E-Mail-Adresse des neuen Administrators ein. Der Benutzer muss sich mit dieser E-Mail registrieren, um Zugang zu erhalten.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="E-Mail-Adresse"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={addingAdmin}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={addingAdmin}
            sx={{ textTransform: 'none' }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleAddAdmin}
            variant="contained"
            disabled={addingAdmin || !newEmail.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {addingAdmin ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}




