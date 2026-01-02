'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:34',message:'AuthProvider mounting',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:41',message:'Calling createBrowserClient',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const supabase = createBrowserClient()
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:42',message:'createBrowserClient returned',data:{hasClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:43',message:'useEffect running',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Get initial session
    const getInitialSession = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:45',message:'getInitialSession called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:47',message:'Calling supabase.auth.getSession',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:48',message:'getSession returned',data:{hasSession:!!initialSession,hasUser:!!initialSession?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de14b646-6048-4a0f-a797-a9f88a9d0d8e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AuthProvider.tsx:50',message:'Error in getInitialSession',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }

        // Refresh the page data when session changes
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          router.refresh()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [supabase, router])

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}






