'use client'

import { Box, Container, Typography, Button } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import Link from 'next/link'

export default function NotFound() {
  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <SearchOffIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
            Seite nicht gefunden
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Die angeforderte Seite konnte nicht gefunden werden.
          </Typography>
          <Button
            component={Link}
            href="/"
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #653a8f 100%)',
              },
            }}
          >
            Zur Startseite
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

