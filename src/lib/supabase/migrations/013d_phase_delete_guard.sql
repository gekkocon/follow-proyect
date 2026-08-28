-- 013d · CANDADO DE BORRADO DE FASE
-- Etapa 1, paso 1C-c. Repara la 013.
--
-- La 013 declaro tasks.phase_id con ON DELETE SET NULL (lineas 58-59).
-- Medido contra pg_constraint el 27 ago 2026: la clausula esta viva.
--
-- SET NULL es incompatible con D-20. Borrar una fase suelta sus tareas al
-- namespace de huerfanas del proyecto conservando su codigo local de fase.
-- Contra idx_tasks_orphan_code eso da uno de dos resultados, ninguno bueno:
--   codigo ya presente entre las huerfanas -> 23505 crudo de Postgres
--   codigo ausente                         -> exito SILENCIOSO, la tarea
--                                             cambia de namespace sin aviso
--
-- Ningun guard de aplicacion lo evita: RLS esta deshabilitada en tasks y en
-- phases, y la anon key vive en el bundle del navegador, asi que
-- DELETE /rest/v1/phases llega a la base sin pasar por Next.
--
-- RESTRICT convierte D-20 en invariante estructural. La salida para una fase
-- con tareas es moverlas con C-1, no soltarlas.
--
-- Precedente: subtasks.task_id y tasks.project_id ya son NO ACTION. La fase
-- era el unico padre de la jerarquia sin proteccion en la base.
--
-- IDEMPOTENTE: se puede volver a correr sin efecto.

-- 1 · LA FK PASA DE SET NULL A RESTRICT -------------------------------

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_phase_id_fkey,
  ADD  CONSTRAINT tasks_phase_id_fkey
       FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE RESTRICT;
