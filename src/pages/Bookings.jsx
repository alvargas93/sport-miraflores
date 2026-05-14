import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClasses } from '../hooks/useClasses'
import { useBono } from '../hooks/useBono'
import { todayStr } from '../lib/utils'
import CalendarStrip from '../components/features/bookings/CalendarStrip'
import ClassCard from '../components/features/bookings/ClassCard'
import ClassModal from '../components/features/bookings/ClassModal'
import IosBanner from '../components/features/bookings/IosBanner'

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: '4px' }} />
      <div style={{ padding: '14px 16px 14px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: '72px', height: '11px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ width: '64px', height: '20px', borderRadius: '20px' }} />
        </div>
        <div className="skeleton" style={{ width: '55%', height: '20px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ width: '96px', height: '13px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ width: '100%', height: '4px', borderRadius: '2px' }} />
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3" style={{ opacity: 0.4 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p style={{ fontSize: '14px' }}>{message}</p>
    </div>
  )
}

export default function Bookings() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [selectedClass, setSelectedClass] = useState(null)
  const [zoomedPhoto, setZoomedPhoto] = useState(null)

  const { data: classes = [], isLoading, isError } = useClasses(selectedDate, profile?.id)
  const { data: bono } = useBono(profile?.id)

  // Realtime: invalidate classes when reservations change
  useEffect(() => {
    const channel = supabase
      .channel('reservations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['classes', selectedDate] })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedDate, queryClient])

  const bonoText = bono
    ? bono.bonos.max_classes === null
      ? `${bono.bonos.name} (ilimitado)`
      : `${bono.bonos.name} · ${bono.bonos.max_classes - bono.classes_used} clases restantes`
    : null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', letterSpacing: '1px' }}>
            RESERVAS
          </h1>
          <img src="/logo.png" alt="Sport Miraflores" className="logo-img" style={{ height: '38px', opacity: 0.75 }} />
        </div>

        {/* Bono status */}
        {bonoText && (
          <div style={{ padding: '0 16px 10px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'var(--teal)',
              background: 'var(--teal-glow)',
              padding: '4px 10px', borderRadius: '20px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
              {bonoText}
            </span>
          </div>
        )}
        {!bono && profile && (
          <div style={{ padding: '0 16px 10px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'var(--danger)',
              background: 'rgba(224,85,85,0.1)',
              padding: '4px 10px', borderRadius: '20px',
            }}>
              Sin bono activo este mes
            </span>
          </div>
        )}
      </div>

      {/* Calendar */}
      <CalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Class list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {isError && (
          <EmptyState message="Error al cargar las clases. Inténtalo de nuevo." />
        )}

        {!isLoading && !isError && classes.length === 0 && (
          <EmptyState message="No hay clases este día." />
        )}

        {!isLoading && !isError && classes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
            {classes.map((cls, i) => (
              <ClassCard key={cls.id} cls={cls} onPress={setSelectedClass} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedClass && (
        <ClassModal
          cls={selectedClass}
          selectedDate={selectedDate}
          onClose={() => setSelectedClass(null)}
          onZoomPhoto={setZoomedPhoto}
        />
      )}

      <IosBanner />

      {/* Photo zoom overlay — rendered to body via portal to avoid stacking context issues */}
      {zoomedPhoto && createPortal(
        <div
          onClick={() => setZoomedPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: '240px', height: '240px', borderRadius: '50%', border: '3px solid var(--teal)', overflow: 'hidden', background: 'var(--teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: '80px', fontWeight: 800, color: 'var(--teal)' }}>
            {zoomedPhoto.avatar_url
              ? <img src={zoomedPhoto.avatar_url} alt={zoomedPhoto.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : zoomedPhoto.initials}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
