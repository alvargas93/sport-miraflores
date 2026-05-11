import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const SPORT_COLORS = { crossfit: '#0abfbf', hyrox: '#e8a020' }
const SPORT_SHORT = { crossfit: 'CF', hyrox: 'Hyrox' }

const ROLE_LABELS = { general_admin: 'Admin', sport_admin: 'Admin deporte', user: 'Socio' }
const ROLE_OPTIONS = [
  { value: 'user', label: 'Socio' },
  { value: 'sport_admin', label: 'Admin de deporte' },
  { value: 'general_admin', label: 'Admin general' },
]
const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'user' }

export default function AdminUsers() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const isGeneralAdmin = profile?.role === 'general_admin'
  const isSportAdmin = profile?.role === 'sport_admin'

  const { data: adminSportIds = [] } = useQuery({
    queryKey: ['my-sport-ids', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_sports').select('sport_id').eq('user_id', profile.id)
      if (error) throw error
      return (data ?? []).map((us) => us.sport_id)
    },
    enabled: isSportAdmin,
    staleTime: 1000 * 60 * 5,
  })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, user_sports(sport_id, sports(name, slug))')
        .order('full_name')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 30,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  function canEditUser(user) {
    if (isGeneralAdmin) return user.role !== 'general_admin'
    if (isSportAdmin) return (user.user_sports ?? []).some((us) => adminSportIds.includes(us.sport_id))
    return false
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setCreateError('')
    if (createForm.password.length < 6) {
      setCreateError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setCreateLoading(true)
    try {
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      )

      const { data: authData, error: signUpError } = await tempClient.auth.signUp({
        email: createForm.email.trim(),
        password: createForm.password,
      })

      if (signUpError) {
        setCreateError(
          signUpError.message.toLowerCase().includes('already registered')
            ? 'Ya existe un usuario con ese email.'
            : 'Error al crear la cuenta: ' + signUpError.message
        )
        return
      }

      if (!authData.user) {
        setCreateError('No se pudo crear el usuario. Comprueba que la confirmación de email está desactivada en Supabase.')
        return
      }

      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: createForm.email.trim().toLowerCase(),
        full_name: createForm.full_name.trim(),
        role: isGeneralAdmin ? createForm.role : 'user',
        is_active: true,
      })

      if (profileError) {
        setCreateError('Error al guardar el perfil del usuario.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      navigate(`/admin/users/${authData.user.id}`)
    } catch {
      setCreateError('Error inesperado. Inténtalo de nuevo.')
    } finally {
      setCreateLoading(false)
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field"
          style={{ flex: 1 }}
        />
        {(isGeneralAdmin || isSportAdmin) && (
          <button
            onClick={() => { setShowCreate(true); setCreateForm(EMPTY_FORM); setCreateError('') }}
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--teal)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}
          >
            + Crear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div>
          {filtered.map((user) => {
            const initials = user.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
            const sports = (user.user_sports ?? []).map((us) => us.sports).filter(Boolean)
            const editable = canEditUser(user)

            return (
              <div
                key={user.id}
                style={{
                  borderBottom: '1px solid var(--border)', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  opacity: user.is_active ? 1 : 0.6,
                }}
              >
                <div
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--teal-glow)', border: '1px solid var(--teal)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-head)', fontSize: '16px', fontWeight: 800, color: 'var(--teal)',
                    cursor: 'pointer',
                  }}
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0" onClick={() => navigate(`/admin/users/${user.id}`)} style={{ cursor: 'pointer' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.full_name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{ROLE_LABELS[user.role] ?? user.role}</span>
                    {sports.map((sport) => (
                      <span key={sport.slug} style={{
                        fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px',
                        color: SPORT_COLORS[sport.slug] ?? 'var(--teal)',
                        background: (SPORT_COLORS[sport.slug] ?? 'var(--teal)') + '22',
                      }}>
                        {SPORT_SHORT[sport.slug] ?? sport.name}
                      </span>
                    ))}
                  </div>
                </div>

                {editable && user.role !== 'general_admin' && (
                  <button
                    onClick={() => toggleMutation.mutate({ id: user.id, is_active: !user.is_active })}
                    disabled={toggleMutation.isPending}
                    style={{
                      padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                      border: `1px solid ${user.is_active ? 'var(--success)' : 'var(--danger)'}`,
                      color: user.is_active ? 'var(--success)' : 'var(--danger)',
                      background: 'transparent', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                )}

                <span onClick={() => navigate(`/admin/users/${user.id}`)} style={{ color: 'var(--muted)', fontSize: '20px', cursor: 'pointer', flexShrink: 0 }}>›</span>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>
              No se encontraron usuarios
            </p>
          )}
        </div>
      )}

      {/* Modal crear usuario */}
      {showCreate && (
        <>
          <div
            onClick={() => setShowCreate(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid var(--border)', zIndex: 101,
            maxHeight: '90vh', overflowY: 'auto',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          }}>
            <form onSubmit={handleCreateUser} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>
                Nuevo usuario
              </p>

              <input
                type="text"
                placeholder="Nombre completo"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                className="input-field"
                required
                autoComplete="off"
              />

              <input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                required
                autoComplete="off"
              />

              <input
                type="password"
                placeholder="Contraseña inicial (mín. 6 caracteres)"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="input-field"
                required
                autoComplete="new-password"
              />

              {isGeneralAdmin && (
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  className="input-field"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              )}

              {createError && (
                <p style={{ fontSize: '13px', color: 'var(--danger)', background: 'rgba(224,85,85,0.1)', padding: '10px 12px', borderRadius: '10px' }}>
                  {createError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--teal)', color: '#000', border: 'none', cursor: createLoading ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: createLoading ? 0.7 : 1 }}
                >
                  {createLoading ? 'Creando…' : 'CREAR USUARIO'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
