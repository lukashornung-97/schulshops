import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AppBar } from '@/components/AppBar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schulshop Verwaltung',
  description: 'Verwaltungssystem für Schulshops',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <ThemeProvider>
          <AppBar />
          <main style={{ paddingTop: '72px', minHeight: 'calc(100vh - 72px)' }}>
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}

