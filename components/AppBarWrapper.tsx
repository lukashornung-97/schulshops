'use client'

import { usePathname } from 'next/navigation'
import { AppBar } from './AppBar'

// Routes where the AppBar should not be shown
const hiddenRoutes = ['/login']

export function AppBarWrapper() {
  const pathname = usePathname()

  // Don't show AppBar on login page
  if (hiddenRoutes.includes(pathname)) {
    return null
  }

  return <AppBar />
}





