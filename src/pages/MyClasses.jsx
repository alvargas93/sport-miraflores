import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMyReservations } from '../hooks/useMyReservations'
import { formatTime, formatDayLong } from '../lib/utils'

const SPORT_COLORS = {
  crossfit: '#0abfbf',
  hyrox: '#e8a020',
}

const CANCEL_ERRORS = {
  reservation_not_found: 'Reserva no encontrada.',
  cancellation_window_closed: 'No puedes cancelar una clase que ya ha comenzado hace más de 10 minutos.',
}

function canCancel(startsAt) {
  const limit = new Date(new Date(startsAt).getTime() + 10 * 60 * 1000)
  return new Date() < limit
}

function ReservationCard({ reservation, onCancel, cancelling }) {
  const cls = reservation.classes
  if (!cls) return null

  const now = new Date()
  const startsAt = new Date(cls.starts_at)
  const endsAt = new Date(cls.ends_at)
  const isPast = endsAt < now
  const sportColor = SPORT_COLORS[cls.sports?.slug] ?? 'var(--teal)'
  const cancelable = canCancel(cls.starts_at) && !isPast && !cls.is_cancelled

  const statusConfig = cls.is_cancelled
    ? { label: 'Cancelada', bg: 'rgba(224,85,85,0.12)', color: 'var(--danger)' }
    : isPast
      ? { label: 'Finalizada', bg: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }
      : { label: 'Confirmada', bg: 'rgba(10,191,191,0.12)', color: 'var(--teal)' }

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: '16px',
      overflow: 'hidden',
      border: `1.5px solid ${isPast || cls.is_cancelled ? 'rgba(255,255,255,0.04)' : sportColor + '30'}`,
      opacity: isPast || cls.is_cancelled ? 0.65 : 1,
    }}>
      {/* Sport accent bar */}
      <div style={{ height: '3px', background: sportColor }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Top: sport + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: sportColor,
          }}>
            {cls.sports?.name}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
            background: statusConfig.bg, color: statusConfig.color,
          }}>
            {statusConfig.label}
          </span>
        </div>

        {/* Title */}
        <p style={{
          fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800,
          color: 'var(--text)', letterSpacing: '0.5px', lineHeight: 1.1,
          marginBottom: '8px',
        }}>
          {cls.title}
        </p>

        {/* Date + time row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '12px', color: 'var(--muted)', textTransform: 'capitalize',
          }}>
            {formatDayLong(cls.starts_at)}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: '12px', color: 'var(--text)',
            background: 'var(--surface2)', padding: '3px 8px', borderRadius: '6px',
          }}>
            {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
          </span>
          {cls.instructor && (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.instructor}</span>
          )}
        </div>

        {/* Cancel button */}
        {cancelable && (
          <button
            onClick={() => onCancel(reservation.id)}
            disabled={cancelling === reservation.id}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '9px',
              borderRadius: '10px',
              border: '1px solid rgba(224,85,85,0.4)',
              color: 'var(--danger)',
              background: 'rgba(224,85,85,0.06)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: cancelling === reservation.id ? 'default' : 'pointer',
              letterSpacing: '0.3px',
            }}
          >
            {cancelling === reservation.id ? 'Cancelando…' : 'Cancelar reserva'}
          </button>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)',
      textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '2px',
    }}>
      {children}
    </p>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', color: 'var(--muted)',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '20px',
        background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="4" width="18" height="18" rx="3"/>
          <polyline points="8,9 10.5,11.5 15,7"/>
          <line x1="8" y1="15" x2="16" y2="15"/>
        </svg>
      </div>
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Sin reservas</p>
      <p style={{ fontSize: '13px' }}>Tus próximas clases aparecerán aquí</p>
    </div>
  )
}

export default function MyClasses() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const { data: reservations = [], isLoading, isError, error } = useMyReservations(profile?.id)
  const [cancelling, setCancelling] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const cancelMutation = useMutation({
    mutationFn: async (reservationId) => {
      const { data, error } = await supabase.rpc('cancel_reservation', {
        p_reservation_id: reservationId,
        p_user_id: profile.id,
      })
      if (error) throw error
      return { reservationId, data }
    },
    onSuccess: ({ reservationId, data }) => {
      setCancelling(null)
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['my-reservations', profile.id] })
        queryClient.invalidateQueries({ queryKey: ['bono', profile.id] })
      } else {
        setErrorMsg(CANCEL_ERRORS[data.error] ?? 'No se pudo cancelar la reserva.')
      }
    },
    onError: () => {
      setCancelling(null)
      setErrorMsg('Error de conexión. Inténtalo de nuevo.')
    },
  })

  function handleCancel(reservationId) {
    setErrorMsg('')
    setCancelling(reservationId)
    cancelMutation.mutate(reservationId)
  }

  const now = new Date()
  const upcoming = reservations.filter((r) => r.classes && !r.classes.is_cancelled && new Date(r.classes.ends_at) >= now)
  const past = reservations.filter((r) => r.classes && (r.classes.is_cancelled || new Date(r.classes.ends_at) < now))

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid rgba(10,191,191,0.1)',
        padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
          MIS CLASES
        </h1>
        <img src="/logo.png" alt="Sport Miraflores" className="logo-img" style={{ height: '38px', opacity: 0.75 }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="w-7 h-7 rounded-full border-2 border-teal"
              style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {isError && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', gap: '6px' }}>
            <p style={{ color: 'var(--danger)', fontSize: '14px' }}>Error al cargar tus reservas.</p>
            {error?.message && (
              <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>{error.message}</p>
            )}
          </div>
        )}

        {!isLoading && !isError && reservations.length === 0 && <EmptyState />}

        {!isLoading && !isError && reservations.length > 0 && (
          <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {errorMsg && (
              <div style={{
                padding: '12px 16px', borderRadius: '12px',
                background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.2)',
                fontSize: '13px', color: 'var(--danger)',
              }}>
                {errorMsg}
              </div>
            )}

            {upcoming.length > 0 && (
              <section>
                <SectionLabel>Próximas · {upcoming.length}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upcoming.map((r) => (
                    <ReservationCard key={r.id} reservation={r} onCancel={handleCancel} cancelling={cancelling} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <SectionLabel>Historial</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {past.map((r) => (
                    <ReservationCard key={r.id} reservation={r} onCancel={handleCancel} cancelling={cancelling} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
