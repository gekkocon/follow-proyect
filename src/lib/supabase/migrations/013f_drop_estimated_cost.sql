-- ============================================================
-- 013f_drop_estimated_cost.sql · Sesión 1N · MIGRACIÓN DESTRUCTIVA
-- 30 ago 2026.
--
-- POR QUÉ EXISTE
-- estimated_cost (tasks y subtasks) se descarta por decisión tomada en
-- chat en la sesión 1N: uso mínimo, nunca se totalizó en ninguna vista
-- (deuda técnica #6 de CLAUDE.md, cerrada en esa misma sesión). El
-- código de la app ya no lo referencia en ningún punto — TypeScript,
-- Zod y la única función SQL viva que lo escribía quedaron limpios
-- antes de correr esto (commits 4b653f6 y 9840660, deploy Ready
-- confirmado en Vercel).
--
-- NO es la migración 014. La 014 sigue reservada para start_date,
-- dependencies y subtasks.completed — ninguno de esos tres se toca acá.
--
-- QUÉ HACE
--   1. Redefine import_project_tasks(BIGINT, JSONB, BIGINT) — la ÚNICA
--      función SQL viva que todavía leía/insertaba estimated_cost —
--      quitándole esas referencias. Copia exacta del cuerpo de 013e,
--      sin ningún otro cambio de lógica.
--   2. Recién después de redefinir la función, DROP COLUMN en tasks y
--      subtasks: así no hay ninguna ventana donde la función viva
--      referencie una columna que ya no existe.
--   3. Verificación por SELECT (no RAISE NOTICE): confirma que la
--      columna desapareció de las dos tablas.
--
-- QUÉ NO HACE
--   No toca update_project_tasks: su cuerpo vivo hoy es el stub
--   congelado de 013b (líneas 268-281 de esa migración), cuya primera
--   sentencia es un RAISE EXCEPTION antes de cualquier otra cosa — el
--   resto del cuerpo, con sus referencias a estimated_cost, nunca se
--   ejecuta. Confirmado leyendo 013b_repair_import_rpc.sql antes de
--   escribir esto. El archivo 011_update_project_tasks.sql en
--   /migrations es historial: su CREATE OR REPLACE fue pisado por el
--   de 013b hace tiempo, no es lo que corre hoy en la base.
--
--   No toca import_project_tasks(BIGINT, JSONB) de 2 argumentos: esa
--   sobrecarga ya no existe, se dropeó en 013g_drop_orphan_namespace.sql
--   (confirmado por grep: `DROP FUNCTION IF EXISTS
--   public.import_project_tasks(bigint, jsonb);`). Las versiones de
--   009, 010 y 013b de import_project_tasks también son historial: cada
--   una fue pisada por la siguiente vía CREATE OR REPLACE, y la firma
--   de 2 argumentos que compartían ya no existe en la base.
--
-- Idempotente: CREATE OR REPLACE y DROP COLUMN IF EXISTS. Se puede
-- correr de nuevo sin romper nada.
-- ============================================================

BEGIN;

-- 1 · import_project_tasks · SIN estimated_cost ----------------------
-- Copia literal del cuerpo de 013e_import_into_phase.sql. Único cambio:
-- se quitan `estimated_cost` de las dos listas de columnas (INSERT INTO
-- tasks / INSERT INTO subtasks) y sus dos valores correspondientes
-- (`NULLIF(v_task->>'estimated_cost', '')::numeric` /
-- `NULLIF(v_subtask->>'estimated_cost', '')::numeric`). Ninguna otra
-- línea de la lógica se tocó.

CREATE OR REPLACE FUNCTION import_project_tasks(
  p_project_id BIGINT,
  p_tasks      JSONB,
  p_phase_id   BIGINT
)
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
  v_phase_project BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;

  -- La fase destino existe y es de ESTE proyecto.
  SELECT project_id INTO v_phase_project FROM phases WHERE id = p_phase_id;
  IF v_phase_project IS NULL THEN
    RAISE EXCEPTION 'La fase de destino no existe (id %)', p_phase_id;
  END IF;
  IF v_phase_project <> p_project_id THEN
    RAISE EXCEPTION 'La fase de destino pertenece a otro proyecto';
  END IF;

  -- Pass 1: insertar tareas y subtareas, construir mapa temp_id -> id real
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    IF COALESCE(trim(v_task->>'title'), '') = '' THEN
      RAISE EXCEPTION 'Cada tarea debe tener un título';
    END IF;

    v_code := NULLIF(trim(COALESCE(v_task->>'code', '')), '');
    IF v_code IS NULL THEN
      v_code := alloc_task_code_in_phase(p_phase_id);
    ELSIF v_code !~ '^T[0-9]+$' THEN
      RAISE EXCEPTION 'Código de tarea inválido: "%". El formato cambió en la Etapa 1: ahora es T01, T02… (antes F3). Quitá el campo "code" para que se genere solo.', v_code;
    END IF;

    INSERT INTO tasks (title, description, status, priority, project_id, phase_id, start_date, due_date, code)
    VALUES (
      v_task->>'title',
      NULLIF(v_task->>'description', ''),
      COALESCE(NULLIF(v_task->>'status', '')::task_status, 'todo'),
      COALESCE(NULLIF(v_task->>'priority', '')::priority_level, 'medium'),
      p_project_id,
      p_phase_id,
      NULLIF(v_task->>'start_date', '')::date,
      NULLIF(v_task->>'due_date', '')::date,
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
        INSERT INTO assignments (assignable_type, assignable_id, user_id)
        VALUES ('task', v_new_task_id, v_user_id)
        ON CONFLICT DO NOTHING;
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
      ELSIF v_code !~ '^S[0-9]+$' THEN
        RAISE EXCEPTION 'Código de subtarea inválido: "%". El formato cambió en la Etapa 1: ahora es S01, S02… (antes F3-T08). Quitá el campo "code" para que se genere solo.', v_code;
      END IF;

      INSERT INTO subtasks (title, description, status, priority, task_id, start_date, due_date, completed, code)
      VALUES (
        v_subtask->>'title',
        NULLIF(v_subtask->>'description', ''),
        COALESCE(NULLIF(v_subtask->>'status', '')::task_status, 'todo'),
        COALESCE(NULLIF(v_subtask->>'priority', '')::priority_level, 'medium'),
        v_new_task_id,
        NULLIF(v_subtask->>'start_date', '')::date,
        NULLIF(v_subtask->>'due_date', '')::date,
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
          INSERT INTO assignments (assignable_type, assignable_id, user_id)
          VALUES ('subtask', v_new_subtask_id, v_user_id)
          ON CONFLICT DO NOTHING;
          INSERT INTO subtask_assignees (subtask_id, user_id) VALUES (v_new_subtask_id, v_user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Pass 2: resolver dependencias por temp_id. MUERE EN LA 014, igual que
  -- en la 013b/013e: dependencies está vacío en las dos tablas y se elimina.
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

  -- Pass 3 · la marca de agua que se resiembra es la DE LA FASE.
  -- projects.orphan_task_code_seq no se toca: acá no nace ninguna huérfana.
  -- Sin "+ 1": task_code_seq es POST-incremento y guarda el ÚLTIMO usado.
  UPDATE phases f
     SET task_code_seq = GREATEST(f.task_code_seq, m.max_n)
    FROM (
      SELECT MAX((substring(code FROM '^T([0-9]+)$'))::int) AS max_n
        FROM tasks
       WHERE phase_id = p_phase_id
         AND code ~ '^T[0-9]+$'
    ) m
   WHERE f.id = p_phase_id
     AND m.max_n IS NOT NULL;

  UPDATE tasks t
     SET subtask_code_seq = GREATEST(t.subtask_code_seq, m.max_n)
    FROM (
      SELECT s.task_id,
             MAX((substring(s.code FROM '^S([0-9]+)$'))::int) AS max_n
        FROM subtasks s
        JOIN tasks pt ON pt.id = s.task_id
       WHERE pt.project_id = p_project_id
         AND s.code ~ '^S[0-9]+$'
       GROUP BY s.task_id
    ) m
   WHERE t.id = m.task_id;

  RETURN jsonb_build_object(
    'tasks_created', v_created_tasks,
    'subtasks_created', v_created_subtasks
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código repetido: ya existe una tarea o subtarea con ese código en el destino. No se importó nada, la operación es atómica. Quitá el campo "code" del payload para que se genere solo. Detalle: %', SQLERRM;
END;
$$;

-- 2 · DROP COLUMN -----------------------------------------------------
-- Recién acá, después de que la función que las usaba ya quedó
-- redefinida sin referenciarlas — nunca hay una ventana donde el
-- código vivo apunte a una columna que ya no existe.

ALTER TABLE tasks    DROP COLUMN IF EXISTS estimated_cost;
ALTER TABLE subtasks DROP COLUMN IF EXISTS estimated_cost;

COMMIT;

-- 3 · VERIFICACIÓN · SELECT, no RAISE NOTICE --------------------------
-- Correr aparte, después del COMMIT. Debe devolver UNA fila con los
-- dos booleanos en `true`.

SELECT
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'estimated_cost'
  ) AS tasks_estimated_cost_dropped,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'subtasks' AND column_name = 'estimated_cost'
  ) AS subtasks_estimated_cost_dropped;
