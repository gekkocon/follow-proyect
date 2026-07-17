# Changelog técnico — Dashboard Agencia FEMCO

> Historial de fases con detalle de arquitectura, archivos y migraciones SQL.
> Para la vista funcional (qué hace cada módulo), ver `FUNCIONALIDADES.md`.

---

## Fase 6B — PWA + Responsive + Branding dinámico

**Alcance:** Instalabilidad PWA, layout responsive completo (breakpoint `md`), y gestión de marca 100% dinámica desde Configuración.

### PWA
- `public/manifest.json`, `public/icons/icon-192.svg`, `icon-512.svg`
- `public/sw.js` — service worker (network-first navegación, cache-first estáticos, fallback `/offline`)
- `components/layout/SwRegister.tsx` — registro del SW
- `app/offline/page.tsx` — página offline

### Layout responsive
- `components/layout/Sidebar.tsx` — dos `<aside>` separados: estático `hidden md:flex` (desktop) y `fixed md:hidden` drawer (móvil). Evita duplicados y errores de hydration.
- `components/layout/Header.tsx` — hamburger + logo centrado en móvil
- `components/layout/BottomNav.tsx` — barra inferior móvil, ítems filtrados por rol
- `components/tasks/TaskFilters.tsx` — reescrito con panel colapsable en móvil

### Branding dinámico
- Migración `src/lib/supabase/migrations/006_favicon_url.sql` — columna `favicon_url` en `brand_settings`
- `components/layout/BrandMeta.tsx` (nuevo) — actualiza `document.title` (`"<Módulo> · <Agencia>"`) y favicon en tiempo real según ruta y store
- `app/layout.tsx` — `generateMetadata()` async lee marca desde Supabase para el `<title>`/favicon inicial (SSR)
- `app/login/page.tsx` — convertido a server component, lee marca real desde DB; formulario extraído a `components/login/LoginForm.tsx`
- `components/settings/SettingsForm.tsx` — campo de favicon con preview

### Fixes
- Dropdown de rol en tabla Usuarios cortado por overflow → `createPortal` a `document.body` + posición `fixed` calculada
- Sidebar duplicado / hydration error → dos `<aside>` explícitos sin lógica condicional dependiente de estado async
- Errores de webpack chunk tras reescrituras de archivos → resuelto con `rm -rf .next`

---

## Fase 6A — Autenticación real con Supabase Auth

**Alcance:** Reemplazo del usuario simulado (Ana Torres hardcoded) por sesión real.

- Vínculo Auth ↔ tabla `users` por **email** (sin columna UUID adicional)
- `src/lib/supabase/server.ts` — `createServerClient()`, `createAuthServerClient()` (cookies SSR), `createAdminClient()` (service role)
- `middleware.ts` — protege `/dashboard`, `/projects`, `/tasks`, `/users`, `/settings`
- `src/lib/supabase/active-user.ts` — `getActiveUser()` ahora async
- `src/store/authStore.ts` — sin usuario simulado, hidratado vía `components/layout/AuthHydrator.tsx`
- `app/login/page.tsx` — login con Zod + RHF
- `src/lib/supabase/user-actions.ts` — `createUser()` crea cuenta Auth + inserta en `users` (con rollback); `updateUser()` sincroniza email/password en Auth

**Variable de entorno requerida:** `SUPABASE_SERVICE_ROLE_KEY`

**Paso manual en Supabase:** Authentication → Providers → Email debe estar habilitado (default en proyectos nuevos).

---

## Fase 5F — Equipo de trabajo por proyecto

- Tabla `project_members` (project_id, user_id, rol_en_proyecto)
- Filtro de visibilidad por rol: Admin ve todo, Coordinador/Colaborador solo proyectos donde son miembros
- `components/projects/MemberSelector.tsx` — selector reutilizable
- `src/lib/supabase/member-actions.ts` — `getVisibleProjectIds()`, `getProjectMembers()`, `addProjectMember()`, etc.

---

## Fase 5E — Detalle de proyecto con tareas/subtareas inline

### SQL ejecutado en Supabase
- `task_assignees` (task_id, user_id)
- `subtask_assignees` (subtask_id, user_id)
- `subtasks` extendida con `status task_status` y `due_date DATE`
- Migración de `assignee_id` (tasks) → `task_assignees`

### Archivos
- `src/lib/supabase/types.ts` — `DbTaskAssignee`, `DbSubtaskAssignee`, `SubtaskWithAssignees`, `TaskWithFullRelations`
- `src/lib/supabase/project-task-actions.ts` — CRUD tasks + subtasks con sync de assignees
- `components/projects/AssigneeSelector.tsx` — selector multi-usuario con avatares
- `components/projects/TaskRow.tsx` — edición inline + `SubtaskRow` + `NewSubtaskRow`
- `components/projects/ProjectTasksClient.tsx` — lista con `NewTaskRow` inline

---

## Deploy

- Flujo: `git init` → GitHub → Vercel
- Variables de entorno en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Pendiente por cada nuevo dominio: configurar Site URL y Redirect URLs en Supabase Auth
