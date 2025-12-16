import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { AppBarWrapper } from '@/components/AppBarWrapper'
import { LayoutContent } from '@/components/LayoutContent'
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
          <AuthProvider>
            <AppBarWrapper />
            <LayoutContent>
              {children}
            </LayoutContent>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
