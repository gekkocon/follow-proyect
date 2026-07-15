-- ============================================================
-- FOLLOW PROJECT — Seed data (SQL puro, sin JS, sin imports)
-- Ejecutar DESPUÉS de schema.sql
-- ============================================================

-- ============================================================
-- BRAND SETTINGS
-- ============================================================

INSERT INTO brand_settings (org_name, primary_color, secondary_color, accent_color, font_family) VALUES
  ('Follow Project', '#6366F1', '#8B5CF6', '#EC4899', 'Inter');

-- ============================================================
-- USERS
-- ============================================================

INSERT INTO users (name, email, role, status) VALUES
  ('Ana García',      'ana.garcia@follow.dev',    'admin',     'active'),
  ('Carlos López',    'carlos.lopez@follow.dev',  'pm',        'active'),
  ('María Torres',    'maria.torres@follow.dev',  'developer', 'active'),
  ('Javier Ruiz',     'javier.ruiz@follow.dev',   'developer', 'active'),
  ('Sofía Martínez',  'sofia.martinez@follow.dev','designer',  'active'),
  ('Pedro Sánchez',   'pedro.sanchez@follow.dev', 'developer', 'inactive');

-- ============================================================
-- PROJECTS
-- ============================================================

INSERT INTO projects (name, description, status, priority, owner_id, start_date, due_date) VALUES
  (
    'Rediseño Dashboard',
    'Modernizar la interfaz del dashboard principal con nuevo sistema de diseño.',
    'active', 'high',
    (SELECT id FROM users WHERE email = 'carlos.lopez@follow.dev'),
    '2026-06-01', '2026-08-31'
  ),
  (
    'API de Integraciones',
    'Desarrollar endpoints REST para conectar con herramientas externas (Slack, Jira, GitHub).',
    'active', 'critical',
    (SELECT id FROM users WHERE email = 'ana.garcia@follow.dev'),
    '2026-05-15', '2026-07-30'
  ),
  (
    'App Móvil iOS',
    'Versión nativa iOS de la plataforma de gestión de proyectos.',
    'planning', 'medium',
    (SELECT id FROM users WHERE email = 'carlos.lopez@follow.dev'),
    '2026-09-01', '2026-12-31'
  ),
  (
    'Sistema de Notificaciones',
    'Notificaciones en tiempo real vía WebSockets y push notifications.',
    'on_hold', 'medium',
    (SELECT id FROM users WHERE email = 'ana.garcia@follow.dev'),
    '2026-04-01', '2026-06-30'
  ),
  (
    'Migración a PostgreSQL',
    'Migrar base de datos legacy MySQL a PostgreSQL con Supabase.',
    'completed', 'high',
    (SELECT id FROM users WHERE email = 'ana.garcia@follow.dev'),
    '2026-01-10', '2026-04-30'
  );

-- ============================================================
-- TASKS — Proyecto: Rediseño Dashboard
-- ============================================================

INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, is_blocked, due_date) VALUES
  (
    'Definir design tokens',
    'Colores, tipografía, espaciado y sombras en el sistema de diseño.',
    'done', 'high',
    (SELECT id FROM projects WHERE name = 'Rediseño Dashboard'),
    (SELECT id FROM users WHERE email = 'sofia.martinez@follow.dev'),
    false, '2026-06-15'
  ),
  (
    'Crear componentes base UI',
    'Botones, inputs, cards, badges y modales en Storybook.',
    'in_progress', 'high',
    (SELECT id FROM projects WHERE name = 'Rediseño Dashboard'),
    (SELECT id FROM users WHERE email = 'sofia.martinez@follow.dev'),
    false, '2026-07-10'
  ),
  (
    'Implementar vista de proyectos',
    'Listado de proyectos con filtros, búsqueda y ordenamiento.',
    'in_progress', 'high',
    (SELECT id FROM projects WHERE name = 'Rediseño Dashboard'),
    (SELECT id FROM users WHERE email = 'maria.torres@follow.dev'),
    false, '2026-07-20'
  ),
  (
    'Implementar vista de tareas',
    'Kanban board con drag & drop y vista de lista.',
    'todo', 'high',
    (SELECT id FROM projects WHERE name = 'Rediseño Dashboard'),
    (SELECT id FROM users WHERE email = 'javier.ruiz@follow.dev'),
    false, '2026-08-05'
  ),
  (
    'Integrar gráficos de métricas',
    'Charts de progreso con Recharts. Bloqueado hasta definir métricas con stakeholders.',
    'todo', 'medium',
    (SELECT id FROM projects WHERE name = 'Rediseño Dashboard'),
    (SELECT id FROM users WHERE email = 'maria.torres@follow.dev'),
    true, '2026-08-20'
  );

UPDATE tasks
SET blocked_reason = 'Pendiente definir métricas con stakeholders antes de implementar.'
WHERE title = 'Integrar gráficos de métricas';

-- ============================================================
-- TASKS — Proyecto: API de Integraciones
-- ============================================================

INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, is_blocked, due_date) VALUES
  (
    'Diseño de arquitectura REST',
    'Documentar endpoints, autenticación OAuth2 y rate limiting.',
    'done', 'critical',
    (SELECT id FROM projects WHERE name = 'API de Integraciones'),
    (SELECT id FROM users WHERE email = 'ana.garcia@follow.dev'),
    false, '2026-06-01'
  ),
  (
    'Integración con Slack',
    'Webhooks entrantes y salientes para notificaciones de tareas.',
    'in_review', 'high',
    (SELECT id FROM projects WHERE name = 'API de Integraciones'),
    (SELECT id FROM users WHERE email = 'javier.ruiz@follow.dev'),
    false, '2026-07-15'
  ),
  (
    'Integración con GitHub',
    'Asociar commits y PRs a tareas del proyecto.',
    'in_progress', 'high',
    (SELECT id FROM projects WHERE name = 'API de Integraciones'),
    (SELECT id FROM users WHERE email = 'maria.torres@follow.dev'),
    false, '2026-07-25'
  ),
  (
    'Tests de integración API',
    'Suite de tests con Jest y Supertest para todos los endpoints.',
    'todo', 'critical',
    (SELECT id FROM projects WHERE name = 'API de Integraciones'),
    (SELECT id FROM users WHERE email = 'javier.ruiz@follow.dev'),
    false, '2026-07-28'
  );

-- ============================================================
-- TASKS — Proyecto: App Móvil iOS
-- ============================================================

INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, is_blocked, due_date) VALUES
  (
    'Investigación tech stack',
    'Evaluar React Native vs Swift nativo vs Flutter.',
    'in_progress', 'high',
    (SELECT id FROM projects WHERE name = 'App Móvil iOS'),
    (SELECT id FROM users WHERE email = 'carlos.lopez@follow.dev'),
    false, '2026-09-15'
  ),
  (
    'Wireframes pantallas principales',
    'Mockups de dashboard, proyectos y tareas en Figma.',
    'todo', 'medium',
    (SELECT id FROM projects WHERE name = 'App Móvil iOS'),
    (SELECT id FROM users WHERE email = 'sofia.martinez@follow.dev'),
    false, '2026-09-30'
  );

-- ============================================================
-- SUBTASKS
-- ============================================================

INSERT INTO subtasks (title, completed, task_id) VALUES
  ('Diseñar variantes de Button', true,
    (SELECT id FROM tasks WHERE title = 'Crear componentes base UI')),
  ('Diseñar componente Input con validación', true,
    (SELECT id FROM tasks WHERE title = 'Crear componentes base UI')),
  ('Crear Card con skeleton loader', false,
    (SELECT id FROM tasks WHERE title = 'Crear componentes base UI')),
  ('Crear Modal accesible (a11y)', false,
    (SELECT id FROM tasks WHERE title = 'Crear componentes base UI')),
  ('Publicar en Storybook', false,
    (SELECT id FROM tasks WHERE title = 'Crear componentes base UI'));

INSERT INTO subtasks (title, completed, task_id) VALUES
  ('Conectar API proyectos con React Query', true,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de proyectos')),
  ('Implementar filtros por status y prioridad', true,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de proyectos')),
  ('Buscador en tiempo real', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de proyectos')),
  ('Paginación o scroll infinito', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de proyectos'));

INSERT INTO subtasks (title, completed, task_id) VALUES
  ('Kanban board con columnas por status', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de tareas')),
  ('Drag & drop entre columnas', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de tareas')),
  ('Vista de lista alternativa', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de tareas')),
  ('Detalle de tarea en modal lateral', false,
    (SELECT id FROM tasks WHERE title = 'Implementar vista de tareas'));

INSERT INTO subtasks (title, completed, task_id) VALUES
  ('Configurar app en Slack API', true,
    (SELECT id FROM tasks WHERE title = 'Integración con Slack')),
  ('Webhook entrada: crear tarea desde Slack', true,
    (SELECT id FROM tasks WHERE title = 'Integración con Slack')),
  ('Notificación salida al cambiar status', true,
    (SELECT id FROM tasks WHERE title = 'Integración con Slack')),
  ('Tests unitarios del webhook', false,
    (SELECT id FROM tasks WHERE title = 'Integración con Slack'));

INSERT INTO subtasks (title, completed, task_id) VALUES
  ('Configurar GitHub App y webhooks', true,
    (SELECT id FROM tasks WHERE title = 'Integración con GitHub')),
  ('Asociar PR a tarea por referencia en título', false,
    (SELECT id FROM tasks WHERE title = 'Integración con GitHub')),
  ('Mostrar estado CI en detalle de tarea', false,
    (SELECT id FROM tasks WHERE title = 'Integración con GitHub'));
