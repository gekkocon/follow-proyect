-- NO EJECUTADA todavía. Diseñada en la sesión 1K, ver
-- docs/PLAN-SEMILLA-1K.md y docs/ARQUITECTURA-WORKPLAN.md (secciones
-- 2, 3, 4, 6, 9).
-- ============================================================
-- 015_work_items.sql · Etapa 2 · MIGRACIÓN ADITIVA
-- Ninguna columna ni tabla existente se borra acá. Crea los enums y
-- las dos tablas nuevas para bugs / deuda técnica / question_rfc.
-- Re-ejecutable sin romper: CREATE TYPE va envuelto en DO $$ ...
-- EXCEPTION WHEN duplicate_object, y los CREATE TABLE llevan
-- IF NOT EXISTS, igual que 013_work_plan.sql.
-- ============================================================

BEGIN;

-- 1 · ENUMS -----------------------------------------------------------
-- Cuatro enums nuevos. work_item_type y work_item_status se usan en
-- work_items.type / work_items.status para los tres tipos de item.
-- work_item_severity y work_item_impact son específicos de bug y debt
-- respectivamente — no hay un enum específico de question_rfc, ese
-- tipo no tiene un campo de clasificación equivalente.

DO $$ BEGIN
  CREATE TYPE work_item_type AS ENUM ('bug', 'debt', 'question_rfc');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE work_item_status AS ENUM (
    'open', 'in_progress', 'awaiting_decision', 'resolved', 'discarded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE work_item_severity AS ENUM ('minor', 'major', 'blocker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE work_item_impact AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2 · CONTADORES EN projects -------------------------------------------
-- Mismo patrón que phases.task_code_seq: un watermark monotónico por
-- tipo, para que el código (BUG-014, TD-007, QRFC-004) nunca colisione
-- ni decrezca. Arrancan en 0, igual que el resto de los seq existentes.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS bug_seq         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS debt_seq        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS question_rfc_seq INTEGER NOT NULL DEFAULT 0;

-- 3 · work_items --------------------------------------------------------
-- Una sola tabla para los tres tipos (bug / debt / question_rfc), con
-- 14 campos comunes y los campos específicos de cada tipo como
-- columnas nullable — el tipo que no aplica simplemente los deja en
-- NULL. project_id, created_by y generated_task_id son INTEGER porque
-- projects.id, users.id y tasks.id son INTEGER en la base real (no
-- BIGINT, como asumía la versión vieja del documento de arquitectura).
-- target_phase_id es BIGINT porque phases.id sí es bigserial/bigint.
-- UNIQUE(project_id, code) replica el mismo criterio que ya usan los
-- códigos de fase/tarea/subtarea: único dentro de su contenedor, acá
-- el proyecto, con contador propio por tipo (sección 2).

CREATE TABLE IF NOT EXISTS work_items (
  -- Comunes a los tres tipos (14 campos)
  id                BIGSERIAL         PRIMARY KEY,
  project_id        INTEGER           NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type              work_item_type    NOT NULL,
  code              TEXT              NOT NULL,
  title             TEXT              NOT NULL,
  description       TEXT,
  status            work_item_status  NOT NULL DEFAULT 'open',
  priority          priority_level    NOT NULL DEFAULT 'medium',
  created_by        INTEGER           REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  sort_order        INTEGER           NOT NULL DEFAULT 0,
  generated_task_id INTEGER           REFERENCES tasks(id) ON DELETE SET NULL,
  checklist         JSONB             NOT NULL DEFAULT '[]',

  -- Específicos de bug (7 campos)
  severity            work_item_severity,
  environment         TEXT,
  version             TEXT,
  reproduction_steps  TEXT,
  expected_behavior   TEXT,
  actual_behavior     TEXT,
  resolution          TEXT,

  -- Específicos de debt (4 campos)
  impact              work_item_impact,
  proposed_solution   TEXT,
  estimated_effort    TEXT,
  target_phase_id     BIGINT REFERENCES phases(id) ON DELETE SET NULL,

  -- Específicos de question_rfc (3 campos)
  options             JSONB,
  recommendation      TEXT,
  final_decision      TEXT,

  UNIQUE (project_id, code)
);

-- 4 · work_item_origins ---------------------------------------------------
-- Relación polimórfica opcional: un work_item puede apuntar a cero o
-- más orígenes (fase, tarea o subtarea) donde apareció. origin_type es
-- TEXT + CHECK, no un enum Postgres real, siguiendo el mismo patrón
-- que assignments.assignable_type — necesario porque origin_id es
-- polimórfico y no puede llevar un FK real hacia tres tablas distintas.
-- ON DELETE CASCADE en work_item_id: si se borra el work_item, sus
-- orígenes no tienen sentido por separado.

CREATE TABLE IF NOT EXISTS work_item_origins (
  id            BIGSERIAL PRIMARY KEY,
  work_item_id  BIGINT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  origin_type   TEXT   NOT NULL CHECK (origin_type IN ('phase', 'task', 'subtask')),
  origin_id     BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
