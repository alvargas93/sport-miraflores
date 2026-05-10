-- Ejecutar en Supabase SQL Editor
-- Devuelve las clases de un día con aforo real y estado de reserva del usuario

CREATE OR REPLACE FUNCTION get_classes_for_day(
  p_date    date,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_sport_ids uuid[];
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;

  IF v_user_role = 'user' THEN
    SELECT ARRAY_AGG(sport_id) INTO v_sport_ids
    FROM user_sports
    WHERE user_id = p_user_id;

    IF v_sport_ids IS NULL THEN
      v_sport_ids := '{}';
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(t ORDER BY t.starts_at), '[]'::json)
    FROM (
      SELECT
        c.id,
        c.sport_id,
        s.name  AS sport_name,
        s.slug  AS sport_slug,
        c.title,
        c.starts_at,
        c.ends_at,
        c.max_capacity,
        c.instructor,
        c.notes,
        COALESCE(rc.confirmed_count, 0) AS confirmed_count,
        COALESCE(ur.is_booked, false)   AS is_booked,
        ur.reservation_id
      FROM classes c
      JOIN sports s ON c.sport_id = s.id
      LEFT JOIN (
        SELECT class_id, COUNT(*) AS confirmed_count
        FROM reservations
        WHERE status = 'confirmed'
        GROUP BY class_id
      ) rc ON rc.class_id = c.id
      LEFT JOIN (
        SELECT class_id, true AS is_booked, id AS reservation_id
        FROM reservations
        WHERE user_id = p_user_id AND status = 'confirmed'
      ) ur ON ur.class_id = c.id
      WHERE (c.starts_at AT TIME ZONE 'Europe/Madrid')::date = p_date
        AND c.is_cancelled = false
        AND (
          v_user_role IN ('sport_admin', 'general_admin')
          OR c.sport_id = ANY(v_sport_ids)
        )
    ) t
  );
END;
$$;
