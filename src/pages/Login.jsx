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

  // Redirigir si ya hay sesión activa (via useEffect para evitar flash)
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
    <div className="flex flex-col items-center justify-center h-full bg-canvas px-6">
      <div className="mb-10 text-center" style={{ animation: 'fade-up 0.5s ease forwards' }}>
        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 'clamp(44px, 13vw, 60px)',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '4px',
        }}>
          <span style={{ color: 'var(--teal)' }}>SPORT </span>
          <span style={{ color: 'var(--text)' }}>MIRAFLORES</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '11px', letterSpacing: '3px', marginTop: '6px' }}>
          CROSSFIT · HYROX
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', animation: 'fade-up 0.6s ease 0.1s both' }}
      >
        {!resetView ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-3">
              <div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Email"
                  className="input-field"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="Contraseña"
                  className="input-field"
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {serverError && (
              <p className="text-sm mt-4 p-3 rounded-lg text-center" style={{ color: 'var(--danger)', background: 'rgba(224,85,85,0.1)' }}>
                {serverError}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary mt-5">
              {isSubmitting ? 'Entrando...' : 'INICIAR SESIÓN'}
            </button>

            <button
              type="button"
              onClick={() => setResetView(true)}
              className="w-full text-center text-sm mt-4"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        ) : (
          <div>
            <button
              onClick={() => { setResetView(false); setResetSent(false) }}
              className="flex items-center gap-1.5 text-sm mb-4"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Volver
            </button>

            {!resetSent ? (
              <form onSubmit={handleReset} noValidate>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                <input
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input-field"
                  autoComplete="email"
                />
                <button type="submit" disabled={resetLoading} className="btn-primary mt-4">
                  {resetLoading ? 'Enviando...' : 'ENVIAR ENLACE'}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-2xl mb-3" style={{ color: 'var(--success)' }}>✓</p>
                <p className="text-sm" style={{ color: 'var(--success)' }}>
                  Enlace enviado. Revisa tu bandeja de entrada.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
