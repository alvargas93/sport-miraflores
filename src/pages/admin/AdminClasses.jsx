import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayStr, formatTime, formatDayLong, madridDayBounds } from '../../lib/utils'

const SPORT_COLORS = { crossfit: '#0abfbf', hyrox: '#e8a020' }

function addDays(str, n) {
  const d = new Date(str + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function AdminClasses() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['admin-classes', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, title, starts_at, ends_at, max_capacity, instructor, is_cancelled, sports(name, slug), reservations(id, status)')
        .gte('starts_at', madridDayBounds(selectedDate).start)
        .lte('starts_at', madridDayBounds(selectedDate).end)
        .order('starts_at')
      if (error) throw error
      return (data ?? []).map((cls) => ({
        ...cls,
        confirmed_count: cls.reservations?.filter((r) => r.status === 'confirmed').length ?? 0,
      }))
    },
    staleTime: 1000 * 30,
  })

  const displayDate = formatDayLong(selectedDate + 'T12:00:00')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Date navigation */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: '16px' }}
          >
            ‹
          </button>
          <p style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
            {displayDate}
          </p>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: '16px' }}
          >
            ›
          </button>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-field"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : classes.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>
          No hay clases este día.
        </p>
      ) : (
        <div>
          {classes.map((cls) => {
            const color = SPORT_COLORS[cls.sports?.slug] ?? 'var(--teal)'
            const full = cls.confirmed_count >= cls.max_capacity

            return (
              <div
                key={cls.id}
                onClick={() => navigate(`/admin/classes/${cls.id}`)}
                style={{
                  borderBottom: '1px solid var(--border)', padding: '14px 16px',
                  cursor: 'pointer', opacity: cls.is_cancelled ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{ width: '3px', height: '44px', borderRadius: '2px', background: cls.is_cancelled ? 'var(--muted)' : color, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontFamily: 'var(--font-head)', fontSize: '17px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.3px' }}>
                      {cls.title}
                    </p>
                    {cls.is_cancelled && (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--danger)', background: 'rgba(224,85,85,0.1)', padding: '2px 7px', borderRadius: '10px' }}>
                        CANCELADA
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
                    {cls.instructor ? ` · ${cls.instructor}` : ''}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: full && !cls.is_cancelled ? 'var(--danger)' : 'var(--text)' }}>
                    {cls.confirmed_count}/{cls.max_capacity}
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--muted)' }}>plazas</p>
                </div>

                <span style={{ color: 'var(--muted)', fontSize: '20px', flexShrink: 0 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
