# Plan semilla — 1P: Service Worker (deuda 32) o Etapa 3

**30 ago 2026.** Nace al cerrar 1O (migración 014 completa: `start_date`,
`dependencies`, `subtasks.completed`). Commit `d0771f2` en origin/main.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | `d0771f2` |
| SQL pendiente | ninguno funcionalmente — la migración 014 ya está aplicada en Supabase. Pendiente solo el archivo `.sql` versionado en `/migrations` que la documente (ver §2, nunca se creó). |

## 2. Lo que quedó cerrado en 1O

**Migración 014 — completa, smoke test de 9 pasos, PASA:**
- `subtasks.completed` eliminado. UI y server actions leen/escriben
  `status` directamente.
- `start_date` eliminado de `tasks` y `subtasks`. Cero consumidores
  encontrados en ningún formulario.
- `dependencies` eliminado de `subtasks` (sin consumidor real ahí), se
  mantiene en `tasks` con badge visual nuevo: "Depende de tareas sin
  cerrar", cuando una tarea `in_progress` referencia otra que no está
  `done`. Sin bloqueo, solo aviso. `taskStatusById` calculado en
  `ProjectTasksClient` desde `workPlan.allTasks`, enhebrado por
  `WorkSection` -> `TaskList` -> `TaskRow`.
- Dos hallazgos fuera de la lista original de archivos, corregidos en
  el mismo commit: `app/(dashboard)/tasks/page.tsx` (SELECT y tipo
  `SubtaskListItem` con `completed` sin consumidor) y
  `src/lib/supabase/project-import-actions.ts` (`normalizeForRpc`
  seguía armando `start_date`). Lección de proceso: el radio de un
  grep de campo antes de una migración destructiva tiene que cubrir
  `/app`, no solo `/components` y `/src/lib`.
- Verificación: pasos 3-6 y 9 del smoke test en producción real; pasos
  7-8 (badge de dependencias) en local, incluida la reversión (el
  badge reaparece/desaparece correctamente al reabrir/cerrar la
  dependencia).

**Deudas y decisiones cerradas en `CLAUDE.md`:**
- Deuda 7 (`dependencies` sin uso) — cerrada, implementado el badge en
  vez de descartar el campo.
- Decisión abierta #2 (`status`/`completed` en subtareas, 8B) —
  cerrada, ya no aplica sin la columna.
- Deuda 32 (Service Worker) — **NO cerrada, actualizada.** Ver §4.

**Gap encontrado, sin resolver todavía:** la migración 014 nunca quedó
como archivo `.sql` versionado en `/migrations` — se corrió a mano en
Supabase sin que nadie creara un `014_*.sql` en el repo (a diferencia
de la 013f, que sí documentó `estimated_cost`). La base real ya tiene
el cambio aplicado; lo que falta es solo el registro histórico.

## 3. Explícito, no es deuda nueva

Nada nuevo — los tres campos de la 014 quedaron resueltos según su
consumidor real, sin dejar ningún cabo suelto adicional.

## 4. Primera decisión a cerrar en el chat nuevo

**Service Worker (deuda 32), confirmado en 1O como bug activo, no solo
deuda de fondo:** `SwRegister.tsx` se re-registra sin ninguna guarda en
cada navegación completa (no solo en el primer mount), y esa condición
de carrera puede producir `TypeError: Cannot read properties of
undefined (reading 'call')` y, en el peor caso, bloquear la navegación
completa del origen en una pestaña — reproducido en vivo durante 1O.
Sin confirmar todavía si reproduce en Vercel/producción.

Decidir antes de escribir código: ¿sesión propia ahora para arreglarlo,
o se pospone hasta después de cerrar Etapa 3? Es un bug con capacidad
de bloquear la navegación entera de un usuario real, no una deuda
cosmética — pesa distinto que las demás deudas abiertas a la hora de
priorizar.

## 5. Sin empezar

- **Etapa 3 completa**: drag & drop de fases y tareas, `activity_log`,
  `import_work_plan`, totalización (ya no aplica a `estimated_cost`,
  eliminado en 1N — revisar si la mención en `ARQUITECTURA-WORKPLAN.md`
  sigue arrastrando esa referencia vieja).
- Migración 014 sin versionar en `/migrations` (§2) — reconstruir el
  `.sql` real como registro histórico, no bloqueante para seguir
  trabajando.
- Deuda 39 (menú-portal duplicado entre `TaskRow` y `RowActionMenu`) y
  deuda 40 (`originCounts` desincronizado) siguen abiertas, sin
  prioridad asignada.

## 6. Primer paso del chat nuevo

    Proyecto follow-proyect — 1P: decidir Service Worker (deuda 32)
    ahora o después de Etapa 3.

    Adjunto PLAN-SEMILLA-1P.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo de
    mi terminal, no del documento.
