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

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUS)[number], string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  in_review: 'En revisión',
  done: 'Completada',
  blocked: 'Bloqueada',
};

export const PRIORITY_LABELS: Record<(typeof PRIORITY_LEVELS)[number], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export const USER_STATUS_LABELS: Record<(typeof USER_STATUS)[number], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
};
