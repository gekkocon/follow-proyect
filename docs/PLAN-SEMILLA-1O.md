# Plan semilla — 1O: Etapa 3 pendiente, migración 014 por decidir

**30 ago 2026.** Nace al cerrar 1N (FUNCIONALIDADES.md reescrito para
Etapa 2, estimated_cost eliminado por completo de tasks/subtasks).
Commit `92eab66` en origin/main.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | `92eab66` |
| SQL pendiente | ninguno |

## 2. Lo que quedó cerrado en 1N

**Frente 1 — docs/FUNCIONALIDADES.md, reescritura completa:**
Reemplazado el modelo de códigos de dos niveles por el real de tres
(fase/tarea/subtarea), agregada sección "Fases", agregada sección
"Bloques emergentes" (Etapa 2 completa: bugs/deuda/RFC, orígenes,
contador, checklist), "Actualizar tareas" reducida a un párrafo que
explica por qué está deshabilitada, limpiada la mención a migraciones
010/011 como posiblemente pendientes (estaban aplicadas hace tiempo).
Commit `1df01f1`.

**Frente 2 — estimated_cost eliminado por completo (no solo sin
totalizar: se descartó el campo entero, decisión tomada en chat por
bajo uso):**
- Código (TypeScript, Zod, docs de arquitectura, CLAUDE.md): commit
  `4b653f6`.
- Fix de build roto: `sameNumber()` en `update-normalize.ts` quedó sin
  uso tras el cambio anterior y rompió `next build` (ESLint
  `no-unused-vars`, invisible para `tsc --noEmit`). Commit `9840660`.
- SQL: `013f_drop_estimated_cost.sql` — redefine
  `import_project_tasks(bigint, jsonb, bigint)` sin el campo y recién
  después dropea la columna en `tasks` y `subtasks`, todo en una sola
  transacción. Corrida a mano en Supabase, verificada con `SELECT`
  (ambas columnas confirmadas ausentes). Commit del archivo: `3d2af0e`.
- Deuda técnica #6 de CLAUDE.md cerrada por eliminación del campo, no
  por la totalización que proponía originalmente.
- `docs/ARQUITECTURA-WORKPLAN.md` actualizado en dos puntos (línea 156
  y la lista de Etapa 3) para no contradecir la decisión.
- La migración 014 (reservada) queda ahora SOLO con `start_date`,
  `dependencies` y `subtasks.completed` — `estimated_cost` salió de esa
  lista porque ya se ejecutó aparte, en 013f.

**Lección de proceso nueva, ya en CLAUDE.md:** `tsc --noEmit` no
detecta código muerto que `next build` sí bloquea (ESLint
`no-unused-vars`). Cualquier cambio que borre código se verifica con
`npm run build` completo, no alcanza con `tsc` solo.

## 3. Explícito, no es deuda nueva

- `sameNumber()` no dejó rastro: se eliminó por completo, no quedó como
  código muerto tolerado.
- El commit `3d2af0e` no generó cambios nuevos porque el archivo ya
  estaba commiteado desde el turno anterior al pedido — reconfirmado,
  no reejecutado.

## 4. Sin empezar

- **Decisión pendiente, primera cosa a cerrar en el chat nuevo:** qué
  hacer con los tres campos que quedan en la migración 014
  (`start_date`, `dependencies`, `subtasks.completed`). Mismo tipo de
  pregunta que se cerró hoy con `estimated_cost`: ¿se implementan de
  verdad (dependencies con aviso visual, según recomendación de
  `ARQUITECTURA-WORKPLAN.md` sección 10) o se descartan por bajo uso,
  igual que estimated_cost? No arrancar código hasta cerrar esto.
- **Etapa 3 completa** (fuera de la 014): drag & drop de fases y
  tareas, `activity_log`, `import_work_plan`.
- Deuda 39 (menú-portal duplicado entre `TaskRow` y `RowActionMenu`) y
  deuda 40 (`originCounts` desincronizado) siguen abiertas, sin
  prioridad asignada todavía.

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1O: decidir el destino de la migración
    014 (start_date, dependencies, subtasks.completed) antes de
    arrancar Etapa 3.

    Adjunto PLAN-SEMILLA-1O.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo de
    mi terminal, no del documento.
