import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currentMonthStart, formatDate } from '../../lib/utils'
import { bonoPrice, formatEuros, BONO_PRICES } from '../../lib/pricing'

const HISTORY_MONTHS = 12
const MIN_PRICE = Math.min(...BONO_PRICES.values())

// 'YYYY-MM-01' + n meses → 'YYYY-MM-01'
function addMonths(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

function monthLabel(monthStr, opts = { month: 'long', year: 'numeric' }) {
  return formatDate(monthStr + 'T12:00:00', opts)
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function sectionTitle(text) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '2px' }}>
      {text}
    </p>
  )
}

const card = {
  background: 'var(--surface)', borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.05)', padding: '16px',
}

function Delta({ current, previous, format }) {
  if (previous == null) return null
  const diff = current - previous
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null
  const color = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--muted)'
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '='
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, color }}>
      {arrow} {diff > 0 ? '+' : ''}{format(diff)}{pct != null && diff !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  )
}

function Kpi({ label, value, sub }) {
  return (
    <div style={{ ...card, flex: 1, padding: '14px 12px', minWidth: 0 }}>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</p>
      {sub && <div style={{ marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function RevenueChart({ months, selected, onSelect }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...months.map((m) => m.revenue), 1)
  const H = 120
  const focus = hover ?? selected
  const focusData = months.find((m) => m.month === focus)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', minHeight: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {focusData && capitalize(monthLabel(focusData.month))}
        </span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
          {focusData && `${formatEuros(focusData.revenue)} · ${focusData.count} bonos`}
        </span>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${H}px`, borderBottom: '1px solid rgba(255,255,255,0.12)' }}
        onMouseLeave={() => setHover(null)}
      >
        {months.map((m) => {
          const h = m.revenue > 0 ? Math.max(4, Math.round((m.revenue / max) * H)) : 0
          const isSel = m.month === selected
          return (
            <button
              key={m.month}
              onClick={() => onSelect(m.month)}
              onMouseEnter={() => setHover(m.month)}
              aria-label={`${monthLabel(m.month)}: ${formatEuros(m.revenue)}`}
              style={{
                flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              <div style={{
                width: '100%', height: `${h}px`, borderRadius: '4px 4px 0 0',
                background: 'var(--teal)',
                opacity: isSel || m.month === hover ? 1 : 0.35,
                transition: 'opacity 0.15s',
              }} />
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
        {months.map((m) => (
          <span key={m.month} style={{
            flex: 1, textAlign: 'center', fontSize: '10px', textTransform: 'capitalize',
            color: m.month === selected ? 'var(--text)' : 'var(--muted)',
            fontWeight: m.month === selected ? 700 : 400,
          }}>
            {monthLabel(m.month, { month: 'narrow' })}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AdminBilling() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const thisMonth = currentMonthStart()
  const [selectedMonth, setSelectedMonth] = useState(thisMonth)
  const isGeneralAdmin = profile?.role === 'general_admin'

  const fromMonth = addMonths(selectedMonth, -(HISTORY_MONTHS - 1))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-billing', fromMonth, selectedMonth],
    queryFn: async () => {
      const [usersRes, bonosRes] = await Promise.all([
        supabase.from('users').select('id, full_name, role, is_active').order('full_name'),
        supabase
          .from('user_bonos')
          .select('user_id, month, classes_used, bonos(name, max_classes)')
          .gte('month', fromMonth)
          .lte('month', selectedMonth),
      ])
      if (usersRes.error) throw usersRes.error
      if (bonosRes.error) throw bonosRes.error
      return { users: usersRes.data ?? [], userBonos: bonosRes.data ?? [] }
    },
    enabled: isGeneralAdmin,
    staleTime: 1000 * 60,
  })

  if (profile && !isGeneralAdmin) return <Navigate to="/admin" replace />

  // Solo cuentan los bonos de socios (rol 'user'); los de admins no se facturan
  const members = (data?.users ?? []).filter((u) => u.role === 'user')
  const memberIds = new Set(members.map((u) => u.id))
  const memberBonos = (data?.userBonos ?? []).filter((ub) => memberIds.has(ub.user_id) && ub.bonos)

  const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const month = addMonths(fromMonth, i)
    const rows = memberBonos.filter((ub) => ub.month === month)
    return {
      month,
      count: rows.length,
      revenue: rows.reduce((sum, ub) => sum + (bonoPrice(ub.bonos.max_classes) ?? 0), 0),
    }
  })

  const current = months[months.length - 1]
  const previous = months[months.length - 2]
  const avgPerMember = current.count > 0 ? current.revenue / current.count : 0

  const selectedRows = memberBonos.filter((ub) => ub.month === selectedMonth)
  const unpriced = selectedRows.filter((ub) => bonoPrice(ub.bonos.max_classes) == null)

  // Desglose por tipo de bono
  const breakdown = [...BONO_PRICES.keys()].map((maxClasses) => {
    const rows = selectedRows.filter((ub) => (ub.bonos.max_classes ?? null) === maxClasses)
    return {
      key: String(maxClasses),
      name: rows[0]?.bonos.name ?? (maxClasses == null ? 'Ilimitado' : `Bono ${maxClasses}`),
      price: bonoPrice(maxClasses),
      count: rows.length,
      revenue: rows.length * bonoPrice(maxClasses),
    }
  })

  // Uso del bono: % de clases consumidas en bonos con límite; media en ilimitados
  const limited = selectedRows.filter((ub) => ub.bonos.max_classes != null)
  const limitedCapacity = limited.reduce((s, ub) => s + ub.bonos.max_classes, 0)
  const limitedUsed = limited.reduce((s, ub) => s + Math.min(ub.classes_used ?? 0, ub.bonos.max_classes), 0)
  const usagePct = limitedCapacity > 0 ? Math.round((limitedUsed / limitedCapacity) * 100) : null
  const unlimited = selectedRows.filter((ub) => ub.bonos.max_classes == null)
  const unlimitedAvg = unlimited.length > 0
    ? (unlimited.reduce((s, ub) => s + (ub.classes_used ?? 0), 0) / unlimited.length).toFixed(1)
    : null

  // Socios activos sin bono en el mes seleccionado
  const withBono = new Set(selectedRows.map((ub) => ub.user_id))
  const withoutBono = members.filter((u) => u.is_active && !withBono.has(u.id))

  const isCurrentMonth = selectedMonth === thisMonth

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Selector de mes */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
          aria-label="Mes anterior"
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '18px', cursor: 'pointer' }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {monthLabel(selectedMonth)}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Facturación por bonos de socios</p>
        </div>
        <button
          onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
          disabled={isCurrentMonth}
          aria-label="Mes siguiente"
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '18px', cursor: isCurrentMonth ? 'default' : 'pointer', opacity: isCurrentMonth ? 0.3 : 1 }}
        >›</button>
      </div>

      {isLoading || !profile ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : isError ? (
        <p style={{ textAlign: 'center', color: 'var(--danger)', padding: '40px', fontSize: '14px' }}>
          Error al cargar la facturación.
        </p>
      ) : (
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Ingresos del mes */}
          <div>
            {sectionTitle('Ingresos del mes')}
            <div style={{ ...card, textAlign: 'center', padding: '20px 16px' }}>
              <p style={{ fontFamily: 'var(--font-head)', fontSize: '48px', fontWeight: 900, color: 'var(--teal)', lineHeight: 1 }}>
                {formatEuros(current.revenue)}
              </p>
              <div style={{ marginTop: '8px' }}>
                <Delta current={current.revenue} previous={previous.revenue} format={formatEuros} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}> vs {monthLabel(previous.month, { month: 'long' })}</span>
              </div>
              {isCurrentMonth && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  Mes en curso: puede subir si se asignan más bonos.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Kpi
                label="Bonos vendidos"
                value={current.count}
                sub={<Delta current={current.count} previous={previous.count} format={(n) => String(n)} />}
              />
              <Kpi label="Ingreso medio / socio" value={current.count > 0 ? formatEuros(avgPerMember) : '—'} />
            </div>
            {unpriced.length > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '10px' }}>
                {unpriced.length} bono{unpriced.length === 1 ? '' : 's'} sin precio definido (no se suman al total).
              </p>
            )}
          </div>

          {/* Evolución */}
          <div>
            {sectionTitle(`Evolución últimos ${HISTORY_MONTHS} meses`)}
            <div style={card}>
              <RevenueChart months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
            </div>
          </div>

          {/* Desglose */}
          <div>
            {sectionTitle('Desglose por tipo de bono')}
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {breakdown.map((b) => {
                const share = current.revenue > 0 ? Math.round((b.revenue / current.revenue) * 100) : 0
                return (
                  <div key={b.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                        {b.name} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)' }}>· {formatEuros(b.price)}</span>
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {b.count} bono{b.count === 1 ? '' : 's'} · <strong>{formatEuros(b.revenue)}</strong>
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface3)', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${share}%`, height: '100%', borderRadius: '4px', background: 'var(--teal)' }} />
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>{share}% de los ingresos</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Uso del bono */}
          <div>
            {sectionTitle('Uso de los bonos')}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Kpi
                label="Clases usadas (bonos 5/10/15)"
                value={usagePct == null ? '—' : `${usagePct}%`}
                sub={usagePct != null && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{limitedUsed} de {limitedCapacity} clases</span>}
              />
              <Kpi
                label="Media clases (ilimitado)"
                value={unlimitedAvg ?? '—'}
                sub={unlimitedAvg != null && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{unlimited.length} socio{unlimited.length === 1 ? '' : 's'}</span>}
              />
            </div>
          </div>

          {/* Sin bono */}
          <div>
            {sectionTitle('Socios activos sin bono')}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: withoutBono.length ? 'var(--danger)' : 'var(--success)' }}>
                  {withoutBono.length}
                </span>
                {withoutBono.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Ingreso potencial: mín. <strong style={{ color: 'var(--text)' }}>{formatEuros(withoutBono.length * MIN_PRICE)}</strong>
                  </span>
                )}
              </div>
              {withoutBono.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column' }}>
                  {withoutBono.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 0', background: 'none', border: 'none',
                        borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                        color: 'var(--text)', fontSize: '14px', textAlign: 'left',
                      }}
                    >
                      {u.full_name}
                      <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                    </button>
                  ))}
                </div>
              )}
              {!isCurrentMonth && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  Calculado con los socios activos hoy.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
