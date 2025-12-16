import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate environment variables (only in non-edge environments)
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
  }
}

// Legacy client for backward compatibility (client-side with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side API routes (bypasses RLS)
// Uses service role key if available, otherwise anon key
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Browser client for client components (handles cookies automatically)
export function createBrowserClient() {
  return createClientComponentClient()
}

// Check if a user is an admin (using admin client)
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .single()
  
  return !error && !!data
}
