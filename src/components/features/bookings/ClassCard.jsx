import { formatTime } from '../../../lib/utils'

const SPORT_COLORS = {
  crossfit: '#0abfbf',
  hyrox: '#e8a020',
}

function getState(cls) {
  const now = new Date()
  const startsAt = new Date(cls.starts_at)
  const endsAt = new Date(cls.ends_at)

  if (endsAt < now) return 'past'
  if (cls.is_booked) return 'booked'
  if (startsAt - now < 60 * 60 * 1000) return 'too_late'
  if (cls.confirmed_count >= cls.max_capacity) return 'full'
  return 'available'
}

const STATE_BADGE = {
  available: { label: null, color: 'var(--success)' },
  full:      { label: 'Completa', color: 'var(--danger)' },
  booked:    { label: 'Reservada', color: 'var(--teal)' },
  too_late:  { label: 'Cerrada', color: 'var(--muted)' },
  past:      { label: 'Pasada', color: 'var(--muted)' },
}

export default function ClassCard({ cls, onPress }) {
  const state = getState(cls)
  const badge = STATE_BADGE[state]
  const sportColor = SPORT_COLORS[cls.sport_slug] ?? 'var(--teal)'
  const free = cls.max_capacity - cls.confirmed_count
  const isPast = state === 'past' || state === 'too_late'

  return (
    <button
      onClick={() => onPress(cls)}
      style={{
        display: 'block',
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid',
        borderColor: state === 'booked' ? 'var(--teal)' : 'var(--border)',
        borderRadius: '14px',
        padding: '14px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        opacity: isPast ? 0.5 : 1,
        outline: 'none',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        {/* Sport badge */}
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: sportColor,
          fontFamily: 'var(--font-body)',
        }}>
          {cls.sport_name}
        </span>

        {/* State indicator */}
        <div className="flex items-center gap-1.5">
          {state === 'available' && (
            <>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--success)', fontFamily: 'var(--font-body)' }}>
                {free} {free === 1 ? 'plaza' : 'plazas'}
              </span>
            </>
          )}
          {badge.label && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: badge.color,
              fontFamily: 'var(--font-body)',
            }}>
              {badge.label}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: 'var(--font-head)',
        fontSize: '20px',
        fontWeight: 700,
        color: 'var(--text)',
        letterSpacing: '0.5px',
        lineHeight: 1.1,
        marginBottom: '6px',
      }}>
        {cls.title}
      </h3>

      {/* Time + instructor */}
      <div className="flex items-center gap-2" style={{ color: 'var(--muted)', fontSize: '13px' }}>
        <span>{formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}</span>
        {cls.instructor && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{cls.instructor}</span>
          </>
        )}
      </div>

      {/* Capacity bar */}
      <div className="mt-3 flex items-center gap-2">
        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--surface3)' }}>
          <div style={{
            height: '100%',
            borderRadius: '2px',
            width: `${Math.min((cls.confirmed_count / cls.max_capacity) * 100, 100)}%`,
            background: state === 'full' ? 'var(--danger)' : state === 'booked' ? 'var(--teal)' : 'var(--success)',
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0, fontFamily: 'var(--font-body)' }}>
          {cls.confirmed_count}/{cls.max_capacity}
        </span>
      </div>
    </button>
  )
}
