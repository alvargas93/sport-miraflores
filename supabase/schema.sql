-- ============================================================
-- Sport Miraflores — Esquema completo
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLAS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  avatar_url    text,
  is_active     boolean DEFAULT true,
  role          text NOT NULL CHECK (role IN ('user', 'sport_admin', 'general_admin')),
  onesignal_id  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sports (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  sport_id  uuid REFERENCES sports(id) ON DELETE CASCADE,
  UNIQUE(user_id, sport_id)
);

CREATE TABLE IF NOT EXISTS bonos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  max_classes int,
  is_active   boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_bonos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  bono_id     uuid REFERENCES bonos(id),
  month       date NOT NULL,
  classes_used int DEFAULT 0,
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  notes       text,
  UNIQUE(user_id, month)
);

CREATE TABLE IF NOT EXISTS class_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id     uuid REFERENCES sports(id),
  title        text NOT NULL,
  days_of_week int[] NOT NULL,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  max_capacity int DEFAULT 14,
  instructor   text,
  is_active    boolean DEFAULT true,
  valid_from   date NOT NULL,
  valid_until  date,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id     uuid REFERENCES sports(id),
  template_id  uuid REFERENCES class_templates(id) ON DELETE SET NULL,
  title        text NOT NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  max_capacity int DEFAULT 14,
  instructor   text,
  notes        text,
  is_cancelled boolean DEFAULT false,
  cancel_reason text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          uuid REFERENCES classes(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id),
  status            text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  booked_at         timestamptz DEFAULT now(),
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES users(id),
  cancel_reason     text,
  is_admin_override boolean DEFAULT false,
  UNIQUE(class_id, user_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  onesignal_id text NOT NULL,
  device_info  text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, onesignal_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  payload     jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- DATOS SEED
-- ────────────────────────────────────────────────────────────

INSERT INTO sports (name, slug, description) VALUES
  ('Crossfit / Cross Training', 'crossfit', 'Clases de CrossFit y Cross Training'),
  ('Hyrox', 'hyrox', 'Clases de Hyrox')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO bonos (name, max_classes) VALUES
  ('Bono 5',      5),
  ('Bono 10',     10),
  ('Bono 15',     15),
  ('Ilimitado',   NULL)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN: book_class
-- ────────────────────────────────────────────────────────────

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
  VALUES (p_class_id, p_user_id, 'confirmed');

  UPDATE user_bonos
  SET classes_used = classes_used + 1
  WHERE user_id = p_user_id AND month = v_month;

  RETURN json_build_object('success', true);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN: cancel_reservation
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_reservation(p_reservation_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_starts_at timestamptz;
  v_class_id  uuid;
  v_month     date;
BEGIN
  SELECT c.starts_at, r.class_id INTO v_starts_at, v_class_id
  FROM reservations r
  JOIN classes c ON r.class_id = c.id
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id
    AND r.status = 'confirmed';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'reservation_not_found');
  END IF;

  IF now() > v_starts_at + interval '10 minutes' THEN
    RETURN json_build_object('success', false, 'error', 'cancellation_window_closed');
  END IF;

  UPDATE reservations
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_user_id,
      cancel_reason = 'Cancelada por el usuario'
  WHERE id = p_reservation_id;

  v_month := date_trunc('month', v_starts_at AT TIME ZONE 'Europe/Madrid')::date;

  UPDATE user_bonos
  SET classes_used = GREATEST(0, classes_used - 1)
  WHERE user_id = p_user_id AND month = v_month;

  RETURN json_build_object('success', true);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN: cancel_class_by_admin
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_class_by_admin(
  p_class_id uuid,
  p_admin_id uuid,
  p_reason   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user     record;
  v_count    int := 0;
  v_month    date;
  v_user_ids uuid[] := '{}';
BEGIN
  UPDATE classes
  SET is_cancelled = true,
      cancel_reason = COALESCE(p_reason, 'Cancelada por el gimnasio'),
      updated_at = now()
  WHERE id = p_class_id;

  FOR v_user IN
    SELECT r.user_id, c.starts_at
    FROM reservations r
    JOIN classes c ON r.class_id = c.id
    WHERE r.class_id = p_class_id AND r.status = 'confirmed'
  LOOP
    v_month := date_trunc('month', v_user.starts_at AT TIME ZONE 'Europe/Madrid')::date;

    UPDATE reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_admin_id,
        cancel_reason = COALESCE(p_reason, 'Clase cancelada por el gimnasio')
    WHERE class_id = p_class_id AND user_id = v_user.user_id;

    UPDATE user_bonos
    SET classes_used = GREATEST(0, classes_used - 1)
    WHERE user_id = v_user.user_id AND month = v_month;

    v_user_ids := array_append(v_user_ids, v_user.user_id);
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    p_admin_id,
    'class_cancelled',
    'class',
    p_class_id,
    jsonb_build_object('reason', p_reason, 'users_refunded', v_count, 'user_ids', v_user_ids)
  );

  RETURN json_build_object('success', true, 'users_refunded', v_count, 'user_ids', v_user_ids);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN: generate_classes_from_templates
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_classes_from_templates(
  p_month    date,
  p_admin_id uuid
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

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admins_select_all_users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

CREATE POLICY "general_admin_manage_users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'general_admin')
  );

-- SPORTS (lectura pública para autenticados)
CREATE POLICY "authenticated_read_sports" ON sports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "general_admin_manage_sports" ON sports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'general_admin')
  );

-- USER_SPORTS
CREATE POLICY "users_own_sports" ON user_sports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_user_sports" ON user_sports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

-- BONOS (lectura pública para autenticados)
CREATE POLICY "authenticated_read_bonos" ON bonos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "general_admin_manage_bonos" ON bonos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'general_admin')
  );

-- USER_BONOS
CREATE POLICY "users_own_bono" ON user_bonos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_bonos" ON user_bonos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

-- CLASS_TEMPLATES
CREATE POLICY "authenticated_read_templates" ON class_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "general_admin_manage_templates" ON class_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'general_admin')
  );

CREATE POLICY "sport_admin_manage_own_templates" ON class_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_sports us ON us.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.role = 'sport_admin'
        AND us.sport_id = class_templates.sport_id
    )
  );

-- CLASSES
CREATE POLICY "authenticated_read_classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated' AND is_cancelled = false);

CREATE POLICY "general_admin_manage_classes" ON classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'general_admin')
  );

CREATE POLICY "sport_admin_manage_own_sport_classes" ON classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_sports us ON us.user_id = u.id
      WHERE u.id = auth.uid()
        AND u.role = 'sport_admin'
        AND us.sport_id = classes.sport_id
    )
  );

-- RESERVATIONS
CREATE POLICY "users_own_reservations" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_reservations" ON reservations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

CREATE POLICY "users_insert_own_reservation" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- PUSH_SUBSCRIPTIONS
CREATE POLICY "users_own_push" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- AUDIT_LOG
CREATE POLICY "admins_read_audit" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

CREATE POLICY "authenticated_insert_audit" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
