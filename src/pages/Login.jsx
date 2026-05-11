import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
})

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full bg-canvas">
      <div
        className="w-8 h-8 rounded-full border-2 border-teal"
        style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
      />
    </div>
  )
}

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3"/>
      <polyline points="2,4 12,13 22,4"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="11" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
      <circle cx="12" cy="16" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function InputField({ icon, error, ...inputProps }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <div style={{
        position: 'relative',
        background: 'var(--surface2)',
        border: `1.5px solid ${error ? 'var(--danger)' : focused ? 'var(--teal)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '14px',
        transition: 'border-color 0.2s',
        display: 'flex',
        alignItems: 'center',
      }}>
        <span style={{
          position: 'absolute', left: '16px',
          color: focused ? 'var(--teal)' : 'var(--muted)',
          transition: 'color 0.2s',
          display: 'flex', alignItems: 'center',
        }}>
          {icon}
        </span>
        <input
          {...inputProps}
          onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e) }}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            padding: '16px 16px 16px 48px',
            fontSize: '15px',
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
          }}
        />
      </div>
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '6px', paddingLeft: '4px' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Login() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [resetView, setResetView] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    if (!loading && session) {
      navigate('/bookings', { replace: true })
    }
  }, [session, loading, navigate])

  if (loading) return <Spinner />

  const onSubmit = async ({ email, password }) => {
    setServerError('')
    const { error } = await signIn(email, password)
    if (error) {
      setServerError(
        error.message === 'user_inactive'
          ? 'Tu cuenta está desactivada. Contacta con el gimnasio.'
          : 'Email o contraseña incorrectos.'
      )
    } else {
      navigate('/bookings', { replace: true })
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!resetEmail) return
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setResetLoading(false)
    setResetSent(true)
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6"
      style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Glow de fondo */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '340px', height: '340px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(10,191,191,0.09) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ animation: 'fade-up 0.5s ease forwards', textAlign: 'center', marginBottom: '40px' }}>
        <img
          src="/logo.png"
          alt="Sport Miraflores"
          style={{ width: 'clamp(160px, 52vw, 210px)', margin: '0 auto' }}
        />
        <p style={{
          color: 'var(--muted)', fontSize: '11px', letterSpacing: '4px',
          marginTop: '10px', fontFamily: 'var(--font-head)', fontWeight: 600,
        }}>
          CROSSFIT · HYROX
        </p>
      </div>

      {/* Formulario */}
      <div
        className="w-full max-w-sm"
        style={{ animation: 'fade-up 0.6s ease 0.1s both' }}
      >
        {!resetView ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-3">
              <InputField
                {...register('email')}
                type="email"
                placeholder="Email"
                autoComplete="email"
                icon={<IconMail />}
                error={errors.email?.message}
              />
              <InputField
                {...register('password')}
                type="password"
                placeholder="Contraseña"
                autoComplete="current-password"
                icon={<IconLock />}
                error={errors.password?.message}
              />
            </div>

            {serverError && (
              <div style={{
                marginTop: '16px', padding: '12px 16px', borderRadius: '12px',
                background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.25)',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ fontSize: '13px', color: 'var(--danger)' }}>{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                background: isSubmitting ? 'var(--teal-dark)' : 'var(--teal)',
                color: '#000',
                fontFamily: 'var(--font-head)',
                fontWeight: 800,
                fontSize: '17px',
                letterSpacing: '1.5px',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                boxShadow: '0 4px 24px rgba(10,191,191,0.25)',
              }}
            >
              {isSubmitting ? 'Entrando...' : 'INICIAR SESIÓN'}
            </button>

            <button
              type="button"
              onClick={() => setResetView(true)}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontSize: '13px', color: 'var(--muted)', background: 'none',
                border: 'none', cursor: 'pointer', marginTop: '20px',
                letterSpacing: '0.2px',
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        ) : (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            <button
              onClick={() => { setResetView(false); setResetSent(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', color: 'var(--muted)', background: 'none',
                border: 'none', cursor: 'pointer', marginBottom: '20px',
              }}
            >
              ← Volver
            </button>

            {!resetSent ? (
              <form onSubmit={handleReset} noValidate>
                <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                <InputField
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoComplete="email"
                  icon={<IconMail />}
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    marginTop: '16px', width: '100%', padding: '16px',
                    borderRadius: '14px', background: 'var(--teal)', color: '#000',
                    fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '16px',
                    letterSpacing: '1px', border: 'none',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 24px rgba(10,191,191,0.2)',
                  }}
                >
                  {resetLoading ? 'Enviando...' : 'ENVIAR ENLACE'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(46,204,143,0.15)', border: '1.5px solid var(--success)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                  Enlace enviado
                </p>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Revisa tu bandeja de entrada.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
