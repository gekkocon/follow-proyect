-- ============================================================
-- 020_task_status_cancelled.sql · MIGRACIÓN ADITIVA · REGISTRO HISTÓRICO
--
-- Agrega el valor 'cancelled' ("Cancelada") al enum task_status, que
-- comparten phases.status, tasks.status y subtasks.status.
--
-- Ya ejecutada a mano en Supabase el 16 oct 2026 y verificada (la query de
-- abajo devolvió 1 fila). Este archivo es solo el registro versionado de ese
-- DDL — no correrlo de nuevo.
--
-- ALTER TYPE ... ADD VALUE no puede correr dentro de un bloque de
-- transacción junto con un uso del valor nuevo: correrlo solo, sin BEGIN.
-- ============================================================

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Verificación · correr aparte. Debe devolver UNA fila.
SELECT enumlabel
  FROM pg_enum
 WHERE enumtypid = 'task_status'::regtype
   AND enumlabel = 'cancelled';
