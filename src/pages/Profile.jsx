import { useState, useRef, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useBono } from '../hooks/useBono'
import { useUserSports } from '../hooks/useUserSports'
import { subscribePush } from '../lib/push'

const SPORT_COLORS = {
  crossfit: '#0abfbf',
  hyrox: '#e8a020',
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 400, 400)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92))
}

function Avatar({ url, name, onFileSelect, uploading }) {
  const inputRef = useRef(null)
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative' }}
      >
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%',
          background: url ? 'transparent' : 'rgba(10,191,191,0.12)',
          border: '2.5px solid var(--teal)',
          boxShadow: '0 0 20px rgba(10,191,191,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {url ? (
            <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-head)', fontSize: '30px', fontWeight: 800, color: 'var(--teal)' }}>
              {initials}
            </span>
          )}
          {uploading ? (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="w-5 h-5 rounded-full border-2 border-teal"
                style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '28px', background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)',
      textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px',
    }}>
      {children}
    </p>
  )
}

function InfoCard({ rows }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: '16px',
      border: '1px solid var(--card-border)', overflow: 'hidden',
    }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          padding: '13px 16px',
          borderTop: i === 0 ? 'none' : '1px solid var(--card-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>{row.label}</span>
          <span style={{ fontSize: '13px', color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Profile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const { data: bono } = useBono(profile?.id)
  const { data: sports = [] } = useUserSports(profile?.id)

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [cropSrc, setCropSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
  }, [profile?.avatar_url])

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  const [showNameForm, setShowNameForm] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [pushStatus, setPushStatus] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  )
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState('')

  async function handleEnablePush() {
    setPushLoading(true)
    setPushError('')
    try {
      const sub = await subscribePush()
      setPushStatus(Notification.permission)
      if (sub) {
        const subJson = sub.toJSON()
        await supabase.from('push_subscriptions').upsert(
          { user_id: profile.id, onesignal_id: subJson.endpoint, subscription: subJson },
          { onConflict: 'user_id,onesignal_id' }
        )
      }
    } catch (err) {
      setPushError(err?.message ?? 'Error desconocido')
      setPushStatus(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
    } finally {
      setPushLoading(false)
    }
  }

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light')

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.remove('light')
    } else {
      localStorage.setItem('theme', 'light')
      document.documentElement.classList.add('light')
    }
  }

  function handleFileSelect(file) {
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  async function handleCropConfirm() {
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      setCropSrc(null)
      await handleAvatarUpload(blob)
    } catch {
      setUploadError('Error al recortar la imagen.')
    }
  }

  async function handleAvatarUpload(blob) {
    setUploading(true)
    setUploadError('')
    try {
      const path = `${profile.id}/avatar.jpg`
      const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (storageError) throw new Error('Storage: ' + storageError.message)
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: dbError, count } = await supabase
        .from('users')
        .update({ avatar_url: url }, { count: 'exact' })
        .eq('id', profile.id)
      if (dbError) throw new Error('DB: ' + dbError.message)
      if (count === 0) throw new Error('Sin permiso para guardar la foto. Contacta con el administrador.')
      setAvatarUrl(url)
      refreshProfile(profile.id)
    } catch (err) {
      setUploadError(err.message ?? 'Error al subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  async function handleNameSave(e) {
    e.preventDefault()
    const trimmed = nameValue.trim()
    if (!trimmed) return setNameError('El nombre no puede estar vacío.')
    setNameLoading(true)
    setNameError('')
    const { error } = await supabase.from('users').update({ full_name: trimmed }).eq('id', profile.id)
    setNameLoading(false)
    if (error) {
      setNameError('No se pudo guardar el nombre.')
    } else {
      await refreshProfile(profile.id)
      setShowNameForm(false)
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
      setPwNew('')
      setPwConfirm('')
      setTimeout(() => { setPwSuccess(false); setShowPasswordForm(false) }, 2000)
    }
  }

  const bonoText = bono
    ? bono.bonos.max_classes === null
      ? `${bono.bonos.name} · Ilimitado`
      : `${bono.bonos.name} · ${bono.bonos.max_classes - bono.classes_used} de ${bono.bonos.max_classes} clases`
    : null

  const bonoUsed = bono && bono.bonos.max_classes !== null
    ? Math.min((bono.classes_used / bono.bonos.max_classes) * 100, 100)
    : null

  const roleLabel = {
    general_admin: 'Admin general',
    sport_admin: 'Admin de deporte',
    user: 'Socio',
  }[profile?.role] ?? profile?.role

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid rgba(10,191,191,0.1)',
        padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
          PERFIL
        </h1>
        <img src="/logo.png" alt="Sport Miraflores" className="logo-img" style={{ height: '38px', opacity: 0.75 }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Avatar + name card */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--card-border)',
            borderRadius: '20px', padding: '28px 16px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          }}>
            <Avatar url={avatarUrl} name={profile?.full_name} onFileSelect={handleFileSelect} uploading={uploading} />
            {uploadError && (
              <p style={{ fontSize: '12px', color: 'var(--danger)', textAlign: 'center', padding: '0 8px' }}>
                {uploadError}
              </p>
            )}
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <p style={{
                fontFamily: 'var(--font-head)', fontSize: '24px', fontWeight: 800,
                color: 'var(--text)', letterSpacing: '0.5px', lineHeight: 1.1,
              }}>
                {profile?.full_name}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{roleLabel}</p>
            </div>
            {sports.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
                {sports.map((sport) => (
                  <span key={sport.id} style={{
                    fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
                    letterSpacing: '0.5px', textTransform: 'uppercase',
                    color: SPORT_COLORS[sport.slug] ?? 'var(--teal)',
                    background: (SPORT_COLORS[sport.slug] ?? 'var(--teal)') + '20',
                  }}>
                    {sport.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bono del mes */}
          <div>
            <SectionLabel>Bono del mes</SectionLabel>
            <div style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: `1px solid ${bono ? 'rgba(10,191,191,0.2)' : 'rgba(224,85,85,0.2)'}`,
              padding: '16px',
            }}>
              {bono ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bonoUsed !== null ? '12px' : '0' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{bono.bonos.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--teal)', marginTop: '2px' }}>
                        {bonoText}
                      </p>
                      {bono.is_pending && (
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Renovación automática activa</p>
                      )}
                    </div>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '12px',
                      background: 'rgba(10,191,191,0.12)', border: '1px solid rgba(10,191,191,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 12V22H4V12"/>
                        <path d="M22 7H2v5h20V7z"/>
                        <path d="M12 22V7"/>
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                      </svg>
                    </div>
                  </div>
                  {bonoUsed !== null && (
                    <div>
                      <div style={{ height: '5px', borderRadius: '3px', background: 'var(--surface3)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          width: `${bonoUsed}%`,
                          background: bonoUsed >= 90 ? 'var(--danger)' : 'var(--teal)',
                          transition: 'width 0.4s',
                        }} />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'right' }}>
                        {bono.classes_used} de {bono.bonos.max_classes} clases usadas
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '12px',
                    background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger)' }}>Sin bono activo</p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>Contacta con el gimnasio</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cuenta */}
          <div>
            <SectionLabel>Cuenta</SectionLabel>
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
              {/* Email (solo lectura) */}
              <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>Email</span>
                <span style={{ fontSize: '13px', color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all' }}>{profile?.email}</span>
              </div>

              {/* Nombre */}
              <div style={{ borderTop: '1px solid var(--card-border)' }}>
                {!showNameForm ? (
                  <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>Nombre</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text)', textAlign: 'right' }}>{profile?.full_name}</span>
                      <button
                        onClick={() => { setNameValue(profile?.full_name ?? ''); setNameError(''); setShowNameForm(true) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: '2px', flexShrink: 0 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleNameSave} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="input-field"
                      autoFocus
                      autoComplete="name"
                    />
                    {nameError && <p style={{ fontSize: '12px', color: 'var(--danger)' }}>{nameError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowNameForm(false)}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--card-border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={nameLoading}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--teal)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                      >
                        {nameLoading ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Apariencia */}
          <div>
            <SectionLabel>Apariencia</SectionLabel>
            <div style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: '1px solid var(--card-border)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'rgba(10,191,191,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isDark ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: '14px', color: 'var(--text)' }}>
                    {isDark ? 'Modo oscuro' : 'Modo claro'}
                  </span>
                </div>
                <button
                  onClick={toggleTheme}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px',
                    background: isDark ? 'var(--surface3)' : 'var(--teal)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.25s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px', left: '2px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    transform: isDark ? 'translateX(0)' : 'translateX(20px)',
                    transition: 'transform 0.25s',
                  }} />
                </button>
              </div>
            </div>
          </div>

          {/* Notificaciones */}
          {pushStatus !== 'unsupported' && (
            <div>
              <SectionLabel>Notificaciones</SectionLabel>
              <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(10,191,191,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    </div>
                    <div>
                      <span style={{ fontSize: '14px', color: 'var(--text)' }}>Notificaciones push</span>
                      {pushStatus === 'granted' && (
                        <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '2px' }}>Activadas</p>
                      )}
                      {pushStatus === 'denied' && (
                        <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>Bloqueadas — actívalas en ajustes del navegador</p>
                      )}
                      {pushStatus === 'default' && (
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>No activadas</p>
                      )}
                    </div>
                  </div>
                  {pushStatus === 'granted' && (
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                  {pushStatus === 'default' && (
                    <button
                      onClick={handleEnablePush}
                      disabled={pushLoading}
                      style={{ padding: '7px 14px', borderRadius: '10px', background: 'var(--teal)', color: '#000', border: 'none', cursor: pushLoading ? 'default' : 'pointer', fontSize: '13px', fontWeight: 700, flexShrink: 0, opacity: pushLoading ? 0.6 : 1 }}
                    >
                      {pushLoading ? '…' : 'Activar'}
                    </button>
                  )}
                </div>
                {pushError && (
                  <p style={{ fontSize: '12px', color: 'var(--danger)', padding: '0 16px 12px' }}>
                    Error: {pushError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Seguridad */}
          <div>
            <SectionLabel>Seguridad</SectionLabel>
            <div style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: '1px solid var(--card-border)', overflow: 'hidden',
            }}>
              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '10px',
                      background: 'rgba(10,191,191,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="11" width="14" height="11" rx="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--text)' }}>Cambiar contraseña</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => { setShowPasswordForm(false); setPwError(''); setPwNew(''); setPwConfirm('') }}
                      style={{
                        flex: 1, padding: '11px', borderRadius: '12px', fontSize: '13px',
                        background: 'var(--surface2)', color: 'var(--muted)',
                        border: '1px solid var(--card-border)', cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      style={{
                        flex: 1, padding: '11px', borderRadius: '12px', fontSize: '13px',
                        background: 'var(--teal)', color: '#000', fontWeight: 700,
                        border: 'none', cursor: pwLoading ? 'default' : 'pointer',
                      }}
                    >
                      {pwLoading ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Cerrar sesión */}
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '15px', borderRadius: '16px',
              background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.25)',
              color: 'var(--danger)', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.5px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>

          <div style={{ height: '8px' }} />
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 201,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Crop area */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls */}
            <div style={{
              background: 'var(--surface)',
              borderTop: '1px solid var(--border)',
              padding: '16px 20px calc(20px + env(safe-area-inset-bottom))',
              display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                <input
                  type="range"
                  min={1} max={3} step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--teal)' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setCropSrc(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCropConfirm}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--teal)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
                >
                  Usar foto
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
