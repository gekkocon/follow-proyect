# Plan semilla — 1K: Etapa 2, bloques emergentes (bugs, deuda técnica, RFC)

**29 ago 2026.** Nace al cerrar 1J (Drizzle confirmado resuelto,
labels consolidados, commit 5b9d882 pusheado a origin/main).

## 1. Estado al arrancar

El HEAD lo lee el terminal, no este documento.

| | |
|---|---|
| Último commit conocido | 5b9d882 (cierre 1J, pusheado a origin/main) |
| SQL pendiente | ninguno |

## 2. Punto de partida

La arquitectura de Etapa 2 está cerrada y documentada por completo en
docs/ARQUITECTURA-WORKPLAN.md (secciones 2, 3, 4, 6, 9): tabla
`work_items` (type ∈ bug/debt/rfc, 13 campos comunes + específicos por
tipo), tabla `work_item_origins` (relación polimórfica opcional a
phase/task/subtask), contadores `bug_seq`/`debt_seq`/`rfc_seq` en
`projects`, formato de código `BUG-014`/`TD-007`/`RFC-004` (padding 3),
`assignments` polimórfica compartida con la jerarquía
(assignable_type ∈ task/subtask/work_item), decisión D-18 (emergentes
son planos, se vinculan a una tarea generada vía `generated_task_id`).

Esto es diseño cerrado, CERO implementado: ninguna migración crea estas
tablas, no están en schema.sql, no están en FUNCIONALIDADES.md.

## 3. Primer paso: verificar estado real de la base

Antes de escribir la migración, confirmar contra la base real (no solo
contra el documento del 26 ago) que nada de esto ya existe y que los
tipos de FK van a calzar. Ver consultas en el primer prompt de esta
sesión.

## 4. Primer paso del chat nuevo

    Proyecto follow-proyect — 1K: Etapa 2, bloques emergentes.
    Adjunto PLAN-SEMILLA-1K.md, CLAUDE.md y ARQUITECTURA-WORKPLAN.md.

## 5. Estado al cortar (corte no del todo limpio — SQL sin ejecutar)

Diseño de Etapa 2 cerrado y documentado en ARQUITECTURA-WORKPLAN.md
(incluye la regla Question/RFC unificada). Migración
src/lib/supabase/migrations/015_work_items.sql CREADA pero NO
EJECUTADA contra la base — commit b00c609, pendiente de push al
arrancar el chat nuevo.

Discrepancia marcada en la sesión anterior sobre el tipo de
created_by (INTEGER vs BIGINT) queda RESUELTA — pero fuera de esta
sesión de Claude Code: Hikashi corrió una consulta contra
information_schema en el editor SQL de Supabase (dentro del chat de
Claude.ai, no en esta terminal) que confirmó users.id = integer. La
migración 015 tal como está escrita es correcta, no necesita
cambios. Si el próximo chat quiere volver a verificarlo por su
cuenta, la consulta es:
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

Próximo paso al abrir el chat nuevo, en orden:
  1. Confirmar (git log / git status) que b00c609 sigue siendo el HEAD
     local y que sigue sin pushear.
  2. Pushear b00c609 a origin/main.
  3. Copiar el contenido de 015_work_items.sql al editor SQL de
     Supabase y ejecutarlo A MANO (Hikashi). Verificar con SELECT
     contra information_schema que work_items, work_item_origins y
     los 4 enums se crearon, y que projects tiene las 3 columnas *_seq
     nuevas.
  4. Recién después de esa verificación, seguir con el allocator de
     código (BUG-xxx/TD-xxx/QRFC-xxx) y los server actions de
     work_items — todavía sin diseñar.
