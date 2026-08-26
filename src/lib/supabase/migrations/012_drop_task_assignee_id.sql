-- ---------------------------------------------------------------------------
-- 012_drop_task_assignee_id.sql
-- Elimina tasks.assignee_id, la columna legacy de responsable único.
--
-- `task_assignees` la reemplazó por completo desde la Fase 5E. Verificado en
-- PROD antes de escribir esta migración: cero tareas tienen un `assignee_id`
-- que no esté ya en `task_assignees`. Es redundancia pura, no hay datos que
-- migrar.
--
-- ===========================================================================
-- ATENCIÓN — EL ORDEN ACÁ ES AL REVÉS DEL HABITUAL
-- ===========================================================================
-- El orden normal del proyecto (CLAUDE.md, sección 8) es: SQL primero, código
-- después. ESTA MIGRACIÓN VA AL REVÉS, y el motivo es que borra algo en vez de
-- agregarlo:
--
--   1. Primero se pushea el código que YA NO LEE `assignee_id`.
--   2. Se verifica DEV y PROD funcionando con ese código.
--   3. RECIÉN AHÍ se corre este DROP en DEV, se verifica, y después en PROD.
--
-- Si el DROP va primero, producción queda leyendo una columna que no existe y
-- se cae hasta que el deploy del código la alcance. El orden habitual protege
-- contra el caso inverso —código nuevo contra una base vieja— que acá no
-- aplica: el código nuevo funciona igual con la columna presente o ausente,
-- porque simplemente dejó de mirarla.
--
-- Ejecutar a mano en el editor SQL de Supabase, como todas las migraciones de
-- este proyecto.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASO A — VERIFICACIÓN PREVIA. Correr SOLO ESTO primero, en DEV y en PROD.
--
-- Tiene que devolver 0 en las dos columnas. Si `en_riesgo` es mayor que 0,
-- hay tareas cuyo responsable vive únicamente en la columna vieja: esa
-- información se perdería con el DROP y hay que migrarla antes.
--
-- NO CONTINUAR AL PASO B si esto no da 0.
-- ===========================================================================

SELECT
  COUNT(*) FILTER (WHERE t.assignee_id IS NOT NULL)              AS con_assignee_id,
  COUNT(*) FILTER (
    WHERE t.assignee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM task_assignees ta
        WHERE ta.task_id = t.id
          AND ta.user_id = t.assignee_id
      )
  )                                                              AS en_riesgo
FROM tasks t;


-- ===========================================================================
-- PASO B — EL DROP. Correr solo después de que el PASO A haya dado 0 y de que
-- el código que ya no lee la columna esté desplegado y verificado.
--
-- No hace falta un DROP INDEX para `idx_tasks_assignee`: Postgres borra
-- automáticamente todo índice que dependa de una columna eliminada. Agregarlo
-- por las dudas no aporta y ensucia la migración.
--
-- Tampoco hace falta tocar la foreign key contra `users`: cae con la columna.
--
-- IF EXISTS lo vuelve idempotente: correrlo dos veces no falla.
-- ===========================================================================

ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_id;


-- ===========================================================================
-- PASO C — VERIFICACIÓN POSTERIOR. Tiene que devolver cero filas.
-- ===========================================================================

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'tasks'
  AND column_name  = 'assignee_id';
