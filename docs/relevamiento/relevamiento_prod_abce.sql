-- ===========================================================================
-- RELEVAMIENTO DEL WORK PLAN — BLOQUES (a), (b), (c) y (e)
--
-- Extraido de relevamiento_work_plan.sql. Los bloques (d) y (f) ya se
-- corrieron y no estan aca.
--
-- SOLO LECTURA: unicamente SELECT. Ni un INSERT, UPDATE, DELETE, ALTER,
-- CREATE, DROP, TRUNCATE ni GRANT.
--
-- CORRER DE A UN BLOQUE. El editor de Supabase muestra solo el resultado de
-- la ultima sentencia, asi que seleccionar el bloque entero y ejecutar la
-- seleccion es la unica forma de ver cada salida. Los bloques (a) y (b)
-- tienen DOS sentencias cada uno, marcadas abajo como (a.1)/(a.2) y
-- (b.1)/(b.2): esos tambien van de a uno.
--
-- Destino: la base única. No hay DEV ni PROD separados (CLAUDE.md §8).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- (a) VOLUMEN Y DISTRIBUCIÓN POR PROYECTO
--
-- Una fila por proyecto, más una fila TOTAL al final. La pregunta que
-- responde no es "cuántas tareas hay" sino "cómo están repartidas": un
-- promedio alto con un solo proyecto cargado no dice lo mismo que el mismo
-- promedio repartido entre quince.
-- ---------------------------------------------------------------------------
-- --- (a.1) --- Una fila por proyecto.
SELECT
  'a. por proyecto'                      AS bloque,
  p.id                                   AS project_id,
  p.name                                 AS proyecto,
  p.status::text                         AS estado_proyecto,
  COUNT(DISTINCT t.id)                   AS tasks,
  COUNT(DISTINCT s.id)                   AS subtasks,
  ROUND(
    COUNT(DISTINCT s.id)::numeric
      / NULLIF(COUNT(DISTINCT t.id), 0)
  , 2)                                   AS subtasks_por_task,
  COUNT(DISTINCT t.id) FILTER (WHERE t.code IS NULL) AS tasks_sin_code,
  COUNT(DISTINCT s.id) FILTER (WHERE s.code IS NULL) AS subtasks_sin_code,
  p.created_at::date                     AS creado
FROM projects p
LEFT JOIN tasks    t ON t.project_id = p.id
LEFT JOIN subtasks s ON s.task_id    = t.id
GROUP BY p.id, p.name, p.status, p.created_at
ORDER BY COUNT(DISTINCT t.id) DESC, p.id;

-- --- (a.2) --- Totales, para contrastar contra la distribución de arriba.
SELECT
  'a. totales'                                      AS bloque,
  (SELECT COUNT(*) FROM projects)                   AS proyectos,
  (SELECT COUNT(*) FROM tasks)                      AS tasks,
  (SELECT COUNT(*) FROM subtasks)                   AS subtasks,
  (SELECT COUNT(*) FROM tasks WHERE project_id IS NULL) AS tasks_huerfanas,
  (SELECT COUNT(*) FROM task_assignees)             AS filas_task_assignees,
  (SELECT COUNT(*) FROM subtask_assignees)          AS filas_subtask_assignees;


-- ###########################################################################

-- ---------------------------------------------------------------------------
-- (b) PROFUNDIDAD REAL DEL ÁRBOL
--
-- Cuántas subtareas cuelgan de cada tarea, agrupado en tramos. Es la medida
-- que dice si el árbol de dos niveles alcanza o si en la práctica la gente
-- está aplanando una jerarquía más profunda dentro de los títulos.
-- ---------------------------------------------------------------------------
-- --- (b.1) --- Distribución por tramos.
WITH conteo AS (
  SELECT t.id, COUNT(s.id) AS n
  FROM tasks t
  LEFT JOIN subtasks s ON s.task_id = t.id
  GROUP BY t.id
),
clasificado AS (
  SELECT
    CASE
      WHEN n = 0            THEN '0 subtasks'
      WHEN n BETWEEN 1 AND 5   THEN '1 a 5'
      WHEN n BETWEEN 6 AND 20  THEN '6 a 20'
      ELSE                          'mas de 20'
    END AS tramo,
    CASE
      WHEN n = 0 THEN 1 WHEN n <= 5 THEN 2 WHEN n <= 20 THEN 3 ELSE 4
    END AS orden
  FROM conteo
)
SELECT
  'b. profundidad'                                       AS bloque,
  tramo,
  COUNT(*)                                               AS tasks,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM clasificado
GROUP BY tramo, orden
ORDER BY orden;

-- --- (b.2) --- El máximo real, el caso que rompe cualquier diseño de UI.
SELECT
  'b. extremos'                                  AS bloque,
  MAX(n)                                         AS max_subtasks_en_una_task,
  ROUND(AVG(n), 2)                               AS promedio,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n) AS mediana,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY n) AS p90
FROM (
  SELECT COUNT(s.id) AS n
  FROM tasks t
  LEFT JOIN subtasks s ON s.task_id = t.id
  GROUP BY t.id
) x;


-- ###########################################################################

-- ---------------------------------------------------------------------------
-- (c) TASA DE LLENADO POR COLUMNA
--
-- Qué porcentaje de filas tiene cada columna vacía. Una columna con 100% de
-- vacío es una columna que el negocio no usa, y eso pesa más que cualquier
-- opinión sobre si "debería" existir.
--
-- La asimetría entre las dos tablas está respetada (CLAUDE.md, sección 6):
--   tasks    tiene is_blocked y blocked_reason; NO tiene completed
--   subtasks tiene completed;                   NO tiene is_blocked ni blocked_reason
-- Las columnas que no existen en una tabla aparecen como NULL en su fila, no
-- como 0: un 0 se leería como "existe y está llena", que es falso.
--
-- Criterio de "vacío" por tipo:
--   texto            NULL o cadena en blanco
--   fecha / numérico NULL
--   dependencies     NULL o array de largo 0 (el default es '{}')
--   is_blocked       se mide el FALSE, no el NULL: la columna es NOT NULL
--                    DEFAULT false, así que el dato interesante es cuántas
--                    filas están efectivamente bloqueadas
--   completed        ídem: se mide el TRUE
-- ---------------------------------------------------------------------------
SELECT
  'c. llenado'                                                   AS bloque,
  'tasks'                                                        AS tabla,
  COUNT(*)                                                       AS filas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(TRIM(description), '') = '') / NULLIF(COUNT(*), 0), 1) AS pct_description_vacia,
  ROUND(100.0 * COUNT(*) FILTER (WHERE priority IS NULL)         / NULLIF(COUNT(*), 0), 1) AS pct_priority_null,
  ROUND(100.0 * COUNT(*) FILTER (WHERE start_date IS NULL)       / NULLIF(COUNT(*), 0), 1) AS pct_start_date_null,
  ROUND(100.0 * COUNT(*) FILTER (WHERE due_date IS NULL)         / NULLIF(COUNT(*), 0), 1) AS pct_due_date_null,
  ROUND(100.0 * COUNT(*) FILTER (WHERE estimated_cost IS NULL)   / NULLIF(COUNT(*), 0), 1) AS pct_estimated_cost_null,
  ROUND(100.0 * COUNT(*) FILTER (WHERE dependencies IS NULL OR CARDINALITY(dependencies) = 0) / NULLIF(COUNT(*), 0), 1) AS pct_dependencies_vacia,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_blocked)               / NULLIF(COUNT(*), 0), 1) AS pct_is_blocked_true,
  ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(TRIM(blocked_reason), '') = '') / NULLIF(COUNT(*), 0), 1) AS pct_blocked_reason_vacia,
  NULL::numeric                                                  AS pct_completed_true,
  ROUND(100.0 * COUNT(*) FILTER (WHERE code IS NULL)             / NULLIF(COUNT(*), 0), 1) AS pct_code_null
FROM tasks

UNION ALL

SELECT
  'c. llenado',
  'subtasks',
  COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(TRIM(description), '') = '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE priority IS NULL)       / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE start_date IS NULL)     / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE due_date IS NULL)       / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE estimated_cost IS NULL) / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE dependencies IS NULL OR CARDINALITY(dependencies) = 0) / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,   -- subtasks no tiene is_blocked
  NULL::numeric,   -- subtasks no tiene blocked_reason
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed)             / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE code IS NULL)          / NULLIF(COUNT(*), 0), 1)
FROM subtasks;


-- ###########################################################################

-- ---------------------------------------------------------------------------
-- (e) LOS CÓDIGOS REALES, CON SU TÍTULO
--
-- Para ver si en la práctica F0, F1, F2 se están usando como FASES del plan
-- o como numeración corrida de tareas sueltas. El título es la evidencia:
-- "F0 — Diagnóstico legal" es una fase; "F0 — Llamar al proveedor" no.
-- ---------------------------------------------------------------------------
SELECT
  'e. codigos'                                    AS bloque,
  t.project_id,
  p.name                                          AS proyecto,
  t.code,
  t.title,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtasks,
  t.status::text                                  AS estado
FROM tasks t
LEFT JOIN projects p ON p.id = t.project_id
WHERE t.code IS NOT NULL
ORDER BY
  t.project_id,
  -- Orden numérico por el sufijo, no lexicográfico: si no, F10 va antes que F2.
  NULLIF(REGEXP_REPLACE(t.code, '\D', '', 'g'), '')::int NULLS LAST,
  t.code
LIMIT 30;

