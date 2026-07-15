import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, projects, tasks, subtasks } from './schema';
import { parseDbUrl, resolveHost } from './connection';

const connParams = parseDbUrl(process.env.DATABASE_URL!);

async function seed() {
  const ipv4Host = await resolveHost(connParams.host);
  const client = postgres({ ...connParams, host: ipv4Host, ssl: 'require', prepare: false });
  const db = drizzle(client);

  console.log('🌱 Limpiando tablas...');
  await db.delete(subtasks);
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(users);

  console.log('👥 Insertando usuarios...');
  const [admin, pm, dev] = await db.insert(users).values([
    { name: 'Ana Torres', email: 'ana@femco.mx', role: 'admin', status: 'active' },
    { name: 'Carlos Ruiz', email: 'carlos@femco.mx', role: 'pm', status: 'active' },
    { name: 'Sofía Mendez', email: 'sofia@femco.mx', role: 'developer', status: 'active' },
  ]).returning();

  console.log('📁 Insertando proyectos...');
  const today = new Date().toISOString().split('T')[0];
  const pastDate = '2025-05-01';
  const futureDate = '2026-12-31';

  const [proyectoActivo, proyectoAtrasado, proyectoPlanificacion] = await db.insert(projects).values([
    {
      name: 'Rediseño Web Corporativo',
      description: 'Actualización completa del sitio web con nuevo branding.',
      status: 'active',
      priority: 'high',
      ownerId: pm.id,
      startDate: today,
      dueDate: futureDate,
    },
    {
      name: 'App Móvil v2',
      description: 'Segunda versión de la aplicación móvil con nuevas funciones.',
      status: 'overdue',
      priority: 'critical',
      ownerId: pm.id,
      startDate: '2025-01-01',
      dueDate: pastDate,
    },
    {
      name: 'Sistema de Reportes',
      description: 'Dashboard interno de métricas y KPIs para dirección.',
      status: 'planning',
      priority: 'medium',
      ownerId: admin.id,
      startDate: futureDate,
      dueDate: futureDate,
    },
  ]).returning();

  console.log('✅ Insertando tareas...');
  const [t1, , t3, , , , , t8, t9] = await db.insert(tasks).values([
    // Proyecto: Rediseño Web
    {
      title: 'Levantar wireframes de home',
      description: 'Diseño de la estructura visual de la página principal.',
      status: 'done',
      priority: 'high',
      projectId: proyectoActivo.id,
      assigneeId: dev.id,
      dueDate: today,
    },
    {
      title: 'Definir paleta de colores y tipografía',
      status: 'in_review',
      priority: 'medium',
      projectId: proyectoActivo.id,
      assigneeId: dev.id,
      dueDate: today,
    },
    {
      title: 'Integrar CMS headless',
      description: 'Conectar Contentful con Next.js.',
      status: 'in_progress',
      priority: 'high',
      projectId: proyectoActivo.id,
      assigneeId: dev.id,
      dueDate: futureDate,
    },
    {
      title: 'Migrar contenido existente',
      status: 'todo',
      priority: 'medium',
      projectId: proyectoActivo.id,
      assigneeId: pm.id,
      dueDate: futureDate,
    },
    // Proyecto: App Móvil (atrasado)
    {
      title: 'Configurar autenticación biométrica',
      description: 'FaceID y TouchID para iOS y Android.',
      status: 'blocked',
      priority: 'critical',
      projectId: proyectoAtrasado.id,
      assigneeId: dev.id,
      isBlocked: true,
      blockedReason: 'Esperando certificado de Apple Developer. Sin acceso a cuenta hasta que legal apruebe.',
      dueDate: pastDate,
    },
    {
      title: 'Optimizar carga de imágenes',
      status: 'in_progress',
      priority: 'high',
      projectId: proyectoAtrasado.id,
      assigneeId: dev.id,
      dueDate: pastDate,
    },
    {
      title: 'QA regression testing v1.x',
      status: 'todo',
      priority: 'high',
      projectId: proyectoAtrasado.id,
      assigneeId: pm.id,
      dueDate: pastDate,
    },
    {
      title: 'Fix crash en Android 13',
      description: 'El app crashea al abrir notificaciones en segundo plano.',
      status: 'in_progress',
      priority: 'critical',
      projectId: proyectoAtrasado.id,
      assigneeId: dev.id,
      dueDate: pastDate,
    },
    // Proyecto: Sistema de Reportes
    {
      title: 'Definir KPIs con dirección',
      status: 'todo',
      priority: 'medium',
      projectId: proyectoPlanificacion.id,
      assigneeId: pm.id,
      dueDate: futureDate,
    },
    {
      title: 'Diseñar arquitectura del dashboard',
      status: 'todo',
      priority: 'low',
      projectId: proyectoPlanificacion.id,
      assigneeId: dev.id,
      dueDate: futureDate,
    },
  ]).returning();

  console.log('🔖 Insertando subtareas...');
  await db.insert(subtasks).values([
    { title: 'Wireframe sección hero', completed: true, taskId: t1.id },
    { title: 'Wireframe sección servicios', completed: true, taskId: t1.id },
    { title: 'Wireframe footer', completed: true, taskId: t1.id },
    { title: 'Instalar SDK de Contentful', completed: true, taskId: t3.id },
    { title: 'Crear modelos de contenido', completed: false, taskId: t3.id },
    { title: 'Conectar API con Next.js', completed: false, taskId: t3.id },
    { title: 'Reproducir bug en emulador', completed: true, taskId: t8.id },
    { title: 'Identificar stack trace', completed: true, taskId: t8.id },
    { title: 'Aplicar fix y probar', completed: false, taskId: t8.id },
    { title: 'Subir build de prueba', completed: false, taskId: t8.id },
    { title: 'Reunión inicial con dirección', completed: false, taskId: t9.id },
    { title: 'Documentar métricas acordadas', completed: false, taskId: t9.id },
  ]);

  console.log('✅ Seed completado.');
  console.log('   Usuarios: 3 | Proyectos: 3 | Tareas: 10 | Subtareas: 12');
  await client.end();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
