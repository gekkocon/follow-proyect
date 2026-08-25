-- Fase 8A — Códigos humanos legibles en tareas y subtareas
--
-- Introduce `code` como llave de identidad legible:
--   tasks     -> F0, F1, F2 …
--   subtasks  -> F0-T01, F0-T02 … (prefijo = code de la tarea padre)
--
-- Reglas de negocio que implementa este archivo:
--   1. El código es IDENTIDAD, no posición. No se renumera al reordenar
--      ni al borrar.
--   2. Al borrar, el código queda QUEMADO y no se reutiliza.
--   3. Único por proyecto, no global.
--
-- Sobre la regla 2: no alcanza con calcular MAX(code) + 1 sobre las filas
-- vivas, porque al borrar la última fila el siguiente alta reusaría su
-- código. Hace falta una marca de agua que sobreviva al borrado. Por eso
-- se agregan los contadores `projects.task_code_seq` y
-- `tasks.subtask_code_seq`: sólo suben, nunca bajan.
--
-- Sobre la regla 3: subtasks no tiene project_id y Postgres no puede
-- indexar entre tablas, así que el índice único es (task_id, code).
-- Como el código de subtarea lleva embebido el de su tarea padre, la
-- unicidad dentro del padre implica unicidad dentro del proyecto.
--
-- Ejecutar completo y en orden en el editor SQL de Supabase.
-- Es idempotente: se puede volver a correr sin efectos secundarios.

-- ============================================================
-- 1. COLUMNAS
-- ============================================================

ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS code TEXT;

-- Marcas de agua (burn counters). Nunca decrecen.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS task_code_seq    INT NOT NULL DEFAULT 0;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS subtask_code_seq INT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. BACKFILL — tareas de primer nivel: F0, F1, F2 …
--    Orden actual de la tarea dentro del proyecto (created_at, id).
-- ============================================================

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) - 1 AS n
  FROM tasks
  WHERE code IS NULL
    AND project_id IS NOT NULL
)
UPDATE tasks t
   SET code = 'F' || numbered.n
  FROM numbered
 WHERE t.id = numbered.id;

-- ============================================================
-- 3. BACKFILL — subtareas: F0-T01, F0-T02 … dentro de su task padre
--
--    Ancho de padding DINÁMICO por tarea padre. lpad TRUNCA por la
--    derecha cuando el texto es más largo que el ancho pedido:
--    lpad('100', 2, '0') devuelve '10'. Con el ancho fijo en 2, una
--    tarea con más de 99 subtareas colapsaba 100..109 en '10' y hacía
--    fallar el CREATE UNIQUE INDEX de la sección 5.
--
--    Acá el ancho sale de COUNT(*) OVER (PARTITION BY s.task_id) y no
--    del contador acumulado, al revés que alloc_subtask_code: este es
--    un backfill de una sola pasada, sin borrados de por medio, así que
--    la cantidad de filas y la numeración coinciden. Como `n` va de 1 a
--    `total` dentro de cada partición, length(n) <= length(total) <=
--    ancho, y lpad no tiene nada que truncar.
-- ============================================================

WITH numbered AS (
  SELECT
    s.id,
    t.code AS parent_code,
    row_number() OVER (PARTITION BY s.task_id ORDER BY s.created_at, s.id) AS n,
    COUNT(*)   OVER (PARTITION BY s.task_id)                               AS total
  FROM subtasks s
  JOIN tasks t ON t.id = s.task_id
  WHERE s.code IS NULL
    AND t.code IS NOT NULL
)
UPDATE subtasks s
   SET code = numbered.parent_code
              || '-T'
              || lpad(numbered.n::text, GREATEST(2, length(numbered.total::text)), '0')
  FROM numbered
 WHERE s.id = numbered.id;

-- ============================================================
-- 4. SEMILLA DE LOS CONTADORES
--    Se dejan por encima del código más alto ya existente, de modo que
--    la próxima autogeneración nunca colisione con lo backfilleado.
-- ============================================================

UPDATE projects p
   SET task_code_seq = GREATEST(p.task_code_seq, m.next_seq)
  FROM (
    SELECT
      project_id,
      MAX((substring(code FROM '^F([0-9]+)$'))::int) + 1 AS next_seq
    FROM tasks
    WHERE project_id IS NOT NULL
      AND code ~ '^F[0-9]+$'
    GROUP BY project_id
  ) m
 WHERE p.id = m.project_id;

UPDATE tasks t
   SET subtask_code_seq = GREATEST(t.subtask_code_seq, m.max_n)
  FROM (
    SELECT
      task_id,
      MAX((substring(code FROM '-T([0-9]+)$'))::int) AS max_n
    FROM subtasks
    WHERE code ~ '-T[0-9]+$'
    GROUP BY task_id
  ) m
 WHERE t.id = m.task_id;

-- ============================================================
-- 5. ÍNDICES ÚNICOS
--    Parciales: las filas sin código (p. ej. una tarea huérfana sin
--    proyecto) no participan de la restricción.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_code
  ON tasks (project_id, code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subtasks_task_code
  ON subtasks (task_id, code)
  WHERE code IS NOT NULL;

-- ============================================================
-- 6. ALLOCATORS
--    Reservan el próximo código y avanzan la marca de agua en una sola
--    sentencia. El UPDATE ... RETURNING toma un lock de fila, así que
--    dos altas concurrentes se serializan y no pueden obtener el mismo
--    número.
-- ============================================================

CREATE OR REPLACE FUNCTION alloc_task_code(p_project_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
BEGIN
  UPDATE projects
     SET task_code_seq = task_code_seq + 1
   WHERE id = p_project_id
  RETURNING task_code_seq - 1 INTO v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;

  RETURN 'F' || v_seq;
END;
$$;

CREATE OR REPLACE FUNCTION alloc_subtask_code(p_task_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_code TEXT;
  v_project_id  BIGINT;
  v_seq         INT;
  v_width       INT;
BEGIN
  SELECT code, project_id
    INTO v_parent_code, v_project_id
    FROM tasks
   WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea % no existe', p_task_id;
  END IF;

  -- Self-heal: una tarea creada antes de esta migración puede no tener
  -- código todavía. Se le asigna uno antes de derivar el de la subtarea.
  IF v_parent_code IS NULL AND v_project_id IS NOT NULL THEN
    v_parent_code := alloc_task_code(v_project_id);
    UPDATE tasks SET code = v_parent_code WHERE id = p_task_id;
  END IF;

  UPDATE tasks
     SET subtask_code_seq = subtask_code_seq + 1
   WHERE id = p_task_id
  RETURNING subtask_code_seq INTO v_seq;

  -- Ancho de padding DINÁMICO. lpad TRUNCA por la derecha cuando el texto
  -- es más largo que el ancho pedido: lpad('100', 2, '0') devuelve '10'.
  -- Con el ancho fijo en 2, las secuencias 100..109 colapsaban todas en
  -- '10' y chocaban contra idx_subtasks_task_code.
  --
  -- El ancho se deriva de v_seq, NO de un COUNT(*) de subtareas vivas.
  -- Los códigos se queman al borrar, así que el contador y la cantidad de
  -- filas vivas divergen: una tarea que llegó a 118 subtareas y se quedó
  -- con 18 tendría count=18 (ancho 2) y v_seq=119, y volvería a truncar.
  -- length(v_seq::text) es exactamente la cantidad de dígitos, así que
  -- GREATEST(2, …) no puede truncar nunca.
  v_width := GREATEST(2, length(v_seq::text));

  -- 'F?' sólo aplica a tareas huérfanas (project_id NULL), que no pueden
  -- derivar un código de proyecto. El índice único es por task_id, así
  -- que sigue sin haber colisión posible.
  RETURN COALESCE(v_parent_code, 'F?') || '-T' || lpad(v_seq::text, v_width, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION alloc_task_code(BIGINT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alloc_subtask_code(BIGINT) TO anon, authenticated;

-- ============================================================
-- 7. IMPORTACIÓN MASIVA — reemplazo de import_project_tasks
--    Cambio respecto de la migración 009: se acepta un campo opcional
--    "code" en cada tarea y subtarea del JSON. Si viene, se respeta;
--    si no viene, se autogenera con los allocators de arriba.
--    Todo lo demás (dos pasadas, mapa temp_id, dependencias, todo-o-nada)
--    queda igual.
-- ============================================================

CREATE OR REPLACE FUNCTION import_project_tasks(p_project_id BIGINT, p_tasks JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_task JSONB;
  v_subtask JSONB;
  v_new_task_id BIGINT;
  v_new_subtask_id BIGINT;
  v_id_map JSONB := '{}'::jsonb;
  v_created_tasks INT := 0;
  v_created_subtasks INT := 0;
  v_user_id BIGINT;
  v_assignee TEXT;
  v_code TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;

  -- Pass 1: insertar tareas y subtareas, construir mapa temp_id -> id real
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    IF COALESCE(trim(v_task->>'title'), '') = '' THEN
      RAISE EXCEPTION 'Cada tarea debe tener un título';
    END IF;

    -- Código explícito del payload, o autogenerado.
    v_code := NULLIF(trim(COALESCE(v_task->>'code', '')), '');
    IF v_code IS NULL THEN
      v_code := alloc_task_code(p_project_id);
    END IF;

    INSERT INTO tasks (title, description, status, priority, project_id, start_date, due_date, estimated_cost, code)
    VALUES (
      v_task->>'title',
      NULLIF(v_task->>'description', ''),
      COALESCE(NULLIF(v_task->>'status', '')::task_status, 'todo'),
      COALESCE(NULLIF(v_task->>'priority', '')::priority_level, 'medium'),
      p_project_id,
      NULLIF(v_task->>'start_date', '')::date,
      NULLIF(v_task->>'due_date', '')::date,
      NULLIF(v_task->>'estimated_cost', '')::numeric,
      v_code
    )
    RETURNING id INTO v_new_task_id;

    v_created_tasks := v_created_tasks + 1;

    IF v_task ? 'temp_id' THEN
      v_id_map := jsonb_set(v_id_map, ARRAY[v_task->>'temp_id'], to_jsonb(v_new_task_id));
    END IF;

    FOR v_assignee IN SELECT * FROM jsonb_array_elements_text(COALESCE(v_task->'assignee_names', '[]'::jsonb))
    LOOP
      SELECT id INTO v_user_id FROM users WHERE lower(name) = lower(v_assignee) LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        INSERT INTO task_assignees (task_id, user_id) VALUES (v_new_task_id, v_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    FOR v_subtask IN SELECT * FROM jsonb_array_elements(COALESCE(v_task->'subtasks', '[]'::jsonb))
    LOOP
      IF COALESCE(trim(v_subtask->>'title'), '') = '' THEN
        RAISE EXCEPTION 'Cada subtarea debe tener un título (tarea padre: %)', v_task->>'title';
      END IF;

      v_code := NULLIF(trim(COALESCE(v_subtask->>'code', '')), '');
      IF v_code IS NULL THEN
        v_code := alloc_subtask_code(v_new_task_id);
      END IF;

      INSERT INTO subtasks (title, description, status, priority, task_id, start_date, due_date, estimated_cost, completed, code)
      VALUES (
        v_subtask->>'title',
        NULLIF(v_subtask->>'description', ''),
        COALESCE(NULLIF(v_subtask->>'status', '')::task_status, 'todo'),
        COALESCE(NULLIF(v_subtask->>'priority', '')::priority_level, 'medium'),
        v_new_task_id,
        NULLIF(v_subtask->>'start_date', '')::date,
        NULLIF(v_subtask->>'due_date', '')::date,
        NULLIF(v_subtask->>'estimated_cost', '')::numeric,
        COALESCE(NULLIF(v_subtask->>'status', ''), 'todo') = 'done',
        v_code
      )
      RETURNING id INTO v_new_subtask_id;

      v_created_subtasks := v_created_subtasks + 1;

      IF v_subtask ? 'temp_id' THEN
        v_id_map := jsonb_set(v_id_map, ARRAY[v_subtask->>'temp_id'], to_jsonb(v_new_subtask_id));
      END IF;

      FOR v_assignee IN SELECT * FROM jsonb_array_elements_text(COALESCE(v_subtask->'assignee_names', '[]'::jsonb))
      LOOP
        SELECT id INTO v_user_id FROM users WHERE lower(name) = lower(v_assignee) LIMIT 1;
        IF v_user_id IS NOT NULL THEN
          INSERT INTO subtask_assignees (subtask_id, user_id) VALUES (v_new_subtask_id, v_user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Pass 2: resolver dependencias por temp_id, ya que ahora todos los ids existen
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    IF v_task ? 'temp_id' AND v_task ? 'dependencies' AND v_id_map ? (v_task->>'temp_id') THEN
      UPDATE tasks SET dependencies = (
        SELECT COALESCE(array_agg((v_id_map->>dep)::bigint), '{}')
        FROM jsonb_array_elements_text(v_task->'dependencies') AS dep
        WHERE v_id_map ? dep
      )
      WHERE id = (v_id_map->>(v_task->>'temp_id'))::bigint;
    END IF;

    FOR v_subtask IN SELECT * FROM jsonb_array_elements(COALESCE(v_task->'subtasks', '[]'::jsonb))
    LOOP
      IF v_subtask ? 'temp_id' AND v_subtask ? 'dependencies' AND v_id_map ? (v_subtask->>'temp_id') THEN
        UPDATE subtasks SET dependencies = (
          SELECT COALESCE(array_agg((v_id_map->>dep)::bigint), '{}')
          FROM jsonb_array_elements_text(v_subtask->'dependencies') AS dep
          WHERE v_id_map ? dep
        )
        WHERE id = (v_id_map->>(v_subtask->>'temp_id'))::bigint;
      END IF;
    END LOOP;
  END LOOP;

  -- Pass 3: dejar las marcas de agua por encima de cualquier código
  -- explícito que haya venido en el payload, para que las próximas
  -- autogeneraciones no colisionen con lo importado.
  UPDATE projects p
     SET task_code_seq = GREATEST(p.task_code_seq, m.next_seq)
    FROM (
      SELECT MAX((substring(code FROM '^F([0-9]+)$'))::int) + 1 AS next_seq
        FROM tasks
       WHERE project_id = p_project_id
         AND code ~ '^F[0-9]+$'
    ) m
   WHERE p.id = p_project_id
     AND m.next_seq IS NOT NULL;

  UPDATE tasks t
     SET subtask_code_seq = GREATEST(t.subtask_code_seq, m.max_n)
    FROM (
      SELECT s.task_id,
             MAX((substring(s.code FROM '-T([0-9]+)$'))::int) AS max_n
        FROM subtasks s
        JOIN tasks pt ON pt.id = s.task_id
       WHERE pt.project_id = p_project_id
         AND s.code ~ '-T[0-9]+$'
       GROUP BY s.task_id
    ) m
   WHERE t.id = m.task_id;

  RETURN jsonb_build_object(
    'tasks_created', v_created_tasks,
    'subtasks_created', v_created_subtasks
  );
END;
$$;

-- El cliente usa la clave anon (RLS permisiva en esta app, ver schema.sql),
-- así que la función debe ser ejecutable por ese rol.
GRANT EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB) TO anon, authenticated;
