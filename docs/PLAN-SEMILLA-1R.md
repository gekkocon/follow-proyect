# Plan semilla — 1R: Etapa 3 del Work Plan, paso 4/4 — import_work_plan

**01 sep 2026.** Nace al cerrar los pasos 1-3 de 1Q (activity_log,
tasks.sort_order, drag & drop de fases y tareas).

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | `8292d34` |
| SQL pendiente | ninguno |

## 2. Qué quedó cerrado en 1Q

- **Paso 1 — `activity_log`** (commit `cd86cbc`, migración 017):
  tabla + helper `logActivityChange()` + wiring en `status`/`is_blocked`
  de fases, tareas y subtareas. `user_id` siempre server-side, log
  siempre después del éxito del write real.
- **Paso 2 — `tasks.sort_order`** (commit `6bf95b0`, migración 018):
  columna agregada, backfill verificado, tipo TS actualizado, cero
  `SELECT`s de `/app` necesitaron el campo.
- **Paso 3 — drag & drop** (commits `0e8103f` fases, `8292d34`
  tareas): `@dnd-kit`, `reorderPhases()` y `reorderTasks()`, ambas
  secuenciales y no atómicas por diseño (deuda 41, documentada antes
  de implementar). El drag & drop nunca mueve un ítem entre
  contenedores — eso sigue siendo `moveTaskToPhase`. `activity_log`
  registra solo el ítem arrastrado, no cada fila desplazada.

## 3. Contexto: qué es el paso 4

Según `docs/ARQUITECTURA-WORKPLAN.md` §8, `import_project_tasks` está
activamente invocada hoy desde `project-import-actions.ts:121` — es
la función real detrás del botón "Importar tareas" en producción. El
JSON anidado actual (`tareas` con `subtareas` adentro) mapea
directamente al modelo nuevo: fases con tareas, más un nivel opcional
de subtareas.

**Decisión ya cerrada en 1Q sobre el destino de `import_project_tasks`:**
- Se crea `import_work_plan` al lado, mismo formato de JSON de
  entrada, escribe en `phases`/`tasks` (y opcionalmente `subtasks`).
- `ImportTasksPanel.tsx` mantiene su prop `mode`, solo cambia a qué
  RPC llama.
- `import_project_tasks` sigue intacta y activa hasta que
  `import_work_plan` complete el ciclo DEV → PROD → smoke test →
  cambio del RPC en `ImportTasksPanel.tsx`. Recién ahí queda
  deprecada de hecho — no antes, y no se borra en esta etapa (es
  limpieza posterior).
- Esto da rollback trivial: si algo sale raro con `import_work_plan`,
  el camino viejo sigue parado y disponible.

**No es precondición a resolver, ya se sabe:** `update_project_tasks`
(el par de `import_project_tasks`) es la única de las dos que está
realmente congelada — stub con `RAISE EXCEPTION` desde la migración
`013b`.

## 4. Primera decisión a cerrar en el chat nuevo

El diseño de alto nivel de `import_work_plan` ya está cerrado en
`ARQUITECTURA-WORKPLAN.md` §8. Lo que falta cerrar en el chat nuevo,
antes de que Claude Code escriba nada:

- ¿`import_work_plan` es una función RPC de Postgres (como los
  allocators `alloc_*_code`) o server actions en TypeScript que
  parsean el JSON y hacen los inserts vía Supabase client? La
  arquitectura no lo especifica — `import_project_tasks` es RPC hoy,
  pero eso no obliga a que la nueva lo sea.
- Si es RPC: ¿corre en una sola transacción (atomicidad real, a
  diferencia de `reorderPhases`/`reorderTasks` de esta misma etapa)?
  Un import parcialmente fallido en producción es peor que un reorder
  parcialmente fallido — vale la pena discutirlo explícitamente antes
  de asumir el mismo patrón secuencial no-atómico de la deuda 41.
- ¿El nivel opcional de subtareas del JSON usa los allocators de
  código existentes (`alloc_subtask_code`) o necesita algo nuevo?
- ¿`import_work_plan` escribe en `activity_log`? Si es una fila por
  entidad creada, un import grande puede generar cientos de filas de
  log de una — mismo tipo de decisión de granularidad que se cerró
  para el drag & drop (ahí se resolvió por "solo el ítem arrastrado";
  acá no hay un "ítem arrastrado" equivalente, hay que pensarlo de
  cero).

## 5. Sin empezar

Deudas 39 (menú-portal duplicado) y 40 (`originCounts` desincronizado)
siguen abiertas, sin prioridad asignada, no forman parte de Etapa 3.

## 6. Primer paso del chat nuevo

    Proyecto follow-proyect — 1R: Etapa 3 del Work Plan, paso 4/4
    (import_work_plan). Decidir arquitectura de la función (RPC vs
    server actions, atomicidad, granularidad de activity_log).

    Adjunto PLAN-SEMILLA-1R.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo
    de mi terminal, no del documento.
