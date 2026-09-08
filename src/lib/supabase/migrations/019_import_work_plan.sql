-- ============================================================
-- 019_import_work_plan.sql · Etapa 3, paso 4 · REGISTRO HISTÓRICO
--
-- Ya ejecutada a mano en Supabase el 8 sep 2026. Este archivo es solo el
-- registro versionado de ese DDL — no correrlo de nuevo. Mismo criterio
-- que las migraciones 014, 017 y 018: la función y el CHECK ya existen
-- en la base real, este archivo documenta el DDL real, no lo aplica.
--
-- Contenido, en el mismo orden en que corrió:
--   1. ALTER del CHECK de activity_log.entity_type, para aceptar
--      'project' además de 'phase' | 'task' | 'subtask'.
--   2. CREATE OR REPLACE FUNCTION import_work_plan(bigint, jsonb) — crea
--      fases, tareas y subtareas de un plan de trabajo completo en una
--      única transacción, reutilizando alloc_phase_code,
--      alloc_task_code_in_phase y alloc_subtask_code. Gate de rol
--      (admin o pm) y membresía (pm) dentro del cuerpo, mismo criterio
--      que el resto de las funciones con identidad de CLAUDE.md sección
--      8. Inserta una fila de resumen en activity_log
--      (entity_type='project') como última sentencia.
--   3. REVOKE/GRANT de la función — anon afuera, authenticated adentro.
-- ============================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'activity_log'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%entity_type%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE activity_log DROP CONSTRAINT %I', v_conname);
  END IF;

  EXECUTE 'ALTER TABLE activity_log
             ADD CONSTRAINT activity_log_entity_type_check
             CHECK (entity_type IN (''phase'',''task'',''subtask'',''project''))';
END $$;

CREATE OR REPLACE FUNCTION public.import_work_plan(p_project_id bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_phase JSONB;
  v_task JSONB;
  v_subtask JSONB;
  v_new_phase_id BIGINT;
  v_new_task_id BIGINT;
  v_new_subtask_id BIGINT;
  v_id_map JSONB := '{}'::jsonb;
  v_created_phases INT := 0;
  v_created_tasks INT := 0;
  v_created_subtasks INT := 0;
  v_caller_id BIGINT;
  v_user_id BIGINT;
  v_assignee TEXT;
  v_code TEXT;
  v_email TEXT;
  v_role user_role;
  v_is_member BOOLEAN;
  v_summary JSONB;
BEGIN
  v_email := lower((current_setting('request.jwt.claims', true)::json ->> 'email'));
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT id, role INTO v_caller_id, v_role FROM public.users WHERE lower(email) = v_email;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'pm') THEN
    RAISE EXCEPTION 'No autorizado para importar el plan de trabajo' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'El proyecto % no existe', p_project_id;
  END IF;

  IF v_role <> 'admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = p_project_id AND user_id = v_caller_id
    ) INTO v_is_member;
    IF NOT v_is_member THEN
      RAISE EXCEPTION 'No sos miembro de este proyecto' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR v_phase IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'phases', '[]'::jsonb))
  LOOP
    IF COALESCE(trim(v_phase->>'name'), '') = '' THEN
      RAISE EXCEPTION 'Cada fase debe tener un nombre';
    END IF;

    v_code := NULLIF(trim(COALESCE(v_phase->>'code', '')), '');
    IF v_code IS NULL THEN
      v_code := alloc_phase_code(p_project_id);
    ELSIF v_code !~ '^F[0-9]+$' THEN
      RAISE EXCEPTION 'Código de fase inválido: "%". El formato es F0, F1… sin padding. Quitá el campo "code" para que se genere solo.', v_code;
    END IF;

    INSERT INTO phases (project_id, code, name, objective, status, priority, due_date)
    VALUES (
      p_project_id,
      v_code,
      v_phase->>'name',
      NULLIF(v_phase->>'objective', ''),
      COALESCE(NULLIF(v_phase->>'status', '')::task_status, 'todo'),
      COALESCE(NULLIF(v_phase->>'priority', '')::priority_level, 'medium'),
      NULLIF(v_phase->>'due_date', '')::date
    )
    RETURNING id INTO v_new_phase_id;

    v_created_phases := v_created_phases + 1;

    FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(v_phase->'tasks', '[]'::jsonb))
    LOOP
      IF COALESCE(trim(v_task->>'title'), '') = '' THEN
        RAISE EXCEPTION 'Cada tarea debe tener un título (fase: %)', v_phase->>'name';
      END IF;

      v_code := NULLIF(trim(COALESCE(v_task->>'code', '')), '');
      IF v_code IS NULL THEN
        v_code := alloc_task_code_in_phase(v_new_phase_id);
      ELSIF v_code !~ '^T[0-9]+$' THEN
        RAISE EXCEPTION 'Código de tarea inválido: "%". Formato T01, T02… Quitá el campo "code" para que se genere solo.', v_code;
      END IF;

      INSERT INTO tasks (title, description, status, priority, project_id, phase_id, due_date, code)
      VALUES (
        v_task->>'title',
        NULLIF(v_task->>'description', ''),
        COALESCE(NULLIF(v_task->>'status', '')::task_status, 'todo'),
        COALESCE(NULLIF(v_task->>'priority', '')::priority_level, 'medium'),
        p_project_id,
        v_new_phase_id,
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
          RAISE EXCEPTION 'Código de subtarea inválido: "%". Formato S01, S02… Quitá el campo "code" para que se genere solo.', v_code;
        END IF;

        INSERT INTO subtasks (title, description, status, priority, task_id, due_date, code)
        VALUES (
          v_subtask->>'title',
          NULLIF(v_subtask->>'description', ''),
          COALESCE(NULLIF(v_subtask->>'status', '')::task_status, 'todo'),
          COALESCE(NULLIF(v_subtask->>'priority', '')::priority_level, 'medium'),
          v_new_task_id,
          NULLIF(v_subtask->>'due_date', '')::date,
          v_code
        )
        RETURNING id INTO v_new_subtask_id;

        v_created_subtasks := v_created_subtasks + 1;

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
  END LOOP;

  FOR v_phase IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'phases', '[]'::jsonb))
  LOOP
    FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(v_phase->'tasks', '[]'::jsonb))
    LOOP
      IF v_task ? 'temp_id' AND v_task ? 'dependencies' AND v_id_map ? (v_task->>'temp_id') THEN
        UPDATE tasks SET dependencies = (
          SELECT COALESCE(array_agg((v_id_map->>dep)::bigint), '{}')
          FROM jsonb_array_elements_text(v_task->'dependencies') AS dep
          WHERE v_id_map ? dep
        )
        WHERE id = (v_id_map->>(v_task->>'temp_id'))::bigint;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE projects p
     SET phase_code_seq = GREATEST(p.phase_code_seq, m.max_n)
    FROM (
      SELECT MAX((substring(code FROM '^F([0-9]+)$'))::int) AS max_n
        FROM phases
       WHERE project_id = p_project_id
         AND code ~ '^F[0-9]+$'
    ) m
   WHERE p.id = p_project_id
     AND m.max_n IS NOT NULL;

  UPDATE phases f
     SET task_code_seq = GREATEST(f.task_code_seq, m.max_n)
    FROM (
      SELECT phase_id, MAX((substring(code FROM '^T([0-9]+)$'))::int) AS max_n
        FROM tasks
       WHERE project_id = p_project_id
         AND code ~ '^T[0-9]+$'
       GROUP BY phase_id
    ) m
   WHERE f.id = m.phase_id;

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

  v_summary := jsonb_build_object(
    'phases_created', v_created_phases,
    'tasks_created', v_created_tasks,
    'subtasks_created', v_created_subtasks
  );

  INSERT INTO activity_log (entity_type, entity_id, user_id, field, old_value, new_value)
  VALUES ('project', p_project_id, v_caller_id, 'import_work_plan', NULL, v_summary::text);

  RETURN v_summary;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código repetido: ya existe una fase, tarea o subtarea con ese código en el destino. No se importó nada, la operación es atómica. Quitá el campo "code" del payload para que se genere solo. Detalle: %', SQLERRM;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_work_plan(bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_work_plan(bigint, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_work_plan(bigint, jsonb) TO authenticated;
