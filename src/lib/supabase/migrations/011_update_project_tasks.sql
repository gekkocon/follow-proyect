-- ---------------------------------------------------------------------------
-- 011_update_project_tasks.sql
-- Phase 8B — Bulk patch of tasks and subtasks addressed by human-readable code.
--
-- Does NOT touch import_project_tasks, alloc_task_code or alloc_subtask_code.
-- All-or-nothing: any raised exception rolls back the whole call.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_project_tasks(
  p_project_id     BIGINT,
  p_payload        JSONB,                  -- flat array of { code, ...fields }
  p_create_missing BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item        JSONB;
  v_code        TEXT;
  v_parent_code TEXT;
  v_parent_id   BIGINT;
  v_target_id   BIGINT;
  v_seen        TEXT[] := ARRAY[]::TEXT[];
  v_suffix      INT;
  v_name        TEXT;
  v_user_id     BIGINT;

  v_updated     INT := 0;
  v_created     INT := 0;
  v_skipped     INT := 0;
BEGIN
  IF jsonb_typeof(p_payload) <> 'array' THEN
    RAISE EXCEPTION 'El payload debe ser un array plano de objetos.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    -- -----------------------------------------------------------------------
    -- Code presence, shape and duplication
    -- -----------------------------------------------------------------------
    v_code := NULLIF(trim(v_item->>'code'), '');

    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Hay un elemento sin campo "code".';
    END IF;

    IF v_code = ANY (v_seen) THEN
      RAISE EXCEPTION 'Código duplicado en el payload: %', v_code;
    END IF;
    v_seen := array_append(v_seen, v_code);

    -- -----------------------------------------------------------------------
    -- SUBTASK branch: code contains a hyphen (e.g. F3-T08)
    -- -----------------------------------------------------------------------
    IF position('-' IN v_code) > 0 THEN
      v_parent_code := split_part(v_code, '-', 1);

      SELECT id INTO v_parent_id
      FROM tasks
      WHERE project_id = p_project_id AND code = v_parent_code;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'La subtarea % referencia una tarea padre inexistente (%).',
          v_code, v_parent_code;
      END IF;

      SELECT id INTO v_target_id
      FROM subtasks
      WHERE task_id = v_parent_id AND code = v_code;

      -- Not found -------------------------------------------------------------
      IF v_target_id IS NULL THEN
        IF NOT p_create_missing THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;

        IF NULLIF(trim(v_item->>'title'), '') IS NULL THEN
          RAISE EXCEPTION 'No se puede crear la subtarea % sin "title".', v_code;
        END IF;

        INSERT INTO subtasks (task_id, code, title)
        VALUES (v_parent_id, v_code, v_item->>'title')
        RETURNING id INTO v_target_id;

        -- Watermark: never let the counter fall behind an explicit code.
        -- Suffix of F3-T08 is "T08" -> 8.
        --
        -- NO "+ 1" HERE, AND THAT ASYMMETRY WITH THE TASK BRANCH BELOW IS
        -- DELIBERATE — DO NOT UNIFY THE TWO. The two counters of migration
        -- 010 hold different things:
        --   alloc_subtask_code does
        --     UPDATE tasks SET subtask_code_seq = subtask_code_seq + 1
        --     RETURNING subtask_code_seq   -- POST-increment
        --   so tasks.subtask_code_seq holds the LAST code already used, and
        --   storing the bare suffix is exactly right: the next allocation
        --   returns suffix + 1.
        -- The task branch below stores suffix + 1 because its counter holds
        -- the NEXT FREE number instead. See the comment there.
        v_suffix := NULLIF(regexp_replace(split_part(v_code, '-', 2), '\D', '', 'g'), '')::INT;
        IF v_suffix IS NOT NULL THEN
          UPDATE tasks
          SET subtask_code_seq = GREATEST(COALESCE(subtask_code_seq, 0), v_suffix)
          WHERE id = v_parent_id;
        END IF;

        v_created := v_created + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      -- Patch: only keys present in the object are written -------------------
      UPDATE subtasks SET
        title          = CASE WHEN jsonb_exists(v_item, 'title')
                              THEN v_item->>'title' ELSE title END,
        description    = CASE WHEN jsonb_exists(v_item, 'description')
                              THEN v_item->>'description' ELSE description END,
        status         = CASE WHEN jsonb_exists(v_item, 'status')
                              THEN (v_item->>'status')::task_status ELSE status END,
        priority       = CASE WHEN jsonb_exists(v_item, 'priority')
                              THEN (v_item->>'priority')::priority_level ELSE priority END,
        start_date     = CASE WHEN jsonb_exists(v_item, 'start_date')
                              THEN NULLIF(v_item->>'start_date','')::DATE ELSE start_date END,
        due_date       = CASE WHEN jsonb_exists(v_item, 'due_date')
                              THEN NULLIF(v_item->>'due_date','')::DATE ELSE due_date END,
        estimated_cost = CASE WHEN jsonb_exists(v_item, 'estimated_cost')
                              THEN NULLIF(v_item->>'estimated_cost','')::NUMERIC
                              ELSE estimated_cost END,
        completed      = CASE WHEN jsonb_exists(v_item, 'completed')
                              THEN (v_item->>'completed')::BOOLEAN ELSE completed END
      WHERE id = v_target_id;

      -- Assignees: present key replaces the whole set; absent key is untouched.
      IF jsonb_exists(v_item, 'assignees') THEN
        DELETE FROM subtask_assignees WHERE subtask_id = v_target_id;

        FOR v_name IN SELECT jsonb_array_elements_text(v_item->'assignees')
        LOOP
          -- users.name is the real column (schema.sql: name TEXT NOT NULL).
          -- Unlike import_project_tasks, an unresolved name aborts instead of
          -- being skipped, and both sides are trimmed.
          SELECT id INTO v_user_id
          FROM users
          WHERE lower(trim(name)) = lower(trim(v_name))
          LIMIT 1;

          IF v_user_id IS NULL THEN
            RAISE EXCEPTION 'Responsable no encontrado para %: "%"', v_code, v_name;
          END IF;

          INSERT INTO subtask_assignees (subtask_id, user_id)
          VALUES (v_target_id, v_user_id)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;

    -- -----------------------------------------------------------------------
    -- TASK branch: code has no hyphen (e.g. F3)
    -- -----------------------------------------------------------------------
    ELSE
      SELECT id INTO v_target_id
      FROM tasks
      WHERE project_id = p_project_id AND code = v_code;

      IF v_target_id IS NULL THEN
        IF NOT p_create_missing THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;

        IF NULLIF(trim(v_item->>'title'), '') IS NULL THEN
          RAISE EXCEPTION 'No se puede crear la tarea % sin "title".', v_code;
        END IF;

        INSERT INTO tasks (project_id, code, title)
        VALUES (p_project_id, v_code, v_item->>'title')
        RETURNING id INTO v_target_id;

        -- Watermark: F17 -> 17, stored as 18.
        --
        -- THE "+ 1" IS LOAD-BEARING, AND THE SUBTASK BRANCH ABOVE MUST NOT
        -- COPY IT — DO NOT UNIFY THE TWO. alloc_task_code (migration 010) does
        --     UPDATE projects SET task_code_seq = task_code_seq + 1
        --     RETURNING task_code_seq - 1   -- PRE-increment
        --     RETURN 'F' || that value
        -- so projects.task_code_seq holds the NEXT FREE number, not the last
        -- used one. The backfill of migration 010 seeds it the same way:
        -- MAX(n) + 1 AS next_seq.
        -- Storing the bare 17 after creating F17 would make the next
        -- alloc_task_code hand out 'F17' again, and the insert would die on
        -- idx_tasks_project_code — in another screen, far from here.
        -- tasks.subtask_code_seq is a post-increment counter and holds the
        -- LAST used number, which is why the subtask branch stores the bare
        -- suffix. Same-looking code, different contract.
        v_suffix := NULLIF(regexp_replace(v_code, '\D', '', 'g'), '')::INT;
        IF v_suffix IS NOT NULL THEN
          UPDATE projects
          SET task_code_seq = GREATEST(COALESCE(task_code_seq, 0), v_suffix + 1)
          WHERE id = p_project_id;
        END IF;

        v_created := v_created + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      UPDATE tasks SET
        title          = CASE WHEN jsonb_exists(v_item, 'title')
                              THEN v_item->>'title' ELSE title END,
        description    = CASE WHEN jsonb_exists(v_item, 'description')
                              THEN v_item->>'description' ELSE description END,
        status         = CASE WHEN jsonb_exists(v_item, 'status')
                              THEN (v_item->>'status')::task_status ELSE status END,
        priority       = CASE WHEN jsonb_exists(v_item, 'priority')
                              THEN (v_item->>'priority')::priority_level ELSE priority END,
        start_date     = CASE WHEN jsonb_exists(v_item, 'start_date')
                              THEN NULLIF(v_item->>'start_date','')::DATE ELSE start_date END,
        due_date       = CASE WHEN jsonb_exists(v_item, 'due_date')
                              THEN NULLIF(v_item->>'due_date','')::DATE ELSE due_date END,
        estimated_cost = CASE WHEN jsonb_exists(v_item, 'estimated_cost')
                              THEN NULLIF(v_item->>'estimated_cost','')::NUMERIC
                              ELSE estimated_cost END,
        is_blocked     = CASE WHEN jsonb_exists(v_item, 'is_blocked')
                              THEN (v_item->>'is_blocked')::BOOLEAN ELSE is_blocked END,
        blocked_reason = CASE WHEN jsonb_exists(v_item, 'blocked_reason')
                              THEN v_item->>'blocked_reason' ELSE blocked_reason END
      WHERE id = v_target_id;

      IF jsonb_exists(v_item, 'assignees') THEN
        DELETE FROM task_assignees WHERE task_id = v_target_id;

        FOR v_name IN SELECT jsonb_array_elements_text(v_item->'assignees')
        LOOP
          SELECT id INTO v_user_id
          FROM users
          WHERE lower(trim(name)) = lower(trim(v_name))
          LIMIT 1;

          IF v_user_id IS NULL THEN
            RAISE EXCEPTION 'Responsable no encontrado para %: "%"', v_code, v_name;
          END IF;

          INSERT INTO task_assignees (task_id, user_id)
          VALUES (v_target_id, v_user_id)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'created', v_created,
    'skipped', v_skipped
  );
END;
$$;
-- The client uses the anon key (permissive RLS in this app, see schema.sql),
-- so the function must be executable by that role. Declared explicitly instead
-- of relying on the PUBLIC default, same as migrations 009 and 010.
GRANT EXECUTE ON FUNCTION update_project_tasks(BIGINT, JSONB, BOOLEAN) TO anon, authenticated;
