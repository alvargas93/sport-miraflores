import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currentMonthStart, formatDate } from '../../lib/utils'

export default function AdminBonos() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStart().slice(0, 7))
  const [assigningUserId, setAssigningUserId] = useState(null)
  const [selectedBonoId, setSelectedBonoId] = useState('')

  const monthDate = selectedMonth + '-01'

  const { data: bonoCatalog = [] } = useQuery({
    queryKey: ['bonos-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bonos').select('*').eq('is_active', true).order('max_classes', { nullsFirst: false })
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const { data: usersWithBonos = [], isLoading } = useQuery({
    queryKey: ['admin-bonos', monthDate],
    queryFn: async () => {
      const [usersRes, bonosRes] = await Promise.all([
        supabase.from('users').select('id, full_name, email, role, is_active').eq('is_active', true).order('full_name'),
        supabase.from('user_bonos').select('*, bonos(name, max_classes)').eq('month', monthDate),
      ])
      if (usersRes.error) throw usersRes.error

      const bonosMap = {}
      for (const b of bonosRes.data ?? []) bonosMap[b.user_id] = b

      return (usersRes.data ?? [])
        .filter((u) => u.role !== 'general_admin')
        .map((u) => ({ ...u, bono: bonosMap[u.id] ?? null }))
    },
    staleTime: 1000 * 30,
  })

  const assignMutation = useMutation({
    mutationFn: async ({ userId, bonoId }) => {
      const existing = usersWithBonos.find((u) => u.id === userId)?.bono
      if (existing) {
        const { error } = await supabase
          .from('user_bonos')
          .update({ bono_id: bonoId, assigned_by: profile.id })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_bonos')
          .insert({ user_id: userId, bono_id: bonoId, month: monthDate, classes_used: 0, assigned_by: profile.id })
        if (error) throw error
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-bonos', monthDate] })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-bonos', userId] })
      setAssigningUserId(null)
      setSelectedBonoId('')
    },
  })

  const monthLabel = formatDate(monthDate + 'T12:00:00', { month: 'long', year: 'numeric' })

  const withBono = usersWithBonos.filter((u) => u.bono)
  const withoutBono = usersWithBonos.filter((u) => !u.bono)

  function UserRow({ user }) {
    const bono = user.bono
    const isAssigning = assigningUserId === user.id
    const initials = user.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

    return (
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--teal-glow)', border: '1px solid var(--teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontSize: '14px', fontWeight: 800, color: 'var(--teal)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.full_name}
            </p>
            {bono ? (
              <p style={{ fontSize: '11px', color: 'var(--teal)', marginTop: '1px' }}>
                {bono.bonos?.name}
                {bono.bonos?.max_classes
                  ? ` · ${bono.classes_used}/${bono.bonos.max_classes}`
                  : ` · ${bono.classes_used} usadas`}
              </p>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '1px' }}>Sin bono</p>
            )}
          </div>
          <button
            onClick={() => { setAssigningUserId(isAssigning ? null : user.id); setSelectedBonoId('') }}
            style={{
              padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              border: `1px solid ${bono ? 'var(--border)' : 'var(--teal)'}`,
              color: bono ? 'var(--muted)' : 'var(--teal)',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {bono ? 'Cambiar' : 'Asignar'}
          </button>
        </div>

        {isAssigning && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <select
              value={selectedBonoId}
              onChange={(e) => setSelectedBonoId(e.target.value)}
              className="input-field"
              style={{ flex: 1 }}
            >
              <option value="">Tipo de bono...</option>
              {bonoCatalog.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.max_classes ? ` (${b.max_classes})` : ' (∞)'}
                </option>
              ))}
            </select>
            <button
              onClick={() => assignMutation.mutate({ userId: user.id, bonoId: selectedBonoId })}
              disabled={!selectedBonoId || assignMutation.isPending}
              style={{
                padding: '10px 14px', borderRadius: '10px', background: 'var(--teal)',
                color: '#000', border: 'none', cursor: selectedBonoId ? 'pointer' : 'default',
                fontSize: '13px', fontWeight: 700, flexShrink: 0,
                opacity: selectedBonoId ? 1 : 0.5,
              }}
            >
              OK
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Month selector */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setAssigningUserId(null) }}
          className="input-field"
        />
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', textTransform: 'capitalize' }}>
          {monthLabel}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {withoutBono.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: '14px', overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--danger)', padding: '12px 16px 8px' }}>
                Sin bono ({withoutBono.length})
              </p>
              {withoutBono.map((u) => <UserRow key={u.id} user={u} />)}
            </div>
          )}

          {withBono.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
                Con bono ({withBono.length})
              </p>
              {withBono.map((u) => <UserRow key={u.id} user={u} />)}
            </div>
          )}

          {usersWithBonos.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>
              No hay socios activos.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
