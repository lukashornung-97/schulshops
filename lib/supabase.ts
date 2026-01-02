import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

// #region agent log
if (typeof window === 'undefined') {
  const fs = require('fs');
  const logPath = '/Users/lukashornung/Desktop/Privat/gradu/schulshop/.cursor/debug.log';
  try {
    const logEntry = JSON.stringify({location:'lib/supabase.ts:4',message:'Checking env vars',data:{hasUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasAnonKey:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'A'}) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch {}
}
// #endregion

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate environment variables - fail fast if missing
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `❌ Missing required Supabase environment variables!
  
Please add the following to your .env.local file:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

See README.md for setup instructions.`
  
  // #region agent log
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const logPath = '/Users/lukashornung/Desktop/Privat/gradu/schulshop/.cursor/debug.log';
    try {
      const logEntry = JSON.stringify({location:'lib/supabase.ts:13',message:'Missing env vars - throwing error',data:{missingUrl:!supabaseUrl,missingAnonKey:!supabaseAnonKey},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'A'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
    } catch {}
  }
  // #endregion
  
  console.error(errorMsg)
  if (typeof window === 'undefined') {
    // Server-side: throw error to prevent server from starting with invalid config
    throw new Error(errorMsg)
  }
}

// #region agent log
if (typeof window === 'undefined') {
  const fs = require('fs');
  const logPath = '/Users/lukashornung/Desktop/Privat/gradu/schulshop/.cursor/debug.log';
  try {
    const logEntry = JSON.stringify({location:'lib/supabase.ts:35',message:'Creating supabase client',data:{urlLength:supabaseUrl?.length||0,keyLength:supabaseAnonKey?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'A'}) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch {}
}
// #endregion
// Legacy client for backward compatibility (client-side with RLS)
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

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

// Singleton pattern for browser client to avoid multiple instances
let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null

// Browser client for client components (handles cookies automatically)
export function createBrowserClient() {
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/supabase.ts:48',message:'createBrowserClient called',data:{hasExistingClient:!!browserClient,urlLength:supabaseUrl?.length||0,keyLength:supabaseAnonKey?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
  }
  // #endregion
  if (browserClient) {
    return browserClient
  }
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/supabase.ts:54',message:'Creating new browser client',data:{urlLength:supabaseUrl?.length||0,keyLength:supabaseAnonKey?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
  }
  // #endregion
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured. Please check your .env.local file.')
  }
  browserClient = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClient
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
