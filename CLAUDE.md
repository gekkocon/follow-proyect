# CLAUDE.md — follow-proyect

Reglas del repositorio. Se cargan automáticamente al abrir sesión de Claude Code.
Última fase cerrada: **Etapa 2, 1M completo** — UI de work_item_origins: crear bug/deuda/pregunta-RFC desde tarea o subtarea con origen prellenado (store workItemOriginStore), contador de emergentes vinculados en TaskRow/SubtaskRow, edición de orígenes (agregar/quitar) desde WorkItemRow. Incluye fix post-verificación: OriginEditor no se montaba en modo edición de item existente (commit ce51d92). Verificado en vivo, smoke test de 9 pasos sin discrepancias tras el fix, incluido el gate de autorización probado con cuenta developer real (jorohoan@gmail.com). Commit `ce51d92` en `origin/main`.

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
| Estado global | Zustand (4 stores) |
| Formularios | React Hook Form |
| Validación | Zod |
| Fechas | date-fns, locale `es` |

El cuarto store, `workItemOriginStore` (Etapa 2, sesión 1M), es estado efímero de UI: prellena el origen (tarea o subtarea) al crear un bug/deuda/pregunta desde `RowActionMenu`, y se limpia al crear el item, cancelar el formulario o cerrarlo. Sin `persist` — se pierde en cada refresh y está bien así.

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

**Archivos de acciones (8):** `project-actions`, `project-task-actions`, `project-import-actions`, `task-actions`, `member-actions`, `user-actions`, `brand-actions`, `phase-actions`.

`phase-actions.ts` nació en el paso 1C-b con `createPhase` y `updatePhase`, y sumó `deletePhase` en 1C-c. Es el único archivo de acciones que escribe en `phases`.

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
                     active-user.ts, *-actions.ts, import-schema.ts,
                     schema.sql, /migrations
    constants.ts, task-constants.ts, work-plan.ts
  /store             Zustand
/docs                FUNCIONALIDADES.md, CHANGELOG.md,
                     ARQUITECTURA-WORKPLAN.md
```

**No existe `/src/lib/validations`.** El esquema Zod del importador vive en
`src/lib/supabase/import-schema.ts`. Verificado el 27 ago 2026.

Es asimétrico (`/app` y `/components` fuera de `/src`) pero **es el estándar del repo. No reorganizar.** El alias `@/` apunta a la raíz.

---

## 5. Convenciones

- Código, nombres de variables y comentarios **en inglés**. Texto de interfaz **en español**.
- Separadores de sección con líneas de guiones dentro de los archivos.
- Zod valida entradas de formulario. Complementa a Supabase, no duplica lógica.

---

## 6. Modelo de datos actual

**10 tablas:** `users`, `brand_settings`, `projects`, `phases`, `tasks`, `subtasks`, `assignments`, `task_assignees`, `subtask_assignees`, `project_members`.

`task_assignees` y `subtask_assignees` están **supersedidas** por `assignments` y se borran en la 014.

Los ids **no son todos bigserial**: `projects.id`, `tasks.id` y `subtasks.id` son `integer`; `phases`, `assignments` y las tablas de asignados son `bigint`. El mix es preexistente.

Campos reales — **en inglés**, no en español:

- `projects`: name, description, status, priority, owner_id, start_date, due_date, phase_code_seq
- `phases`: project_id, code, name, objective, status, priority, start_date, due_date, completed_at, sort_order, task_code_seq
- `tasks`: title, description, status, priority, project_id, **phase_id**, is_blocked, blocked_reason, start_date, due_date, dependencies, code, **legacy_code**, **completed_at**, subtask_code_seq
- `subtasks`: igual + task_id + completed + legacy_code + completed_at; sin is_blocked ni blocked_reason
- `assignments`: assignable_type (`task | subtask | work_item`), assignable_id, user_id — UNIQUE sobre los tres
- `project_members`: project_id, user_id, rol_en_proyecto *(TEXT libre, no enum)*

`start_date`, `dependencies` y `subtasks.completed` se eliminan en la 014.

**`task_status` real:** `todo · in_progress · in_review · done · blocked`. No existe `cancelled` ni `pending`.

**5 enums Postgres:** `user_role`, `user_status`, `project_status`, `priority_level`, `task_status`.

**Roles reales:** `admin`, `pm`, `developer`, `designer`.
Equivalencia con la nomenclatura vieja: admin ≈ Admin, pm ≈ Coordinador, developer y designer ≈ Colaborador.

**Permisos** (`src/lib/supabase/active-user.ts`) — solo dos funciones:

- `isGlobalAdmin(user)` → `role === 'admin'`
- `canManageTeam(user)` → admin o pm

**Visibilidad:** `member-actions.ts → getVisibleProjectIds()` devuelve `null` para admin (ve todo) o un array de `project_id`. Se inyecta como `.in('id', ids)` en cada query de página.

**Vínculo Auth ↔ tabla users: por EMAIL, no por UUID.** Si cambia el email en un lado y no en el otro, el usuario queda sin perfil.

### Códigos humanos legibles (Etapa 1)

El código guardado es **local**. El compuesto (`F0-T03-S02`) se arma al mostrar, con `composeCode()` de `src/lib/work-plan.ts`.

| Nivel | Formato | Único dentro de | Contador | Contrato |
|---|---|---|---|---|
| Fase | `F0`, `F1` sin padding | proyecto | `projects.phase_code_seq` | PRE |
| Tarea en fase | `T01` padding 2 | fase | `phases.task_code_seq` | POST |
| Subtarea | `S01` padding 2 | tarea | `tasks.subtask_code_seq` | POST |

El camino "tarea sin fase" existió en la Etapa 1 (paso 1C) y se retiró completo en 1F: hoy toda tarea nace con phase_id NOT NULL (013f) y createProjectTask lo exige por tipo (commit 79c084c). La columna projects.orphan_task_code_seq se dropeó en 013g.

**Los contratos PRE y POST son distintos a propósito. No unificarlos.**

Allocators: `alloc_phase_code`, `alloc_task_code_in_phase`, `alloc_subtask_code`. Padding con ancho dinámico `GREATEST(2, length(...))`: un `lpad` fijo trunca y colisiona.

Watermarks monotónicos: nunca decrecen, los códigos borrados quedan quemados.

`legacy_code` guarda el código 8A previo (`F19`, `F19-T01`). Es anotación histórica: **nunca se muestra como código vivo.**

### Funciones SQL de carga masiva

| Función | Migración | Estado |
|---|---|---|
| `import_project_tasks` | 010 → reparada en 013b | Ancla. Crea tareas **sin fase**. Valida códigos del payload. |
| `update_project_tasks` | 011 → congelada en 013b | Lanza excepción. Direccionaba por `F3-T08`, que ya no existe. Vuelve como `update_work_plan` en la Etapa 3. |

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

## 8. Entorno, migraciones y deploy

**Hay UN SOLO proyecto Supabase.** Local y producción apuntan a la misma base. No existe entorno de ensayo.

| Entorno | Configuración |
|---|---|
| Local | `.env.local` → el proyecto Supabase. Gitignored, nunca se commitea. |
| Producción | Variables en Vercel → el mismo proyecto Supabase. |

Consecuencias:

- Todo SQL que se corre a mano impacta producción en el acto.
- `localhost:3001` y la app desplegada leen y escriben los mismos datos.
- **No hay rollback.** El plan Free de Supabase no incluye backups. Verificado el 27 ago 2026. Toda migración destructiva —empezando por la 014— exige un dump manual previo, guardado fuera del repo, antes de correr una sola línea de SQL.

Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).

**Migraciones: no hay sistema automático.** `schema.sql` es la fuente de verdad y `/migrations` es el registro. El SQL se ejecuta **a mano** en el editor de Supabase, **una sola vez**.

**Regla dura:** solo archivos SQL puros. Nunca seeds en JavaScript. Y `seed.sql` **no se corre**: escribiría sobre datos vivos.

### El orden entre código y SQL

Con una sola base, el orden es lo único que separa un deploy limpio de producción rota. Depende del tipo de migración:

**Migración ADITIVA** (columna, función o índice nuevo):
1. Correr el SQL
2. Verificar
3. `git push`

Si el código llega primero, producción llama a algo que no existe.

**Migración DESTRUCTIVA** (`DROP COLUMN`, `DROP FUNCTION`):
1. `git push` del código que ya no usa lo que se va a borrar
2. Verificar producción andando
3. Recién ahí correr el SQL

Si el SQL va primero, producción lee algo que ya no existe.

**Migraciones que tocan contadores o secuencias** no se cierran porque el script corra sin error. Se cierran cuando la query de verificación (contador vs. MAX real del sufijo) devuelve **cero filas**. El seeding de contadores es el modo de falla silencioso: índices y backfill pueden andar mientras el contador queda en 0, y los inserts nuevos colisionan sin avisar.

### No correr `npm run build` con el dev server levantado

Comparten el directorio `.next`. El build de producción pisa los artefactos de dev; el navegador queda con chunks de producción contra un proceso de dev con otro manifiesto, y **cualquier server action de esa página devuelve un 500 mudo**, sin error legible.

El síntoma engaña: se ve como un fallo del código recién escrito cuando no lo es.
Salida: frenar el dev server, `rm -rf .next`, levantar de nuevo.

### Las verificaciones tienen que devolver filas, y con la llave correcta

El editor SQL de Supabase **no muestra `RAISE NOTICE` ni `RAISE WARNING`**: una migración que verifica con NOTICE devuelve "Success. No rows returned" tanto si pasó como si no verificó nada. Toda verificación que tenga que leer un humano va en un `SELECT` aparte.

Y el editor **corre como superusuario y bypassea RLS**. Una migración que crea tablas no se cierra verificando desde ahí: la 013, la 013b y su smoke test pasaron las tres mientras la app, con la anon key, veía cero filas. Al crear una tabla que reemplaza a otra, la política se copia junto con el flag de RLS o la nueva nace muda.

### Funciones SQL que dependen de la identidad del llamador

Receta medida extremo a extremo el 27 ago 2026 con una sonda, en los cuatro
cuadrantes. No razonar esto de memoria: la respuesta intuitiva es la
equivocada.

1. `SECURITY INVOKER`. RLS está deshabilitada en las tablas del work plan, así que la función no necesita elevación. `DEFINER` sería privilegio sin necesidad.
2. **`REVOKE EXECUTE ... FROM anon` POR NOMBRE.** `REVOKE FROM PUBLIC` **no alcanza**: Supabase otorga EXECUTE a `anon` nominalmente vía `ALTER DEFAULT PRIVILEGES` sobre el esquema `public`, y un revoke a PUBLIC no toca un grant nominal. Medido: tras `REVOKE FROM PUBLIC`, el ACL seguía mostrando `anon=X/postgres` y el cliente anon ejecutaba la función sin error.
3. `GRANT EXECUTE ... TO authenticated`.
4. Chequeo de rol **dentro del cuerpo**, cruzando `request.jwt.claims ->> 'email'` contra `public.users`, con `lower()` en los dos lados. No es redundante con el chequeo del server action: la anon key lleva prefijo `NEXT_PUBLIC_` y vive en el bundle del navegador, así que cualquiera puede llamar a PostgREST directo sin pasar por Next. Ese camino no lo cubre ningún chequeo del action.
5. Invocar con `createAuthServerClient()`, nunca con `createServerClient()`. Es el único de los tres que propaga el token de sesión a Postgres. Ojo con los nombres: `server.ts` renombra el `createServerClient` de `@supabase/ssr` —el que SÍ propaga sesión— a `createSupabaseServerClient`, para convivir con el propio del archivo, que NO la propaga. Dos nombres casi idénticos con semántica opuesta.
6. Verificar `pg_proc.proacl` DESPUÉS de crearla. El grant se cree cuando se lee, no cuando se escribe.

Los cuatro cuadrantes medidos: con `anon` todavía en el ACL, la función
ejecuta y devuelve `es_admin: false` — el chequeo interno falla cerrado. Sin
`anon` en el ACL, devuelve `42501 permission denied`. Con sesión, resuelve el
rol correctamente. Son dos capas independientes y cada una se probó por
separado.

Aplicada el 28 ago 2026 a `alloc_phase_code`, `alloc_task_code_in_phase` y
`alloc_subtask_code`. La sonda de `request.jwt.claims` mencionada arriba no
se encontró como artefacto vivo en el repo (grep vacío en `/migrations`,
`schema.sql` y `docs/`); la sintaxis usada es la ya documentada en el punto
4, sin verificación contra un artefacto original.

### Una pantalla no verifica nada sin su renglón de compilación

Next dev compila por demanda y escribe a disco. Una pestaña ya renderizada
sobrevive a la muerte de su servidor: scrollea, abre y cierra secciones y
muestra el árbol entero — todo eso es cliente. Se ve idéntica a una viva.

Toda verificación en pantalla arranca con un hard reload y el renglón
`✓ Compiled /ruta` en la terminal. Sin ese renglón, lo que se está mirando
es un bundle viejo. Si `.next/server/app/` está vacío, ese servidor no
atendió un solo request desde que arrancó; si el log muestra
`GET /login?redirect=...`, el middleware rebotó la ruta y tampoco la compiló.

---

## 9. Deuda técnica conocida

Tenerla presente para no romper nada ni "arreglar" algo que es intencional.

1. La postura de RLS es **mixta**: `users`, `projects`, `tasks`, `subtasks`, `phases`, `assignments`, `work_items` y `work_item_origins` la tienen **deshabilitada** (confirmado por SELECT directo contra `pg_class` el 29 ago 2026: `relrowsecurity = false` en las dos últimas); `brand_settings`, `project_members` y las dos tablas de asignados la tienen habilitada con una política `allow_all`. Toda la seguridad real es de aplicación.
2. `/users` y `/settings` se protegen solo contra "no logueado", **no por rol**. La ocultación por rol es visual.
3. `deleteUser` deja la cuenta de Supabase Auth huérfana.
4. ~~Doble lista de etiquetas en `constants.ts` y `task-constants.ts`. Agregar un estado obliga a tocar enum + 2 archivos + `types.ts` + StatusBadge/PriorityBadge.~~ Cerrada el 29 ago 2026 (1J, frente 2.2): `task-constants.ts` (`TASK_STATUSES`, `TASK_PRIORITIES`) es ahora la fuente única de value/label para status y priority de tarea. `constants.ts` deriva `TASK_STATUS_LABELS` y `PRIORITY_LABELS` desde ahí en vez de tener su propio literal, y `StatusBadge`/`PriorityBadge` también derivan sus labels de las mismas listas, separando el texto del `className` (que sigue hardcodeado porque ninguna lista tiene color). `STATUS_ALIASES`/`PRIORITY_ALIASES`/`normalizeTaskStatus`/`normalizeTaskPriority` de `task-constants.ts` no se tocaron — son el contrato de la importación, no parte de esta consolidación. `USER_ROLE_LABELS`, `PROJECT_STATUS_LABELS` y `USER_STATUS_LABELS` tampoco, porque nunca estuvieron duplicadas.
5. `TaskRow.tsx`: 910 líneas con tres componentes adentro. Archivo de mayor riesgo del repo.
6. ~~`estimated_cost` se guarda pero no se totaliza en ninguna vista.~~ Cerrada el 30 ago 2026 (1N): en vez de resolverse con totalización, se decidió eliminar el campo por completo (uso mínimo, no justificaba mantenerlo). Sacado de `DbTask`/`DbSubtask` (`types.ts`), de `import-schema.ts` (los dos schemas), de `TaskInput`/`SubtaskInput` (`project-task-actions.ts`) y de `FIELD_LABELS`/`diffItem()` (`update-normalize.ts`). La columna en Postgres queda pendiente de `DROP` — no se tocó SQL en esta sesión, es el paso siguiente tras confirmar el deploy.
7. `dependencies` se guarda y se resuelve en la importación, pero no se visualiza ni bloquea nada.
8. `projects.status = 'overdue'` nunca se setea solo. No hay job.
9. Sin tests de ningún tipo.
10. Sin upload de archivos: logo y favicon solo por URL externa.
11. `brand_settings` tiene `secondary_color`, `accent_color` y `font_family` en la tabla; la UI no los expone.
12. `TaskStatusSelect` y `UserRoleSelect` usan `createPortal` a `document.body` con posición fija porque los dropdowns quedaban recortados por el overflow de la tabla. Es intencional.
13. ~~`TaskWithSubtasks`~~ — **eliminado** en el paso 1A.
14. `allocCode` en `project-task-actions.ts` devuelve `null` si el RPC falla y el insert omite la clave: una fila puede nacer sin código en silencio.
15. El dashboard mide `tareas done / totales` y el detalle de proyecto mide avance del plan. Para el proyecto 7 son 34 % y 19.8 %. Métricas distintas, etiquetas parecidas.
16. Ningún camino de borrado registra nada: no hay tabla de log, ni soft delete, ni `deleted_at`, ni columna de autor. Un borrado no deja rastro en la aplicación.
17. ~~Ningún action de borrado verifica rol. Los tres usan `createServerClient()` (anon key, sin sesión): no saben quién pide el borrado.~~ Cerrada el 28 ago 2026: las siete acciones de borrado (`deleteProjectTask`, `deleteProjectSubtask`, `deletePhase`, `removeProjectMember`, `deleteProject`, `deleteUser` — no tres como decía el texto original) gatean rol vía `getActiveUser()` + `canManageTeam()` (operativas) o `isGlobalAdmin()` (proyecto/usuario, más estrictas por ser destructivas a nivel global). Verificado con cuentas reales no-admin (pm y developer) en los seis casos aplicables, en producción: los seis bloquearon con "No autorizado." y el camino permitido (pm en fase/tarea/subtarea/miembro) funcionó sin error. NOTA: el gate vive solo en TypeScript (Camino A), no en RLS/RPC — las tablas de fondo sin RLS real (deuda 1) siguen expuestas a un delete directo vía PostgREST con la anon key para quien la tenga; queda como hueco de fondo, no cerrado por 1H.
18. `deleteProjectTask` no valida que la tarea pertenezca al `projectId` recibido. Filtra solo por `id`; `projectId` se usa únicamente para `revalidatePath`. Cerrada el 28 ago 2026 para `deleteProjectTask` y `removeProjectMember` (filtro directo por `project_id`) y `deleteProjectSubtask` (resolución en dos pasos vía `task_id` -> `tasks.project_id`, ya que `subtasks` no tiene `project_id` propio).
19. Ningún borrado limpia `assignments`, **salvo `deleteProject` con `force`**, que sí lo hace (project-actions.ts:135-148) y es el único. La tabla no tiene FK sobre `assignable_id` por ser polimórfica, así que la base tampoco lo hace. `syncTaskAssignees` sabe hacerlo y no se llama desde los demás borrados. Cerrada el 28 ago 2026 para `deleteProjectTask` y `deleteProjectSubtask`, reutilizando `syncTaskAssignees`/`syncSubtaskAssignees` con lista vacía en vez de escribir un delete nuevo.
20. El handler de borrado de subtarea desestructura `error` y no lo usa: un borrado fallido no muestra nada y ni siquiera refresca. El de tarea sí tiene su `alert`.
21. `deleteProjectSubtask` revalida solo `/projects/[id]`, no `/dashboard`. El de tarea revalida los dos.
22. `schema.sql`, declarado fuente de verdad en la §8, no conoce `phases`, ni `assignments`, ni `tasks.phase_id`. Está desactualizado respecto de la 013.
23. El botón Importar aparece en proyectos CON fases y las tareas importadas nacen huérfanas, mientras el alta manual lo tiene prohibido por D-17. Pendiente de resolver junto con D-19.
24. ~~Las RPC existentes se otorgan con `TO anon, authenticated` — `alloc_phase_code`, `alloc_task_code_in_phase` y `alloc_subtask_code`. Como la anon key vive en el bundle del navegador, hoy son invocables contra PostgREST sin pasar por la app, con cualquier `p_project_id`.~~ Cerrada el 28 ago 2026: los tres allocators (`alloc_phase_code`, `alloc_task_code_in_phase`, `alloc_subtask_code`) gatean rol y membresía dentro del cuerpo (`SECURITY INVOKER`, `REVOKE FROM anon` por nombre, `GRANT TO authenticated`). Verificado ACL (`pg_proc.proacl` sin `anon` en los tres) y camino bloqueado con cuenta real no-admin (jorohoan@gmail.com, role=developer, sin membresías): las tres llamadas devuelven 403/42501, cero mutación de contadores confirmada antes/después, en dos corridas independientes.
25. ~~`updateUserRole` cambia el rol de cualquier usuario sin verificar quién llama, y `createUser` usa la service role sin guarda de autorización.~~ Cerrada el 28 ago 2026: las dos funciones gatean con `getActiveUser()` + `isGlobalAdmin()` como primera línea, antes de cualquier efecto secundario (commit 6a2897f). Desbloquea el cierre de la deuda 24.
26. `createPhase` pide el código por RPC y después inserta: dos requests, dos transacciones. Si el insert falla, el código ya quedó quemado. Es la no-atomicidad de PostgREST, no un descuido — pero significa que cada alta fallida consume un código de fase.
27. El avance del proyecto **desaparece** de la tarjeta cuando `projectProgress` devuelve null. Un proyecto cuyas fases estén todas vacías pierde la barra entera en vez de mostrar "—", que es lo que sí hace cada fase. Observado en el proyecto 9.
28. ~~`StatusBadge` llama "Completada" al valor `done` y `TASK_STATUSES` lo llama "Finalizada". Desde 1C-b las dos etiquetas conviven en la misma pantalla: el badge de la cabecera de fase y el select de su formulario. Es la doble lista de la deuda 4, ahora visible.~~ Cerrada el 29 ago 2026, junto con la deuda 4: `TASK_STATUSES.done.label` pasó a "Completada" en `task-constants.ts`, y `StatusBadge` ahora lee ese mismo label en vez de tener su propio literal. Ya no hay discrepancia posible entre las dos pantallas.
29. `moveTaskToPhase` (C-1) no verifica rol ni sesión: usa `createServerClient` con la anon key, igual que el resto. Extiende la deuda 17 al movimiento.
30. `moveTaskToPhase` no es atómica. Pide el código por RPC y después escribe: si el update falla, el código del destino ya quedó quemado. Es la misma no-atomicidad de PostgREST de la deuda 26, ahora también en el movimiento.
31. `schema.sql` no sólo está desactualizado (deuda 22): **se contradice con la base**. Declara `subtasks.task_id ... ON DELETE CASCADE` en su línea 99, mientras `pg_constraint` mide `NO ACTION`. Reconstruir desde ese archivo haría que borrar una tarea se llevara sus subtareas y dejaría el guard de `deleteProjectTask` de adorno.
32. El registro del Service Worker falla en dev: `SW registration failed`, dos veces por carga, en toda ruta. El `sw.js` de la Fase 6B no se genera fuera de build. **Sin verificar en Vercel**: si también falla ahí, la PWA está rota en producción.
33. `allocCode()` en `project-task-actions.ts` tragaba el error del RPC allocator y dejaba que el insert siguiera sin código (deuda 14 original). Cerrado el 28 ago 2026, commit `d8ce79d`: unificado al patrón de abort visible que ya usaban `moveTaskToPhase` y `createPhase`. Necesario para que el gate de rol/membresía de la deuda 24 produzca un error visible en vez de una fila huérfana.
34. ~~Función de agregación personalizada llamada `array_agg` en el esquema `public`, sombreando al agregado nativo.~~ Cerrada el 29 ago 2026, no confirmada: cuatro queries de solo lectura contra `pg_proc` (existencia, código fuente vía `aggtransfn`, `proacl`, y `pg_db_role_setting`) no encontraron ninguna función `array_agg` en `public`. El error 42809 original (28 ago, durante auditoría de 1G) no fue un sombreado real: fue el mismo bug ya documentado en `013b_repair_import_rpc.sql:283-301` — `pg_get_functiondef()` evalúa el filtro de esquema sobre `pg_proc` después de resolver la función, así que terminaba llamándose sobre el `array_agg` nativo de `pg_catalog` y reventaba con ese código. Ese bug ya estaba corregido en esa misma migración (reemplazado por bloque con savepoint implícito vía `EXCEPTION`). Sin función personalizada real, no hay nada que eliminar ni renombrar.
35. Observada una vez, no reproducida: la cabecera de la UI mostró la identidad de otro usuario (Johnny Hoyos · Administrador) mientras el JWT de sesión real era jorohoan@gmail.com / developer, durante una corrida de Playwright. Una segunda corrida idéntica mostró la identidad correcta. Posible caché/storage residual de sesión previa en el entorno de prueba, no confirmado como bug de la aplicación.
36. ~~Observado durante pruebas de 1H, sin confirmar: la UI de `/projects/[id]` pareció no reflejar un borrado exitoso hasta recargar manualmente.~~ Cerrado el 29 ago 2026, no reproducido: prueba manual en navegador real contra producción (Vercel), creando un proyecto con fase → tarea → subtarea y borrando cada nivel uno por uno. En los tres casos la fila desapareció sola, sin recargar. Revisión de código en 1I tampoco había encontrado causa (los tres call sites de borrado llaman al mecanismo de refresh y los `revalidatePath` apuntan a la ruta correcta). Conclusión: el síntoma original fue probablemente un artefacto del entorno de Playwright de la sesión 1H, no un bug de la aplicación.
37. Resuelto el 28 ago 2026 (solo presentación, no la fórmula): el "avance del plan" (% basado en subtareas completadas por tarea) se mostraba concatenado con "tareas finalizadas" (conteo literal de `task.status === 'done'`), dando lecturas contradictorias (ej. "100.0% · 0/1 tareas finalizadas"). Separadas visualmente en `page.tsx` y `ProjectTasksClient.tsx`, con etiquetas y tooltip aclaratorio. Decisión de fondo pendiente, no resuelta acá: si `taskProgress()` debería considerar también el status de la tarea padre, no solo sus subtareas.
38. El origen de un work item (`work_item_origins`) solo admite `task`/`subtask` desde la UI (`workItemOriginStore`, `RowActionMenu`), aunque la tabla soporte `phase` a nivel de datos. Es una restricción de producto tomada en chat en la sesión 1M, no una limitación técnica — un origen `phase` solo puede existir hoy si se inserta a mano o por otro camino fuera de esta UI.
39. Patrón de menú-portal duplicado entre `TaskRow` (mover fase, líneas ~428-556 de `TaskRow.tsx`) y `RowActionMenu` (origen de emergentes, sesión 1M): son casi el mismo código — trigger con `ref`, `createPortal` a `document.body`, posicionamiento por `getBoundingClientRect`, cierre por click afuera + Escape + scroll/resize — escrito dos veces porque refactorizar el menú de mover fase (que ya funciona en producción) quedó deliberadamente fuera de la sesión 1M para no mezclar ese riesgo con la tarea de orígenes. Candidato a unificar cuando se toque `TaskRow.tsx` a fondo.
40. originCounts en TaskRow/SubtaskRow se calcula una sola vez en el fetch inicial de page.tsx. Si desde WorkItemsSection se agrega o quita un origen (addWorkItemOrigin/removeWorkItemOrigin), el contador visual no se actualiza hasta un refresh completo de la página — ProjectTasksClient y WorkItemsSection son hermanos con estado independiente por decisión H de 1L, y ninguno de los dos revalida el estado del otro. No es un bug: es el costo aceptado de mantener los dos módulos desacoplados.

---

## 10. Decisiones abiertas

Una línea cada una. El fundamento completo de las dos últimas está en `docs/CHANGELOG.md`, en la entrada de la Fase 8B.

1. ~~Arquitectura del Work Plan~~ — **cerrada.** Modelo en `docs/ARQUITECTURA-WORKPLAN.md`; decisiones D-1 a D-20 en `docs/PLAN-SEMILLA-1B.md` y `docs/PLAN-SEMILLA-1C.md`. Tablas separadas para la jerarquía, `assignments` polimórfica, `work_items` única para lo emergente en la Etapa 2.
2. **`status` / `completed` en subtareas (8B).** Patch estricto con advertencia, sin derivación automática.
3. **Campos ajenos a la tabla (8B).** `is_blocked` en subtarea, `completed` en tarea: bloquean en vez de advertir.
4. Nomenclatura de roles — cerrada el 29 ago 2026. UI usa "Project Manager" para el rol pm (antes "Coordinador"). "Colaborador" no existía como resto real en código — developer/designer ya tenían labels propios. Grep de verificación en `docs/PLAN-SEMILLA-1I.md`, sección 3.3.
