import { useRef, useEffect } from 'react'
import { parseDateLocal, todayStr } from '../../../lib/utils'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function generateDays(center, before = 3, after = 30) {
  const days = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(center)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

export default function CalendarStrip({ selectedDate, onSelectDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = generateDays(today)
  const scrollRef = useRef(null)
  const todayRef = useRef(null)

  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const c = scrollRef.current
      const el = todayRef.current
      c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
    }
  }, [])

  const selectedDateObj = selectedDate ? parseDateLocal(selectedDate) : today
  const monthLabel = `${MONTHS[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()}`

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(10,191,191,0.1)' }}>
      {/* Month label */}
      <div style={{
        padding: '10px 16px 0',
        fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
        color: 'var(--muted)', textTransform: 'uppercase',
        fontFamily: 'var(--font-head)',
      }}>
        {monthLabel}
      </div>

      {/* Day strip */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: '4px', padding: '8px 12px 10px',
          overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      >
        {days.map((day) => {
          const dateStr = toStr(day)
          const isToday = dateStr === todayStr()
          const isSelected = dateStr === selectedDate
          const isPast = day < today

          return (
            <button
              key={dateStr}
              ref={isToday ? todayRef : null}
              onClick={() => onSelectDate(dateStr)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '44px',
                padding: '7px 4px',
                borderRadius: '12px',
                border: 'none',
                background: isSelected ? 'var(--teal)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0,
                outline: 'none',
                gap: '2px',
              }}
            >
              <span style={{
                fontSize: '9px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: isSelected ? 'rgba(0,0,0,0.65)' : isPast ? 'var(--muted)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
              }}>
                {DAYS[day.getDay()]}
              </span>
              <span style={{
                fontSize: '20px',
                fontFamily: 'var(--font-head)',
                fontWeight: 800,
                lineHeight: 1.15,
                color: isSelected ? '#000' : isPast ? 'rgba(255,255,255,0.25)' : isToday ? 'var(--teal)' : 'var(--text)',
              }}>
                {day.getDate()}
              </span>
              {/* Today dot (only when not selected) */}
              {isToday && !isSelected && (
                <div style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: 'var(--teal)',
                }} />
              )}
              {/* Spacer when no dot */}
              {(!isToday || isSelected) && <div style={{ height: '4px' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
