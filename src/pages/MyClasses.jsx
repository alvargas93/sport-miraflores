import { useState, useEffect } from 'react'
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

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isPast || cls.is_cancelled ? 'var(--border)' : sportColor + '33'}`,
      borderRadius: '16px',
      padding: '16px',
      opacity: isPast || cls.is_cancelled ? 0.6 : 1,
    }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span style={{
            fontSize: '10px', fontWeight: 600, letterSpacing: '1px',
            textTransform: 'uppercase', color: sportColor,
          }}>
            {cls.sports?.name}
          </span>
          <p style={{
            fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800,
            color: 'var(--text)', letterSpacing: '0.5px', lineHeight: 1.1,
            marginTop: '2px',
          }}>
            {cls.title}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', textTransform: 'capitalize' }}>
            {formatDayLong(cls.starts_at)} · {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
          </p>
          {cls.instructor && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {cls.instructor}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {cls.is_cancelled ? (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(224,85,85,0.1)', color: 'var(--danger)',
            }}>
              Cancelada
            </span>
          ) : isPast ? (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
              background: 'var(--surface2)', color: 'var(--muted)',
            }}>
              Finalizada
            </span>
          ) : (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
              background: 'var(--teal-glow)', color: 'var(--teal)',
            }}>
              Confirmada
            </span>
          )}

          {cancelable && (
            <button
              onClick={() => onCancel(reservation.id)}
              disabled={cancelling === reservation.id}
              style={{
                fontSize: '12px', padding: '5px 12px', borderRadius: '8px',
                border: '1px solid var(--danger)', color: 'var(--danger)',
                background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {cancelling === reservation.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3" style={{ opacity: 0.4 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p style={{ fontSize: '14px' }}>No tienes reservas</p>
    </div>
  )
}

export default function MyClasses() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const { data: reservations = [], isLoading, isError } = useMyReservations(profile?.id)
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
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
          MIS CLASES
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div
              className="w-7 h-7 rounded-full border-2 border-teal"
              style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
            />
          </div>
        )}

        {isError && (
          <div className="flex justify-center py-12">
            <p style={{ color: 'var(--danger)', fontSize: '14px' }}>Error al cargar tus reservas.</p>
          </div>
        )}

        {!isLoading && !isError && reservations.length === 0 && <EmptyState />}

        {!isLoading && !isError && reservations.length > 0 && (
          <div className="p-4 flex flex-col gap-6">
            {errorMsg && (
              <p style={{
                fontSize: '13px', color: 'var(--danger)',
                background: 'rgba(224,85,85,0.1)',
                padding: '10px 14px', borderRadius: '10px', textAlign: 'center',
              }}>
                {errorMsg}
              </p>
            )}

            {upcoming.length > 0 && (
              <section>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Próximas
                </p>
                <div className="flex flex-col gap-3">
                  {upcoming.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onCancel={handleCancel}
                      cancelling={cancelling}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Historial
                </p>
                <div className="flex flex-col gap-3">
                  {past.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onCancel={handleCancel}
                      cancelling={cancelling}
                    />
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
