-- ============================================================
-- 013b_repair_import_rpc.sql · Etapa 1 · MIGRACIÓN ADITIVA · URGENTE
--
-- POR QUÉ EXISTE
-- La 013 renombró projects.task_code_seq -> phase_code_seq. Las dos RPC
-- masivas escriben esa columna en su bloque de watermarks, así que desde
-- que corrió la 013 ambas revientan en runtime: el botón Importar está
-- roto en producción. Esta migración lo repara.
--
-- QUÉ HACE
--   1. import_project_tasks  -> reparada. Sigue siendo el ancla.
--   2. update_project_tasks  -> CONGELADA con excepción explicativa.
--      Su direccionamiento por guion (F3-T08) murió con los códigos
--      locales: 'S01' no identifica una subtarea, identifica 106.
--      Se rehabilita como update_work_plan en la Etapa 3.
--
-- Ninguna columna se borra acá. Los DROP siguen siendo la 014.
-- Idempotente: solo CREATE OR REPLACE FUNCTION. Se puede correr de nuevo.
-- ============================================================

BEGIN;

-- 0 · GUARD ---------------------------------------------------------
-- Sin la 013 aplicada, esta migración no tiene sentido y dejaría las
-- funciones apuntando a columnas que no existen.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='projects'
                    AND column_name='phase_code_seq') THEN
    RAISE EXCEPTION 'La 013 no está aplicada (projects.phase_code_seq no existe). Correr la 013 primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='projects'
                    AND column_name='orphan_task_code_seq') THEN
    RAISE EXCEPTION 'La 013 no está aplicada (projects.orphan_task_code_seq no existe).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='assignments') THEN
    RAISE EXCEPTION 'La 013 no está aplicada (falta la tabla assignments).';
  END IF;
END $$;

-- 1 · import_project_tasks · REPARADA -------------------------------
--
-- Diferencias contra la versión de la 010, todas forzadas por la 013:
--
--   a) Los códigos explícitos del payload ahora se VALIDAN. El formato
--      cambió de F3 / F3-T08 a T01 / S01. Un payload viejo entraría
--      creando basura silenciosa; mejor que falle con un mensaje claro.
--   b) Los asignados se escriben en assignments Y en las tablas viejas.
--      La app todavía lee task_assignees/subtask_assignees hasta que se
--      pushee la refactorización de los 10 archivos; sin el doble
--      escribir, lo importado quedaría invisible en la UI. La 014 saca
--      las escrituras viejas junto con las tablas.
--   c) Pass 3 apunta a projects.orphan_task_code_seq (POST-incremento,
--      SIN "+ 1") en vez de projects.task_code_seq (PRE-incremento, con
--      "+ 1"). Los contratos son distintos: ver los comentarios de la
--      011, que documentan la asimetría.
--   d) Los regex de Pass 3 pasan de '^F([0-9]+)$' y '-T([0-9]+)$' a
--      '^T([0-9]+)$' y '^S([0-9]+)$'. Con los viejos no matcheaban nada
--      y el watermark quedaba sin actualizar — falla silenciosa.
--
-- Las tareas importadas se crean SIN fase (phase_id NULL), que es la
-- decisión D-7. Importar directo a una fase es import_work_plan, Etapa 3.

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
    ELSIF v_code !~ '^T[0-9]+$' THEN
      RAISE EXCEPTION 'Código de tarea inválido: "%". El formato cambió en la Etapa 1: ahora es T01, T02… (antes F3). Quitá el campo "code" para que se genere solo.', v_code;
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
        -- Destino nuevo
        INSERT INTO assignments (assignable_type, assignable_id, user_id)
        VALUES ('task', v_new_task_id, v_user_id)
        ON CONFLICT DO NOTHING;
        -- Destino viejo, mientras la UI siga leyendo de acá. Sale en la 014.
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

  -- Pass 2: resolver dependencias por temp_id, ya que ahora todos los ids existen
  --
  -- ESTE PASS MUERE EN LA 014. dependencies está 100 % vacío en las dos
  -- tablas y se elimina; cuando eso pase, este bloque entero y el uso de
  -- temp_id quedan sin objeto. No adaptarlo: borrarlo.
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
  --
  -- SIN "+ 1": orphan_task_code_seq es POST-incremento y guarda el
  -- ÚLTIMO usado, igual que tasks.subtask_code_seq. El "+ 1" de la
  -- versión vieja pertenecía a projects.task_code_seq, que era
  -- PRE-incremento y ya no existe.
  UPDATE projects p
     SET orphan_task_code_seq = GREATEST(p.orphan_task_code_seq, m.max_n)
    FROM (
      SELECT MAX((substring(code FROM '^T([0-9]+)$'))::int) AS max_n
        FROM tasks
       WHERE project_id = p_project_id
         AND phase_id IS NULL
         AND code ~ '^T[0-9]+$'
    ) m
   WHERE p.id = p_project_id
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
END;
$$;

GRANT EXECUTE ON FUNCTION import_project_tasks(BIGINT, JSONB) TO anon, authenticated;

-- 2 · update_project_tasks · CONGELADA ------------------------------
--
-- Se conserva la firma exacta para que la llamada .rpc() del cliente no
-- falle por función inexistente: devuelve el error como string, que es
-- justamente lo que el server action muestra al usuario.
--
-- Por qué no se repara acá: la función direcciona subtareas por el guion
-- del código compuesto (F3-T08 -> padre F3). Con códigos locales no hay
-- guion, y 'S01' no es único dentro del proyecto: hay 106. Repararla es
-- rediseñar su esquema de direccionamiento, no parchearla.
-- Reemplazo previsto: update_work_plan, Etapa 3 (ARQUITECTURA §8).

CREATE OR REPLACE FUNCTION update_project_tasks(
  p_project_id     BIGINT,
  p_payload        JSONB,
  p_create_missing BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'El patch masivo está deshabilitado desde la migración a fases (Etapa 1). Direccionaba por códigos del tipo F3-T08, que ya no existen. Se rehabilita como update_work_plan en la Etapa 3. Mientras tanto, usá Importar para crear o la edición inline para modificar.';
END;
$$;

GRANT EXECUTE ON FUNCTION update_project_tasks(BIGINT, JSONB, BOOLEAN) TO anon, authenticated;

-- 3 · VERIFICACIÓN · SMOKE TEST REVERSIBLE --------------------------
--
-- La versión anterior de este bloque usaba pg_get_functiondef() sobre
-- pg_proc filtrando por nspname='public'. Dos errores:
--
--   1. Postgres evalúa el qual de la función en el scan de pg_proc,
--      ANTES del join con pg_namespace, así que pg_get_functiondef()
--      terminaba llamándose sobre agregados de pg_catalog y reventaba
--      con 42809 "array_agg is an aggregate function".
--   2. La lógica era falsa igual: buscaba task_code_seq excluyendo
--      subtask_code_seq, pero phases.task_code_seq EXISTE y es legítima
--      — alloc_task_code_in_phase la escribe. Falso positivo garantizado.
--
-- El reemplazo ejecuta las funciones de verdad dentro de un sub-bloque
-- con EXCEPTION, que en plpgsql establece un savepoint implícito: todo
-- lo que escriba se revierte al salir. Las variables plpgsql NO son
-- transaccionales, así que el diagnóstico sobrevive al rollback.
--
-- Esto verifica lo que el análisis estático no podía: que Pass 3 corra.

DO $$
DECLARE
  v_project_id  BIGINT;
  v_seq_before  INT;
  v_seq_after   INT;
  v_task_code   TEXT;
  v_sub_code    TEXT;
  v_diag        TEXT := NULL;
  v_frozen      BOOLEAN := FALSE;
BEGIN
  SELECT id, orphan_task_code_seq
    INTO v_project_id, v_seq_before
    FROM projects ORDER BY id LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'No hay proyectos en la base: no se puede correr el smoke test';
  END IF;

  -- --- Smoke test 1: import_project_tasks -------------------------
  BEGIN
    PERFORM import_project_tasks(
      v_project_id,
      '[{"title":"__smoke_013b__","subtasks":[{"title":"__smoke_013b_sub__"}]}]'::jsonb
    );

    SELECT t.code INTO v_task_code
      FROM tasks t
     WHERE t.project_id = v_project_id AND t.title = '__smoke_013b__'
     ORDER BY t.id DESC LIMIT 1;

    SELECT s.code INTO v_sub_code
      FROM subtasks s JOIN tasks t ON t.id = s.task_id
     WHERE t.project_id = v_project_id AND s.title = '__smoke_013b_sub__'
     ORDER BY s.id DESC LIMIT 1;

    SELECT orphan_task_code_seq INTO v_seq_after
      FROM projects WHERE id = v_project_id;

    IF v_task_code IS NULL OR v_task_code !~ '^T[0-9]+$' THEN
      v_diag := 'código de tarea inválido: ' || COALESCE(v_task_code, '(null)');
    ELSIF v_sub_code IS NULL OR v_sub_code !~ '^S[0-9]+$' THEN
      v_diag := 'código de subtarea inválido: ' || COALESCE(v_sub_code, '(null)');
    ELSIF v_seq_after <= v_seq_before THEN
      v_diag := 'orphan_task_code_seq no avanzó (' || v_seq_before || ' -> '
                || v_seq_after || '): Pass 3 no está corriendo';
    END IF;

    -- Salida forzada: revierte todo lo que insertó el smoke test.
    RAISE EXCEPTION 'SMOKE_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'SMOKE_ROLLBACK' THEN
        RAISE EXCEPTION 'import_project_tasks SIGUE ROTA: %', SQLERRM;
      END IF;
  END;

  IF v_diag IS NOT NULL THEN
    RAISE EXCEPTION 'import_project_tasks corre pero mal — %', v_diag;
  END IF;

  RAISE NOTICE 'import_project_tasks OK — % + % creados y revertidos, watermark % -> %',
    v_task_code, v_sub_code, v_seq_before, v_seq_after;

  -- --- Smoke test 2: update_project_tasks congelada ---------------
  BEGIN
    PERFORM update_project_tasks(v_project_id, '[]'::jsonb, FALSE);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%deshabilitado%' THEN
        v_frozen := TRUE;
      ELSE
        RAISE EXCEPTION 'update_project_tasks lanzó algo inesperado: %', SQLERRM;
      END IF;
  END;

  IF NOT v_frozen THEN
    RAISE EXCEPTION 'update_project_tasks NO quedó congelada: no lanzó excepción';
  END IF;

  RAISE NOTICE 'update_project_tasks congelada correctamente';
  RAISE NOTICE '013b OK. Igual probá el botón Importar en la app antes de darla por cerrada.';
END $$;

COMMIT;
