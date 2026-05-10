-- Ejecutar DESPUÉS de crear el usuario en Supabase Dashboard (Authentication → Users)
-- Ajusta el email si usaste otro distinto

DO $$
DECLARE
  v_user_id     uuid;
  v_crossfit_id uuid;
  v_hyrox_id    uuid;
  v_bono10_id   uuid;
  v_template_id uuid;
BEGIN
  -- Obtener el UUID del usuario recién creado en auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@sportmiraflores.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en auth.users. Créalo primero en el dashboard.';
  END IF;

  -- IDs de deportes y bono
  SELECT id INTO v_crossfit_id FROM sports WHERE slug = 'crossfit';
  SELECT id INTO v_hyrox_id    FROM sports WHERE slug = 'hyrox';
  SELECT id INTO v_bono10_id   FROM bonos  WHERE name = 'Bono 10';

  -- Insertar perfil en users
  INSERT INTO public.users (id, email, full_name, role, is_active)
  VALUES (v_user_id, 'admin@sportmiraflores.com', 'Admin General', 'general_admin', true)
  ON CONFLICT (id) DO NOTHING;

  -- Asignar ambos deportes (admin puede gestionar todos)
  INSERT INTO user_sports (user_id, sport_id) VALUES (v_user_id, v_crossfit_id) ON CONFLICT DO NOTHING;
  INSERT INTO user_sports (user_id, sport_id) VALUES (v_user_id, v_hyrox_id)    ON CONFLICT DO NOTHING;

  -- Asignar Bono 10 para el mes actual
  INSERT INTO user_bonos (user_id, bono_id, month, classes_used, assigned_by)
  VALUES (
    v_user_id,
    v_bono10_id,
    date_trunc('month', now() AT TIME ZONE 'Europe/Madrid')::date,
    2,
    v_user_id
  )
  ON CONFLICT (user_id, month) DO NOTHING;

  -- Crear plantilla de clase CrossFit (Lun-Vie a las 12:00)
  INSERT INTO class_templates (sport_id, title, days_of_week, start_time, end_time, max_capacity, instructor, valid_from, created_by)
  VALUES (v_crossfit_id, 'CrossFit Mediodía', ARRAY[1,2,3,4,5], '12:00', '13:00', 14, 'Juan García', current_date - 30, v_user_id)
  RETURNING id INTO v_template_id;

  -- Crear plantilla Hyrox (Martes y Jueves a las 19:00)
  INSERT INTO class_templates (sport_id, title, days_of_week, start_time, end_time, max_capacity, instructor, valid_from, created_by)
  VALUES (v_hyrox_id, 'Hyrox Tarde', ARRAY[2,4], '19:00', '20:00', 10, 'Laura Sanz', current_date - 30, v_user_id);

  -- Generar clases del mes actual
  PERFORM generate_classes_from_templates(
    date_trunc('month', now() AT TIME ZONE 'Europe/Madrid')::date,
    v_user_id
  );

  RAISE NOTICE 'Usuario, bono y clases creados correctamente. ID: %', v_user_id;
END $$;
