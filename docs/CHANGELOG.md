# Changelog técnico — Dashboard Agencia FEMCO

> Historial de fases con detalle de arquitectura, archivos y migraciones SQL.
> Para la vista funcional (qué hace cada módulo), ver `FUNCIONALIDADES.md`.

---

## Fase 1D-a — Importador con fase obligatoria — 2026-08-28

**Alcance:** cero tareas huérfanas en la base. El importador exige fase
destino y las 8 tareas huérfanas preexistentes se migraron a mano a sus
fases (proyectos 5, 7 y 9).

---

## Limpieza previa al Work Plan — 2026-08-26

**Alcance:** tres cosas que no agregan funcionalidad y que había que sacar del camino antes de reestructurar el Work Plan: el ORM muerto, la columna legacy de responsable, y una premisa falsa sobre los entornos que estaba escrita en `CLAUDE.md`.

**Por qué ahora:** las tres tocan lo mismo que la reestructuración va a mover. Arrastrarlas hasta la migración del Work Plan habría significado migrar código muerto y decidir sobre una columna que ya no debía existir.

### Eliminado — Drizzle

Commit `29dc134`. Drizzle nunca llegó a usarse: el acceso a datos siempre fue el cliente de Supabase. Quedaba en el repositorio como andamio de una decisión anterior.

- Borrados `drizzle.config.ts`, `src/db/` completo (`schema.ts`, `index.ts`, `connection.ts`, `seed.ts`) y `drizzle/` con sus snapshots.
- Borrado también `src/lib/types.ts`: era el único archivo que importaba `src/db/schema`, y nadie lo importaba a él. El tipado real del dominio siempre fue `src/lib/supabase/types.ts`.
- Fuera los cuatro scripts `db:*` de `package.json` y cinco dependencias huérfanas: `drizzle-orm`, `drizzle-kit`, `postgres`, `@libsql/client` y `tsx`.

El bundle no cambió de tamaño en ninguna ruta, que es lo esperado: el código estaba muerto en el grafo de imports y nunca entraba a la compilación.

### Eliminado — `tasks.assignee_id`, y el bug que escondía

Commit `085bcb0`, más la migración `012_drop_task_assignee_id.sql`.

`task_assignees` reemplazó a la columna de responsable único en la Fase 5E, pero la columna sobrevivió y **dos lugares seguían leyéndola**. Al medirla se encontró que estaba **enteramente vacía**, y eso convertía la redundancia en un bug con consecuencias visibles:

- El contador de tareas del módulo Usuarios mostraba **0 para todos los usuarios**, sin importar cuántas tareas tuvieran asignadas.
- `deleteUser` **nunca bloqueaba**: su chequeo de "este usuario tiene tareas asignadas" consultaba la columna vacía, así que cualquier usuario se podía borrar aunque tuviera trabajo a cargo.

Los dos ahora cuentan por `task_assignees`. Se eliminó además el fallback de la vista global de tareas, que intentaba completar los responsables desde la columna vieja cuando la tabla join no devolvía filas.

Se sacó `assignee_id` de `DbTask`, de `TaskWithRelations` (la propiedad `assignee`, que ya nadie escribía ni leía), de `schema.sql` junto con su índice `idx_tasks_assignee`, y de los tres `INSERT` de `seed.sql`.

**La migración 012 ya se corrió. No hay que volver a correrla.** La verificación previa devolvió cero filas en riesgo y la posterior confirmó que la columna no existe.

### Corregido — la sección 8 de `CLAUDE.md` describía dos bases que no existen

Decía que `.env.local` apuntaba a un proyecto Supabase **DEV** y Vercel a uno **PROD**, y prescribía una secuencia de deploy de cinco pasos que pasaba por los dos. **Hay un solo proyecto Supabase.** Local y producción leen y escriben los mismos datos, y todo SQL corrido a mano impacta producción en el acto.

La sección se reescribió entera. El cambio de fondo no es la tabla de entornos sino el orden de deploy, que ahora depende del tipo de migración:

- **Aditiva** (columna, función o índice nuevo): SQL primero, verificar, después `git push`. Si el código llega primero, producción llama a algo que no existe.
- **Destructiva** (`DROP COLUMN`, `DROP FUNCTION`): `git push` primero, verificar producción andando, después el SQL. Si el SQL va primero, producción lee algo que ya no existe.

La 012 es el primer caso destructivo del proyecto y se ejecutó en ese orden.

Quedó documentado también que `seed.sql` **no se corre**: con una sola base, escribiría sobre datos vivos. Y que el backup de Supabase es el único rollback que existe.

### Deudas y decisiones que esto cierra

- Deuda técnica: se elimina la de `assignee_id` conviviendo con `task_assignees`. Nace una en su lugar: `TaskWithSubtasks` en `types.ts` es un tipo legacy sin ningún consumidor, y se elimina en la migración del Work Plan.
- Decisiones abiertas: se cierran las de **Drizzle** (se borra) y **`assignee_id`** (se elimina). También la de **nomenclatura de roles**, adoptando los reales: `admin / pm / developer / designer`.
- Queda abierta la del **Work Plan**, cuyo modelo vive en `docs/ARQUITECTURA-WORKPLAN.md`, y las dos de la Fase 8B.

---

## Fase 8B — Actualización masiva de tareas por código — 2026-08-25

**Alcance:** botón "Actualizar tareas" junto a "Importar tareas" en el detalle de proyecto, que aplica un *patch* sobre tareas y subtareas ya existentes usando el código humano de la Fase 8A como llave.

**Por qué:** hasta acá el JSON solo servía para crear. Corregir treinta tareas ya cargadas obligaba a editarlas de a una en la UI, y volver a importarlas duplicaba filas. El código legible de 8A hizo posible direccionar una fila existente sin exponer ids internos, que es lo que faltaba para poder actualizar en lote.

### Añadido
- Migración `src/lib/supabase/migrations/011_update_project_tasks.sql` — función `update_project_tasks(p_project_id, p_payload, p_create_missing)`. Todo-o-nada: cualquier excepción revierte la llamada entera. **Se corre a mano en Supabase**, en DEV y en PROD.
- `src/lib/supabase/update-normalize.ts` — helpers puros: normalización de código, clasificación tarea/subtarea, diff campo por campo y validación de forma. Vive fuera del módulo de server actions porque un archivo con `'use server'` solo puede exportar funciones async.
- `src/lib/supabase/project-import-actions.ts` — `previewProjectUpdate()` y `updateProjectTasks()`, ambas con contrato `{ error: string | null }` y `revalidatePath` al final.
- `src/lib/supabase/import-schema.ts` — `updateItemSchema` / `updatePayloadSchema`, separados del esquema de importación. Construidos con `z.strictObject`, así que una clave desconocida se rechaza — y con eso se rechazan también los intentos de tocar `id`, `project_id` o `task_id`.
- `components/projects/ProjectTasksClient.tsx` — botón "Actualizar tareas".

### Cambiado
- `components/projects/ImportTasksPanel.tsx` — un solo panel para los dos flujos, con prop `mode: 'import' | 'update'`. Comparte overlay, cierre con Escape, carga de `.json`, textarea y botonera; diverge en título, texto de ayuda, ejemplo, vista previa y etiqueta de confirmación. Se evitó duplicar el panel a propósito: el preview de cada modo vive en su propio subcomponente (`ImportPreviewBox`, `UpdatePreviewBox`) para que el branching no se derrame sobre el resto.

### Decisiones de diseño que conviene no revertir sin leer esto
- **Normalización con conciencia de presencia.** `task-constants.ts` no se tocó: sus `normalizeTaskStatus` / `normalizeTaskPriority` devuelven `todo` / `medium` tanto para el valor ausente como para un alias mal escrito, y en modo *patch* eso convertiría un typo en un reseteo silencioso. El módulo de actualización tiene su propio normalizador que devuelve `null` ante un alias desconocido, y eso bloquea el commit.
- **Códigos a mayúsculas antes de enviar.** El comparador SQL y el índice único distinguen mayúsculas: `f3` no encontraría a `F3` y, con el toggle de creación encendido, habría creado una fila fantasma.
- **Responsable no resuelto bloquea.** La función SQL aborta ante un nombre que no existe, así que la vista previa tiene que bloquear también. Si solo advirtiera, diría que está todo bien y el commit moriría después con un error crudo de Postgres.

### Decisiones abiertas
Las dos siguen como están hasta que el negocio decida otra cosa:
1. **`status` y `completed` en subtareas: patch estricto, sin derivación automática.** Son columnas independientes y el flujo no deriva una de la otra. Un payload con `"status": "done"` y sin `"completed"` deja el check de la subtarea como estaba, y la vista previa lo advierte sin bloquear. La alternativa —derivar `completed` cuando llega `status: done`— se descartó porque escribiría un campo que el usuario no mandó, que es exactamente lo contrario de la semántica de patch.
2. **Campos ajenos a la tabla de destino: bloquean, no advierten.** `is_blocked` y `blocked_reason` no existen en `subtasks`; `completed` no existe en `tasks`. La función SQL los ignora en silencio, así que el usuario los mandaría, vería "actualizada" y no habría pasado nada. Un no-op mudo es la clase de falla que este flujo existe para evitar, y por eso se eligió bloquear.

### Paso manual obligatorio
`011_update_project_tasks.sql` se ejecuta a mano en el editor SQL de Supabase. Hasta que corra en un entorno, la vista previa funciona ahí igual (no llama al RPC) pero la confirmación falla con un error de función inexistente.

---

## Fase 8A — Códigos legibles en tareas y subtareas — 2026-08-25

**Alcance:** columna `code` en `tasks` y `subtasks`, con backfill, contadores de asignación y soporte en la importación.

**Por qué:** no había forma de nombrar una tarea desde afuera de la app. Para hablar de una tarea en un mail, en una minuta o en un archivo de actualización hacía falta un identificador corto, estable y legible, que no fuera el id interno de la base.

### Añadido
- Migración `src/lib/supabase/migrations/010_task_codes.sql`. **Se corre a mano en Supabase**, en DEV y en PROD. Es idempotente. Contiene:
  - `tasks.code` (`F0`, `F1`, …) y `subtasks.code` (`F0-T01`, `F0-T02`, …, con el código del padre embebido).
  - Backfill de las filas existentes, ordenadas por `created_at, id`.
  - Contadores `projects.task_code_seq` y `tasks.subtask_code_seq`: marcas de agua que solo suben.
  - Índices únicos parciales `(project_id, code)` y `(task_id, code)`.
  - Asignadores atómicos `alloc_task_code()` y `alloc_subtask_code()`, que reservan el próximo código y avanzan la marca de agua en una sola sentencia, de modo que dos altas concurrentes se serialicen.
  - Reemplazo de `import_project_tasks` para aceptar un `code` opcional por ítem.
- `src/lib/supabase/import-schema.ts` — `code` opcional en los ítems importados.

### Reglas de negocio que implementa
- **El código es identidad, no posición.** No se renumera al reordenar ni al borrar.
- **Un código borrado queda quemado** y no se reutiliza. Por eso hacen falta los contadores: calcular `MAX(code) + 1` sobre las filas vivas devolvería el código de la última fila borrada al alta siguiente.
- **Único por proyecto, no global.** `subtasks` no tiene `project_id` y Postgres no indexa entre tablas, así que el índice es por `(task_id, code)`; como el código de subtarea lleva embebido el del padre, la unicidad dentro del padre implica unicidad dentro del proyecto.

### Cambiado
- `components/projects/TaskRow.tsx` — el código se muestra junto al título.
- `src/lib/supabase/project-task-actions.ts` y `types.ts` — `code` incorporado a las consultas y a los tipos del dominio. Es `string | null`: las filas anteriores a la migración pueden no tenerlo.

### Paso manual obligatorio
`010_task_codes.sql` se ejecuta a mano en el editor SQL de Supabase. Sin ella, la columna `code` no existe y la importación falla.

---

## Fase 7 — Importación masiva de tareas y subtareas — 2026-07-22

> **Entrada reconstruida a posteriori** (2026-08-25), a partir del commit `e275a71` y del código y el SQL que hoy están en el repositorio. No hubo entrada contemporánea a la fase. Todo lo que sigue es verificable contra el repo; lo que no se pudo verificar quedó fuera a propósito.

**Alcance:** botón "Importar tareas" en el detalle de proyecto, que crea tareas y subtareas a partir de un JSON, más las columnas que ese JSON necesitaba.

**Por qué:** cargar un plan de trabajo completo a mano, tarea por tarea, era el cuello de botella para poner un proyecto nuevo en el sistema. El commit trae además el archivo `the-showroom-miami-tasks-import.json` en la raíz, que es el plan real que motivó la funcionalidad.

**Commit:** `e275a71` — *feat: importación masiva de tareas/subtareas + fix de refresh tras crear/editar/eliminar*. 11 archivos, 780 inserciones.

### Añadido
- Migración `src/lib/supabase/migrations/008_task_import_fields.sql`. **Se corre a mano en Supabase.** Agrega `start_date`, `estimated_cost NUMERIC(12,2)` y `dependencies BIGINT[]` a `tasks`, y `description`, `start_date`, `estimated_cost` y `dependencies` a `subtasks`.
- Migración `src/lib/supabase/migrations/009_import_tasks_rpc.sql`. **Se corre a mano en Supabase.** Crea `import_project_tasks(p_project_id, p_tasks)`:
  - **Todo-o-nada.** Una sola función, una sola transacción: si una fila falla, no se crea ninguna y el proyecto nunca queda con una importación a medias.
  - **Dos pasadas.** La primera inserta y construye un mapa `temp_id → id real`; la segunda resuelve las dependencias, cuando ya existen todos los ids. Es la única forma de aceptar dependencias entre filas que se crean en la misma operación.
  - Responsables por nombre, resueltos contra `users` sin distinguir mayúsculas. Un nombre que no existe se ignora en silencio.
  - `GRANT EXECUTE` a `anon` y `authenticated`, porque el cliente usa la clave anon.
- `src/lib/supabase/import-schema.ts` — esquemas Zod del payload anidado.
- `src/lib/supabase/project-import-actions.ts` — `previewProjectImport()` e `importProjectTasks()`, con contrato `{ error: string | null }` y `revalidatePath` al final. Es el archivo donde después se apoyaría la Fase 8B.
- `components/projects/ImportTasksPanel.tsx` — panel lateral: pegar el JSON o cargar un `.json`, vista previa con el conteo de lo que se va a crear y aviso de títulos repetidos. El aviso no bloquea: informa y deja importar.
- `src/lib/task-constants.ts` — `TASK_STATUSES` y `TASK_PRIORITIES` con sus etiquetas, y `normalizeTaskStatus()` / `normalizeTaskPriority()`, que aceptan tanto el código de enum como la etiqueta en español. Es lo que permite escribir `"Alta"` o `"En progreso"` en el archivo.

### Corregido
- Crear, editar o eliminar tareas y subtareas no se reflejaba en la pantalla hasta apretar F5. `router.refresh()` competía con la escritura en la base: el revalidate y el re-render del cliente podían resolverse antes de que el efecto del insert fuera visible para la lectura siguiente. Se reemplazó por un refetch explícito con `getProjectTasksFull()` que reemplaza el estado local. El comentario que explica esto sigue en `components/projects/ProjectTasksClient.tsx`.

### Deuda que dejó abierta
- La columna `dependencies` se escribe (la función SQL la resuelve) y está en los tipos del dominio, pero **ninguna pantalla la lee**. Verificado sobre el repo actual: fuera de la migración, del esquema Zod y de `types.ts`, no hay una sola referencia en `app/`, `components/` o `src/`. Es infraestructura sin consumidor.

### Nota sobre la vigencia de la 009
`import_project_tasks` fue **reemplazada** por la versión de la migración `010_task_codes.sql` (Fase 8A), que agrega el soporte de `code`. La 009 sigue en el repositorio como registro histórico, pero la función viva en la base es la de la 010. Aplicar la 009 después de la 010 haría retroceder la importación.

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

> El **orden obligatorio de deploy cuando la fase trae SQL** y la regla de **no correr `npm run build` con el dev server levantado** viven en `CLAUDE.md`, sección 8 (*Entornos, migraciones y deploy*). Ahí está el mecanismo completo y el motivo de cada una.

### Infraestructura

- Flujo: `git init` → GitHub → Vercel
- Variables de entorno en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Pendiente por cada nuevo dominio: configurar Site URL y Redirect URLs en Supabase Auth
