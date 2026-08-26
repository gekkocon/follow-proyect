-- YA EJECUTADA en la base el 2026-08-26 · NO volver a correr.
-- No es idempotente: el INSERT INTO phases del paso 4 rebota
-- contra idx_phases_project_code en cualquier corrida posterior.
-- ============================================================
-- 013_work_plan.sql · Etapa 1 · MIGRACIÓN ADITIVA
-- Ninguna columna se borra acá. Los DROP van en la 014.
-- Todo en una transacción: si una verificación falla, ROLLBACK total.
-- ============================================================

BEGIN;

-- 1 · TABLAS NUEVAS -------------------------------------------------

CREATE TABLE IF NOT EXISTS phases (
  id             BIGSERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code           TEXT,
  name           TEXT NOT NULL,
  objective      TEXT,
  status         task_status,
  priority       priority_level,
  start_date     DATE,
  due_date       DATE,
  completed_at   TIMESTAMPTZ,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  task_code_seq  INTEGER NOT NULL DEFAULT 0
);

-- Los defaults de status/priority se copian de tasks en vez de
-- hardcodearse: así no hace falta adivinar las etiquetas del enum.
DO $$
DECLARE v_st TEXT; v_pr TEXT;
BEGIN
  SELECT column_default INTO v_st FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tasks' AND column_name='status';
  SELECT column_default INTO v_pr FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tasks' AND column_name='priority';
  IF v_st IS NULL OR v_pr IS NULL THEN
    RAISE EXCEPTION 'tasks.status o tasks.priority no tienen DEFAULT; revisar a mano';
  END IF;
  EXECUTE format('ALTER TABLE phases ALTER COLUMN status   SET DEFAULT %s', v_st);
  EXECUTE format('ALTER TABLE phases ALTER COLUMN priority SET DEFAULT %s', v_pr);
END $$;

CREATE TABLE IF NOT EXISTS assignments (
  id              BIGSERIAL PRIMARY KEY,
  assignable_type TEXT   NOT NULL
                  CHECK (assignable_type IN ('task','subtask','work_item')),
  assignable_id   BIGINT NOT NULL,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignable_type, assignable_id, user_id)
);

-- 2 · COLUMNAS NUEVAS ----------------------------------------------

ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS phase_id     BIGINT
                     REFERENCES phases(id) ON DELETE SET NULL;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS legacy_code  TEXT;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS legacy_code  TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS orphan_task_code_seq
                     INTEGER NOT NULL DEFAULT 0;

-- projects.task_code_seq pasa a contar FASES. Dejarlo con nombre
-- 'task' contando fases es el error esperando a pasar (D-11).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='projects'
                AND column_name='task_code_seq') THEN
    ALTER TABLE projects RENAME COLUMN task_code_seq TO phase_code_seq;
  END IF;
END $$;

COMMENT ON COLUMN projects.phase_code_seq IS
  'Watermark de fases. PRE-incremento: guarda el PROXIMO libre. F0-based.';
COMMENT ON COLUMN projects.orphan_task_code_seq IS
  'Watermark de tareas SIN fase. POST-incremento: guarda el ULTIMO usado.';
COMMENT ON COLUMN phases.task_code_seq IS
  'Watermark de tareas de la fase. POST-incremento: ULTIMO usado.';
COMMENT ON COLUMN tasks.subtask_code_seq IS
  'Watermark de subtareas. POST-incremento. Sobrevive intacto a la 013.';
COMMENT ON COLUMN tasks.legacy_code IS
  'Codigo 8A previo (F19). Anotacion historica, NUNCA se muestra como codigo vivo.';

-- 3 · EL INDICE VIEJO DE TASKS SE CAE ------------------------------
-- Era UNIQUE (project_id, code). Ahora dos fases del mismo proyecto
-- tienen T01 cada una: lo violarian. Se busca por definicion, no por
-- nombre adivinado.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT indexname FROM pg_indexes
     WHERE schemaname='public' AND tablename='tasks'
       AND indexdef ILIKE '%UNIQUE%'
       AND indexdef ILIKE '%project_id%'
       AND indexdef ILIKE '%code%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
    RAISE NOTICE 'Indice viejo eliminado: %', r.indexname;
  END LOOP;
END $$;

-- 4 · BACKFILL · FASES ---------------------------------------------
-- Mapeo EXPLICITO de PLAN-SEMILLA §5. Sin heuristica: el numero del
-- codigo no correlaciona con la fase (§4.2).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = 7) THEN
    RAISE EXCEPTION 'No existe el proyecto 7; el mapeo de §5 no aplica';
  END IF;
END $$;

INSERT INTO phases (project_id, code, name, sort_order)
VALUES (7,'F0','Fase 0',0),
       (7,'F1','Fase 1',1),
       (7,'F2','Fase 2',2),
       (7,'F3','Fase 3',3),
       (7,'F4','SEO Técnico',4);

-- 5 · BACKFILL · TAREAS CON FASE -----------------------------------
-- T01.. por orden numerico del codigo viejo. El prefijo 'Fase N - '
-- se limpia del titulo: el dato pasa a vivir en su columna.

WITH mapping(phase_code, task_codes) AS (
  VALUES ('F0', ARRAY['F0','F1','F2','F3','F4','F10','F19','F20']),
         ('F1', ARRAY['F5','F6','F7','F8','F18']),
         ('F2', ARRAY['F9','F11','F12','F13']),
         ('F3', ARRAY['F14','F15','F16','F17']),
         ('F4', ARRAY['F21','F22','F23','F24','F25','F26','F27','F28','F29'])
),
ranked AS (
  SELECT t.id,
         ph.id AS phase_id,
         row_number() OVER (
           PARTITION BY ph.id
           ORDER BY substring(t.code from '^F([0-9]+)$')::int
         ) AS rn
    FROM tasks t
    JOIN mapping m  ON t.code = ANY(m.task_codes)
    JOIN phases  ph ON ph.project_id = 7 AND ph.code = m.phase_code
   WHERE t.project_id = 7          -- CRITICO: el proyecto 5 tambien tiene F0 y F1
)
UPDATE tasks t
   SET phase_id    = r.phase_id,
       legacy_code = t.code,
       code        = 'T' || lpad(r.rn::text, GREATEST(2, length(r.rn::text)), '0'),
       title       = regexp_replace(t.title, '^\s*Fase\s+\d+\s*[-–—:]\s*', '')
  FROM ranked r
 WHERE t.id = r.id;

-- 6 · BACKFILL · TAREAS SIN FASE -----------------------------------
-- F30-F34 del proyecto 7 (retroactivas, material de Handoff) y las 2
-- del proyecto 5. Namespace propio: no chocan con las T01 de fase.

WITH ranked AS (
  SELECT t.id,
         row_number() OVER (
           PARTITION BY t.project_id
           ORDER BY substring(t.code from '^F([0-9]+)$')::int
         ) AS rn
    FROM tasks t
   WHERE t.phase_id IS NULL AND t.legacy_code IS NULL
)
UPDATE tasks t
   SET legacy_code = t.code,
       code        = 'T' || lpad(r.rn::text, GREATEST(2, length(r.rn::text)), '0')
  FROM ranked r
 WHERE t.id = r.id;

-- 7 · BACKFILL · SUBTAREAS -----------------------------------------
-- F19-T01 -> S01. Se despega el prefijo (D-8). La query 7 ya confirmo
-- cero colisiones de sufijo dentro de una misma tarea.

UPDATE subtasks s
   SET legacy_code = s.code,
       code        = 'S' || x.sfx
  FROM (SELECT id, substring(code from '-T([0-9]+)$') AS sfx FROM subtasks) x
 WHERE s.id = x.id AND x.sfx IS NOT NULL;

-- 8 · BACKFILL · ASIGNADOS -----------------------------------------
-- Bajo D-1 las tareas siguen siendo tareas: NO se pierde ninguna
-- asignacion, ni de tarea ni de subtarea.

INSERT INTO assignments (assignable_type, assignable_id, user_id, created_at)
SELECT 'task', task_id, user_id, created_at FROM task_assignees
ON CONFLICT DO NOTHING;

INSERT INTO assignments (assignable_type, assignable_id, user_id, created_at)
SELECT 'subtask', subtask_id, user_id, created_at FROM subtask_assignees
ON CONFLICT DO NOTHING;

-- completed_at queda NULL en el backfill a proposito: no existe dato
-- de cuando se completo cada fila. Inventarlo desde created_at seria
-- fabricar. Lo setean los server actions de ahora en mas.

-- 9 · SEMILLA DE CONTADORES ----------------------------------------
-- Desde los datos reales, no desde los contadores viejos.

UPDATE projects p SET phase_code_seq = COALESCE(
  (SELECT MAX(substring(ph.code from '^F([0-9]+)$')::int) + 1
     FROM phases ph WHERE ph.project_id = p.id), 0);

UPDATE projects p SET orphan_task_code_seq = COALESCE(
  (SELECT MAX(substring(t.code from '^T([0-9]+)$')::int)
     FROM tasks t WHERE t.project_id = p.id AND t.phase_id IS NULL), 0);

UPDATE phases ph SET task_code_seq = COALESCE(
  (SELECT MAX(substring(t.code from '^T([0-9]+)$')::int)
     FROM tasks t WHERE t.phase_id = ph.id), 0);

-- 10 · INDICES NUEVOS ----------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_phases_project_code
  ON phases (project_id, code) WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_phase_code
  ON tasks (phase_id, code) WHERE phase_id IS NOT NULL AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_orphan_code
  ON tasks (project_id, code) WHERE phase_id IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_phase        ON tasks (phase_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lookup ON assignments (assignable_type, assignable_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user   ON assignments (user_id, assignable_type);

ALTER TABLE phases ALTER COLUMN status   SET NOT NULL;
ALTER TABLE phases ALTER COLUMN priority SET NOT NULL;

-- 11 · ALLOCATORS ---------------------------------------------------
-- alloc_task_code CONSERVA su argumento (project_id) y su rol (codigo
-- de tarea de primer nivel). Cambia el formato F->T y la fuente del
-- contador. Por eso import_project_tasks sigue funcionando sin tocarla.

CREATE OR REPLACE FUNCTION alloc_phase_code(p_project_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  UPDATE projects SET phase_code_seq = phase_code_seq + 1
   WHERE id = p_project_id
  RETURNING phase_code_seq - 1 INTO v_seq;   -- PRE-incremento
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;
  RETURN 'F' || v_seq;
END; $$;

CREATE OR REPLACE FUNCTION alloc_task_code(p_project_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_seq INT; v_width INT;
BEGIN
  UPDATE projects SET orphan_task_code_seq = orphan_task_code_seq + 1
   WHERE id = p_project_id
  RETURNING orphan_task_code_seq INTO v_seq;  -- POST-incremento
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;
  v_width := GREATEST(2, length(v_seq::text));  -- leccion 8A: ancho dinamico
  RETURN 'T' || lpad(v_seq::text, v_width, '0');
END; $$;

CREATE OR REPLACE FUNCTION alloc_task_code_in_phase(p_phase_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_seq INT; v_width INT;
BEGIN
  UPDATE phases SET task_code_seq = task_code_seq + 1
   WHERE id = p_phase_id
  RETURNING task_code_seq INTO v_seq;
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'La fase % no existe', p_phase_id;
  END IF;
  v_width := GREATEST(2, length(v_seq::text));
  RETURN 'T' || lpad(v_seq::text, v_width, '0');
END; $$;

CREATE OR REPLACE FUNCTION alloc_subtask_code(p_task_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_seq INT; v_width INT;
BEGIN
  UPDATE tasks SET subtask_code_seq = subtask_code_seq + 1
   WHERE id = p_task_id
  RETURNING subtask_code_seq INTO v_seq;
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'La tarea % no existe', p_task_id;
  END IF;
  v_width := GREATEST(2, length(v_seq::text));
  -- Ya NO compone el prefijo del padre: el codigo guardado es LOCAL.
  RETURN 'S' || lpad(v_seq::text, v_width, '0');
END; $$;

GRANT EXECUTE ON FUNCTION alloc_phase_code(BIGINT)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alloc_task_code(BIGINT)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alloc_task_code_in_phase(BIGINT)TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alloc_subtask_code(BIGINT)      TO anon, authenticated;

-- 12 · VERIFICACION · reconciliación de PLAN-SEMILLA §5 -------------
-- No alcanza con que el script corra. Si un numero no da, revienta.

DO $$
DECLARE r RECORD; v_n INT; v_src INT;
BEGIN
  -- fases por proyecto
  SELECT count(*) INTO v_n FROM phases WHERE project_id = 7;
  IF v_n <> 5 THEN RAISE EXCEPTION 'Fases del proyecto 7: % (esperado 5)', v_n; END IF;

  -- tareas y subtareas por fase
  FOR r IN
    SELECT ph.code,
           count(DISTINCT t.id) AS tasks,
           count(s.id)          AS subtasks
      FROM phases ph
      LEFT JOIN tasks    t ON t.phase_id = ph.id
      LEFT JOIN subtasks s ON s.task_id  = t.id
     WHERE ph.project_id = 7
     GROUP BY ph.code
  LOOP
    IF (r.code,r.tasks,r.subtasks) NOT IN
       (('F0',8,29),('F1',5,13),('F2',4,11),('F3',4,10),('F4',9,24)) THEN
      RAISE EXCEPTION 'Fase % dio %/% — no coincide con §5', r.code, r.tasks, r.subtasks;
    END IF;
  END LOOP;

  -- tareas sin fase: 5 del proyecto 7 + 2 del proyecto 5
  SELECT count(*) INTO v_n FROM tasks WHERE phase_id IS NULL AND project_id = 7;
  IF v_n <> 5 THEN RAISE EXCEPTION 'Tareas sin fase en p7: % (esperado 5)', v_n; END IF;
  SELECT count(*) INTO v_n FROM tasks WHERE phase_id IS NULL AND project_id = 5;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Tareas sin fase en p5: % (esperado 2)', v_n; END IF;

  -- totales
  SELECT count(*) INTO v_n FROM tasks;
  IF v_n <> 37 THEN RAISE EXCEPTION 'Total tasks: % (esperado 37)', v_n; END IF;
  SELECT count(*) INTO v_n FROM subtasks;
  IF v_n <> 106 THEN RAISE EXCEPTION 'Total subtasks: % (esperado 106)', v_n; END IF;

  -- ninguna fila quedo sin recodificar
  SELECT count(*) INTO v_n FROM tasks WHERE code !~ '^T[0-9]+$' OR legacy_code IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION '% tareas sin recodificar', v_n; END IF;
  SELECT count(*) INTO v_n FROM subtasks WHERE code !~ '^S[0-9]+$' OR legacy_code IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION '% subtareas sin recodificar', v_n; END IF;

  -- asignaciones: ni una perdida
  SELECT (SELECT count(*) FROM task_assignees) + (SELECT count(*) FROM subtask_assignees)
    INTO v_src;
  SELECT count(*) INTO v_n FROM assignments;
  IF v_n <> v_src THEN
    RAISE EXCEPTION 'assignments: % filas, origen % filas', v_n, v_src;
  END IF;

  -- deriva de contadores (la falla silenciosa de la 8A)
  SELECT count(*) INTO v_n FROM projects p
   WHERE p.phase_code_seq <> COALESCE(
     (SELECT MAX(substring(ph.code from '^F([0-9]+)$')::int)+1
        FROM phases ph WHERE ph.project_id=p.id), 0);
  IF v_n <> 0 THEN RAISE EXCEPTION 'phase_code_seq desviado en % proyectos', v_n; END IF;

  SELECT count(*) INTO v_n FROM phases ph
   WHERE ph.task_code_seq <> COALESCE(
     (SELECT MAX(substring(t.code from '^T([0-9]+)$')::int)
        FROM tasks t WHERE t.phase_id=ph.id), 0);
  IF v_n <> 0 THEN RAISE EXCEPTION 'task_code_seq desviado en % fases', v_n; END IF;

  SELECT count(*) INTO v_n FROM tasks t
   WHERE t.subtask_code_seq < COALESCE(
     (SELECT MAX(substring(s.code from '^S([0-9]+)$')::int)
        FROM subtasks s WHERE s.task_id=t.id), 0);
  IF v_n <> 0 THEN RAISE EXCEPTION 'subtask_code_seq por debajo del MAX en % tareas', v_n; END IF;

  -- D-5: invariante de 'completed'. Aca solo AVISA; el DROP es la 014.
  SELECT count(*) INTO v_n FROM subtasks WHERE completed IS TRUE AND status <> 'done';
  IF v_n <> 0 THEN
    RAISE WARNING 'D-5 BLOQUEADA: % subtareas con completed=true y status<>done. NO correr la 014.', v_n;
  ELSE
    RAISE NOTICE 'D-5 OK: completed es subconjunto estricto de status. La 014 puede dropearlo.';
  END IF;

  RAISE NOTICE 'RECONCILIACION OK — 5 fases / 37 tareas / 106 subtareas / % asignaciones', v_src;
END $$;

COMMIT;
