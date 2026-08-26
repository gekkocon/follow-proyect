-- ============================================================
-- 013c_fix_rls_new_tables.sql · Etapa 1 · MIGRACIÓN ADITIVA · URGENTE
--
-- POR QUÉ EXISTE
-- La 013 creó `phases` y `assignments` con RLS HABILITADA y CERO políticas.
-- En Postgres eso no es "permitir todo": es denegar todo a cualquier rol que
-- no sea el dueño. Los GRANT están completos (SELECT/INSERT/UPDATE/DELETE
-- para anon y authenticated), así que la capa de privilegios pasa y la de RLS
-- filtra después — sin error, con conjunto vacío.
--
-- El editor SQL de Supabase corre como superusuario y bypassea RLS, así que
-- todas las verificaciones de la 013 y la 013b dieron bien. La app usa la
-- anon key y ve cero filas. Las dos cosas son ciertas al mismo tiempo.
--
-- QUÉ ROMPIÓ, MEDIDO
--   1. El detalle de proyecto no ve ninguna fase. El proyecto 7 renderiza sus
--      35 tareas planas, como si la 013 nunca hubiera corrido.
--   2. PEOR, y anterior a esto: desde el paso 1A (commit 4bb5504) la app lee
--      los responsables de `assignments`. Vienen vacíos. Los responsables
--      están invisibles en la UI desde ese push.
--   3. Y las escrituras también fallan: syncTaskAssignees / syncSubtaskAssignees
--      hacen INSERT en `assignments` sin chequear el error que devuelven, así
--      que asignar un responsable desde la UI viene fallando en silencio.
--
-- QUÉ HACE
-- Deja `phases` y `assignments` con la MISMA postura que el resto del
-- esquema: `projects`, `tasks` y `subtasks` tienen relrowsecurity = false.
-- No es un cambio de exposición — esas tres tablas ya están igual de
-- abiertas. Es alinear las dos nuevas con el estándar existente en vez de
-- dejar una postura mixta que nadie va a recordar dentro de tres meses.
--
-- ALTERNATIVA, si preferís mantener RLS encendida: reemplazar los dos ALTER
-- por CREATE POLICY allow_all ... USING (true) WITH CHECK (true). La
-- exposición resultante es idéntica; cambia solo el camino futuro hacia
-- políticas reales. Decidilo ANTES de correr, no después.
--
-- Ninguna columna se borra acá. Los DROP siguen siendo la 014.
-- Idempotente: los dos ALTER se pueden correr de nuevo sin efecto.
-- ============================================================

BEGIN;

-- 0 · GUARD ---------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='phases') THEN
    RAISE EXCEPTION 'La 013 no está aplicada (falta la tabla phases). Correr la 013 primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='assignments') THEN
    RAISE EXCEPTION 'La 013 no está aplicada (falta la tabla assignments).';
  END IF;
END $$;

-- 1 · LA REPARACIÓN -------------------------------------------------

ALTER TABLE public.phases      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.phases IS
  'Fases del Work Plan (Etapa 1, migración 013). RLS deshabilitada por la 013c '
  'para igualar la postura de projects/tasks/subtasks. Toda la seguridad real '
  'es de aplicación — deuda #1 de CLAUDE.md.';

COMMENT ON TABLE public.assignments IS
  'Responsables, polimórfica (Etapa 1, migración 013). Supersede a '
  'task_assignees y subtask_assignees, que se borran en la 014. RLS '
  'deshabilitada por la 013c, mismo criterio que phases.';

COMMIT;

-- 2 · VERIFICACIÓN · TIENE QUE DEVOLVER FILAS -----------------------
--
-- Va FUERA de la transacción y como SELECT, no como RAISE NOTICE: el editor
-- de Supabase se traga los NOTICE y los WARNING, así que una verificación
-- diseñada con NOTICE es una verificación diseñada para que nadie la lea.
-- Lección de la sesión de la 013.
--
-- CRITERIO: la columna `veredicto` tiene que decir 'OK' en TODAS las filas.
-- Cualquier 'BLOQUEA LECTURA' significa que la anon key sigue viendo vacío.

SELECT
  c.relname                                        AS tabla,
  c.relrowsecurity                                 AS rls_activa,
  (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.tablename = c.relname)                AS politicas,
  CASE
    WHEN NOT c.relrowsecurity                                        THEN 'OK'
    WHEN (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname = 'public'
             AND p.tablename = c.relname) > 0                        THEN 'OK'
    ELSE 'BLOQUEA LECTURA'
  END                                              AS veredicto
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY veredicto DESC, c.relname;
