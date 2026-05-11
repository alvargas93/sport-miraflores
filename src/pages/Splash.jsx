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
        <img
          src="/logo.png"
          alt="Sport Miraflores"
          style={{
            width: 'clamp(200px, 65vw, 280px)',
            margin: '0 auto',
            filter: 'drop-shadow(0 0 28px rgba(10,191,191,0.25))',
          }}
        />
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--muted)',
          fontSize: '12px',
          letterSpacing: '4px',
          marginTop: '16px',
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
