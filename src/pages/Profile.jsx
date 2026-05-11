import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBono } from '../hooks/useBono'
import { useUserSports } from '../hooks/useUserSports'

const SPORT_COLORS = {
  crossfit: '#0abfbf',
  hyrox: '#e8a020',
}

function Avatar({ url, name, onUpload, uploading }) {
  const inputRef = useRef(null)
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    onUpload(file)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: url ? 'transparent' : 'var(--teal-glow)',
          border: '2px solid var(--teal)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {url ? (
            <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-head)', fontSize: '28px', fontWeight: 800, color: 'var(--teal)' }}>
              {initials}
            </span>
          )}
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="w-5 h-5 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
        </div>
      </button>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ fontSize: '12px', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Cambiar foto
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
      <p style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase',
        color: 'var(--muted)', padding: '12px 16px 8px',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

export default function Profile() {
  const { profile, signOut } = useAuth()
  const queryClient = useQueryClient()
  const { data: bono } = useBono(profile?.id)
  const { data: sports = [] } = useUserSports(profile?.id)

  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handleAvatarUpload(file) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const url = `${publicUrl}?t=${Date.now()}`

      await supabase.from('users').update({ avatar_url: url }).eq('id', profile.id)
      setAvatarUrl(url)
    } catch {
      // silently ignore upload errors
    } finally {
      setUploading(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwError('')
    if (pwNew.length < 6) return setPwError('La contraseña debe tener al menos 6 caracteres.')
    if (pwNew !== pwConfirm) return setPwError('Las contraseñas no coinciden.')

    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)

    if (error) {
      setPwError('No se pudo cambiar la contraseña. Inténtalo de nuevo.')
    } else {
      setPwSuccess(true)
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      setTimeout(() => { setPwSuccess(false); setShowPasswordForm(false) }, 2000)
    }
  }

  const bonoText = bono
    ? bono.bonos.max_classes === null
      ? `${bono.bonos.name} (ilimitado)`
      : `${bono.bonos.name} · ${bono.bonos.max_classes - bono.classes_used} de ${bono.bonos.max_classes} clases`
    : 'Sin bono activo este mes'

  const roleLabel = {
    general_admin: 'Admin general',
    sport_admin: 'Admin de deporte',
    user: 'Socio',
  }[profile?.role] ?? profile?.role

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
          PERFIL
        </h1>
        <img src="/logo.png" alt="Sport Miraflores" style={{ height: '38px', opacity: 0.75 }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">

          {/* Avatar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px 16px' }}>
            <Avatar
              url={avatarUrl}
              name={profile?.full_name}
              onUpload={handleAvatarUpload}
              uploading={uploading}
            />
            <p style={{ textAlign: 'center', fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginTop: '12px', letterSpacing: '0.5px' }}>
              {profile?.full_name}
            </p>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {roleLabel}
            </p>
          </div>

          {/* Cuenta */}
          <Section title="Cuenta">
            <InfoRow label="Email" value={profile?.email} />
          </Section>

          {/* Bono */}
          <Section title="Bono del mes">
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', color: bono ? 'var(--teal)' : 'var(--danger)',
                background: bono ? 'var(--teal-glow)' : 'rgba(224,85,85,0.1)',
                padding: '6px 12px', borderRadius: '20px',
              }}>
                {bono && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />}
                {bonoText}
              </span>
            </div>
          </Section>

          {/* Deportes */}
          {sports.length > 0 && (
            <Section title="Deportes">
              <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {sports.map((sport) => (
                  <span key={sport.id} style={{
                    fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px',
                    color: SPORT_COLORS[sport.slug] ?? 'var(--teal)',
                    background: (SPORT_COLORS[sport.slug] ?? 'var(--teal)') + '22',
                  }}>
                    {sport.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Cambiar contraseña */}
          <Section title="Seguridad">
            {!showPasswordForm ? (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    fontSize: '13px', color: 'var(--teal)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  Cambiar contraseña
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <div className="flex flex-col gap-2">
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    className="input-field"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    placeholder="Repetir contraseña"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    className="input-field"
                    autoComplete="new-password"
                  />
                </div>

                {pwError && (
                  <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '8px' }}>{pwError}</p>
                )}
                {pwSuccess && (
                  <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px' }}>Contraseña actualizada.</p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => { setShowPasswordForm(false); setPwError(''); setPwNew(''); setPwConfirm('') }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px',
                      background: 'var(--surface2)', color: 'var(--muted)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pwLoading}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px',
                      background: 'var(--teal)', color: '#000', fontWeight: 700,
                      border: 'none', cursor: pwLoading ? 'default' : 'pointer',
                    }}
                  >
                    {pwLoading ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </Section>

          {/* Cerrar sesión */}
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '14px', borderRadius: '14px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--danger)', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.5px',
            }}
          >
            Cerrar sesión
          </button>

          <div style={{ height: '8px' }} />
        </div>
      </div>
    </div>
  )
}
