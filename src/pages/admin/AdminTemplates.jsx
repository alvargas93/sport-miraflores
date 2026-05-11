import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currentMonthStart, todayStr, madridToUTC } from '../../lib/utils'

const SPORT_COLORS = { crossfit: '#0abfbf', hyrox: '#e8a020' }

const DAYS = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'X', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 7 },
]

function emptyForm() {
  const today = todayStr()
  return {
    sport_id: '',
    title: '',
    days_of_week: [],
    start_time: '',
    end_time: '',
    max_capacity: 14,
    instructor: '',
    valid_from: today,
    valid_until: '',
    single_date: today,
  }
}

function DayPicker({ value, onChange }) {
  function toggle(day) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))
  }
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {DAYS.map((d) => (
        <button
          key={d.value}
          type="button"
          onClick={() => toggle(d.value)}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', fontSize: '13px', fontWeight: 600,
            border: `1px solid ${value.includes(d.value) ? 'var(--teal)' : 'var(--border)'}`,
            background: value.includes(d.value) ? 'var(--teal)' : 'transparent',
            color: value.includes(d.value) ? '#000' : 'var(--muted)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}

export default function AdminTemplates() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [mode, setMode] = useState('recurring') // 'recurring' | 'single'
  const [form, setForm] = useState(emptyForm)
  const [generateMonth, setGenerateMonth] = useState(currentMonthStart().slice(0, 7))
  const [generateResult, setGenerateResult] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  const { data: sports = [] } = useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sports').select('*').eq('is_active', true).order('name')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_templates')
        .select('*, sports(name, slug)')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setForm(emptyForm())
    setEditingId(null)
    setMode('recurring')
    setShowForm(true)
  }

  function openEdit(tpl) {
    setForm({
      sport_id: tpl.sport_id,
      title: tpl.title,
      days_of_week: tpl.days_of_week ?? [],
      start_time: tpl.start_time?.slice(0, 5) ?? '',
      end_time: tpl.end_time?.slice(0, 5) ?? '',
      max_capacity: tpl.max_capacity,
      instructor: tpl.instructor ?? '',
      valid_from: tpl.valid_from ?? '',
      valid_until: tpl.valid_until ?? '',
      single_date: todayStr(),
    })
    setEditingId(tpl.id)
    setMode('recurring')
    setShowForm(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'single') {
        const startsAt = madridToUTC(form.single_date, form.start_time)
        const endsAt = madridToUTC(form.single_date, form.end_time)
        const { error } = await supabase.from('classes').insert({
          sport_id: form.sport_id,
          title: form.title,
          starts_at: startsAt,
          ends_at: endsAt,
          max_capacity: Number(form.max_capacity),
          instructor: form.instructor || null,
          created_by: profile.id,
        })
        if (error) throw error
      } else {
        const payload = {
          sport_id: form.sport_id,
          title: form.title,
          days_of_week: form.days_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          max_capacity: Number(form.max_capacity),
          instructor: form.instructor || null,
          valid_from: form.valid_from,
          valid_until: form.valid_until || null,
          created_by: profile.id,
        }
        if (editingId) {
          const { error } = await supabase.from('class_templates').update(payload).eq('id', editingId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('class_templates').insert(payload)
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
      setShowForm(false)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('class_templates').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] }),
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const month = generateMonth + '-01'
      const { data, error } = await supabase.rpc('generate_classes_from_templates', {
        p_month: month,
        p_admin_id: profile.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setGenerateResult(data.classes_created ?? 0)
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
      setTimeout(() => setGenerateResult(null), 4000)
    },
  })

  const deleteMonthMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delete_month_classes', {
        p_month: generateMonth + '-01',
        p_admin_id: profile.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setShowDeleteConfirm(false)
      setDeleteResult(data)
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] })
      setTimeout(() => setDeleteResult(null), 5000)
    },
  })

  const activeTemplates = templates.filter((t) => t.is_active)
  const inactiveTemplates = templates.filter((t) => !t.is_active)

  function TemplateRow({ tpl }) {
    const color = SPORT_COLORS[tpl.sports?.slug] ?? 'var(--teal)'
    const dayNames = (tpl.days_of_week ?? []).map((d) => DAYS.find((x) => x.value === d)?.label).join(' ')
    return (
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {tpl.sports?.name}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: '16px', fontWeight: 700, color: tpl.is_active ? 'var(--text)' : 'var(--muted)', letterSpacing: '0.3px' }}>
            {tpl.title}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
            {dayNames} · {tpl.start_time?.slice(0, 5)} – {tpl.end_time?.slice(0, 5)} · {tpl.max_capacity} plazas
            {tpl.instructor ? ` · ${tpl.instructor}` : ''}
          </p>
        </div>
        {tpl.is_active && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => openEdit(tpl)} style={{ padding: '5px 10px', borderRadius: '7px', fontSize: '12px', border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer' }}>
              Editar
            </button>
            <button onClick={() => deactivateMutation.mutate(tpl.id)} style={{ padding: '5px 10px', borderRadius: '7px', fontSize: '12px', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        )}
      </div>
    )
  }

  const canSave = mode === 'single'
    ? form.sport_id && form.title && form.single_date && form.start_time && form.end_time
    : form.sport_id && form.title && form.days_of_week.length > 0 && form.start_time && form.end_time && form.valid_from

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>Plantillas</p>
        <button
          onClick={openCreate}
          style={{ padding: '7px 14px', borderRadius: '20px', background: 'var(--teal)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
        >
          + Nueva
        </button>
      </div>

      {/* Generate / delete month */}
      <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="month"
          value={generateMonth}
          onChange={(e) => setGenerateMonth(e.target.value)}
          className="input-field"
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--teal)', color: 'var(--teal)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            {generateMutation.isPending ? 'Generando…' : 'Generar mes'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteMonthMutation.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            Borrar mes
          </button>
        </div>
      </div>
      {generateResult !== null && (
        <p style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--success)', background: 'rgba(46,204,143,0.1)', borderBottom: '1px solid var(--border)' }}>
          {generateResult === 0 ? 'No se crearon clases nuevas (ya existen).' : `${generateResult} clases creadas correctamente.`}
        </p>
      )}
      {deleteResult !== null && (
        <p style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--danger)', background: 'rgba(224,85,85,0.1)', borderBottom: '1px solid var(--border)' }}>
          {deleteResult.deleted === 0
            ? 'No se borró ninguna clase.'
            : `${deleteResult.deleted} ${deleteResult.deleted === 1 ? 'clase borrada' : 'clases borradas'}.`}
          {deleteResult.skipped > 0 && ` ${deleteResult.skipped} ${deleteResult.skipped === 1 ? 'clase omitida por tener reservas' : 'clases omitidas por tener reservas'}.`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-teal" style={{ borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeTemplates.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
                Activas
              </p>
              {activeTemplates.map((t) => <TemplateRow key={t.id} tpl={t} />)}
            </div>
          )}

          {inactiveTemplates.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', opacity: 0.6 }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 16px 8px' }}>
                Inactivas
              </p>
              {inactiveTemplates.map((t) => <TemplateRow key={t.id} tpl={t} />)}
            </div>
          )}

          {templates.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>
              No hay plantillas. Crea una para empezar.
            </p>
          )}
        </div>
      )}

      {/* Delete month confirmation sheet */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid var(--border)', zIndex: 101,
            padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
          }}>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginBottom: '8px' }}>
              Borrar clases del mes
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>
              Se eliminarán todas las clases de <strong style={{ color: 'var(--text)' }}>{generateMonth}</strong> que no tengan reservas activas.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
              Las clases con reservas confirmadas no se borrarán.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMonthMutation.mutate()}
                disabled={deleteMonthMutation.isPending}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', opacity: deleteMonthMutation.isPending ? 0.7 : 1 }}
              >
                {deleteMonthMutation.isPending ? 'Borrando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create/Edit form sheet */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid var(--border)', zIndex: 101,
            maxHeight: '90vh', overflowY: 'auto',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>
                {editingId ? 'Editar plantilla' : 'Nueva clase'}
              </p>

              {/* Mode toggle — solo al crear, no al editar */}
              {!editingId && (
                <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', borderRadius: '10px', padding: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setMode('recurring')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      background: mode === 'recurring' ? 'var(--teal)' : 'transparent',
                      color: mode === 'recurring' ? '#000' : 'var(--muted)',
                    }}
                  >
                    Plantilla recurrente
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('single')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      background: mode === 'single' ? 'var(--teal)' : 'transparent',
                      color: mode === 'single' ? '#000' : 'var(--muted)',
                    }}
                  >
                    Clase individual
                  </button>
                </div>
              )}

              <select value={form.sport_id} onChange={(e) => setField('sport_id', e.target.value)} className="input-field">
                <option value="">Deporte...</option>
                {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <input type="text" placeholder="Título" value={form.title} onChange={(e) => setField('title', e.target.value)} className="input-field" />

              {mode === 'recurring' ? (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Días de la semana</p>
                  <DayPicker value={form.days_of_week} onChange={(v) => setField('days_of_week', v)} />
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Fecha de la clase</p>
                  <input type="date" value={form.single_date} onChange={(e) => setField('single_date', e.target.value)} className="input-field" />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Inicio</p>
                  <input type="time" value={form.start_time} onChange={(e) => setField('start_time', e.target.value)} className="input-field" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Fin</p>
                  <input type="time" value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} className="input-field" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Capacidad</p>
                  <input type="number" min="1" max="100" value={form.max_capacity} onChange={(e) => setField('max_capacity', e.target.value)} className="input-field" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Instructor</p>
                  <input type="text" placeholder="Opcional" value={form.instructor} onChange={(e) => setField('instructor', e.target.value)} className="input-field" />
                </div>
              </div>

              {mode === 'recurring' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Válida desde</p>
                    <input type="date" value={form.valid_from} onChange={(e) => setField('valid_from', e.target.value)} className="input-field" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Válida hasta</p>
                    <input type="date" value={form.valid_until} onChange={(e) => setField('valid_until', e.target.value)} className="input-field" />
                  </div>
                </div>
              )}

              {saveMutation.isError && (
                <p style={{ fontSize: '12px', color: 'var(--danger)' }}>Error al guardar.</p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}>
                  Cancelar
                </button>
                <button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--teal)', color: '#000', border: 'none', cursor: canSave ? 'pointer' : 'default', fontWeight: 700, fontSize: '14px', opacity: canSave ? 1 : 0.5 }}>
                  {saveMutation.isPending ? 'Guardando…' : 'GUARDAR'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
