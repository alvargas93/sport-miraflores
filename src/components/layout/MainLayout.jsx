import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function MainLayout() {
  return (
    <div className="flex flex-col h-full bg-canvas">
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
