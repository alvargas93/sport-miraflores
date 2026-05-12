import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function IconCalendar({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.12)' : 'none'} />
      <rect x="3" y="5" width="18" height="6" rx="3" fill={active ? 'var(--teal)' : 'none'}
        stroke={active ? 'var(--teal)' : 'currentColor'} strokeWidth="1.8" />
      <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  )
}

function IconList({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.12)' : 'none'} />
      <polyline points="8,9 10.5,11.5 15,7" stroke={active ? 'var(--teal)' : 'currentColor'} strokeWidth="1.8" />
      <line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="1.6" />
      <line x1="8" y1="17.5" x2="13" y2="17.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconUser({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.12)' : 'none'} />
      <circle cx="12" cy="9.5" r="3" stroke={active ? 'var(--teal)' : 'currentColor'} strokeWidth="1.8" />
      <path d="M5.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function IconAdmin({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'var(--teal)' : 'none'} />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.25)' : 'none'} />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.25)' : 'none'} />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'rgba(10,191,191,0.12)' : 'none'} />
    </svg>
  )
}

const userTabs = [
  { to: '/bookings', label: 'Reservas', Icon: IconCalendar },
  { to: '/my-classes', label: 'Mis Clases', Icon: IconList },
  { to: '/profile', label: 'Perfil', Icon: IconUser },
]

const adminTab = { to: '/admin', label: 'Admin', Icon: IconAdmin }

export default function BottomNav() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const tabs = isAdmin ? [...userTabs, adminTab] : userTabs

  const activeIndex = tabs.findIndex(t => pathname.startsWith(t.to))
  const tabW = 100 / tabs.length

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex"
      style={{
        background: 'var(--surface2)',
        borderTop: '1px solid rgba(10,191,191,0.1)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}
    >
      {/* Sliding indicator */}
      {activeIndex >= 0 && (
        <span style={{
          position: 'absolute',
          top: 0,
          left: `${activeIndex * tabW}%`,
          width: `${tabW}%`,
          height: '2.5px',
          display: 'flex',
          justifyContent: 'center',
          transition: 'left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          <span style={{
            width: '32px',
            height: '2.5px',
            borderRadius: '0 0 4px 4px',
            background: 'var(--teal)',
            boxShadow: '0 0 8px rgba(10,191,191,0.6)',
          }} />
        </span>
      )}

      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="flex flex-col items-center justify-center flex-1 py-2"
          style={({ isActive }) => ({
            color: isActive ? 'var(--teal)' : 'var(--muted)',
            fontSize: '10px',
            letterSpacing: '0.3px',
            gap: '4px',
            textDecoration: 'none',
          })}
        >
          {({ isActive }) => (
            <>
              <div
                key={isActive ? 1 : 0}
                style={{
                  padding: '4px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(10,191,191,0.12)' : 'transparent',
                  transition: isActive ? 'none' : 'background 0.2s',
                  animation: isActive ? 'nav-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
                }}
              >
                <tab.Icon active={isActive} />
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: isActive ? 600 : 400 }}>
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
