import { TASK_STATUSES, TASK_PRIORITIES } from '@/src/lib/task-constants';

export const USER_ROLES = ['admin', 'pm', 'developer', 'designer'] as const;
export const USER_STATUS = ['active', 'inactive'] as const;
export const PROJECT_STATUS = ['planning', 'active', 'on_hold', 'completed', 'overdue'] as const;
export const TASK_STATUS = ['todo', 'in_progress', 'in_review', 'done', 'blocked'] as const;
export const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const USER_ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  admin: 'Administrador',
  pm: 'Project Manager',
  developer: 'Desarrollador',
  designer: 'Diseñador',
};

export const PROJECT_STATUS_LABELS: Record<(typeof PROJECT_STATUS)[number], string> = {
  planning: 'Planificación',
  active: 'Activo',
  on_hold: 'En pausa',
  completed: 'Completado',
  overdue: 'Atrasado',
};

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUS)[number], string> =
  Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s.label])) as Record<
    (typeof TASK_STATUS)[number],
    string
  >;

export const PRIORITY_LABELS: Record<(typeof PRIORITY_LEVELS)[number], string> =
  Object.fromEntries(TASK_PRIORITIES.map((p) => [p.value, p.label])) as Record<
    (typeof PRIORITY_LEVELS)[number],
    string
  >;

export const USER_STATUS_LABELS: Record<(typeof USER_STATUS)[number], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
};
