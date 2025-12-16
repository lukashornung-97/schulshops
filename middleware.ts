import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login']

// Routes that should be ignored (API routes, static files, etc.)
const ignoredRoutes = [
  '/api/',
  '/_next/',
  '/favicon.ico',
]

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const searchParams = req.nextUrl.searchParams
  const hasRsc = searchParams.has('_rsc')

  // Skip middleware for RSC payload requests (Next.js internal)
  // These requests need to pass through without any authentication checks
  if (hasRsc) {
    return NextResponse.next()
  }

  // Also skip for Next.js internal route segments
  // These are used for prefetching and navigation
  if (pathname.includes('/_next/') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // Skip middleware for ignored routes
  if (ignoredRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Skip middleware for public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Create response first
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  try {
    // Create Supabase client using the new @supabase/ssr package
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
            res = NextResponse.next({
              request: {
                headers: req.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get the current session
    const { data: { user } } = await supabase.auth.getUser()

    // If no user, redirect to login
    if (!user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check if user is an admin by user_id first
    let { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If not found by user_id, also check by email (for pre-added admins)
    // Use ilike for case-insensitive matching
    if (!adminData) {
      const { data: emailAdminData, error: emailError } = await supabase
        .from('admin_users')
        .select('id')
        .ilike('email', user.email || '')
        .maybeSingle()

      if (emailError || !emailAdminData) {
        // Sign out the user
        await supabase.auth.signOut()
        
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('error', 'no_admin_access')
        return NextResponse.redirect(loginUrl)
      }
      
      adminData = emailAdminData
    }

    // Return the response
    return res
  } catch (error) {
    // If there's an error in middleware, log it and allow the request through
    // This prevents middleware errors from blocking all requests
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (HMR)
     * - favicon.ico (favicon file)
     * Note: RSC requests are handled in the middleware function itself
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
}
