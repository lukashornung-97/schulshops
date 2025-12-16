'use client'

import { useState } from 'react'
import { 
  AppBar as MUIAppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Tooltip,
} from '@mui/material'
import { useRouter, usePathname } from 'next/navigation'
import SchoolIcon from '@mui/icons-material/School'
import StoreIcon from '@mui/icons-material/Store'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import { useAuth } from './AuthProvider'

export function AppBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    handleMenuClose()
    await signOut()
  }

  const navItems = [
    { label: 'Schulen', path: '/', icon: SchoolIcon },
    { label: 'Shops', path: '/shops', icon: StoreIcon },
    { label: 'Bestellungen', path: '/orders', icon: ShoppingCartIcon },
  ]

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return '?'
    return user.email.charAt(0).toUpperCase()
  }

  return (
    <MUIAppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 4 }, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              '&:hover': { opacity: 0.9 },
            }}
            onClick={() => router.push('/')}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <SchoolIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ 
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Schulshop
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path))
            return (
              <Button
                key={item.path}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (item.path === pathname) return // Verhindere Navigation zur aktuellen Seite
                  router.push(item.path)
                }}
                startIcon={<Icon sx={{ fontSize: 18 }} />}
                sx={{
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: isActive ? 600 : 400,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  background: isActive 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : 'transparent',
                  backdropFilter: isActive ? 'blur(10px)' : 'none',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                {item.label}
              </Button>
            )
          })}

          {/* User Menu */}
          <Box sx={{ ml: 2 }}>
            <Tooltip title={user?.email || 'Benutzer'}>
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  p: 0.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {getUserInitials()}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 8,
                sx: {
                  mt: 1.5,
                  minWidth: 220,
                  borderRadius: 2,
                  overflow: 'visible',
                  '&:before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: 'background.paper',
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Angemeldet als
                </Typography>
                <Typography variant="body1" fontWeight={600} noWrap>
                  {user?.email || 'Unbekannt'}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleMenuClose()
                  router.push('/admin/pricing')
                }}
                sx={{
                  py: 1.5,
                }}
              >
                <SettingsIcon sx={{ mr: 1.5, fontSize: 20 }} />
                Preisverwaltung
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleLogout}
                sx={{
                  py: 1.5,
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.lighter',
                  },
                }}
              >
                <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} />
                Abmelden
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Toolbar>
    </MUIAppBar>
  )
}
