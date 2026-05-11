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

export default function ClassCard({ cls, onPress }) {
  const state = getState(cls)
  const sportColor = SPORT_COLORS[cls.sport_slug] ?? 'var(--teal)'
  const free = cls.max_capacity - cls.confirmed_count
  const isPast = state === 'past' || state === 'too_late'
  const fillPct = Math.min((cls.confirmed_count / cls.max_capacity) * 100, 100)

  const stateConfig = {
    available: { label: `${free} ${free === 1 ? 'plaza' : 'plazas'}`, color: 'var(--success)', dot: true },
    full:      { label: 'Completa', color: 'var(--danger)', dot: false },
    booked:    { label: 'Reservada', color: 'var(--teal)', dot: false },
    too_late:  { label: 'Cerrada', color: 'var(--muted)', dot: false },
    past:      { label: 'Finalizada', color: 'var(--muted)', dot: false },
  }[state]

  const barColor = state === 'full' ? 'var(--danger)' : state === 'booked' ? 'var(--teal)' : 'var(--success)'

  return (
    <button
      onClick={() => onPress(cls)}
      style={{
        display: 'block',
        width: '100%',
        background: state === 'booked' ? 'rgba(10,191,191,0.05)' : 'var(--surface)',
        border: `1.5px solid ${state === 'booked' ? 'rgba(10,191,191,0.4)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '16px',
        padding: '0',
        textAlign: 'left',
        cursor: isPast ? 'default' : 'pointer',
        opacity: isPast ? 0.5 : 1,
        outline: 'none',
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
    >
      {/* Sport accent bar */}
      <div style={{ height: '3px', background: sportColor, opacity: isPast ? 0.5 : 1 }} />

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Top row: sport label + state */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: sportColor,
            fontFamily: 'var(--font-body)',
          }}>
            {cls.sport_name}
          </span>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 600,
            color: stateConfig.color,
            background: stateConfig.color + '18',
            padding: '3px 9px', borderRadius: '20px',
          }}>
            {stateConfig.dot && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: stateConfig.color, flexShrink: 0 }} />
            )}
            {stateConfig.label}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: 'var(--font-head)',
          fontSize: '21px',
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '0.5px',
          lineHeight: 1.1,
          marginBottom: '5px',
        }}>
          {cls.title}
        </h3>

        {/* Time + instructor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'var(--surface2)', padding: '3px 8px', borderRadius: '6px',
            fontSize: '12px', color: 'var(--text)',
          }}>
            {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
          </span>
          {cls.instructor && (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.instructor}</span>
          )}
        </div>

        {/* Capacity bar */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--surface3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${fillPct}%`,
              background: barColor,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
            {cls.confirmed_count}/{cls.max_capacity}
          </span>
        </div>
      </div>
    </button>
  )
}
