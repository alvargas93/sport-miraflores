import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full bg-canvas">
      <div
        className="w-8 h-8 rounded-full border-2 border-teal"
        style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
      />
    </div>
  )
}

export default function ProtectedRoute({ adminOnly = false }) {
  const { session, loading, isAdmin } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/bookings" replace />

  return <Outlet />
}
