'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '40px', color: 'white' }}>
          ⚠️
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
          Ein Fehler ist aufgetreten
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px', lineHeight: '1.5' }}>
          {error.message || 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              fontWeight: 500,
              color: 'white',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#667eea',
              background: 'transparent',
              border: '1px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Zur Startseite
          </button>
        </div>
      </div>
    </div>
  )
}



