-- 013g — retiro del namespace huérfano (1F-b)
-- Ejecutada a mano en el editor de Supabase el 28 ago 2026.
-- Ver docs/PLAN-SEMILLA-1F.md para el contexto completo (1F-a: auditoría).
--
-- Precondición cumplida antes de los DROP: project-task-actions.ts,
-- createProjectTask, ya no tiene la rama condicional que llamaba a
-- alloc_task_code (phaseId pasó a ser obligatorio). Push a main
-- verificado en prod antes de correr la parte destructiva, según
-- la regla de orden de CLAUDE.md §8.

-- Paso 1 — revocar anon de la sobrecarga vieja (mitigación inmediata,
-- no depende del punto anterior).
REVOKE EXECUTE ON FUNCTION public.import_project_tasks(bigint, jsonb) FROM anon;

-- Paso 2 — retiro. idx_tasks_orphan_code era un índice parcial sobre
-- un conjunto permanentemente vacío desde 013f (tasks.phase_id NOT NULL).
-- alloc_task_code tenía dos callers: esta misma función (ya cubierta
-- arriba) y createProjectTask en el repo (ya removido, ver precondición).
DROP FUNCTION IF EXISTS public.import_project_tasks(bigint, jsonb);
DROP FUNCTION IF EXISTS public.alloc_task_code(bigint);
DROP INDEX IF EXISTS public.idx_tasks_orphan_code;

-- Paso 3 — projects.orphan_task_code_seq. Sin lectores en TypeScript
-- (confirmado en la auditoría 1F-a) y sin escritores tras el paso 2.
ALTER TABLE public.projects DROP COLUMN IF EXISTS orphan_task_code_seq;
