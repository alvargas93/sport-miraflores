-- Ejecutar en Supabase Dashboard → SQL Editor
-- Funciones necesarias para el panel de administración

-- admin_add_user_to_class: el admin añade un usuario a una clase
-- Permite override de aforo (p_override = true)
CREATE OR REPLACE FUNCTION admin_add_user_to_class(
  p_class_id   uuid,
  p_user_id    uuid,
  p_admin_id   uuid,
  p_override   boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count       int;
  v_capacity    int;
  v_starts_at   timestamptz;
  v_month       date;
  v_max_classes int;
  v_used        int;
BEGIN
  SELECT max_capacity, starts_at INTO v_capacity, v_starts_at
  FROM classes WHERE id = p_class_id AND is_cancelled = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'class_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'already_booked');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM reservations WHERE class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_capacity AND NOT p_override THEN
    RETURN json_build_object('success', false, 'error', 'class_full');
  END IF;

  -- Verificar bono del usuario
  v_month := date_trunc('month', v_starts_at AT TIME ZONE 'Europe/Madrid')::date;

  SELECT b.max_classes, ub.classes_used INTO v_max_classes, v_used
  FROM user_bonos ub
  JOIN bonos b ON ub.bono_id = b.id
  WHERE ub.user_id = p_user_id AND ub.month = v_month;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'no_bono');
  END IF;

  IF v_max_classes IS NOT NULL AND v_used >= v_max_classes THEN
    RETURN json_build_object('success', false, 'error', 'bono_exhausted');
  END IF;

  INSERT INTO reservations (class_id, user_id, status, is_admin_override)
  VALUES (p_class_id, p_user_id, 'confirmed', p_override)
  ON CONFLICT (class_id, user_id) DO UPDATE
    SET status            = 'confirmed',
        is_admin_override = p_override,
        booked_at         = now(),
        cancelled_at      = NULL,
        cancelled_by      = NULL,
        cancel_reason     = NULL;

  UPDATE user_bonos
  SET classes_used = classes_used + 1
  WHERE user_id = p_user_id AND month = v_month;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    p_admin_id, 'user_added_to_class', 'class', p_class_id,
    jsonb_build_object('user_id', p_user_id, 'override', p_override)
  );

  RETURN json_build_object('success', true);
END;
$$;


-- admin_remove_user_from_class: el admin elimina un usuario de una clase
-- Sin restricción de ventana temporal; siempre devuelve la clase al bono
CREATE OR REPLACE FUNCTION admin_remove_user_from_class(
  p_reservation_id uuid,
  p_admin_id       uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid;
  v_starts_at timestamptz;
  v_class_id  uuid;
  v_month     date;
BEGIN
  SELECT r.user_id, c.starts_at, r.class_id
  INTO v_user_id, v_starts_at, v_class_id
  FROM reservations r
  JOIN classes c ON r.class_id = c.id
  WHERE r.id = p_reservation_id AND r.status = 'confirmed';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'reservation_not_found');
  END IF;

  UPDATE reservations
  SET status       = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_admin_id,
      cancel_reason = 'Eliminado por el administrador'
  WHERE id = p_reservation_id;

  v_month := date_trunc('month', v_starts_at AT TIME ZONE 'Europe/Madrid')::date;

  UPDATE user_bonos
  SET classes_used = GREATEST(0, classes_used - 1)
  WHERE user_id = v_user_id AND month = v_month;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    p_admin_id, 'user_removed_from_class', 'reservation', p_reservation_id,
    jsonb_build_object('user_id', v_user_id, 'class_id', v_class_id)
  );

  RETURN json_build_object('success', true);
END;
$$;
