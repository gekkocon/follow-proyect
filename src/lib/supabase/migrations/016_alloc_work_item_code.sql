-- ============================================================
-- 016_alloc_work_item_code.sql · Etapa 2 · Allocator de código
-- Genera el código humano (BUG-014 / TD-007 / QRFC-004) para bugs,
-- deuda técnica y question/RFC. Un solo allocator genérico -- decisión
-- de diseño en docs/ARQUITECTURA-WORKPLAN.md línea 95 (work_items es
-- una tabla única -> un allocator, no tres).
--
-- Gate de autorización: cualquier miembro del proyecto (admin ve todo
-- sin necesitar fila en project_members; el resto sí la necesita).
-- Decisión cerrada en chat el 29 ago 2026, sesión 1K.
--
-- Mismo patrón medido y cerrado en 1G para alloc_phase_code /
-- alloc_task_code_in_phase / alloc_subtask_code (CLAUDE.md sección 8):
--   1. SECURITY INVOKER.
--   2. REVOKE EXECUTE FROM PUBLIC, anon -- por nombre.
--   3. GRANT EXECUTE TO authenticated.
--   4. Chequeo de identidad dentro del cuerpo vía
--      request.jwt.claims ->> 'email' contra public.users, lower()
--      en los dos lados.
--   5. Debe invocarse con createAuthServerClient(), nunca con
--      createServerClient() (anon, no propaga sesión).
--
-- Padding 3, ancho dinámico GREATEST(3, length(...)) -- misma lección
-- de la fase 8A que fase/tarea/subtarea, pero con base 3 en vez de 2
-- (ARQUITECTURA-WORKPLAN.md sección 4).
-- Re-ejecutable: CREATE OR REPLACE FUNCTION.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION alloc_work_item_code(
  p_project_id INTEGER,
  p_type       work_item_type
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_caller_email TEXT;
  v_user_id      INTEGER;
  v_user_role    user_role;
  v_is_member    BOOLEAN;
  v_new_seq      INTEGER;
  v_prefix       TEXT;
  v_code         TEXT;
BEGIN
  -- 1 - Identidad del llamador ------------------------------------
  v_caller_email := lower(current_setting('request.jwt.claims', true)::json ->> 'email');

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT id, role INTO v_user_id, v_user_role
  FROM public.users
  WHERE lower(email) = v_caller_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;

  -- 2 - Autorizacion: admin ve todo, resto necesita membresia -----
  IF v_user_role <> 'admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = p_project_id AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3 - Prefijo + columna de watermark segun tipo ------------------
  IF p_type = 'bug' THEN
    v_prefix := 'BUG';
    UPDATE projects SET bug_seq = bug_seq + 1
      WHERE id = p_project_id
      RETURNING bug_seq INTO v_new_seq;
  ELSIF p_type = 'debt' THEN
    v_prefix := 'TD';
    UPDATE projects SET debt_seq = debt_seq + 1
      WHERE id = p_project_id
      RETURNING debt_seq INTO v_new_seq;
  ELSIF p_type = 'question_rfc' THEN
    v_prefix := 'QRFC';
    UPDATE projects SET question_rfc_seq = question_rfc_seq + 1
      WHERE id = p_project_id
      RETURNING question_rfc_seq INTO v_new_seq;
  ELSE
    RAISE EXCEPTION 'Tipo de work item desconocido: %', p_type;
  END IF;

  IF v_new_seq IS NULL THEN
    RAISE EXCEPTION 'Proyecto % no encontrado.', p_project_id;
  END IF;

  -- 4 - Composicion del codigo, padding 3 dinamico -----------------
  v_code := v_prefix || '-' || lpad(
    v_new_seq::text,
    GREATEST(3, length(v_new_seq::text)),
    '0'
  );

  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION alloc_work_item_code(INTEGER, work_item_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION alloc_work_item_code(INTEGER, work_item_type) FROM anon;
GRANT EXECUTE ON FUNCTION alloc_work_item_code(INTEGER, work_item_type) TO authenticated;

COMMIT;
