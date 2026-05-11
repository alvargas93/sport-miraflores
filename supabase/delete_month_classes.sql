CREATE OR REPLACE FUNCTION delete_month_classes(p_month date, p_admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted int;
  v_skipped int;
  v_end_month date;
BEGIN
  v_end_month := p_month + interval '1 month';

  SELECT COUNT(*) INTO v_skipped
  FROM classes c
  WHERE (c.starts_at AT TIME ZONE 'Europe/Madrid')::date >= p_month
    AND (c.starts_at AT TIME ZONE 'Europe/Madrid')::date < v_end_month
    AND EXISTS (
      SELECT 1 FROM reservations r WHERE r.class_id = c.id AND r.status = 'confirmed'
    );

  WITH deleted AS (
    DELETE FROM classes
    WHERE (starts_at AT TIME ZONE 'Europe/Madrid')::date >= p_month
      AND (starts_at AT TIME ZONE 'Europe/Madrid')::date < v_end_month
      AND NOT EXISTS (
        SELECT 1 FROM reservations r WHERE r.class_id = classes.id AND r.status = 'confirmed'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN json_build_object('success', true, 'deleted', v_deleted, 'skipped', v_skipped);
END;
$$;
