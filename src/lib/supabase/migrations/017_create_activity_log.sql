-- ============================================================
-- 017_create_activity_log.sql · Etapa 3, paso 1 · REGISTRO HISTÓRICO
--
-- Ya ejecutada a mano en Supabase DEV. Este archivo es solo el
-- registro versionado de ese DDL — no correrlo de nuevo.
--
-- Mismo criterio que la migración 014 (start_date/dependencies/
-- subtasks.completed): la tabla ya existe en la base real: este
-- archivo documenta el DDL real, no lo aplica.
-- ============================================================

CREATE TABLE activity_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('phase', 'task', 'subtask')),
  entity_id bigint NOT NULL,
  user_id bigint REFERENCES users(id),
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_entity ON activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log (created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_allow_all ON activity_log
  FOR ALL USING (true) WITH CHECK (true);
