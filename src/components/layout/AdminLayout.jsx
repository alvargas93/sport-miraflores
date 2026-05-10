import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Usuarios' },
  { to: '/admin/classes', label: 'Clases' },
  { to: '/admin/templates', label: 'Plantillas' },
  { to: '/admin/bonos', label: 'Bonos' },
]

export default function AdminLayout() {
  return (
    <div>
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        overflowX: 'auto', display: 'flex', gap: '6px',
        padding: '10px 16px', scrollbarWidth: 'none',
      }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            style={({ isActive }) => ({
              padding: '7px 16px', borderRadius: '20px',
              whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600,
              flexShrink: 0, textDecoration: 'none',
              background: isActive ? 'var(--teal)' : 'var(--surface2)',
              color: isActive ? '#000' : 'var(--muted)',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
