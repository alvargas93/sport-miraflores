import { useState } from 'react'

export default function IosBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('ios-banner-dismissed') === '1'
  )

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  if (!isIos || isStandalone || dismissed) return null

  function dismiss() {
    localStorage.setItem('ios-banner-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(64px + env(safe-area-inset-bottom) + 8px)',
      left: '12px', right: '12px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 50,
      display: 'flex', gap: '12px', alignItems: 'flex-start',
    }}>
      <img src="/icons/icon-192.png" alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
          Instala la app
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          Pulsa{' '}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'text-bottom' }}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {' '}y luego{' '}
          <strong style={{ color: 'var(--text)' }}>"Añadir a pantalla de inicio"</strong>
        </p>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', padding: '0', flexShrink: 0,
          fontSize: '20px', lineHeight: 1, marginTop: '-2px',
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  )
}
