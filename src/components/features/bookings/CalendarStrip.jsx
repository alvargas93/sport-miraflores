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
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid rgba(10,191,191,0.12)',
    }}>
      {/* Month label */}
      <div style={{
        padding: '10px 16px 0',
        fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
        color: 'var(--muted)', textTransform: 'uppercase',
        fontFamily: 'var(--font-head)',
      }}>
        {monthLabel}
      </div>

      {/* Day strip */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: '4px', padding: '8px 12px 12px',
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
                minWidth: '46px',
                padding: '8px 4px',
                borderRadius: '14px',
                border: isSelected ? 'none' : isToday ? '1.5px solid rgba(10,191,191,0.3)' : '1.5px solid transparent',
                background: isSelected
                  ? 'var(--teal)'
                  : isToday
                  ? 'rgba(10,191,191,0.07)'
                  : 'transparent',
                cursor: 'pointer',
                transform: isSelected ? 'scale(1.1) translateY(-4px)' : 'scale(1) translateY(0)',
                boxShadow: isSelected ? '0 8px 20px rgba(10,191,191,0.45)' : 'none',
                transition: 'background 0.2s, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.2s',
                flexShrink: 0,
                outline: 'none',
                gap: '2px',
                position: 'relative',
                zIndex: isSelected ? 1 : 0,
              }}
            >
              <span style={{
                fontSize: '9px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: isSelected ? 'rgba(0,0,0,0.6)' : isPast ? 'rgba(122,122,122,0.5)' : 'var(--muted)',
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
                color: isSelected
                  ? '#000'
                  : isPast
                  ? 'rgba(255,255,255,0.2)'
                  : isToday
                  ? 'var(--teal)'
                  : 'var(--text)',
              }}>
                {day.getDate()}
              </span>
              {isToday && !isSelected && (
                <div style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: 'var(--teal)',
                  boxShadow: '0 0 4px rgba(10,191,191,0.8)',
                }} />
              )}
              {(!isToday || isSelected) && <div style={{ height: '4px' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
