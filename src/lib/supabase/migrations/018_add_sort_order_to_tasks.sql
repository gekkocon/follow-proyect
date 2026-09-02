-- ============================================================
-- 018_add_sort_order_to_tasks.sql · Etapa 3, paso 2 · REGISTRO HISTÓRICO
--
-- Ya ejecutada a mano en Supabase: columna agregada, backfill por
-- phase_id ordenado por id, NOT NULL + DEFAULT 0 confirmados, cero
-- filas NULL verificado. Este archivo es solo el registro versionado
-- de ese DDL — no correrlo de nuevo. Mismo criterio que las
-- migraciones 014 y 017.
-- ============================================================

ALTER TABLE tasks ADD COLUMN sort_order int;

WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY phase_id ORDER BY id) - 1 AS rn
  FROM tasks
)
UPDATE tasks t
SET sort_order = ordered.rn
FROM ordered
WHERE t.id = ordered.id;

ALTER TABLE tasks ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN sort_order SET DEFAULT 0;
