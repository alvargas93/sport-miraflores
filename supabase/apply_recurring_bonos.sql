-- Ejecutar en Supabase Dashboard → SQL Editor
-- Crea user_bonos para todos los usuarios con bono recurrente que no tengan
-- entrada para el mes indicado. Idempotente (ON CONFLICT DO NOTHING).

CREATE OR REPLACE FUNCTION apply_recurring_bonos(p_month date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO user_bonos (user_id, bono_id, month, classes_used, notes)
  SELECT
    u.id,
    u.recurring_bono_id,
    p_month,
    0,
    'Renovación automática'
  FROM users u
  WHERE u.recurring_bono_id IS NOT NULL
    AND u.is_active = true
  ON CONFLICT (user_id, month) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'bonos_created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_recurring_bonos(date) TO authenticated;

-- ── Cron job ───────────────────────────────────────────────────────────────────
-- Se ejecuta el día 1 de cada mes a las 00:05 UTC (01:05 ó 02:05 en España).
-- Requiere pg_cron activado (activo por defecto en Supabase).
-- Si ya existe el job con ese nombre, esta llamada lo actualiza.

SELECT cron.schedule(
  'apply-recurring-bonos-monthly',
  '5 0 1 * *',
  $$SELECT apply_recurring_bonos(
    date_trunc('month', now() AT TIME ZONE 'Europe/Madrid')::date
  )$$
);
