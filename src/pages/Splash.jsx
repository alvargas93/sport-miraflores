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
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -60%)',
        width: '420px', height: '420px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(10,191,191,0.15) 0%, transparent 68%)',
        animation: 'glow-pulse 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <img
          src="/logo.png"
          alt="Sport Miraflores"
          style={{
            width: 'clamp(200px, 65vw, 280px)',
            margin: '0 auto',
            animation: 'logo-3d-in 0.95s cubic-bezier(0.34, 1.26, 0.64, 1) forwards',
            filter: 'drop-shadow(0 0 28px rgba(10,191,191,0.25))',
          }}
        />
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--muted)',
          fontSize: '12px',
          letterSpacing: '4px',
          marginTop: '20px',
          textTransform: 'uppercase',
          animation: 'fade-up 0.6s ease 0.5s both',
        }}>
          CrossFit · Hyrox
        </p>
      </div>

      <p style={{
        position: 'absolute', bottom: '24px',
        fontSize: '11px', color: 'var(--muted)', opacity: 0.4,
        letterSpacing: '0.3px',
        animation: 'fade-up 0.4s ease 0.9s both',
      }}>
        Desarrollado por <a href="https://avforge.vercel.app/es" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>AV Forge</a>
      </p>

      {/* Loading dots */}
      <div
        style={{
          position: 'absolute', bottom: '56px',
          display: 'flex', alignItems: 'center', gap: '7px',
          animation: 'fade-up 0.4s ease 0.7s both',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '7px', height: '7px',
              borderRadius: '50%',
              background: 'var(--teal)',
              boxShadow: '0 0 6px rgba(10,191,191,0.6)',
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
