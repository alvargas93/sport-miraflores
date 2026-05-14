import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { formatTime, formatDayLong } from '../../../lib/utils'
import { useAuth } from '../../../hooks/useAuth'
import { useBono } from '../../../hooks/useBono'

const SPORT_COLORS = {
  crossfit: '#0abfbf',
  hyrox: '#e8a020',
}

const BOOK_ERRORS = {
  user_inactive:     'Tu cuenta está desactivada. Contacta con el gimnasio.',
  class_not_found:   'Esta clase no está disponible.',
  too_late_to_book:  'Solo puedes reservar con más de 1 hora de antelación.',
  sport_not_assigned:'No tienes este deporte asignado.',
  class_full:        'Esta clase está completa.',
  already_booked:    'Ya tienes esta clase reservada.',
  no_bono:           'No tienes bono activo para este mes.',
  bono_exhausted:    'Has agotado las clases de tu bono este mes.',
}

const CANCEL_ERRORS = {
  reservation_not_found:     'Reserva no encontrada.',
  cancellation_window_closed:'No puedes cancelar una clase que ya ha comenzado hace más de 10 minutos.',
}

function getState(cls) {
  if (!cls) return null
  const now = new Date()
  const startsAt = new Date(cls.starts_at)
  const endsAt = new Date(cls.ends_at)
  if (cls.is_cancelled) return 'cancelled'
  if (endsAt < now) return 'past'
  if (cls.is_booked) return 'booked'
  if (startsAt - now < 60 * 60 * 1000) return 'too_late'
  if (cls.confirmed_count >= cls.max_capacity) return 'full'
  return 'available'
}

export default function ClassModal({ cls, selectedDate, onClose }) {
  const { profile } = useAuth()
  const { data: bono } = useBono(profile?.id)
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [zoomedAttendee, setZoomedAttendee] = useState(null)

  const state = getState(cls)
  const sportColor = cls ? (SPORT_COLORS[cls.sport_slug] ?? 'var(--teal)') : 'var(--teal)'
  const free = cls ? cls.max_capacity - cls.confirmed_count : 0

  const { data: attendees = [] } = useQuery({
    queryKey: ['class-attendees', cls?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_class_attendees', { p_class_id: cls.id })
      if (error) throw error
      return data ?? []
    },
    enabled: !!cls?.id,
    staleTime: 1000 * 30,
  })

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const bookMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('book_class', {
        p_class_id: cls.id,
        p_user_id:  profile.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['classes', selectedDate] })
        queryClient.invalidateQueries({ queryKey: ['bono', profile.id] })
        queryClient.invalidateQueries({ queryKey: ['class-attendees', cls.id] })
        setBookingSuccess(true)
        setTimeout(onClose, 1300)
      } else if (data.error === 'too_early_to_book') {
        const opensAt = new Date(new Date(cls.starts_at).getTime() - 24 * 60 * 60 * 1000)
        setError(`Las reservas abren el ${formatDayLong(opensAt)} a las ${formatTime(opensAt)}.`)
      } else {
        setError(BOOK_ERRORS[data.error] ?? 'Error al reservar. Inténtalo de nuevo.')
      }
    },
    onError: (err) => setError(`Error: ${err?.message ?? 'Error de conexión.'}`),
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cancel_reservation', {
        p_reservation_id: cls.reservation_id,
        p_user_id:        profile.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['classes', selectedDate] })
        queryClient.invalidateQueries({ queryKey: ['bono', profile.id] })
        queryClient.invalidateQueries({ queryKey: ['class-attendees', cls.id] })
        onClose()
      } else {
        setError(CANCEL_ERRORS[data.error] ?? 'No se pudo cancelar la reserva.')
      }
    },
    onError: () => setError('Error de conexión. Inténtalo de nuevo.'),
  })

  const isPending = bookMutation.isPending || cancelMutation.isPending

  const bonoLabel = bono
    ? bono.bonos.max_classes === null
      ? `${bono.bonos.name} (ilimitado)`
      : `${bono.bonos.name} · ${bono.bonos.max_classes - bono.classes_used} clases restantes`
    : 'Sin bono activo este mes'

  return (
    <>
      {zoomedAttendee && createPortal(
        <div
          onClick={() => setZoomedAttendee(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: '240px', height: '240px', borderRadius: '50%', border: '3px solid var(--teal)', overflow: 'hidden', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: '80px', fontWeight: 800, color: 'var(--teal)' }}>
            {zoomedAttendee.avatar_url
              ? <img src={zoomedAttendee.avatar_url} alt={zoomedAttendee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : zoomedAttendee.initials}
          </div>
        </div>,
        document.body
      )}

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 100,
          animation: 'fade-up 0.25s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(10,191,191,0.15)',
          zIndex: 101,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          animation: 'slide-up-spring 0.48s cubic-bezier(0.34, 1.26, 0.64, 1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--surface3)' }} />
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          {/* Sport badge */}
          <span style={{
            fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
            textTransform: 'uppercase', color: sportColor,
            fontFamily: 'var(--font-body)',
          }}>
            {cls?.sport_name}
          </span>

          {/* Title */}
          <h2 style={{
            fontFamily: 'var(--font-head)',
            fontSize: '28px', fontWeight: 800,
            color: 'var(--text)', letterSpacing: '0.5px',
            lineHeight: 1.05, marginTop: '4px',
          }}>
            {cls?.title}
          </h2>

          {/* Date / time */}
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '6px', textTransform: 'capitalize' }}>
            {cls && formatDayLong(cls.starts_at)} · {cls && formatTime(cls.starts_at)} – {cls && formatTime(cls.ends_at)}
          </p>

          {cls?.instructor && (
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>
              Instructor: <span style={{ color: 'var(--text)' }}>{cls.instructor}</span>
            </p>
          )}

          {cls?.notes && (
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
              {cls.notes}
            </p>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

          {/* Capacity */}
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Aforo</span>
            <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>
              {cls?.confirmed_count}/{cls?.max_capacity}
              {state === 'available' && <span style={{ color: 'var(--success)', fontWeight: 400, marginLeft: '6px' }}>({free} libres)</span>}
              {state === 'full' && <span style={{ color: 'var(--danger)', fontWeight: 400, marginLeft: '6px' }}>(Completa)</span>}
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface3)', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{
              height: '100%',
              width: `${cls ? Math.min((cls.confirmed_count / cls.max_capacity) * 100, 100) : 0}%`,
              background: state === 'full' ? 'var(--danger)' : state === 'booked' ? 'var(--teal)' : 'var(--success)',
              borderRadius: '3px',
              transition: 'width 0.4s',
            }} />
          </div>

          {/* Attendees */}
          {attendees.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Apuntados · {attendees.length}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {attendees.map((a, i) => {
                  const initials = a.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '48px' }}>
                      <button
                        type="button"
                        onClick={() => setZoomedAttendee({ avatar_url: a.avatar_url, full_name: a.full_name, initials })}
                        style={{
                          width: '42px', height: '42px', borderRadius: '50%',
                          background: a.avatar_url ? 'transparent' : 'var(--teal-glow)',
                          border: '1.5px solid var(--border)',
                          overflow: 'hidden', flexShrink: 0, padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-head)', fontSize: '14px', fontWeight: 800, color: 'var(--teal)',
                          cursor: 'pointer',
                        }}
                      >
                        {a.avatar_url
                          ? <img src={a.avatar_url} alt={a.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                          : initials}
                      </button>
                      <p style={{ fontSize: '9px', color: 'var(--muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {a.full_name?.split(' ')[0]}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bono */}
          <div className="flex items-center justify-between" style={{
            padding: '10px 14px',
            background: 'var(--surface2)',
            borderRadius: '10px',
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tu bono</span>
            <span style={{
              fontSize: '13px', fontWeight: 600,
              color: bono ? 'var(--text)' : 'var(--danger)',
            }}>
              {bonoLabel}
            </span>
          </div>

          {/* Error */}
          {error && (
            <p style={{
              fontSize: '13px', color: 'var(--danger)',
              background: 'rgba(224,85,85,0.1)',
              padding: '10px 14px', borderRadius: '10px',
              marginBottom: '16px', textAlign: 'center',
            }}>
              {error}
            </p>
          )}

          {/* Action button */}
          {state === 'available' && (
            <button
              onClick={() => { setError(''); bookMutation.mutate() }}
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? 'Reservando...' : 'RESERVAR PLAZA'}
            </button>
          )}

          {state === 'booked' && (
            <button
              onClick={() => { setError(''); cancelMutation.mutate() }}
              disabled={isPending}
              className="btn-primary"
              style={{ background: 'var(--surface3)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
            >
              {isPending ? 'Cancelando...' : 'CANCELAR RESERVA'}
            </button>
          )}

          {state === 'full' && (
            <div className="btn-primary" style={{ background: 'var(--surface3)', color: 'var(--muted)', cursor: 'default', textAlign: 'center' }}>
              CLASE COMPLETA
            </div>
          )}

          {(state === 'too_late' || state === 'past') && (
            <div className="btn-primary" style={{ background: 'var(--surface3)', color: 'var(--muted)', cursor: 'default', textAlign: 'center' }}>
              {state === 'past' ? 'CLASE FINALIZADA' : 'RESERVA CERRADA'}
            </div>
          )}

          {state === 'cancelled' && (
            <div className="btn-primary" style={{ background: 'var(--surface3)', color: 'var(--muted)', cursor: 'default', textAlign: 'center' }}>
              CLASE CANCELADA
            </div>
          )}
        </div>
      </div>

      {/* Booking success overlay */}
      {bookingSuccess && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          zIndex: 200,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '16px',
        }}>
          {/* Expanding ring */}
          <div style={{
            position: 'absolute',
            width: '100px', height: '100px',
            borderRadius: '50%',
            border: '2px solid rgba(10,191,191,0.7)',
            animation: 'ring-expand 0.9s ease-out forwards',
          }} />

          {/* Checkmark circle */}
          <div style={{
            width: '80px', height: '80px',
            borderRadius: '50%',
            background: 'rgba(10,191,191,0.12)',
            border: '2px solid var(--teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'success-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="var(--teal)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 24,
                  animation: 'check-draw 0.38s ease 0.32s both',
                }}
              />
            </svg>
          </div>

          <p style={{
            fontFamily: 'var(--font-head)',
            fontSize: '20px', fontWeight: 800,
            color: 'var(--teal)', letterSpacing: '0.5px',
            animation: 'fade-up 0.4s ease 0.5s both',
          }}>
            ¡Reserva confirmada!
          </p>
        </div>
      )}
    </>
  )
}
