-- Ejecutar en Supabase Dashboard → SQL Editor
-- Devuelve la lista de inscritos confirmados en una clase (para el panel admin)

DROP FUNCTION IF EXISTS get_class_enrollments(uuid);

CREATE OR REPLACE FUNCTION get_class_enrollments(p_class_id uuid)
RETURNS TABLE (
  reservation_id    uuid,
  user_id           uuid,
  user_full_name    text,
  user_email        text,
  booked_at         timestamptz,
  is_admin_override boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    r.id                AS reservation_id,
    r.user_id,
    u.full_name         AS user_full_name,
    u.email             AS user_email,
    r.booked_at,
    r.is_admin_override
  FROM reservations r
  JOIN users u ON u.id = r.user_id
  WHERE r.class_id = p_class_id
    AND r.status = 'confirmed'
  ORDER BY r.booked_at;
$$;

GRANT EXECUTE ON FUNCTION get_class_enrollments(uuid) TO authenticated;
