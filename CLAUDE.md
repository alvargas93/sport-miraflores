# CLAUDE.md — Sport Miraflores App

Este archivo define la especificación completa del proyecto. Léelo entero antes de escribir cualquier línea de código. Ante cualquier duda técnica o de negocio, consulta este documento primero.

---

## Descripción del proyecto

Aplicación PWA de reservas de clases para el gimnasio **Sport Miraflores**. Permite a los socios reservar clases de CrossFit/Cross Training e Hyrox. Tiene sistema de bonos mensuales, roles de administración y notificaciones push.

- **Tipo**: Progressive Web App (PWA) — instalable en Android e iOS sin App Store
- **Usuarios objetivo**: <100 usuarios
- **Plataformas**: Android (Chrome) e iOS (Safari 16.4+ con PWA instalada)
- **Idioma**: español (España)
- **Zona horaria**: Europe/Madrid

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| PWA | `vite-plugin-pwa` (manifest + service worker) |
| Estilos | Tailwind CSS + variables CSS del diseño de referencia |
| Routing | React Router v6 |
| Estado servidor | TanStack Query v5 |
| Formularios | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Notificaciones push | OneSignal (SDK React) |
| Hosting | Vercel (deploy automático desde GitHub) |
| Email (solo reset password) | Supabase Auth built-in (SMTP configurado en Supabase) |

---

## Design tokens (respetar siempre)

```css
:root {
  --teal:      #0abfbf;
  --teal-dark: #077a7a;
  --teal-glow: rgba(10,191,191,0.18);
  --bg:        #0e0e0e;
  --surface:   #161616;
  --surface2:  #1e1e1e;
  --surface3:  #252525;
  --border:    rgba(10,191,191,0.15);
  --text:      #f0f0f0;
  --muted:     #7a7a7a;
  --danger:    #e05555;
  --warning:   #e8a020;
  --success:   #2ecc8f;
  --font-head: 'Barlow Condensed', sans-serif;
  --font-body: 'Barlow', sans-serif;
}
```

Fuentes: Google Fonts — `Barlow Condensed` (pesos 400/600/700/800/900) y `Barlow` (pesos 300/400/500/600).

Estética: fondo oscuro, acento turquesa, tarjetas redondeadas, navegación inferior, tipografía condensada en títulos y headers.

---

## Estructura de carpetas

```
src/
├── components/
│   ├── ui/               # Componentes reutilizables (Button, Card, Modal, Input...)
│   ├── layout/           # BottomNav, TopBar, AdminLayout
│   └── features/
│       ├── auth/         # Login, Splash
│       ├── bookings/     # CalendarStrip, ClassCard, ClassModal, BookingList
│       ├── profile/      # ProfileScreen, AvatarUpload
│       └── admin/        # UserTable, ClassForm, TemplateForm, BonusAssign
├── hooks/                # useAuth, useBookings, useClasses, useBono...
├── lib/
│   ├── supabase.js       # Cliente Supabase
│   ├── onesignal.js      # Inicialización OneSignal
│   └── utils.js          # Helpers de fecha, formato, validaciones
├── pages/
│   ├── Splash.jsx
│   ├── Login.jsx
│   ├── Bookings.jsx
│   ├── MyClasses.jsx
│   ├── Profile.jsx
│   └── admin/
│       ├── AdminDashboard.jsx
│       ├── AdminUsers.jsx
│       ├── AdminClasses.jsx
│       ├── AdminTemplates.jsx
│       ├── AdminBonos.jsx
│       └── AdminClassDetail.jsx
├── stores/               # Zustand si se necesita estado global ligero
├── App.jsx
└── main.jsx
```

---

## Base de datos — Esquema completo

### Tabla: `users`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
email           text UNIQUE NOT NULL
full_name       text NOT NULL
avatar_url      text
is_active       boolean DEFAULT true
role            text NOT NULL CHECK (role IN ('user', 'sport_admin', 'general_admin'))
onesignal_id    text                        -- player_id de OneSignal para push
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

> Los usuarios los crea siempre un admin. No hay registro público.
> Los admins también son usuarios: tienen deportes asignados, bonos y pueden reservar clases.
> Los admins (cualquier rol) pueden reservar CUALQUIER deporte, no están limitados por user_sports.

---

### Tabla: `sports`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL               -- 'Crossfit / Cross Training', 'Hyrox'
slug            text UNIQUE NOT NULL        -- 'crossfit', 'hyrox'
description     text
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

Deportes iniciales:
- `crossfit` → "Crossfit / Cross Training"
- `hyrox` → "Hyrox"

El modelo soporta añadir nuevos deportes (ej. Pilates) sin cambios de esquema.

---

### Tabla: `user_sports`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
sport_id        uuid REFERENCES sports(id) ON DELETE CASCADE
UNIQUE(user_id, sport_id)
```

> Para usuarios normales: define qué deportes puede reservar.
> Para admins de deporte: define qué deportes puede gestionar.
> Para admins generales: esta tabla no limita sus reservas (pueden reservar cualquier deporte).

---

### Tabla: `bonos` (catálogo de tipos de bono)

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL               -- 'Bono 5', 'Bono 10', 'Bono 15', 'Bono Ilimitado'
max_classes     int                         -- NULL = ilimitado
is_active       boolean DEFAULT true
```

Datos iniciales:
```
Bono 5      → max_classes: 5
Bono 10     → max_classes: 10
Bono 15     → max_classes: 15
Ilimitado   → max_classes: NULL
```

---

### Tabla: `user_bonos` (bono activo de cada usuario por mes)

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
bono_id         uuid REFERENCES bonos(id)
month           date NOT NULL               -- siempre el día 1: '2025-06-01'
classes_used    int DEFAULT 0
assigned_by     uuid REFERENCES users(id)
assigned_at     timestamptz DEFAULT now()
notes           text
UNIQUE(user_id, month)
```

> Los pagos son externos a la app. El admin registra manualmente qué bono ha pagado cada usuario.
> Si un usuario no tiene bono para el mes en curso, no puede reservar.
> Al cambiar de mes, el admin asigna el nuevo bono (no hay renovación automática).
> GREATEST(0, classes_used - 1) al devolver para evitar valores negativos.

---

### Tabla: `class_templates` (plantillas de clases recurrentes)

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sport_id        uuid REFERENCES sports(id)
title           text NOT NULL               -- 'CrossFit Mediodía'
days_of_week    int[] NOT NULL              -- [1,2,3,4,5] ISO: 1=Lunes ... 7=Domingo
start_time      time NOT NULL               -- '12:00:00'
end_time        time NOT NULL               -- '13:00:00'
max_capacity    int DEFAULT 14
instructor      text
is_active       boolean DEFAULT true
valid_from      date NOT NULL
valid_until     date                        -- NULL = indefinida
created_by      uuid REFERENCES users(id)
created_at      timestamptz DEFAULT now()
```

> Cuando el horario cambie (verano/invierno), se cierra la plantilla actual (valid_until) y se crea una nueva (valid_from). Las clases ya generadas no se modifican.
> El admin genera las clases del mes pulsando "Generar clases del mes" en el panel. No hay cron automático en MVP.
> La generación no crea duplicados: comprueba si ya existe clase con mismo template_id + fecha.

---

### Tabla: `classes` (clases individuales programadas)

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sport_id        uuid REFERENCES sports(id)
template_id     uuid REFERENCES class_templates(id) ON DELETE SET NULL  -- NULL si es manual
title           text NOT NULL
starts_at       timestamptz NOT NULL
ends_at         timestamptz NOT NULL        -- siempre starts_at + 1 hora
max_capacity    int DEFAULT 14
instructor      text
notes           text
is_cancelled    boolean DEFAULT false
cancel_reason   text
created_by      uuid REFERENCES users(id)
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

---

### Tabla: `reservations`

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
class_id            uuid REFERENCES classes(id) ON DELETE CASCADE
user_id             uuid REFERENCES users(id)
status              text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled'))
booked_at           timestamptz DEFAULT now()
cancelled_at        timestamptz
cancelled_by        uuid REFERENCES users(id)
cancel_reason       text
is_admin_override   boolean DEFAULT false   -- admin añadió al usuario aunque la clase estuviera llena
UNIQUE(class_id, user_id)
```

---

### Tabla: `push_subscriptions`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
onesignal_id    text NOT NULL
device_info     text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
UNIQUE(user_id, onesignal_id)
```

---

### Tabla: `audit_log`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
actor_id        uuid REFERENCES users(id)
action          text NOT NULL
-- Valores: 'bono_assigned', 'user_activated', 'user_deactivated',
--          'class_created', 'class_cancelled', 'user_added_to_class',
--          'user_removed_from_class', 'reservation_cancelled_by_admin'
target_type     text                        -- 'user', 'class', 'reservation', 'bono'
target_id       uuid
payload         jsonb                       -- datos relevantes del cambio
created_at      timestamptz DEFAULT now()
```

---

## Funciones PostgreSQL (ejecutar como RPC desde el frontend)

### `book_class(p_class_id, p_user_id)`

Reserva una plaza con protección de concurrencia via `FOR UPDATE`.

```sql
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
  -- Verificar usuario activo
  SELECT is_active, role INTO v_is_active, v_user_role
  FROM users WHERE id = p_user_id;

  IF NOT v_is_active THEN
    RETURN json_build_object('success', false, 'error', 'user_inactive');
  END IF;

  -- Bloquear fila de clase para evitar concurrencia
  SELECT max_capacity, starts_at, sport_id INTO v_capacity, v_starts_at, v_sport_id
  FROM classes
  WHERE id = p_class_id AND is_cancelled = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'class_not_found');
  END IF;

  -- Verificar ventana de reserva: mínimo 1 hora antes
  IF now() >= v_starts_at - interval '1 hour' THEN
    RETURN json_build_object('success', false, 'error', 'too_late_to_book');
  END IF;

  -- Verificar deporte asignado (solo usuarios normales, admins pueden reservar cualquier deporte)
  IF v_user_role = 'user' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_sports WHERE user_id = p_user_id AND sport_id = v_sport_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'sport_not_assigned');
    END IF;
  END IF;

  -- Verificar aforo
  SELECT COUNT(*) INTO v_count
  FROM reservations
  WHERE class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_capacity THEN
    RETURN json_build_object('success', false, 'error', 'class_full');
  END IF;

  -- Verificar que no tiene ya reserva
  IF EXISTS (SELECT 1 FROM reservations WHERE class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed') THEN
    RETURN json_build_object('success', false, 'error', 'already_booked');
  END IF;

  -- Verificar bono activo
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

  -- Crear reserva
  INSERT INTO reservations (class_id, user_id, status)
  VALUES (p_class_id, p_user_id, 'confirmed');

  -- Descontar del bono
  UPDATE user_bonos
  SET classes_used = classes_used + 1
  WHERE user_id = p_user_id AND month = v_month;

  RETURN json_build_object('success', true);
END;
$$;
```

---

### `cancel_reservation(p_reservation_id, p_user_id)`

```sql
CREATE OR REPLACE FUNCTION cancel_reservation(p_reservation_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_starts_at   timestamptz;
  v_class_id    uuid;
  v_month       date;
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

  -- Bloqueo: más de 10 minutos desde el inicio
  IF now() > v_starts_at + interval '10 minutes' THEN
    RETURN json_build_object('success', false, 'error', 'cancellation_window_closed');
  END IF;

  -- Cancelar reserva
  UPDATE reservations
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_user_id,
      cancel_reason = 'Cancelada por el usuario'
  WHERE id = p_reservation_id;

  -- Devolver clase al bono (siempre, sin penalización)
  v_month := date_trunc('month', v_starts_at AT TIME ZONE 'Europe/Madrid')::date;

  UPDATE user_bonos
  SET classes_used = GREATEST(0, classes_used - 1)
  WHERE user_id = p_user_id AND month = v_month;

  RETURN json_build_object('success', true);
END;
$$;
```

---

### `cancel_class_by_admin(p_class_id, p_admin_id, p_reason)`

Cancela una clase, devuelve el bono a todos los apuntados y prepara la lista de usuarios para notificar.

```sql
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
  v_user      record;
  v_count     int := 0;
  v_month     date;
  v_user_ids  uuid[] := '{}';
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
```

> Tras ejecutar esta función, el frontend debe leer `user_ids` del resultado y enviar notificación push a cada uno via OneSignal.

---

### `generate_classes_from_templates(p_month)`

Genera todas las clases del mes indicado a partir de plantillas activas. Evita duplicados.

```sql
CREATE OR REPLACE FUNCTION generate_classes_from_templates(
  p_month    date,       -- primer día del mes: '2025-07-01'
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
      -- ISO dow: 1=Lunes, 7=Domingo
      v_dow := EXTRACT(ISODOW FROM v_date);

      IF v_dow = ANY(v_template.days_of_week) THEN
        v_starts_at := (v_date || ' ' || v_template.start_time)::timestamptz
                       AT TIME ZONE 'Europe/Madrid';
        v_ends_at   := (v_date || ' ' || v_template.end_time)::timestamptz
                       AT TIME ZONE 'Europe/Madrid';

        -- Evitar duplicados
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
```

---

## Row Level Security (RLS)

Activar RLS en todas las tablas. Políticas principales:

```sql
-- USERS: cada usuario ve su propio perfil; admins ven todos
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

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

-- CLASSES: todos los usuarios autenticados pueden leer clases no canceladas
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

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

-- RESERVATIONS: cada usuario ve y gestiona las suyas; admins ven todas
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_reservations" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_reservations" ON reservations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );

-- USER_BONOS: usuario ve el suyo; admins gestionan
ALTER TABLE user_bonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bono" ON user_bonos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_bonos" ON user_bonos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('general_admin', 'sport_admin'))
  );
```

---

## Reglas de negocio — referencia rápida

### Reservar clase — condiciones (todas deben cumplirse)
1. Usuario activo
2. Faltan más de 60 minutos para el inicio
3. Aforo no completo (`confirmed < max_capacity`)
4. No tiene ya reserva confirmada en esa clase
5. Tiene bono activo con clases restantes para ese mes
6. Si `role = 'user'`: tiene el deporte asignado en `user_sports`
7. Si `role IN ('sport_admin', 'general_admin')`: puede reservar cualquier deporte

### Cancelar reserva (usuario)
- Puede cancelar hasta 10 minutos después del inicio de la clase
- Siempre devuelve la clase al bono (sin penalización)
- Después de 10 minutos del inicio: no se puede cancelar

### Admin añade usuario a clase llena
- Permitido con confirmación explícita
- `is_admin_override = true` en la reserva
- Se registra en `audit_log`

### Cancelación de clase por el gimnasio
- Devuelve bono a todos los usuarios confirmados automáticamente
- Envía notificación push inmediata a los afectados
- Registra en `audit_log`

### Cambio de mes
- El admin asigna manualmente el bono del nuevo mes a cada usuario
- No hay renovación automática
- Sin bono del mes en curso → no puede reservar

### Bono ilimitado
- `max_classes = NULL` en la tabla `bonos`
- La función `book_class` trata NULL como sin límite

### Pendiente de decisión del cliente
- ❓ **¿Los admins necesitan bono activo para reservar, o están exentos?** Implementar según respuesta. Hasta entonces, aplicar la misma regla que a usuarios normales.

---

## Pantallas y navegación

### Navegación de usuario (bottom nav — 3 tabs)
```
[📅 Reservas]  [📋 Mis Clases]  [👤 Perfil]
```

### Navegación de admin (bottom nav — 4 tabs)
```
[📅 Reservas]  [📋 Mis Clases]  [👤 Perfil]  [⚙️ Admin]
```

> Los admins también son usuarios y tienen las mismas 3 pestañas de usuario más la de admin.

### Inventario completo de pantallas

| Pantalla | Ruta | Acceso |
|---|---|---|
| Splash | `/` | Todos |
| Login | `/login` | No autenticados |
| Reservas | `/bookings` | Usuarios autenticados |
| Modal detalle de clase | (modal sobre /bookings) | Usuarios autenticados |
| Mis Clases | `/my-classes` | Usuarios autenticados |
| Perfil | `/profile` | Usuarios autenticados |
| Panel Admin | `/admin` | sport_admin, general_admin |
| Gestión de Usuarios | `/admin/users` | sport_admin, general_admin |
| Detalle de Usuario | `/admin/users/:id` | sport_admin, general_admin |
| Gestión de Clases | `/admin/classes` | sport_admin, general_admin |
| Plantillas de Clases | `/admin/templates` | sport_admin, general_admin |
| Detalle de Clase (reservas) | `/admin/classes/:id` | sport_admin, general_admin |
| Gestión de Bonos | `/admin/bonos` | sport_admin, general_admin |

> `sport_admin` ve y gestiona solo los deportes que tiene asignados en `user_sports`. Todas las consultas deben filtrar por `sport_id IN (select sport_id from user_sports where user_id = auth.uid())`.

---

## Flujos de usuario

### Usuario reserva clase
1. Abre app → Splash (3s) → Login
2. Pantalla Reservas → selecciona día en el calendario horizontal
3. Ve las clases de su deporte para ese día (usuarios normales) o todas las clases (admins)
4. Pulsa una clase → modal con título, hora, instructor, plazas libres, estado del bono
5. Pulsa "Reservar" → llama a `rpc('book_class', {class_id, user_id})`
6. Éxito → modal de confirmación + clase aparece en "Mis Clases"
7. Error → mensaje específico según código de error

| Código error | Mensaje al usuario |
|---|---|
| `user_inactive` | Tu cuenta está desactivada. Contacta con el gimnasio. |
| `class_not_found` | Esta clase no está disponible. |
| `too_late_to_book` | Solo puedes reservar con más de 1 hora de antelación. |
| `sport_not_assigned` | No tienes este deporte asignado. |
| `class_full` | Esta clase está completa. |
| `already_booked` | Ya tienes esta clase reservada. |
| `no_bono` | No tienes bono activo para este mes. |
| `bono_exhausted` | Has agotado las clases de tu bono este mes. |

### Usuario cancela clase
1. Va a "Mis Clases"
2. Pulsa "Cancelar" → llama a `rpc('cancel_reservation', {reservation_id, user_id})`
3. Éxito → reserva desaparece de la lista, bono restante +1
4. Error `cancellation_window_closed` → "No puedes cancelar una clase que ya ha comenzado hace más de 10 minutos."

### Admin genera clases del mes
1. Va a `/admin/templates`
2. Pulsa "Generar clases de [mes siguiente]"
3. Llama a `rpc('generate_classes_from_templates', {month, admin_id})`
4. Toast con "X clases generadas"

### Admin cancela clase
1. Va a `/admin/classes/:id`
2. Pulsa "Cancelar clase" → modal de confirmación con campo de motivo
3. Llama a `rpc('cancel_class_by_admin', {class_id, admin_id, reason})`
4. Con la respuesta `user_ids`, el frontend envía notificación push a cada usuario via OneSignal

### Admin asigna bono
1. Va a `/admin/users/:id`
2. Sección "Bono mensual" → selector de tipo + mes
3. INSERT en `user_bonos` + registro en `audit_log`

### Admin activa/desactiva usuario
1. Va a `/admin/users/:id`
2. Toggle activo/inactivo → UPDATE en `users.is_active`
3. Registro en `audit_log` con actor y fecha

### Admin añade usuario a clase manualmente
1. Va a `/admin/classes/:id` → lista de reservas
2. Pulsa "Añadir usuario" → buscador
3. Si la clase está llena, muestra advertencia con confirmación de override
4. INSERT en `reservations` con `is_admin_override = true` si aplica
5. Descuenta del bono del usuario (o no, según decisión pendiente)
6. Registro en `audit_log`

### Admin quita usuario de clase
1. Va a `/admin/classes/:id` → lista de reservas
2. Pulsa "×" junto al usuario
3. Llama a `cancel_reservation` en nombre del usuario (con `cancelled_by = admin_id`)
4. Devuelve clase al bono

---

## Notificaciones push (OneSignal)

### Eventos que disparan notificación

| Evento | Destinatario | Mensaje |
|---|---|---|
| Clase cancelada por el gym | Usuarios apuntados | "La clase [título] del [día] a las [hora] ha sido cancelada. Tu clase ha sido devuelta al bono." |
| Reserva confirmada | El propio usuario | "Reserva confirmada: [título] el [día] a las [hora]." (opcional MVP) |

> En MVP implementar solo la notificación de cancelación (es la crítica). La de confirmación puede ir en V2.

### Implementación en el frontend

```javascript
// lib/onesignal.js
import OneSignal from 'react-onesignal';

export async function initOneSignal() {
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    serviceWorkerParam: { scope: '/' },
  });
}

export async function registerPushUser(userId) {
  await OneSignal.login(userId); // usa el uuid de Supabase como external_id
  const playerId = await OneSignal.User.PushSubscription.id;
  return playerId;
}
```

Guardar `playerId` en `users.onesignal_id` y en `push_subscriptions` tras el login.

Para enviar notificación desde el frontend tras `cancel_class_by_admin`:
```javascript
// Llamar a la OneSignal REST API desde una Edge Function de Supabase
// (nunca desde el frontend para no exponer la API Key de OneSignal)
```

Crear una Edge Function `notify-class-cancelled` que reciba `{user_ids, class_title, starts_at}` y llame a la API de OneSignal con `include_external_user_ids`.

---

## Variables de entorno

```
# .env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

```
# Supabase Edge Functions (secrets)
ONESIGNAL_API_KEY=...
ONESIGNAL_APP_ID=...
```

---

## PWA — configuración mínima

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Sport Miraflores',
    short_name: 'SportMiraflores',
    description: 'Reserva tus clases de CrossFit y Hyrox',
    theme_color: '#0abfbf',
    background_color: '#0e0e0e',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
})
```

Mostrar banner de instalación en iOS (Safari no muestra el prompt automático):
```jsx
// Detectar iOS + Safari y mostrar instrucciones manuales la primera vez
const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
if (isIos && !isInStandaloneMode) {
  // Mostrar banner: "Para instalar la app: pulsa [compartir] → Añadir a pantalla de inicio"
}
```

---

## Plan de desarrollo — orden recomendado

### Fase 0 — Setup (1-2 días)
- [ ] Crear proyecto en Supabase
- [ ] Aplicar esquema SQL completo (tablas + funciones + RLS)
- [ ] Insertar datos seed (deportes, bonos)
- [ ] Crear proyecto React + Vite + Tailwind + React Router
- [ ] Configurar `vite-plugin-pwa`
- [ ] Conectar repo a Vercel
- [ ] Configurar variables de entorno

### Fase 1 — Auth y shell (3-4 días)
- [ ] Splash screen con logo y animación (3-4 segundos)
- [ ] Pantalla de Login (email + contraseña, Supabase Auth)
- [ ] Bloqueo de usuario inactivo en login
- [ ] Hook `useAuth` con contexto global
- [ ] ProtectedRoute por autenticación y por rol
- [ ] Bottom navigation (3 tabs usuario / 4 tabs admin)
- [ ] Recuperación de contraseña por email (Supabase built-in)

### Fase 2 — Reservas (5-7 días)
- [ ] Calendario horizontal (strip de días con scroll)
- [ ] Fetch de clases por día y deporte
- [ ] `ClassCard` con estado: disponible / llena / reservada / pasada
- [ ] Modal de detalle de clase
- [ ] Función `book_class` y manejo de todos los errores
- [ ] Actualización optimista de aforo con TanStack Query
- [ ] Realtime: actualizar plazas disponibles en tiempo real (Supabase Realtime)

### Fase 3 — Mis Clases y Perfil (3-4 días)
- [ ] Lista de próximas reservas confirmadas
- [ ] Botón cancelar con mensaje según ventana de cancelación
- [ ] Función `cancel_reservation`
- [ ] Pantalla de perfil: datos, deporte, bono restante del mes
- [ ] Cambio de contraseña
- [ ] Subida de avatar (Supabase Storage, bucket `avatars`)

### Fase 4 — Panel de administración (7-10 días)
- [ ] Dashboard admin: resumen de hoy (clases, reservas, usuarios activos)
- [ ] Gestión de usuarios: tabla con buscador, filtro por deporte, activar/desactivar
- [ ] Detalle de usuario: asignar deporte, asignar bono, ver historial de bonos
- [ ] Plantillas de clases: CRUD completo
- [ ] Generar clases del mes (botón + confirmación)
- [ ] Gestión de clases: lista, editar, cancelar clase
- [ ] Detalle de clase: lista de reservas, añadir usuario, quitar usuario
- [ ] Gestión de bonos: vista rápida de bonos activos del mes por usuario
- [ ] Filtrado de vistas para `sport_admin` por sus deportes asignados

### Fase 5 — Notificaciones push (2-3 días)
- [ ] Configurar proyecto OneSignal
- [ ] Integrar SDK en React, solicitar permiso tras login
- [ ] Banner de instalación en iOS
- [ ] Guardar `onesignal_id` en el perfil del usuario
- [ ] Edge Function `notify-class-cancelled`
- [ ] Conectar `cancel_class_by_admin` con la Edge Function

### Fase 6 — QA y despliegue (2-3 días)
- [ ] Test de reservas simultáneas (dos usuarios, última plaza)
- [ ] Test de bono agotado
- [ ] Test de usuario inactivo
- [ ] Test de RLS (usuario no puede ver datos de otro)
- [ ] Test de sport_admin intentando gestionar deportes que no son suyos
- [ ] Probar instalación PWA en Android (Chrome) e iOS (Safari)
- [ ] Probar notificación push en ambas plataformas
- [ ] Configurar dominio en Vercel cuando esté disponible

---

## Decisión pendiente del cliente

> ❓ **¿Los admins (sport_admin y general_admin) necesitan tener bono activo para reservar clases, o están exentos de esta regla?**
>
> Hasta recibir respuesta: aplicar la misma regla que a usuarios normales (necesitan bono).
> Si la respuesta es "exentos": en `book_class`, añadir `IF v_user_role IN ('sport_admin', 'general_admin') THEN saltar comprobación de bono`.

---

*Sport Miraflores · Especificación técnica completa · Mayo 2026*
