# Plan semilla — 1M: Etapa 2 UI cerrada, decisiones de scope pendientes

**29 ago 2026.** Nace al cerrar 1L (UI de bloques emergentes completa,
verificada en vivo). Commit 6be42bf pusheado a origin/main.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | 6be42bf (UI de bloques emergentes, confirmado en origin/main con `git rev-parse`) |
| SQL pendiente | ninguno |

## 2. Lo que quedó cerrado en 1L

**Seis archivos, TypeScript + UI:**
- `app/(dashboard)/projects/[id]/page.tsx` — `getProjectWorkItems` sumado
  al `Promise.all` existente, `phaseOptions` derivado de `workPlan.phases`
  (sin query nueva), `WorkItemsSection` renderizado como hermano de
  `ProjectTasksClient`.
- `src/lib/supabase/types.ts` — `WorkItemType`, `WorkItemStatus`,
  `WorkItemSeverity`, `WorkItemImpact`, `ChecklistItem`, `DbWorkItem`,
  `WorkItemWithAssignees`.
- `src/lib/supabase/work-item-actions.ts` — `syncWorkItemAssignees`
  (privada, sin tabla legacy que limpiar), llamada desde `createWorkItem`
  y `updateWorkItem`; `getProjectWorkItems` (lectura con `createServerClient`,
  RLS deshabilitada).
- `src/lib/supabase/work-item-schema.ts` — `assigneeIds` en los dos
  schemas, `checklist` sumado a `updateWorkItemSchema` (necesario para
  que el mini-editor escriba, no estaba en el pedido original del campo
  pero sin él el checklist no habría podido guardar nada).
- `components/projects/WorkItemRow.tsx` — un componente con prop `type`
  para los tres tipos, que también resuelve el alta inline (`item`
  undefined = modo creación) en vez de un `NewWorkItemRow.tsx` aparte:
  los campos específicos por tipo son idénticos en alta y edición, así
  que separarlos habría duplicado tres bloques de campos en dos archivos.
- `components/projects/WorkItemsSection.tsx` — tres bloques acordeón
  apilados (Bugs / Deuda Técnica / Preguntas-RFC), hermano de
  `ProjectTasksClient`, con su propio estado y su propio `refresh()`.

**Decisiones de diseño cerradas en chat:**
- F: acordeón apilado, no tabs reales (no existe ningún componente de
  tabs en el repo).
- H: `WorkItemsSection` es hermano de `ProjectTasksClient`, no prop/hijo
  suyo — evita acoplar el módulo de emergentes al de jerarquía.
- B: `assigneeIds` es campo del schema Zod (no argumento posicional
  aparte), se extrae antes del insert/update, sync vía
  `syncWorkItemAssignees`.

**RLS confirmada deshabilitada:** SELECT directo contra `pg_class` el 29
ago 2026 — `relrowsecurity = false` en `work_items` y `work_item_origins`,
mismo criterio que `tasks`/`phases`/`assignments`. Ya reflejado en la
deuda 1 de `CLAUDE.md`.

**Smoke test de 7 pasos, sin discrepancias** — incluido el gate de
borrado probado con cuenta developer real (bloqueado, como se esperaba
de `canManageTeam`).

## 3. Explícito, no es deuda nueva

Dos piezas quedan fuera de alcance de 1L por **decisión de scope
tomada en chat**, no por limitación técnica:

- **`work_item_origins` desde la UI** — "crear bug desde la tarea con
  el origen prellenado" (`ARQUITECTURA-WORKPLAN.md` sección 6). El
  server action ya soporta `origin_type`/`origin_id` opcionales desde
  1K, pero ningún formulario de esta UI los usa todavía — el alta
  siempre es standalone, sin selector de origen.
- **Reordenar checklist** — el mini-editor de 1L soporta agregar/tildar/
  borrar, explícitamente sin drag ni cambio de `order`. Queda para
  cuando se aborde drag & drop en general (Etapa 3).

## 4. Sin empezar

- `docs/FUNCIONALIDADES.md` sigue sin reflejar Etapa 2 — arrastrado
  desde antes de 1L, no es nuevo de esta sesión.
- **Etapa 3 completa**: drag & drop (fases y tareas), `activity_log`,
  `import_work_plan`, totalización de `estimated_cost`.

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1M: continuación tras el cierre de la UI
    de bloques emergentes (Etapa 2).

    Adjunto PLAN-SEMILLA-1M.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo de
    mi terminal, no del documento — debería ser 6be42bf.
