import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currentMonthStart, formatDate } from '../../lib/utils'

const SPORT_COLORS = { crossfit: '#0abfbf', hyrox: '#e8a020' }

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
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

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: userSportIds = [] } = useQuery({
    queryKey: ['admin-user-sports', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_sports').select('sport_id').eq('user_id', id)
      if (error) throw error
      return (data ?? []).map((us) => us.sport_id)
    },
  })

  const { data: allSports = [] } = useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sports').select('*').eq('is_active', true).order('name')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const { data: bonoCatalog = [] } = useQuery({
    queryKey: ['bonos-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bonos').select('*').eq('is_active', true).order('max_classes', { nullsFirst: false })
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const { data: bonoHistory = [] } = useQuery({
    queryKey: ['admin-user-bonos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_bonos')
        .select('*, bonos(name, max_classes)')
        .eq('user_id', id)
        .order('month', { ascending: false })
        .limit(12)
      if (error) throw error
      return data ?? []
    },
  })

  // canEdit: sport_admin puede editar si comparte al menos un deporte con el usuario
  const canEdit = isGeneralAdmin || (isSportAdmin && adminSportIds.some((sid) => userSportIds.includes(sid)))

  // canToggleSport: general_admin puede todos; sport_admin solo sus deportes
  function canToggleSport(sport) {
    return isGeneralAdmin || (isSportAdmin && adminSportIds.includes(sport.id))
  }

  const sportMutation = useMutation({
    mutationFn: async ({ sportId, add }) => {
      if (add) {
        const { error } = await supabase.from('user_sports').insert({ user_id: id, sport_id: sportId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_sports').delete().eq('user_id', id).eq('sport_id', sportId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-sports', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const activeMutation = useMutation({
    mutationFn: async (is_active) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const [selectedBonoId, setSelectedBonoId] = useState('')
  const [bonoSuccess, setBonoSuccess] = useState(false)
  const [bonoError, setBonoError] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [zoomedAvatar, setZoomedAvatar] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delete_user_account', { p_user_id: id })
      if (error) throw error
      if (!data.success) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      navigate('/admin/users')
    },
    onError: (err) => setDeleteError(err.message),
  })

  const recurringMutation = useMutation({
    mutationFn: async (newBonoId) => {
      const { error: userError } = await supabase
        .from('users')
        .update({ recurring_bono_id: newBonoId ?? null })
        .eq('id', id)
      if (userError) throw userError

      if (newBonoId) {
        const month = currentMonthStart()
        const { data: existing } = await supabase
          .from('user_bonos').select('id').eq('user_id', id).eq('month', month).maybeSingle()
        if (existing) {
          const { error } = await supabase
            .from('user_bonos').update({ bono_id: newBonoId, assigned_by: profile.id }).eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('user_bonos').insert({ user_id: id, bono_id: newBonoId, month, classes_used: 0, assigned_by: profile.id })
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-bonos', id] })
      setSelectedBonoId('')
      setBonoError('')
      setBonoSuccess(true)
      setTimeout(() => setBonoSuccess(false), 2500)
    },
    onError: (err) => setBonoError(err.message),
  })

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!user) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Usuario no encontrado.</p>

  const initials = user.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Avatar zoom overlay */}
      {zoomedAvatar && (
        <div
          onClick={() => setZoomedAvatar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{
            width: '240px', height: '240px', borderRadius: '50%',
            border: '3px solid var(--teal)', overflow: 'hidden',
            background: 'var(--teal-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontSize: '80px', fontWeight: 800, color: 'var(--teal)',
          }}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px 16px' }}>
        <button onClick={() => navigate('/admin/users')} style={{ fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '12px', display: 'block' }}>
          ← Usuarios
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => setZoomedAvatar(true)}
            style={{
              width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--teal-glow)', border: '2px solid var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--teal)',
              overflow: 'hidden', cursor: 'pointer',
            }}
          >
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.5px' }}>
              {user.full_name}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          </div>
          {canEdit && user.role !== 'general_admin' && (
            <button
              onClick={() => activeMutation.mutate(!user.is_active)}
              disabled={activeMutation.isPending}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                border: `1px solid ${user.is_active ? 'var(--success)' : 'var(--danger)'}`,
                color: user.is_active ? 'var(--success)' : 'var(--danger)',
                background: 'transparent', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {user.is_active ? 'Activo' : 'Inactivo'}
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation sheet */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', zIndex: 101, padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }}>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginBottom: '8px' }}>
              Eliminar usuario
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
              Se eliminarán todos los datos de <strong style={{ color: 'var(--text)' }}>{user.full_name}</strong> de forma permanente: reservas, bonos y acceso a la app. Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}>
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', opacity: deleteMutation.isPending ? 0.7 : 1 }}
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Sports */}
        <Section title="Deportes asignados">
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {allSports.map((sport) => {
              const assigned = userSportIds.includes(sport.id)
              const color = SPORT_COLORS[sport.slug] ?? 'var(--teal)'
              const togglable = canToggleSport(sport)

              if (!togglable) {
                if (!assigned) return null
                return (
                  <span key={sport.id} style={{
                    padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                    border: `1px solid ${color}`,
                    background: color + '33',
                    color,
                  }}>
                    {sport.name} ✓
                  </span>
                )
              }

              return (
                <button
                  key={sport.id}
                  onClick={() => sportMutation.mutate({ sportId: sport.id, add: !assigned })}
                  disabled={sportMutation.isPending}
                  style={{
                    padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                    border: `1px solid ${color}`,
                    background: assigned ? color + '33' : 'transparent',
                    color: assigned ? color : 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >
                  {sport.name} {assigned ? '✓' : '+'}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Bono y historial: solo si el admin puede editar al usuario */}
        {canEdit && (
          <>
            <Section title="Bono recurrente">
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {user.recurring_bono_id ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--teal-glow)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--teal)' }}>
                          {bonoCatalog.find((b) => b.id === user.recurring_bono_id)?.name ?? '…'}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>Se renueva automáticamente cada mes</p>
                      </div>
                      <button
                        onClick={() => recurringMutation.mutate(null)}
                        disabled={recurringMutation.isPending}
                        style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Quitar
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Cambiar tipo de bono:</p>
                  </>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Sin bono recurrente asignado.</p>
                )}
                <select value={selectedBonoId} onChange={(e) => setSelectedBonoId(e.target.value)} className="input-field">
                  <option value="">Selecciona tipo de bono...</option>
                  {bonoCatalog.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.max_classes ? ` (${b.max_classes} clases)` : ' (ilimitado)'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => recurringMutation.mutate(selectedBonoId)}
                  disabled={!selectedBonoId || recurringMutation.isPending}
                  className="btn-primary"
                  style={{ opacity: !selectedBonoId ? 0.5 : 1 }}
                >
                  {recurringMutation.isPending ? 'Guardando…' : user.recurring_bono_id ? 'CAMBIAR BONO' : 'ASIGNAR BONO RECURRENTE'}
                </button>
                {bonoSuccess && <p style={{ fontSize: '12px', color: 'var(--success)', textAlign: 'center' }}>Guardado correctamente.</p>}
                {bonoError && <p style={{ fontSize: '12px', color: 'var(--danger)', textAlign: 'center' }}>{bonoError}</p>}
              </div>
            </Section>

            {bonoHistory.length > 0 && (
              <Section title="Historial de bonos">
                {bonoHistory.map((ub) => {
                  const monthLabel = formatDate(ub.month + 'T12:00:00', { month: 'long', year: 'numeric' })
                  const max = ub.bonos?.max_classes
                  return (
                    <div key={ub.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--text)', textTransform: 'capitalize' }}>{monthLabel}</p>
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{ub.bonos?.name}</p>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {max === null ? `${ub.classes_used} usadas` : `${ub.classes_used}/${max}`}
                      </span>
                    </div>
                  )
                })}
              </Section>
            )}
          </>
        )}

        {/* Eliminar usuario */}
        {canEdit && user.role !== 'general_admin' && (
          <button
            onClick={() => { setShowDeleteConfirm(true); setDeleteError('') }}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px',
              background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.3)',
              color: 'var(--danger)', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', marginTop: '4px',
            }}
          >
            Eliminar usuario
          </button>
        )}
      </div>
    </div>
  )
}
