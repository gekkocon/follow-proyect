# CLAUDE.md — follow-proyect

Reglas del repositorio. Se cargan automáticamente al abrir sesión de Claude Code.
Última fase cerrada: **8B**.

---

## 1. Qué es este proyecto

`follow-proyect` (en docs figura como "Dashboard Agencia FEMCO") es un gestor interno de proyectos y tareas para una agencia. Tipo Asana reducido, con branding configurable.

**No es un ERP.** No tiene facturación, clientes como entidad, compras, inventario, nómina ni contabilidad. Pedir algo de esa naturaleza implica módulo nuevo, tabla nueva y archivo de acciones nuevo — no es un ajuste.

- Repo `follow-proyect`, rama `main`
- Dev: `npm run dev` → `localhost:3001`
- Deploy: Vercel, automático en cada push a `main`
- Versión visible en Sidebar: v0.6

---

## 2. Stack fijo

| Capa | Herramienta |
|---|---|
| Framework | Next.js 14 App Router |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS 3.4 |
| Componentes | shadcn/ui + lucide-react |
| Base de datos | Supabase Postgres |
| Backend/API | Supabase (server actions, sin API routes) |
| Cliente BD | @supabase/supabase-js |
| Auth | Supabase Auth (email + password, sin registro público) |
| Estado global | Zustand (3 stores) |
| Formularios | React Hook Form |
| Validación | Zod |
| Fechas | date-fns, locale `es` |

**Prohibido sin justificación previa y aprobada:** SQLite, Drizzle ORM, Prisma, cualquier otro ORM, React Query, librerías de charts.

---

## 3. Arquitectura real — respetarla

Patrón dominante, sin excepciones:

```
Server Component (fetch) → props → Client Component (interacción)
    → Server Action → Supabase + revalidatePath
```

- No hay API routes. No hay REST propio. No hay React Query.
- Toda escritura pasa por `'use server'` en `src/lib/supabase/*-actions.ts`.
- Los server actions **devuelven siempre `{ error: string | null }`**. Nunca lanzan excepciones. El cliente muestra ese string tal cual.
- Siempre `revalidatePath` después de escribir.

**Archivos de acciones (7):** `project-actions`, `project-task-actions`, `project-import-actions`, `task-actions`, `member-actions`, `user-actions`, `brand-actions`.

**Clientes de Supabase** (`src/lib/supabase/server.ts`):

| Cliente | Uso |
|---|---|
| `createServerClient()` | anon key, sin sesión. El que usa casi todo. |
| `createAuthServerClient()` | lee/escribe cookies de sesión (SSR). |
| `createAdminClient()` | service role key, bypassea RLS. Solo en `user-actions`. |

`SUPABASE_SERVICE_ROLE_KEY` jamás se expone en cliente.

---

## 4. Estructura de carpetas — la real, no la ideal

```
/app                 rutas App Router: (dashboard)/dashboard, projects,
                     projects/[id], tasks, users, settings, login
/components          layout, dashboard, projects, tasks, users, settings, ui
/lib                 SOLO utils.ts de shadcn
/src
  /lib
    /supabase        client.ts, server.ts, types.ts, auth.ts,
                     active-user.ts, *-actions.ts, schema.sql, /migrations
    /validations     esquemas Zod
    constants.ts, task-constants.ts
  /store             Zustand
/docs                FUNCIONALIDADES.md, CHANGELOG.md,
                     ARQUITECTURA-WORKPLAN.md
```

Es asimétrico (`/app` y `/components` fuera de `/src`) pero **es el estándar del repo. No reorganizar.** El alias `@/` apunta a la raíz.

---

## 5. Convenciones

- Código, nombres de variables y comentarios **en inglés**. Texto de interfaz **en español**.
- Separadores de sección con líneas de guiones dentro de los archivos.
- Zod valida entradas de formulario. Complementa a Supabase, no duplica lógica.

---

## 6. Modelo de datos actual

**8 tablas**, todas con `id BIGSERIAL`: `users`, `brand_settings`, `projects`, `tasks`, `subtasks`, `task_assignees`, `subtask_assignees`, `project_members`.

Campos reales — **en inglés**, no en español:

- `projects`: name, description, status, priority, owner_id, start_date, due_date
- `tasks`: title, description, status, priority, project_id, is_blocked, blocked_reason, start_date, due_date, estimated_cost, dependencies
- `subtasks`: igual + task_id + completed; sin is_blocked ni blocked_reason
- `project_members`: project_id, user_id, rol_en_proyecto *(TEXT libre, no enum)*

**5 enums Postgres:** `user_role`, `user_status`, `project_status`, `priority_level`, `task_status`.

**Roles reales:** `admin`, `pm`, `developer`, `designer`.
Equivalencia con la nomenclatura vieja: admin ≈ Admin, pm ≈ Coordinador, developer y designer ≈ Colaborador.

**Permisos** (`src/lib/supabase/active-user.ts`) — solo dos funciones:

- `isGlobalAdmin(user)` → `role === 'admin'`
- `canManageTeam(user)` → admin o pm

**Visibilidad:** `member-actions.ts → getVisibleProjectIds()` devuelve `null` para admin (ve todo) o un array de `project_id`. Se inyecta como `.in('id', ids)` en cada query de página.

**Vínculo Auth ↔ tabla users: por EMAIL, no por UUID.** Si cambia el email en un lado y no en el otro, el usuario queda sin perfil.

### Códigos humanos legibles (Fase 8A)

- `tasks.code` (sin padding: F0, F1…) y `subtasks.code`.
- Índices únicos parciales `(project_id, code)` y `(task_id, code)`.
- Allocators atómicos `alloc_task_code` / `alloc_subtask_code`.
- Contadores watermark `projects.task_code_seq` / `tasks.subtask_code_seq`. **Nunca decrecen**: los códigos borrados quedan quemados.
- La ausencia de padding en `task.code` es **deliberada**. Agregarlo rompe el uso existente.

### Funciones SQL de carga masiva

| Función | Migración | Qué hace |
|---|---|---|
| `import_project_tasks` | 010 | Importa JSON anidado, crea filas nuevas. **Ancla de estabilidad: no modificar.** |
| `update_project_tasks` | 011 | Patch masivo por código humano, JSON plano. |

---

## 7. Reglas de producto y UX

- Edición **inline** sobre listados. Sin modales pesados.
- Paneles laterales (slide-over) solo para alta y edición de proyecto y usuario.
- Componentes reutilizables. Sin over-engineering.
- Un solo componente con prop `mode` antes que componentes duplicados.
- UI limpia, responsive y brandeable: logo, nombre de agencia y color.
- **Ninguna acción destructiva sin confirmación explícita.**
- Eliminar proyecto: bloqueado si tiene tareas; en cascada solo con confirmación en dos pasos.
- Eliminar usuario: bloqueado si tiene tareas asignadas o proyectos a su nombre.

---

## 8. Entornos, migraciones y deploy

| Entorno | Configuración |
|---|---|
| Local | `.env.local` → proyecto Supabase **DEV**. Gitignored, nunca se commitea. |
| Producción | Variables en el dashboard de Vercel → proyecto Supabase **PROD**. |

Cada push a `main` despliega apuntando a datos de producción.

Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).

**Migraciones: no hay sistema automático.** `src/lib/supabase/schema.sql` es la fuente de verdad y los archivos en `/migrations` son el registro. El SQL se ejecuta **a mano** en el editor de Supabase.

**Regla dura:** solo archivos SQL puros para operaciones de base. Nunca seeds en JavaScript.

### Orden obligatorio cuando la fase trae SQL

1. Correr el SQL a mano en **DEV**.
2. **Verificar** en DEV que el flujo funciona de punta a punta.
3. Correr el SQL a mano en **PROD**.
4. **Verificar** en PROD.
5. Recién ahí, `git push` a `main`.

El push dispara el deploy de Vercel. Si el código llega antes que la función SQL, producción queda llamando a algo que no existe.

**Migraciones que tocan contadores o secuencias** no se consideran cerradas porque el script haya corrido sin error. Se cierran cuando una query explícita de verificación (contador vs. MAX real del sufijo) devuelve **cero filas**. El seeding de contadores es el modo de falla silencioso: índices y backfill pueden andar mientras el contador queda en 0, y los inserts nuevos colisionan sin avisar.

### No correr `npm run build` con el dev server levantado

Comparten el directorio `.next`. El build de producción pisa los artefactos de dev; el navegador queda con chunks de producción contra un proceso de dev con otro manifiesto, y **cualquier server action de esa página devuelve un 500 mudo**, sin error legible.

El síntoma engaña: se ve como un fallo del código recién escrito cuando no lo es.
Salida: frenar el dev server, `rm -rf .next`, levantar de nuevo.

---

## 9. Deuda técnica conocida

Tenerla presente para no romper nada ni "arreglar" algo que es intencional.

1. RLS habilitada pero con políticas `allow_all` permisivas. Toda la seguridad real es de aplicación.
2. `/users` y `/settings` se protegen solo contra "no logueado", **no por rol**. La ocultación por rol es visual.
3. `deleteUser` deja la cuenta de Supabase Auth huérfana.
4. Doble lista de etiquetas en `constants.ts` y `task-constants.ts`. Agregar un estado obliga a tocar enum + 2 archivos + `types.ts` + StatusBadge/PriorityBadge.
5. `TaskRow.tsx`: 746 líneas con tres componentes adentro. Archivo de mayor riesgo del repo.
6. `estimated_cost` se guarda pero no se totaliza en ninguna vista.
7. `dependencies` se guarda y se resuelve en la importación, pero no se visualiza ni bloquea nada.
8. `projects.status = 'overdue'` nunca se setea solo. No hay job.
9. Sin tests de ningún tipo.
10. Sin upload de archivos: logo y favicon solo por URL externa.
11. `brand_settings` tiene `secondary_color`, `accent_color` y `font_family` en la tabla; la UI no los expone.
12. `TaskStatusSelect` y `UserRoleSelect` usan `createPortal` a `document.body` con posición fija porque los dropdowns quedaban recortados por el overflow de la tabla. Es intencional.
13. `TaskWithSubtasks` en `types.ts` es un tipo legacy sin ningún consumidor: nadie lo importa. Se elimina en la migración del Work Plan.

---

## 10. Decisiones abiertas

Una línea cada una. El fundamento completo de las dos últimas está en `docs/CHANGELOG.md`, en la entrada de la Fase 8B.

1. **Arquitectura del Work Plan.** El modelo está definido en `docs/ARQUITECTURA-WORKPLAN.md`, con los cinco conflictos estructurales cerrados. Pendiente: la revisión campo por campo de las tablas.
2. **`status` / `completed` en subtareas (8B).** Patch estricto con advertencia, sin derivación automática.
3. **Campos ajenos a la tabla (8B).** `is_blocked` en subtarea, `completed` en tarea: bloquean en vez de advertir.
