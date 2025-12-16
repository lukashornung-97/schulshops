'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { createBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      
      // Sign in with email and password
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        setLoading(false)
        return
      }

      // Check if user is an admin by user_id first
      let { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, user_id, email')
        .eq('user_id', data.user.id)
        .maybeSingle()

      // If not found by user_id, check by email (for pre-added admins)
      // Use ilike for case-insensitive matching
      if (!adminData) {
        const { data: emailAdminData, error: emailAdminError } = await supabase
          .from('admin_users')
          .select('id, user_id, email')
          .ilike('email', data.user.email || '')
          .maybeSingle()

        if (emailAdminError) {
          console.error('Error checking admin by email:', emailAdminError)
          setError(`Fehler beim Überprüfen der Berechtigung: ${emailAdminError.message}`)
          setLoading(false)
          return
        }

        if (!emailAdminData) {
          // Sign out the user since they're not an admin
          await supabase.auth.signOut()
          setError('Sie haben keine Administratorberechtigung. Bitte kontaktieren Sie einen Administrator.')
          setLoading(false)
          return
        }

        // Link the user_id if it's not set yet
        if (!emailAdminData.user_id) {
          const { error: updateError } = await supabase
            .from('admin_users')
            .update({ user_id: data.user.id })
            .eq('id', emailAdminData.id)

          if (updateError) {
            console.error('Error linking user_id:', updateError)
            // Continue anyway - the user is still an admin by email
          }
        }

        adminData = emailAdminData
      }

      if (!adminData) {
        await supabase.auth.signOut()
        setError('Sie haben keine Administratorberechtigung.')
        setLoading(false)
        return
      }

      // Redirect to dashboard
      router.push('/')
      router.refresh()
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 3,
      }}
    >
      <Card
        elevation={24}
        sx={{
          maxWidth: 420,
          width: '100%',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            py: 4,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              backdropFilter: 'blur(10px)',
            }}
          >
            <SchoolIcon sx={{ color: 'white', fontSize: 36 }} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              color: 'white',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              mb: 0.5,
            }}
          >
            Schulshop Verwaltung
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            Melden Sie sich an, um fortzufahren
          </Typography>
        </Box>

        {/* Form */}
        <CardContent sx={{ p: 4 }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
              }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Passwort"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 4px 14px 0 rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                  boxShadow: '0 6px 20px 0 rgba(102, 126, 234, 0.5)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  opacity: 0.7,
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Anmelden'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}

