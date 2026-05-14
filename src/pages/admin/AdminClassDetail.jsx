import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatTime, formatDayLong } from '../../lib/utils'

const SPORT_COLORS = { crossfit: '#0abfbf', hyrox: '#e8a020' }

const ADD_ERRORS = {
  class_not_found: 'Clase no encontrada.',
  already_booked: 'El usuario ya tiene esta clase reservada.',
}

export default function AdminClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [addError, setAddError] = useState('')
  const [overrideUserId, setOverrideUserId] = useState(null)
  const [zoomedUser, setZoomedUser] = useState(null)

  const { data: classData, isLoading } = useQuery({
    queryKey: ['admin-class-detail', id],
    queryFn: async () => {
      const [classRes, enrollRes] = await Promise.all([
        supabase.from('classes').select('*, sports(name, slug)').eq('id', id).single(),
        supabase.rpc('get_class_enrollments', { p_class_id: id }),
      ])
      if (classRes.error) throw classRes.error
      const reservations = (enrollRes.data ?? []).map((r) => ({
        id: r.reservation_id,
        booked_at: r.booked_at,
        is_admin_override: r.is_admin_override,
        users: { id: r.user_id, full_name: r.user_full_name, email: r.user_email, avatar_url: r.user_avatar_url },
      }))
      return { ...classRes.data, reservations }
    },
  })

  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('is_active', true)
        .or(`full_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`)
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: userSearch.length >= 2,
    staleTime: 0,
  })

  const addMutation = useMutation({
    mutationFn: async ({ userId, override }) => {
      const { data, error } = await supabase.rpc('admin_add_user_to_class', {
        p_class_id: id,
        p_user_id: userId,
        p_admin_id: profile.id,
        p_override: override,
      })
      if (error) throw error
      return { data, userId }
    },
    onSuccess: ({ data, userId }) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-class-detail', id] })
        queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
        setUserSearch('')
        setAddError('')
        setOverrideUserId(null)
      } else if (data.error === 'class_full') {
        setOverrideUserId(userId)
        setAddError('La clase está completa. ¿Añadir igualmente?')
      } else {
        setAddError(ADD_ERRORS[data.error] ?? 'Error al añadir usuario.')
        setOverrideUserId(null)
      }
    },
    onError: (err) => setAddError(`Error: ${err?.message ?? 'Error de conexión.'}`),
  })

  const removeMutation = useMutation({
    mutationFn: async (reservationId) => {
      const { data, error } = await supabase.rpc('admin_remove_user_from_class', {
        p_reservation_id: reservationId,
        p_admin_id: profile.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-class-detail', id] })
        queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cancel_class_by_admin', {
        p_class_id: id,
        p_admin_id: profile.id,
        p_reason: cancelReason || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data?.user_ids?.length > 0) {
        supabase.functions.invoke('notify-class-cancelled', {
          body: {
            user_ids: data.user_ids,
            class_title: classData?.title ?? '',
            starts_at: classData?.starts_at ?? '',
          },
        }).catch(() => {})
      }
      queryClient.invalidateQueries({ queryKey: ['admin-class-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
      setConfirmCancel(false)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('classes')
        .update({ is_cancelled: false, cancel_reason: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
    },
  })

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!classData) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Clase no encontrada.</p>

  const cls = classData
  const sportColor = SPORT_COLORS[cls.sports?.slug] ?? 'var(--teal)'
  const isPast = new Date(cls.ends_at) < new Date()
  const confirmedCount = cls.reservations.length
  const capacityPct = Math.min((confirmedCount / cls.max_capacity) * 100, 100)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {zoomedUser && createPortal(
        <div
          onClick={() => setZoomedUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: '240px', height: '240px', borderRadius: '50%', border: '3px solid var(--teal)', overflow: 'hidden', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: '80px', fontWeight: 800, color: 'var(--teal)' }}>
            {zoomedUser.avatar_url
              ? <img src={zoomedUser.avatar_url} alt={zoomedUser.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : zoomedUser.initials}
          </div>
        </div>,
        document.body
      )}
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px 16px' }}>
        <button onClick={() => navigate('/admin/classes')} style={{ fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '10px', display: 'block' }}>
          ← Clases
        </button>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: sportColor }}>
          {cls.sports?.name}
        </span>
        <p style={{ fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.5px', marginTop: '2px' }}>
          {cls.title}
          {cls.is_cancelled && (
            <span style={{ fontSize: '12px', color: 'var(--danger)', marginLeft: '10px', fontFamily: 'var(--font-body)', fontWeight: 400 }}>CANCELADA</span>
          )}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px', textTransform: 'capitalize' }}>
          {formatDayLong(cls.starts_at)} · {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
        </p>
        {cls.instructor && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>{cls.instructor}</p>}

        {!cls.is_cancelled && !isPast && (
          <button
            onClick={() => setConfirmCancel(true)}
            style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            Cancelar clase
          </button>
        )}

        {cls.is_cancelled && (
          <button
            onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending}
            style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--success)', color: 'var(--success)', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: reactivateMutation.isPending ? 0.6 : 1 }}
          >
            {reactivateMutation.isPending ? 'Reactivando…' : 'Reactivar clase'}
          </button>
        )}
      </div>

      {/* Cancel confirmation sheet */}
      {confirmCancel && (
        <>
          <div onClick={() => setConfirmCancel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', zIndex: 101, padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }}>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginBottom: '8px' }}>
              Cancelar clase
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
              Se cancelará la clase y se devolverá el bono a los {confirmedCount} inscritos.
            </p>
            <input
              type="text"
              placeholder="Motivo de cancelación (opcional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input-field"
              style={{ marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}>
                Cancelar
              </button>
              <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
                {cancelMutation.isPending ? 'Cancelando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Capacity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Aforo</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: confirmedCount >= cls.max_capacity ? 'var(--danger)' : 'var(--text)' }}>
              {confirmedCount}/{cls.max_capacity}
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${capacityPct}%`, background: capacityPct >= 100 ? 'var(--danger)' : 'var(--teal)', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Add user */}
        {!cls.is_cancelled && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
              Añadir usuario
            </p>
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setAddError(''); setOverrideUserId(null) }}
                className="input-field"
              />

              {searchResults.length > 0 && !addError && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  {searchResults.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => addMutation.mutate({ userId: u.id, override: false })}
                      disabled={addMutation.isPending}
                      style={{
                        width: '100%', padding: '10px 14px', textAlign: 'left',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{u.full_name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{u.email}</p>
                    </button>
                  ))}
                </div>
              )}

              {addError && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--warning)' }}>{addError}</p>
                  {overrideUserId && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => { setOverrideUserId(null); setAddError('') }} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px' }}>
                        Cancelar
                      </button>
                      <button onClick={() => addMutation.mutate({ userId: overrideUserId, override: true })} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--warning)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                        Añadir igualmente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reservations */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
            Inscritos ({confirmedCount})
          </p>
          {cls.reservations.length === 0 ? (
            <p style={{ borderTop: '1px solid var(--border)', padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
              Sin inscritos
            </p>
          ) : (
            cls.reservations.map((r) => {
              const initials = r.users?.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
              return (
                <div
                  key={r.id}
                  onClick={() => setZoomedUser({ avatar_url: r.users?.avatar_url, full_name: r.users?.full_name, initials })}
                  style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}
                >
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'var(--teal-glow)', border: '1.5px solid var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: '13px', fontWeight: 800, color: 'var(--teal)', overflow: 'hidden', pointerEvents: 'none' }}>
                    {r.users?.avatar_url
                      ? <img src={r.users.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.users?.full_name}
                      {r.is_admin_override && (
                        <span style={{ fontSize: '10px', color: 'var(--warning)', marginLeft: '6px', fontWeight: 400 }}>override</span>
                      )}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.users?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeMutation.mutate(r.id) }}
                    disabled={removeMutation.isPending}
                    style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
