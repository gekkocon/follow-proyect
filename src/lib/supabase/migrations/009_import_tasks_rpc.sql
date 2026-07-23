-- Fase 7 — Importación masiva de tareas/subtareas
-- Inserta tareas y subtareas de un proyecto en una sola transacción:
-- si cualquier inserción falla, toda la función se revierte (todo-o-nada).
--
-- p_tasks shape (JSONB array), campos opcionales entre []:
-- [
--   {
--     "temp_id": "t1",                 -- [opcional] id local para resolver dependencias
--     "title": "...",
--     "description": "...",            -- []
--     "status": "todo",                -- enum task_status, default 'todo'
--     "priority": "medium",            -- enum priority_level, default 'medium'
--     "start_date": "2026-01-01",      -- [] YYYY-MM-DD
--     "due_date": "2026-01-10",        -- []
--     "estimated_cost": 1000.5,        -- []
--     "assignee_names": ["Ana Pérez"], -- [] nombres a resolver contra users.name
--     "dependencies": ["t0"],          -- [] temp_ids de otras tareas/subtareas del mismo import
--     "subtasks": [ { ...mismos campos, sin "subtasks" anidado... } ]
--   }
-- ]

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

    INSERT INTO tasks (title, description, status, priority, project_id, start_date, due_date, estimated_cost)
    VALUES (
      v_task->>'title',
      NULLIF(v_task->>'description', ''),
      COALESCE(NULLIF(v_task->>'status', '')::task_status, 'todo'),
      COALESCE(NULLIF(v_task->>'priority', '')::priority_level, 'medium'),
      p_project_id,
      NULLIF(v_task->>'start_date', '')::date,
      NULLIF(v_task->>'due_date', '')::date,
      NULLIF(v_task->>'estimated_cost', '')::numeric
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

      INSERT INTO subtasks (title, description, status, priority, task_id, start_date, due_date, estimated_cost, completed)
      VALUES (
        v_subtask->>'title',
        NULLIF(v_subtask->>'description', ''),
        COALESCE(NULLIF(v_subtask->>'status', '')::task_status, 'todo'),
        COALESCE(NULLIF(v_subtask->>'priority', '')::priority_level, 'medium'),
        v_new_task_id,
        NULLIF(v_subtask->>'start_date', '')::date,
        NULLIF(v_subtask->>'due_date', '')::date,
        NULLIF(v_subtask->>'estimated_cost', '')::numeric,
        COALESCE(NULLIF(v_subtask->>'status', ''), 'todo') = 'done'
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

  RETURN jsonb_build_object(
    'tasks_created', v_created_tasks,
    'subtasks_created', v_created_subtasks
  );
END;
$$;

-- El cliente usa la clave anon (RLS permisiva en esta app, ver schema.sql),
-- así que la función debe ser ejecutable por ese rol.
GRANT EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB) TO anon, authenticated;
