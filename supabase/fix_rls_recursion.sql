-- FIX: infinite recursion in RLS policies (error 42P17)
-- Causa: las políticas admin consultan la tabla 'users' desde dentro de
-- las políticas de 'users', causando recursión infinita.
-- Solución: funciones SECURITY DEFINER que bypasean RLS.

-- ─── 1. Funciones helper (SECURITY DEFINER bypasea RLS) ───────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('general_admin', 'sport_admin')
     FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_general_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'general_admin'
     FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sport_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'sport_admin'
     FROM public.users WHERE id = auth.uid()),
    false
  );
$$;


-- ─── 2. Políticas tabla USERS ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "admins_select_all_users"    ON public.users;
DROP POLICY IF EXISTS "general_admin_manage_users"  ON public.users;

-- Admins ven todos los usuarios
CREATE POLICY "admins_select_all_users" ON public.users
  FOR SELECT USING (is_admin());

-- Solo general_admin puede crear/modificar/eliminar usuarios
CREATE POLICY "general_admin_manage_users" ON public.users
  FOR ALL USING (is_general_admin());


-- ─── 3. Políticas tabla CLASSES ───────────────────────────────────────────────

DROP POLICY IF EXISTS "general_admin_manage_classes"          ON public.classes;
DROP POLICY IF EXISTS "sport_admin_manage_own_sport_classes"  ON public.classes;

CREATE POLICY "general_admin_manage_classes" ON public.classes
  FOR ALL USING (is_general_admin());

CREATE POLICY "sport_admin_manage_own_sport_classes" ON public.classes
  FOR ALL USING (
    is_sport_admin()
    AND EXISTS (
      SELECT 1 FROM public.user_sports
      WHERE user_id = auth.uid() AND sport_id = classes.sport_id
    )
  );


-- ─── 4. Políticas tabla RESERVATIONS ─────────────────────────────────────────

DROP POLICY IF EXISTS "admins_read_all_reservations" ON public.reservations;

CREATE POLICY "admins_read_all_reservations" ON public.reservations
  FOR SELECT USING (is_admin());


-- ─── 5. Políticas tabla USER_BONOS ───────────────────────────────────────────

DROP POLICY IF EXISTS "admins_manage_bonos" ON public.user_bonos;

CREATE POLICY "admins_manage_bonos" ON public.user_bonos
  FOR ALL USING (is_admin());
