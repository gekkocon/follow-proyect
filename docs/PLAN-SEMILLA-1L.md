# Plan semilla — 1L: Etapa 2 cerrada (SQL + server actions), pendiente UI

**29 ago 2026.** Nace al cerrar 1K (SQL completo y verificado,
server actions creados y verificados, allocator probado en vivo con
cuenta real). Commit eaee9cb pusheado a origin/main.

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | eaee9cb (server actions de work_items, pusheado a origin/main) |
| SQL pendiente | ninguno |
| Archivo sin trackear en disco | scripts/verify-alloc-work-item.mjs — herramienta de prueba de un solo uso, NO commitear. Confirmar con `git status --short` al arrancar que sigue apareciendo como `??` y no se coló en algún commit por error. |

## 2. Lo que quedó cerrado en 1K

**SQL — verificado contra la base real, no solo contra el plan:**
- `015_work_items.sql`: tablas `work_items` (28 columnas) y
  `work_item_origins`, 4 enums (`work_item_type`, `work_item_status`,
  `work_item_severity`, `work_item_impact`), 3 columnas `*_seq` en
  `projects`. Verificado por `information_schema` + `pg_constraint`.
- `016_alloc_work_item_code.sql`: allocator genérico (un solo RPC para
  los tres tipos, no tres), `SECURITY INVOKER`, `REVOKE FROM anon` por
  nombre, `GRANT TO authenticated`. Gate: admin pasa siempre, el resto
  necesita fila en `project_members`. Prefijo `QRFC-` (no `RFC-` —
  el instructivo v2 quedó desactualizado en ese punto, la fuente
  correcta es `ARQUITECTURA-WORKPLAN.md`), padding 3 dinámico
  (`GREATEST(3, length(...))`, misma lección de la 8A con base
  distinta).

**Decisiones de permisos, cerradas en chat:**
- Crear work item: cualquier miembro del proyecto.
- Editar: cualquier miembro del proyecto.
- Borrar: `canManageTeam` (admin o pm) — mismo criterio que el resto
  de los borrados operativos (deuda 17).

**TypeScript — creado, tsc limpio, pusheado (commit eaee9cb):**
- `src/lib/supabase/work-item-schema.ts` — Zod discriminated union por
  `type`, `priority` con `'critical'` (no `'urgent'`, corregido contra
  el enum real).
- `src/lib/supabase/work-item-actions.ts` — `createWorkItem` (gate vía
  RPC, sin duplicar chequeo en TS), `updateWorkItem` (gate vía
  `getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser))`,
  firma real de dos argumentos posicionales, no un objeto),
  `deleteWorkItem` (gate vía `canManageTeam`). `type` no editable en
  update — el código ya tiene el prefijo grabado. `generated_task_id`
  no se toca en ninguna de las tres (conversión a tarea, D-18 de
  `ARQUITECTURA-WORKPLAN.md`, fuera de alcance).

**Seis correcciones reales encontradas por inspección de Claude Code
antes de escribir código** (ninguna asumida sin verificar contra el
repo real): ubicación `src/lib/supabase/` en vez de
`src/lib/validations/` (esa carpeta no existe), `'critical'` en vez de
`'urgent'`, `await` faltante en las tres llamadas a
`createAuthServerClient()` (hubiera roto en runtime, no
necesariamente en tsc), firma real de `getVisibleProjectIds` (dos
argumentos posicionales, no un objeto `ActiveUser`), Zod v4
(`.issues`, no `.errors`) contra la API v3 asumida.

**Verificación en vivo del allocator — 7 pasos, sin discrepancias:**
developer sin membresía → `42501`, sin consumir `bug_seq`; con
membresía agregada por UI real → `BUG-001`, `bug_seq` incrementado
atómicamente; admin sin fila en `project_members` en otro proyecto →
código generado igual, bypass por rol confirmado. Ejecutado contra
Proyecto 5 (developer) y Proyecto 7 (admin), vía Spark/WorkGPT +
Supabase manual para los pasos SQL.

## 3. Lo que quedó sin verificar — explícito, no es deuda nueva

`updateWorkItem` y `deleteWorkItem` **no se pudieron probar en vivo**
en esta sesión. Su gate es TypeScript puro (no SQL como el
allocator), y pegarle con `supabase-js` directo no prueba nada real —
solo confirmaría que Postgres no tiene guardia (deuda 1, ya sabido).
Verificarlos de verdad requiere invocar el server action real, lo que
requiere UI o un arnés de prueba equivalente. Ninguno existe todavía.

## 4. Sin empezar

- UI: pestañas colapsables Bugs / Deuda Técnica / Preguntas-RFC debajo
  de las fases (`ARQUITECTURA-WORKPLAN.md` línea 308).
- Vínculo de origen (`work_item_origins`) desde la UI — el server
  action ya lo soporta (opcional), pero no hay ningún formulario que
  lo use todavía.
- `docs/FUNCIONALIDADES.md` sigue sin reflejar Etapa 2 (arrastrado
  desde antes de 1K, no es nuevo de esta sesión).

## 5. Primer paso del chat nuevo

    Proyecto follow-proyect — 1L: Etapa 2, UI de bloques emergentes
    (Bugs / Deuda Técnica / Preguntas-RFC).

    Adjunto PLAN-SEMILLA-1L.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.
    El estado real es el de la §1 de este documento; el HEAD lo leo
    de mi terminal, no del documento — debería ser eaee9cb.

## 6. Cierre

Cerrado el 29 ago 2026. SQL y server actions de Etapa 2 completos y
verificados de punta a punta (allocator probado en vivo con cuenta
real, sin discrepancias en los 7 pasos). `updateWorkItem` y
`deleteWorkItem` quedan sin verificación en vivo por falta de UI —
anotado en §3, no confundir con deuda técnica nueva.

HEAD final de la sesión: eaee9cb, pusheado a origin/main.