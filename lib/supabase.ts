import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  
  throw new Error(
    `Missing Supabase environment variables: ${missing.join(', ')}\n` +
    `Please check your .env.local file and ensure both variables are set.`
  )
}

// Client für Client-seitige Verwendung (mit RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client für Server-seitige API-Routes (umgeht RLS)
// Verwendet Service-Role-Key, falls verfügbar, sonst Anon-Key
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

