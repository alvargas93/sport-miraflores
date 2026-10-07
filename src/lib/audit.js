import { supabase } from './supabase'

// Registra en audit_log la activación/desactivación de uno o varios usuarios.
// Un fallo aquí no revierte el cambio ya aplicado: solo se informa por consola.
export async function logUserActiveChange(actorId, userIds, isActive) {
  const bulk = userIds.length > 1
  const rows = userIds.map((userId) => ({
    actor_id: actorId,
    action: isActive ? 'user_activated' : 'user_deactivated',
    target_type: 'user',
    target_id: userId,
    payload: { is_active: isActive, bulk, ...(bulk && { bulk_count: userIds.length }) },
  }))
  const { error } = await supabase.from('audit_log').insert(rows)
  if (error) console.error('Error al registrar en audit_log:', error)
}
