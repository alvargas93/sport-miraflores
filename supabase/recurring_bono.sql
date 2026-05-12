-- Ejecutar en Supabase Dashboard → SQL Editor
-- Implementa bonos recurrentes: el admin asigna una vez y se renueva automáticamente cada mes

-- ── 1. Nueva columna en users ────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS recurring_bono_id uuid REFERENCES bonos(id);

-- ── 2. book_class: auto-crear bono del mes si hay bono recurrente ─────────────
CREATE OR REPLACE FUNCTION book_class(p_class_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count       int;
  v_capacity    int;
  v_starts_at   timestamptz;
  v_sport_id    uuid;
  v_user_role   text;
  v_max_classes int;
  v_used        int;
  v_month       date;
  v_is_active   boolean;
BEGIN
  SELECT is_active, role INTO v_is_active, v_user_role
  FROM users WHERE id = p_user_id;

  IF NOT v_is_active THEN
    RETURN json_build_object('success', false, 'error', 'user_inactive');
  END IF;

  SELECT max_capacity, starts_at, sport_id INTO v_capacity, v_starts_at, v_sport_id
  FROM classes
  WHERE id = p_class_id AND is_cancelled = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'class_not_found');
  END IF;

  IF now() < v_starts_at - interval '24 hours' THEN
    RETURN json_build_object('success', false, 'error', 'too_early_to_book');
  END IF;

  IF now() >= v_starts_at - interval '1 hour' THEN
    RETURN json_build_object('success', false, 'error', 'too_late_to_book');
  END IF;

  IF v_user_role = 'user' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_sports WHERE user_id = p_user_id AND sport_id = v_sport_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'sport_not_assigned');
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM reservations
  WHERE class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_capacity THEN
    RETURN json_build_object('success', false, 'error', 'class_full');
  END IF;

  IF EXISTS (SELECT 1 FROM reservations WHERE class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed') THEN
    RETURN json_build_object('success', false, 'error', 'already_booked');
  END IF;

  v_month := date_trunc('month', now() AT TIME ZONE 'Europe/Madrid')::date;

  -- Auto-crear fila mensual desde bono recurrente si no existe todavía
  INSERT INTO user_bonos (user_id, bono_id, month)
  SELECT p_user_id, u.recurring_bono_id, v_month
  FROM users u
  WHERE u.id = p_user_id AND u.recurring_bono_id IS NOT NULL
  ON CONFLICT (user_id, month) DO NOTHING;

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

  INSERT INTO reservations (class_id, user_id, status)
  VALUES (p_class_id, p_user_id, 'confirmed')
  ON CONFLICT (class_id, user_id) DO UPDATE
    SET status        = 'confirmed',
        booked_at     = now(),
        cancelled_at  = NULL,
        cancelled_by  = NULL,
        cancel_reason = NULL;

  UPDATE user_bonos
  SET classes_used = classes_used + 1
  WHERE user_id = p_user_id AND month = v_month;

  RETURN json_build_object('success', true);
END;
$$;

-- ── 3. admin_add_user_to_class: idem para cuando el admin añade manualmente ───
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

  v_month := date_trunc('month', v_starts_at AT TIME ZONE 'Europe/Madrid')::date;

  -- Auto-crear fila mensual desde bono recurrente si no existe todavía
  INSERT INTO user_bonos (user_id, bono_id, month)
  SELECT p_user_id, u.recurring_bono_id, v_month
  FROM users u
  WHERE u.id = p_user_id AND u.recurring_bono_id IS NOT NULL
  ON CONFLICT (user_id, month) DO NOTHING;

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

GRANT EXECUTE ON FUNCTION book_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_add_user_to_class(uuid, uuid, uuid, boolean) TO authenticated;
