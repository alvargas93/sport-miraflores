import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Supabase fires PASSWORD_RECOVERY when the user arrives via the email link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Also check if there's already an active session (e.g. page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/bookings', { replace: true }), 2500)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-canvas px-6">
      <div className="mb-8 text-center">
        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 'clamp(36px, 10vw, 50px)',
          fontWeight: 900, lineHeight: 1, letterSpacing: '3px',
        }}>
          <span style={{ color: 'var(--teal)' }}>SPORT </span>
          <span style={{ color: 'var(--text)' }}>MIRAFLORES</span>
        </h1>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {success ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-3" style={{ color: 'var(--success)' }}>✓</p>
            <p style={{ color: 'var(--success)', fontSize: '15px', fontWeight: 600 }}>
              Contraseña actualizada
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>
              Redirigiendo…
            </p>
          </div>
        ) : !ready ? (
          <div className="flex justify-center py-6">
            <div
              className="w-8 h-8 rounded-full border-2 border-teal"
              style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              Nueva contraseña
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Repetir contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm mt-4 p-3 rounded-lg text-center" style={{ color: 'var(--danger)', background: 'rgba(224,85,85,0.1)' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary mt-5">
              {loading ? 'Guardando…' : 'GUARDAR CONTRASEÑA'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
