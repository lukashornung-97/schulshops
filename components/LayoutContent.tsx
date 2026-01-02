'use client'

import { usePathname } from 'next/navigation'

// Routes that don't need the main padding (like login page)
const fullPageRoutes = ['/login']

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullPage = fullPageRoutes.includes(pathname)

  if (isFullPage) {
    return <>{children}</>
  }

  return (
    <main style={{ paddingTop: '72px', minHeight: 'calc(100vh - 72px)' }}>
      {children}
    </main>
  )
}






