-- ============================================================
-- Auto-generación mensual de clases con pg_cron
-- ============================================================
-- PASO 1: Habilitar pg_cron en Supabase Dashboard
--   Dashboard → Database → Extensions → buscar "pg_cron" → Enable
-- PASO 2: Ejecutar este script en el SQL Editor
-- ============================================================

-- 1. Actualizar generate_classes_from_templates para aceptar p_admin_id opcional
--    (permite llamarla desde el cron sin asociar un admin concreto)
CREATE OR REPLACE FUNCTION generate_classes_from_templates(
  p_month    date,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template  record;
  v_date      date;
  v_end_date  date;
  v_starts_at timestamptz;
  v_ends_at   timestamptz;
  v_dow       int;
  v_count     int := 0;
BEGIN
  v_end_date := (p_month + interval '1 month - 1 day')::date;

  FOR v_template IN
    SELECT * FROM class_templates
    WHERE is_active = true
      AND valid_from <= v_end_date
      AND (valid_until IS NULL OR valid_until >= p_month)
  LOOP
    v_date := p_month;
    WHILE v_date <= v_end_date LOOP
      v_dow := EXTRACT(ISODOW FROM v_date);

      IF v_dow = ANY(v_template.days_of_week) THEN
        v_starts_at := (v_date || ' ' || v_template.start_time)::timestamptz
                       AT TIME ZONE 'Europe/Madrid';
        v_ends_at   := (v_date || ' ' || v_template.end_time)::timestamptz
                       AT TIME ZONE 'Europe/Madrid';

        IF NOT EXISTS (
          SELECT 1 FROM classes
          WHERE template_id = v_template.id AND starts_at = v_starts_at
        ) THEN
          INSERT INTO classes (sport_id, template_id, title, starts_at, ends_at,
                               max_capacity, instructor, created_by)
          VALUES (v_template.sport_id, v_template.id, v_template.title,
                  v_starts_at, v_ends_at, v_template.max_capacity,
                  v_template.instructor, p_admin_id);

          v_count := v_count + 1;
        END IF;
      END IF;

      v_date := v_date + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object('success', true, 'classes_created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION generate_classes_from_templates(date, uuid) TO authenticated;

-- 2. Función wrapper sin parámetros para el cron
CREATE OR REPLACE FUNCTION auto_generate_classes_for_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month date;
BEGIN
  -- Al ejecutarse el día 1, genera las clases del mes actual
  v_month := date_trunc('month', now() AT TIME ZONE 'Europe/Madrid')::date;
  PERFORM generate_classes_from_templates(v_month, NULL);
END;
$$;

-- 3. Programar el cron: día 1 de cada mes a las 03:00 hora Madrid (01:00 UTC invierno / 00:00 UTC verano)
--    Nota: pg_cron trabaja en UTC. Con '0 1 1 * *' son las 02:00-03:00 Madrid según DST.
DO $$
BEGIN
  -- Eliminar job previo si existe
  PERFORM cron.unschedule('auto-generate-monthly-classes');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignorar si no existía
END;
$$;

SELECT cron.schedule(
  'auto-generate-monthly-classes',
  '0 1 1 * *',
  'SELECT auto_generate_classes_for_month()'
);
