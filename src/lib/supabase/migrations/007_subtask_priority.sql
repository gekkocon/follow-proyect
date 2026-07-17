-- Fase 6B+ — prioridad en subtareas
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS priority priority_level NOT NULL DEFAULT 'medium';
