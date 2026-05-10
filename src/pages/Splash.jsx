import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Splash() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      navigate(session ? '/bookings' : '/login', { replace: true })
    }, 3000)
    return () => clearTimeout(timer)
  }, [loading, session, navigate])

  return (
    <div
      className="flex flex-col items-center justify-center h-full bg-canvas"
      style={{ position: 'relative' }}
    >
      <div style={{ animation: 'fade-up 0.6s ease forwards', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 'clamp(56px, 18vw, 80px)',
          fontWeight: 900,
          color: 'var(--teal)',
          letterSpacing: '6px',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          Sport
        </h1>
        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 'clamp(56px, 18vw, 80px)',
          fontWeight: 900,
          color: 'var(--text)',
          letterSpacing: '6px',
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          Miraflores
        </h1>
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--muted)',
          fontSize: '12px',
          letterSpacing: '4px',
          marginTop: '10px',
          textTransform: 'uppercase',
        }}>
          CrossFit · Hyrox
        </p>
      </div>

      <div className="flex items-center gap-1.5" style={{ position: 'absolute', bottom: '48px' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--teal)',
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
