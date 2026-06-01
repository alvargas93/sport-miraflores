import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayStr, madridDayBounds, currentMonthStart } from '../../lib/utils'

function IconCalendarStat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="17" rx="3"/>
      <rect x="3" y="5" width="18" height="6" rx="3" fill="currentColor" stroke="currentColor"/>
      <line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>
      <circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/>
    </svg>
  )
}

function IconBooking() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
      <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconUsersMgmt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconClasesLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="17" rx="3"/>
      <rect x="3" y="5" width="18" height="6" rx="3" fill="currentColor" stroke="currentColor"/>
      <line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>
      <line x1="8" y1="15" x2="16" y2="15"/><line x1="8" y1="18.5" x2="13" y2="18.5"/>
    </svg>
  )
}

function IconTemplate() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <rect x="3" y="3" width="18" height="7" rx="3" fill="currentColor" stroke="currentColor"/>
      <line x1="3" y1="14" x2="21" y2="14"/>
      <line x1="9" y1="10" x2="9" y2="21"/>
    </svg>
  )
}

function IconBono() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
      <path d="M12 22V7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function StatCard({ label, value, loading, icon, onClick, suffix = '', accent = 'var(--teal)', iconBg = 'rgba(10,191,191,0.12)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '16px 12px 14px',
        textAlign: 'center',
        cursor: 'pointer',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '12px',
        background: iconBg, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '2px',
      }}>
        {icon}
      </div>
      <p style={{
        fontFamily: 'var(--font-head)', fontSize: '34px', fontWeight: 800,
        color: accent, lineHeight: 1,
      }}>
        {loading ? '–' : value}{!loading && suffix}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.3 }}>
        {label}
      </p>
    </button>
  )
}

const quickLinks = [
  { to: '/admin/users',     label: 'Usuarios',    desc: 'Gestionar socios y admins',  Icon: IconUsersMgmt,  color: '#7c6af7' },
  { to: '/admin/classes',   label: 'Clases',      desc: 'Ver y cancelar clases',       Icon: IconClasesLink, color: '#0abfbf' },
  { to: '/admin/templates', label: 'Plantillas',  desc: 'Horarios y generar mes',      Icon: IconTemplate,   color: '#e8a020' },
  { to: '/admin/bonos',     label: 'Bonos',       desc: 'Bonos mensuales y renovaciones', Icon: IconBono,   color: '#2ecc8f' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const today = todayStr()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', today],
    queryFn: async () => {
      const month = currentMonthStart()
      const [classesRes, usersRes, bonosRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, max_capacity, reservations(id, status)')
          .gte('starts_at', madridDayBounds(today).start)
          .lte('starts_at', madridDayBounds(today).end)
          .eq('is_cancelled', false),
        supabase
          .from('users')
          .select('id')
          .eq('is_active', true)
          .eq('role', 'user'),
        supabase
          .from('user_bonos')
          .select('user_id')
          .eq('month', month),
      ])

      const classesData = classesRes.data ?? []
      const usersData = usersRes.data ?? []

      const reservationsToday = classesData.reduce(
        (sum, cls) => sum + (cls.reservations?.filter((r) => r.status === 'confirmed').length ?? 0),
        0
      )
      const totalCapacity = classesData.reduce((sum, cls) => sum + (cls.max_capacity ?? 0), 0)
      const occupancy = totalCapacity > 0 ? Math.round((reservationsToday / totalCapacity) * 100) : null

      const userIdsWithBono = new Set((bonosRes.data ?? []).map((b) => b.user_id))
      const withoutBono = usersData.filter((u) => !userIdsWithBono.has(u.id)).length

      return {
        classes: classesData.length,
        reservations: reservationsToday,
        users: usersData.length,
        occupancy,
        withoutBono,
      }
    },
    staleTime: 1000 * 60,
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid rgba(10,191,191,0.1)',
        padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
            ADMIN
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>Resumen de hoy</p>
        </div>
        <img src="/logo.png" alt="Sport Miraflores" className="logo-img" style={{ height: '38px', opacity: 0.75 }} />
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Stats */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '2px' }}>
            Hoy
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <StatCard label="Clases" value={stats?.classes} loading={isLoading} icon={<IconCalendarStat />} onClick={() => navigate('/admin/classes')} />
            <StatCard label="Reservas" value={stats?.reservations} loading={isLoading} icon={<IconBooking />} onClick={() => navigate('/admin/classes')} />
            <StatCard label="Socios" value={stats?.users} loading={isLoading} icon={<IconUsers />} onClick={() => navigate('/admin/users')} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(() => {
              const occ = stats?.occupancy
              const occAccent = occ == null ? 'var(--muted)' : occ >= 70 ? 'var(--success)' : occ >= 40 ? 'var(--warning)' : 'var(--danger)'
              const occBg = occ == null ? 'rgba(122,122,122,0.1)' : occ >= 70 ? 'rgba(46,204,143,0.12)' : occ >= 40 ? 'rgba(232,160,32,0.12)' : 'rgba(224,85,85,0.12)'
              return (
                <StatCard
                  label="Ocupación hoy"
                  value={occ == null ? '—' : occ}
                  suffix="%"
                  loading={isLoading}
                  icon={<IconCalendarStat />}
                  onClick={() => navigate('/admin/classes')}
                  accent={occAccent}
                  iconBg={occBg}
                />
              )
            })()}
            {(() => {
              const n = stats?.withoutBono ?? 0
              const accent = n === 0 ? 'var(--success)' : 'var(--danger)'
              const iconBg = n === 0 ? 'rgba(46,204,143,0.12)' : 'rgba(224,85,85,0.12)'
              return (
                <StatCard
                  label="Sin bono este mes"
                  value={n}
                  loading={isLoading}
                  icon={<IconBono />}
                  onClick={() => navigate('/admin/bonos')}
                  accent={accent}
                  iconBg={iconBg}
                />
              )
            })()}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '2px' }}>
            Gestión
          </p>
          <div style={{
            background: 'var(--surface)', borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
          }}>
            {quickLinks.map((link, i) => (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  width: '100%', padding: '14px 16px',
                  background: 'none', border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                  background: link.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: link.color,
                }}>
                  <link.Icon />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-head)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                    {link.label}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>{link.desc}</p>
                </div>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>
                  <IconChevron />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
