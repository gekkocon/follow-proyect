-- ============================================================
-- FOLLOW PROJECT — Schema Supabase
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role   AS ENUM ('admin', 'pm', 'developer', 'designer');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'overdue');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'blocked');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  role       user_role   NOT NULL DEFAULT 'developer',
  status     user_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BRAND SETTINGS
-- (Una fila por organización / workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_settings (
  id              BIGSERIAL PRIMARY KEY,
  org_name        TEXT NOT NULL DEFAULT 'My Workspace',
  logo_url        TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#6366F1',
  secondary_color TEXT NOT NULL DEFAULT '#8B5CF6',
  accent_color    TEXT NOT NULL DEFAULT '#EC4899',
  font_family     TEXT NOT NULL DEFAULT 'Inter',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id          BIGSERIAL     PRIMARY KEY,
  name        TEXT          NOT NULL,
  description TEXT,
  status      project_status NOT NULL DEFAULT 'planning',
  priority    priority_level NOT NULL DEFAULT 'medium',
  owner_id    BIGINT        REFERENCES users(id) ON DELETE SET NULL,
  start_date  DATE,
  due_date    DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id             BIGSERIAL     PRIMARY KEY,
  title          TEXT          NOT NULL,
  description    TEXT,
  status         task_status   NOT NULL DEFAULT 'todo',
  priority       priority_level NOT NULL DEFAULT 'medium',
  project_id     BIGINT        REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id    BIGINT        REFERENCES users(id) ON DELETE SET NULL,
  is_blocked     BOOLEAN       NOT NULL DEFAULT FALSE,
  blocked_reason TEXT,
  due_date       DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBTASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS subtasks (
  id         BIGSERIAL   PRIMARY KEY,
  title      TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  task_id    BIGINT      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECT MEMBERS (Fase 5F)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_members (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rol_en_proyecto TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner     ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_task      ON subtasks(task_id);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_brand_settings_updated_at
  BEFORE UPDATE ON brand_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (habilitar, políticas a definir por app)
-- ============================================================

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

-- Política permisiva temporal (ajustar antes de producción)
CREATE POLICY "allow_all_users"          ON users          FOR ALL USING (true);
CREATE POLICY "allow_all_projects"       ON projects       FOR ALL USING (true);
CREATE POLICY "allow_all_tasks"          ON tasks          FOR ALL USING (true);
CREATE POLICY "allow_all_subtasks"       ON subtasks       FOR ALL USING (true);
CREATE POLICY "allow_all_brand_settings" ON brand_settings FOR ALL USING (true);
