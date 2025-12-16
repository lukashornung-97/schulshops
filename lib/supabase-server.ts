import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase'

// Server client for server components and API routes
// This file should only be imported in Server Components
export async function createServerClient() {
  const cookieStore = await cookies()
  
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Get the current user from server context
export async function getCurrentUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

// Get the current user and check if they're an admin
export async function getCurrentAdmin() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return user
}
