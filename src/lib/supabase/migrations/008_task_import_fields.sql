-- Fase 7 — Importación masiva de tareas/subtareas
-- Campos opcionales nuevos: fecha de inicio, costo estimado, dependencias.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies BIGINT[] NOT NULL DEFAULT '{}';

ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2);
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS dependencies BIGINT[] NOT NULL DEFAULT '{}';
