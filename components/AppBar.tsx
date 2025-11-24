'use client'

import { AppBar as MUIAppBar, Toolbar, Typography, Button, Box } from '@mui/material'
import { useRouter } from 'next/navigation'
import SchoolIcon from '@mui/icons-material/School'
import StoreIcon from '@mui/icons-material/Store'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

export function AppBar() {
  const router = useRouter()

  return (
    <MUIAppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <SchoolIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Schulshop Verwaltung
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="inherit" onClick={() => router.push('/')}>
            Schulen
          </Button>
          <Button color="inherit" onClick={() => router.push('/shops')}>
            Shops
          </Button>
          <Button color="inherit" onClick={() => router.push('/orders')}>
            Bestellungen
          </Button>
        </Box>
      </Toolbar>
    </MUIAppBar>
  )
}

