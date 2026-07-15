import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users, projects, tasks, subtasks } from '@/src/db/schema';
import type { USER_ROLES, USER_STATUS, PROJECT_STATUS, TASK_STATUS, PRIORITY_LEVELS } from './constants';

// Tipos derivados del schema
export type User = InferSelectModel<typeof users>;
export type Project = InferSelectModel<typeof projects>;
export type Task = InferSelectModel<typeof tasks>;
export type Subtask = InferSelectModel<typeof subtasks>;

// Tipos para insert
export type NewUser = InferInsertModel<typeof users>;
export type NewProject = InferInsertModel<typeof projects>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewSubtask = InferInsertModel<typeof subtasks>;

// Tipos de enum derivados de constantes
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUS)[number];
export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// Tipos enriquecidos para UI
export type TaskWithSubtasks = Task & { subtasks: Subtask[] };
export type ProjectWithTasks = Project & { tasks: TaskWithSubtasks[]; owner: User | null };

// Inputs de formulario
export type CreateProjectInput = Pick<NewProject, 'name' | 'description' | 'status' | 'priority' | 'ownerId' | 'startDate' | 'dueDate'>;
export type CreateTaskInput = Pick<NewTask, 'title' | 'description' | 'status' | 'priority' | 'projectId' | 'assigneeId' | 'dueDate'>;
export type CreateSubtaskInput = Pick<NewSubtask, 'title' | 'taskId'>;
