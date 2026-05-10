import { useRef, useEffect } from 'react'
import { parseDateLocal, todayStr } from '../../../lib/utils'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

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
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 16px 2px', fontSize: '11px', letterSpacing: '1.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>
        {monthLabel}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-1 px-3 pb-3 pt-1"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
                minWidth: '42px',
                padding: '7px 5px 6px',
                borderRadius: '11px',
                border: '1.5px solid',
                borderColor: isSelected ? 'var(--teal)' : 'transparent',
                background: isSelected ? 'var(--teal-glow)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
                outline: 'none',
              }}
            >
              <span style={{
                fontSize: '9px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: isSelected ? 'var(--teal)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
              }}>
                {DAYS[day.getDay()]}
              </span>
              <span style={{
                fontSize: '19px',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: isSelected ? 'var(--teal)' : isPast ? 'var(--muted)' : 'var(--text)',
              }}>
                {day.getDate()}
              </span>
              {isToday && (
                <div style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: 'var(--teal)', marginTop: '2px',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
