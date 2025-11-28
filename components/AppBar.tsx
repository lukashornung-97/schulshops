'use client'

import { AppBar as MUIAppBar, Toolbar, Typography, Button, Box, alpha } from '@mui/material'
import { useRouter, usePathname } from 'next/navigation'
import SchoolIcon from '@mui/icons-material/School'
import StoreIcon from '@mui/icons-material/Store'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

export function AppBar() {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { label: 'Schulen', path: '/', icon: SchoolIcon },
    { label: 'Shops', path: '/shops', icon: StoreIcon },
    { label: 'Bestellungen', path: '/orders', icon: ShoppingCartIcon },
  ]

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
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path))
            return (
              <Button
                key={item.path}
                onClick={() => router.push(item.path)}
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
        </Box>
      </Toolbar>
    </MUIAppBar>
  )
}

