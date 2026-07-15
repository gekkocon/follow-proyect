import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  date,
} from 'drizzle-orm/pg-core';

// Enums PostgreSQL
export const userRoleEnum = pgEnum('user_role', ['admin', 'pm', 'developer', 'designer']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive']);
export const projectStatusEnum = pgEnum('project_status', ['planning', 'active', 'on_hold', 'completed', 'overdue']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'in_review', 'done', 'blocked']);
export const priorityEnum = pgEnum('priority_level', ['low', 'medium', 'high', 'critical']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: userRoleEnum('role').notNull().default('developer'),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('planning'),
  priority: priorityEnum('priority').notNull().default('medium'),
  ownerId: integer('owner_id').references(() => users.id),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: priorityEnum('priority').notNull().default('medium'),
  projectId: integer('project_id').references(() => projects.id),
  assigneeId: integer('assignee_id').references(() => users.id),
  isBlocked: boolean('is_blocked').notNull().default(false),
  blockedReason: text('blocked_reason'),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subtasks = pgTable('subtasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  completed: boolean('completed').notNull().default(false),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
