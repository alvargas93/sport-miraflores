import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayStr, madridDayBounds } from '../../lib/utils'

function StatCard({ label, value, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '16px 10px', textAlign: 'center',
        cursor: 'pointer', flex: 1,
      }}
    >
      <p style={{ fontFamily: 'var(--font-head)', fontSize: '36px', fontWeight: 800, color: 'var(--teal)', lineHeight: 1 }}>
        {loading ? '–' : value}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.3 }}>
        {label}
      </p>
    </button>
  )
}

const quickLinks = [
  { to: '/admin/users', label: 'USUARIOS', desc: 'Gestionar socios y admins' },
  { to: '/admin/classes', label: 'CLASES', desc: 'Ver y cancelar clases' },
  { to: '/admin/templates', label: 'PLANTILLAS', desc: 'Horarios y generar mes' },
  { to: '/admin/bonos', label: 'BONOS', desc: 'Asignar bonos mensuales' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const today = todayStr()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', today],
    queryFn: async () => {
      const [classesRes, usersRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, reservations(id, status)', { count: 'exact' })
          .gte('starts_at', madridDayBounds(today).start)
          .lte('starts_at', madridDayBounds(today).end)
          .eq('is_cancelled', false),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('role', 'user'),
      ])

      const classesData = classesRes.data ?? []
      const reservationsToday = classesData.reduce(
        (sum, cls) => sum + (cls.reservations?.filter((r) => r.status === 'confirmed').length ?? 0),
        0
      )

      return {
        classes: classesData.length,
        reservations: reservationsToday,
        users: usersRes.count ?? 0,
      }
    },
    staleTime: 1000 * 60,
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
          PANEL ADMIN
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Hoy</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="flex gap-3">
          <StatCard label="Clases hoy" value={stats?.classes} loading={isLoading} onClick={() => navigate('/admin/classes')} />
          <StatCard label="Reservas hoy" value={stats?.reservations} loading={isLoading} onClick={() => navigate('/admin/classes')} />
          <StatCard label="Socios activos" value={stats?.users} loading={isLoading} onClick={() => navigate('/admin/users')} />
        </div>

        <div className="flex flex-col gap-2">
          {quickLinks.map((link) => (
            <button
              key={link.to}
              onClick={() => navigate(link.to)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div>
                <p style={{ fontFamily: 'var(--font-head)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.5px' }}>
                  {link.label}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{link.desc}</p>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: '20px' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
