# Plan semilla — 1Q: Etapa 3 del Work Plan (drag & drop, activity_log, import_work_plan)

**31 ago 2026.** Nace al cerrar 1P (fix Service Worker, deuda 32,
commit `b9ba39f`).

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | `b9ba39f` |
| SQL pendiente | ninguno |

## 2. Qué quedó cerrado en 1P

- Deuda 32 (Service Worker) cerrada — commit `50269b4`. `SwRegister.tsx`
  salta el registro en dev y usa `getRegistration()` como guard en
  producción. Verificado con smoke test manual en Chrome (dev y
  producción local) y deploy Ready en Vercel.
- Nota de proceso nueva en `CLAUDE.md`: el browser tool automatizado
  (Codex/Playwright vía MCP) no valida Service Workers de forma
  confiable — usar Chrome real a mano para eso específicamente.
- La duda de 1P sobre una referencia vieja a `estimated_cost` en
  `ARQUITECTURA-WORKPLAN.md` quedó resuelta: el documento ya
  documentaba la decisión de 1N de descartarlo. No había gap real.

## 3. Contexto: qué es Etapa 3

Según `docs/ARQUITECTURA-WORKPLAN.md` sección 9, las Etapas 0
(limpieza Drizzle), 1 (el corte a `phases`/`tasks`/`subtasks`/
`assignments`) y 2 (`work_items` emergentes) ya están implementadas
y en producción. Queda la **Etapa 3 — el resto**:

1. **Drag & drop de fases y tareas.** `sort_order` existe en `phases`,
   pero **NO existe en `tasks`** (confirmado por auditoría de PASO 0,
   1Q — contradice lo que la sección 3 del documento de arquitectura
   documenta como diseño). Antes de conectar la UI hace falta una
   migración que agregue la columna a `tasks`. Drag & drop de fases
   puede implementarse directo; drag & drop de tareas necesita ese
   paso previo.
2. **`activity_log`.** Tabla nueva, todavía no existe (confirmado).
   Diseño ya cerrado en la sección 3 del documento: `(entity_type,
   entity_id, user_id, field, old_value, new_value, created_at)`. Se
   escribe desde los server actions, solo el campo que cambió — no la
   fila entera.
3. **`import_work_plan`.** RPC nueva que reemplazaría a
   `import_project_tasks`. Corrección importante sobre lo que se creía
   al cerrar 1P: `import_project_tasks` **NO está congelada** — está
   activamente invocada hoy desde `project-import-actions.ts:121`, es
   la función real detrás del botón "Importar tareas" en producción.
   La única función realmente congelada del par es
   `update_project_tasks` (stub con `RAISE EXCEPTION` desde `013b`).
   Falta decidir qué pasa con `import_project_tasks` cuando exista
   `import_work_plan`: ¿conviven, se deprecia, se reemplaza de una?
   No es una precondición ya resuelta — es parte de esta etapa.

## 4. Primera decisión a cerrar en el chat nuevo

**Orden de ejecución de las tres piezas — no preasignado**, se decide
en el chat nuevo. Puntos a tener en cuenta antes de decidir:

- `activity_log` no depende de las otras dos piezas, y tanto el
  drag & drop (persistir `sort_order`) como `import_work_plan`
  probablemente deberían escribir en `activity_log` una vez exista
  — hacerla primero evita rehacer trabajo en las otras dos.
- Decidir qué hacer con `import_project_tasks` una vez exista
  `import_work_plan`: conviven, se deprecia, o se reemplaza de una —
  no es precondición a confirmar, ya se sabe que sigue activa (ver
  sección 3, punto 3).
- Drag & drop es la pieza más chica del lado servidor (solo persistir
  `sort_order`) pero la de mayor superficie de UI/UX.
- `tasks.sort_order` no existe todavía — cualquier plan que empiece
  por drag & drop de tareas (no solo fases) necesita una migración
  SQL previa, ejecutada a mano en Supabase antes de escribir código
  cliente.

## 5. Sin empezar

Nada más en el radar inmediato fuera de lo anterior. Deudas 39
(menú-portal duplicado) y 40 (`originCounts` desincronizado) siguen
abiertas, sin prioridad asignada, no forman parte de Etapa 3.

## 6. Primer paso del chat nuevo

    Proyecto follow-proyect — 1Q: Etapa 3 del Work Plan (drag & drop,
    activity_log, import_work_plan). Decidir orden de ejecución.

    Adjunto PLAN-SEMILLA-1Q.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo
    de mi terminal, no del documento.
