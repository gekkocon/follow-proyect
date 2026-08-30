# Plan semilla — 1N: Etapa 2 cerrada, arranca FUNCIONALIDADES.md

**30 ago 2026.** Nace al cerrar 1M (UI de work_item_origins completa,
verificada en vivo tras un fix). Commit `ce51d92` en origin/main.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | `ce51d92` (fix OriginEditor en modo edición, confirmado en origin/main con `git rev-parse`) |
| SQL pendiente | ninguno |

## 2. Lo que quedó cerrado en 1M

**Frente 1 — UI de work_item_origins, completo:**
- `src/store/workItemOriginStore.ts` (nuevo) — 4º store de Zustand,
  estado efímero (`pending: {workItemType, originType, originId,
  originLabel} | null`), sin persist. `originType` restringido a
  `'task' | 'subtask'` en el tipo — nunca `'phase'` desde la UI, aunque
  la base lo soporte. Se limpia en tres momentos: alta exitosa,
  cancelación, cierre (incluido colapso del acordeón con el alta
  abierta).
- `src/lib/supabase/work-item-actions.ts` — `getProjectWorkItems`
  cambió de firma: `Promise<WorkItemWithAssignees[]>` →
  `Promise<{ items: WorkItemWithOrigins[]; originCounts: Record<string, number> }>`.
  Cada item trae `origins: {id, origin_type, origin_id}[]` (el `id` de
  la fila de `work_item_origins`, no compone el código legible ahí).
  Dos funciones nuevas: `addWorkItemOrigin`/`removeWorkItemOrigin`,
  mismo gate que `updateWorkItem` (`canManageTeam`), con validación de
  que el origen pertenezca al mismo `project_id` del work item.
- `components/projects/RowActionMenu.tsx` (nuevo) — portal compartido,
  mismo patrón que el menú de mover fase de `TaskRow.tsx` (no
  refactorizado, queda duplicado a propósito, deuda 39).
- `src/lib/work-plan.ts` — `OriginOption` y `buildOriginOptions()`
  nuevos, para que Server Component y Client Component deriven el
  mismo dato desde `workPlan` sin query nueva.
- `components/projects/WorkItemRow.tsx` — chip fijo de origen en modo
  alta (`initialOrigin`); `OriginEditor` (chips + combobox) en modo
  display expandido **y**, tras el fix de esta sesión, también en modo
  edición (gap del ensamblaje original: el componente existía pero
  solo se montaba en una de las dos ramas).
- Cadena de props de `originCounts` (más larga de lo previsto):
  `page.tsx → ProjectTasksClient → WorkSection → TaskList → TaskRow →
  SubtaskRow`. Badge "· N emergente(s)" junto al código, visible cuando
  el contador es mayor a 0.
- `CLAUDE.md` — deuda 38 (origen solo task/subtask, restricción de
  producto), deuda 39 (menú-portal duplicado), deuda 40 (`originCounts`
  no se sincroniza en vivo entre `WorkItemsSection` y
  `ProjectTasksClient`, hermanos con estado independiente por decisión
  H de 1L — costo aceptado, no bug).

**Incidente durante verificación, ya cerrado:** el smoke test detectó
que `OriginEditor` no se renderizaba en modo edición de un item
existente — el bloque de formulario (`isNew || editing`) nunca lo
montaba, solo existía en la rama de display expandido. Fix de 11 líneas
en `WorkItemRow.tsx` (commit `ce51d92`), verificado con build limpio y
reverificación en vivo completa (9 pasos, sin discrepancias).

**Smoke test final, sin discrepancias:** creación con origen prellenado
desde tarea y desde subtarea, cancelación sin arrastre de estado,
agregar/quitar orígenes con persistencia real en base (confirmada con
hard reload), y gate de autorización bloqueando a cuenta `developer`
real (jorohoan@gmail.com) con el mismo mensaje "No autorizado." que ya
usan `updateWorkItem`/`deleteProjectTask`.

## 3. Explícito, no es deuda nueva

- El contador `originCounts` no se actualiza en vivo tras
  agregar/quitar un origen — ya está documentado como deuda 40, es el
  costo aceptado de mantener `WorkItemsSection` y `ProjectTasksClient`
  desacoplados (decisión H de 1L).
- El chip de origen no es visible en la fila colapsada de un work item
  — solo al expandir. Mismo patrón que el checklist (`ChecklistEditor`
  tampoco se ve sin expandir). No se decidió cambiar esto.

## 4. Sin empezar

- **`docs/FUNCIONALIDADES.md`** — pendiente desde antes de 1L, arrastrado
  sin tocar. Es el frente 2 declarado para esta etapa, arranca en esta
  sesión.
- **Etapa 3 completa**: drag & drop (fases y tareas), `activity_log`,
  `import_work_plan`, totalización de `estimated_cost`.
- **`scripts/`** — sigue sin trackear en el repo, sin decisión tomada
  sobre si entra versionado o queda fuera vía `.gitignore`.

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1N: actualización de
    docs/FUNCIONALIDADES.md tras el cierre de Etapa 2 (bloques
    emergentes + work_item_origins).

    Adjunto PLAN-SEMILLA-1N.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo de
    mi terminal, no del documento — debería ser ce51d92.
