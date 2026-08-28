-- ============================================================
-- 013e_import_into_phase.sql · Etapa 1 · paso 1D-a · MIGRACIÓN ADITIVA
--
-- POR QUÉ EXISTE
-- El invariante de 1D es que toda tarea vive en una fase.
-- import_project_tasks crea tareas SIN fase por diseño (D-7) y es una de las
-- dos fábricas de huérfanas del sistema. Esta migración agrega la sobrecarga
-- que importa DENTRO de una fase. La otra fábrica, el alta manual, la cierra
-- la UI en el paso 6.
--
-- QUÉ HACE
--   1. import_project_tasks(BIGINT, JSONB, BIGINT) — fase destino OBLIGATORIA.
--   2. Pass 3 resiembra phases.task_code_seq en vez de
--      projects.orphan_task_code_seq. Sin este cambio, un payload con código
--      explícito deja el contador de la fase atrasado y las siguientes altas
--      manuales chocan contra idx_tasks_phase_code con un 23505 crudo,
--      quemando un código por intento hasta curarse solas.
--   3. Traduce unique_violation a un mensaje en castellano.
--
-- QUÉ NO HACE
--   - No toca la sobrecarga de 2 argumentos ni sus GRANT. Sigue viva y sigue
--     creando huérfanas: se dropea en 1D-b, cuando el código ya no la llame.
--   - No agrega chequeo de rol en el cuerpo. Decisión D-39: 1D hereda las
--     deudas 17, 24 y 25. El REVOKE de anon no es un gate: es no regresar.
--   - Ninguna columna se borra. Los DROP siguen siendo la 014.
--
-- POR QUÉ SIN DEFAULT
-- Con "p_phase_id BIGINT DEFAULT NULL" la llamada de dos argumentos matchea
-- las dos funciones y Postgres responde "function is not unique". PostgREST
-- resuelve por el conjunto de nombres del body, así que obligatorio funciona.
--
-- REQUIERE createAuthServerClient EN EL LLAMADOR. La sección 3 revoca anon.
-- Con createServerClient (anon key) esto devuelve 42501.
--
-- Idempotente: solo CREATE OR REPLACE, REVOKE y GRANT. Se puede correr de nuevo.
-- ============================================================

BEGIN;

-- 0 · GUARD ---------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'import_project_tasks'
                    AND p.pronargs = 2) THEN
    RAISE EXCEPTION 'No existe import_project_tasks(bigint, jsonb). Correr la 013b primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'phases'
                    AND column_name = 'task_code_seq') THEN
    RAISE EXCEPTION 'Falta phases.task_code_seq: la 013 no está aplicada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'alloc_task_code_in_phase') THEN
    RAISE EXCEPTION 'Falta alloc_task_code_in_phase: la 013 no está aplicada.';
  END IF;
END $$;

-- 1 · import_project_tasks · SOBRECARGA CON FASE --------------------
--
-- Copia literal del cuerpo de la 013b con cuatro diferencias, y ninguna otra:
--   a) guarda de pertenencia de la fase, calcada de moveTaskToPhase (C-1);
--   b) alloc_task_code_in_phase(p_phase_id) en vez de
--      alloc_task_code(p_project_id);
--   c) phase_id en el INSERT de tasks;
--   d) Pass 3 sobre phases.task_code_seq, acotado a la fase destino.
-- El doble escribir en assignments + task_assignees se mantiene: la UI todavía
-- lee las tablas viejas hasta la 014. Pass 2 se mantiene tal cual y muere
-- en la 014 junto con dependencies.

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

  -- (a) La fase destino existe y es de ESTE proyecto.
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
      v_code := alloc_task_code_in_phase(p_phase_id);   -- (b)
    ELSIF v_code !~ '^T[0-9]+$' THEN
      RAISE EXCEPTION 'Código de tarea inválido: "%". El formato cambió en la Etapa 1: ahora es T01, T02… (antes F3). Quitá el campo "code" para que se genere solo.', v_code;
    END IF;

    INSERT INTO tasks (title, description, status, priority, project_id, phase_id, start_date, due_date, estimated_cost, code)  -- (c)
    VALUES (
      v_task->>'title',
      NULLIF(v_task->>'description', ''),
      COALESCE(NULLIF(v_task->>'status', '')::task_status, 'todo'),
      COALESCE(NULLIF(v_task->>'priority', '')::priority_level, 'medium'),
      p_project_id,
      p_phase_id,
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
  -- en la 013b: dependencies está vacío en las dos tablas y se elimina.
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

  -- Pass 3 · (d) La marca de agua que se resiembra es la DE LA FASE.
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

-- 2 · PERMISOS ------------------------------------------------------
-- Supabase otorga EXECUTE a anon NOMINALMENTE vía ALTER DEFAULT PRIVILEGES:
-- no otorgarlo no alcanza, hay que revocarlo POR NOMBRE. El REVOKE a PUBLIC
-- no toca un grant nominal, así que van los dos. Ver CLAUDE.md §8.

REVOKE EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB, BIGINT) FROM anon;
GRANT  EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB, BIGINT) TO authenticated;

COMMIT;