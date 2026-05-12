import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import AdminLayout from './components/layout/AdminLayout'
import Splash from './pages/Splash'
import Login from './pages/Login'
import UpdatePassword from './pages/UpdatePassword'
import Bookings from './pages/Bookings'
import MyClasses from './pages/MyClasses'
import Profile from './pages/Profile'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import AdminClasses from './pages/admin/AdminClasses'
import AdminClassDetail from './pages/admin/AdminClassDetail'
import AdminTemplates from './pages/admin/AdminTemplates'
import AdminBonos from './pages/admin/AdminBonos'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/update-password" element={<UpdatePassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/my-classes" element={<MyClasses />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute adminOnly />}>
        <Route element={<MainLayout />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="classes/:id" element={<AdminClassDetail />} />
            <Route path="templates" element={<AdminTemplates />} />
            <Route path="bonos" element={<AdminBonos />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
