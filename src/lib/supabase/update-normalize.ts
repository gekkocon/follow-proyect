// ---------------------------------------------------------------------------
// Fase 8B — Helpers puros de la actualización masiva por código.
//
// Viven fuera de project-import-actions.ts porque ese archivo lleva
// 'use server' y un módulo de server actions sólo puede exportar funciones
// async. Acá no hay ningún acceso a la base: sólo normalización y diff.
// ---------------------------------------------------------------------------

import { TASK_STATUSES, TASK_PRIORITIES } from '@/src/lib/task-constants';
import type { DbTask, DbSubtask, DbUser } from '@/src/lib/supabase/types';
import type { UpdateItemInput } from './import-schema';

// ---------------------------------------------------------------------------
// Normalización de status y priority — PRESENCE-AWARE
//
// task-constants.ts NO se toca: normalizeTaskStatus/normalizeTaskPriority son
// el contrato de la importación y ahí un default es correcto. Acá no lo es.
// Aquellas devuelven 'todo'/'medium' tanto para el valor ausente como para un
// alias mal escrito, y en modo patch eso convertiría un typo en un reseteo
// silencioso del campo. Estas devuelven null para el alias desconocido, y
// quien llama lo trata como error que bloquea el commit.
// ---------------------------------------------------------------------------

function lookupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function buildLookup<T extends string>(
  rows: { value: T; label: string }[],
  extras: Record<string, T>
): Record<string, T> {
  const map: Record<string, T> = {};
  for (const row of rows) {
    map[lookupKey(row.value)] = row.value;
    map[lookupKey(row.label)] = row.value;
  }
  for (const [alias, value] of Object.entries(extras)) {
    map[lookupKey(alias)] = value;
  }
  return map;
}

// Los sinónimos replican los que task-constants.ts tiene en privado, para que
// un JSON que hoy funciona en la importación siga funcionando acá.
const STATUS_LOOKUP = buildLookup<DbTask['status']>(TASK_STATUSES, {
  pendiente: 'todo',
  completada: 'done',
});

const PRIORITY_LOOKUP = buildLookup<DbTask['priority']>(TASK_PRIORITIES, {});

/** Devuelve el código de enum, o null si el alias no se reconoce. */
export function resolveStatus(raw: string): DbTask['status'] | null {
  return STATUS_LOOKUP[lookupKey(raw)] ?? null;
}

/** Devuelve el código de enum, o null si el alias no se reconoce. */
export function resolvePriority(raw: string): DbTask['priority'] | null {
  return PRIORITY_LOOKUP[lookupKey(raw)] ?? null;
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

/**
 * El comparador de la función SQL y el índice único son sensibles a
 * mayúsculas, así que "f3" no encontraría a "F3": caería en "no encontrada" y,
 * con el toggle encendido, crearía una fila fantasma con el código en
 * minúscula. Normalizar acá elimina toda esa clase de error.
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** La presencia de guión decide tabla, igual que en update_project_tasks. */
export function isSubtaskCode(code: string): boolean {
  return code.includes('-');
}

/** Espejo exacto de split_part(v_code, '-', 1) en la función SQL. */
export function parentCodeOf(code: string): string {
  return code.split('-')[0];
}

// ---------------------------------------------------------------------------
// Tipos de la vista previa
// ---------------------------------------------------------------------------

export type UpdateFieldChange = {
  field: string;
  from: string;
  to: string;
};

export type UpdatePlanItem = {
  code: string;
  kind: 'task' | 'subtask';
  title: string;
  changes: UpdateFieldChange[];
};

export type UpdatePreview = {
  error: string | null;
  /** Código encontrado y con cambios reales. */
  toUpdate: UpdatePlanItem[];
  /** Código encontrado y con todos los valores idénticos. */
  unchanged: string[];
  /** Código inexistente en el proyecto. */
  notFound: string[];
  /** Errores que impiden confirmar. */
  blocking: string[];
  /** Avisos que no impiden confirmar. */
  warnings: string[];
  /** Filas no direccionables por este flujo. */
  nullCodeTasks: number;
  nullCodeSubtasks: number;
  createMissing: boolean;
};

export const EMPTY_UPDATE_PREVIEW: UpdatePreview = {
  error: null,
  toUpdate: [],
  unchanged: [],
  notFound: [],
  blocking: [],
  warnings: [],
  nullCodeTasks: 0,
  nullCodeSubtasks: 0,
  createMissing: false,
};

// ---------------------------------------------------------------------------
// Campos: etiquetas para la UI y pertenencia por tabla
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  status: 'estado',
  priority: 'prioridad',
  start_date: 'fecha de inicio',
  due_date: 'fecha límite',
  is_blocked: 'bloqueada',
  blocked_reason: 'motivo de bloqueo',
  completed: 'completada',
  assignees: 'responsables',
};

/** subtasks no tiene estas columnas. */
const TASK_ONLY_FIELDS = ['is_blocked', 'blocked_reason'] as const;
/** tasks no tiene esta columna. */
const SUBTASK_ONLY_FIELDS = ['completed'] as const;

// ---------------------------------------------------------------------------
// Comparación
// ---------------------------------------------------------------------------

function textOf(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function sameText(a: unknown, b: unknown): boolean {
  const left = a === undefined || a === '' ? null : a;
  const right = b === undefined || b === '' ? null : b;
  return left === right;
}

export type ResolvedUser = Pick<DbUser, 'id' | 'name'>;

/** Mismo criterio que la función SQL: lower(trim(name)) contra lower(trim(input)). */
export function resolveUserId(name: string, users: ResolvedUser[]): number | null {
  const key = name.trim().toLowerCase();
  const hit = users.find((u) => u.name.trim().toLowerCase() === key);
  return hit ? hit.id : null;
}

type CurrentRow = (DbTask | DbSubtask) & {
  assignees: ResolvedUser[];
};

/**
 * Diff campo por campo entre el objeto del payload y la fila actual. Sólo se
 * miran las claves PRESENTES en el objeto: una clave ausente no es un cambio,
 * es una no-instrucción.
 */
export function diffItem(
  item: UpdateItemInput,
  current: CurrentRow,
  users: ResolvedUser[]
): UpdateFieldChange[] {
  const changes: UpdateFieldChange[] = [];
  const row = current as unknown as Record<string, unknown>;

  const push = (field: string, from: unknown, to: unknown) =>
    changes.push({ field, from: textOf(from), to: textOf(to) });

  if ('title' in item && !sameText(item.title, row.title)) push('title', row.title, item.title);
  if ('description' in item && !sameText(item.description, row.description))
    push('description', row.description, item.description);

  if ('status' in item) {
    const next = resolveStatus(item.status as string);
    if (next && next !== row.status) push('status', row.status, next);
  }

  if ('priority' in item) {
    const next = resolvePriority(item.priority as string);
    if (next && next !== row.priority) push('priority', row.priority, next);
  }

  if ('start_date' in item && !sameText(item.start_date, row.start_date))
    push('start_date', row.start_date, item.start_date);
  if ('due_date' in item && !sameText(item.due_date, row.due_date))
    push('due_date', row.due_date, item.due_date);

  if ('is_blocked' in item && item.is_blocked !== row.is_blocked)
    push('is_blocked', row.is_blocked, item.is_blocked);
  if ('blocked_reason' in item && !sameText(item.blocked_reason, row.blocked_reason))
    push('blocked_reason', row.blocked_reason, item.blocked_reason);
  if ('completed' in item && item.completed !== row.completed)
    push('completed', row.completed, item.completed);

  if ('assignees' in item && Array.isArray(item.assignees)) {
    const nextIds = item.assignees
      .map((n) => resolveUserId(n, users))
      .filter((id): id is number => id !== null)
      .sort((a, b) => a - b);
    const currentIds = current.assignees.map((u) => u.id).sort((a, b) => a - b);
    if (nextIds.join(',') !== currentIds.join(',')) {
      push(
        'assignees',
        current.assignees.map((u) => u.name).join(', '),
        item.assignees.join(', ')
      );
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Validación estructural, compartida por la vista previa y el commit
// ---------------------------------------------------------------------------

export type ItemValidation = {
  blocking: string[];
  warnings: string[];
};

/**
 * Reglas que no dependen del estado de la base: alias desconocidos y campos
 * que no existen en la tabla de destino.
 *
 * Lo de los campos ajenos importa porque la función SQL los IGNORA en
 * silencio: un patch de is_blocked sobre una subtarea no escribe nada y no
 * avisa. Un no-op mudo es justo lo que este flujo intenta evitar, así que acá
 * bloquea.
 */
export function validateItemShape(item: UpdateItemInput, code: string): ItemValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const kind = isSubtaskCode(code) ? 'subtask' : 'task';

  if ('status' in item && resolveStatus(item.status as string) === null) {
    blocking.push(`${code}: estado desconocido "${item.status}".`);
  }
  if ('priority' in item && resolvePriority(item.priority as string) === null) {
    blocking.push(`${code}: prioridad desconocida "${item.priority}".`);
  }

  if (kind === 'subtask') {
    for (const field of TASK_ONLY_FIELDS) {
      if (field in item) {
        blocking.push(
          `${code}: "${field}" no existe en subtareas y no se puede actualizar.`
        );
      }
    }
  } else {
    for (const field of SUBTASK_ONLY_FIELDS) {
      if (field in item) {
        blocking.push(`${code}: "${field}" no existe en tareas y no se puede actualizar.`);
      }
    }
  }

  // Patch estricto: status y completed son columnas independientes y no se
  // derivan una de la otra. Si el payload mueve una sola, la otra queda como
  // estaba y la subtarea puede quedar "Finalizada" con el check vacío.
  if (kind === 'subtask') {
    const statusIsDone = 'status' in item && resolveStatus(item.status as string) === 'done';
    if (statusIsDone && !('completed' in item)) {
      warnings.push(
        `${code}: manda status "done" sin "completed". El check de la subtarea no se toca.`
      );
    }
    if ('completed' in item && !('status' in item)) {
      warnings.push(
        `${code}: manda "completed" sin "status". El estado de la subtarea no se toca.`
      );
    }
  }

  return { blocking, warnings };
}

/**
 * Construye el elemento que viaja al RPC: código en mayúsculas y status /
 * priority ya resueltos a códigos de enum, porque la función SQL castea crudo
 * contra task_status / priority_level y una etiqueta en español la haría
 * fallar. Se preserva la PRESENCIA de cada clave: lo que no vino, no viaja.
 */
export function toRpcItem(item: UpdateItemInput, code: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...item, code };

  if ('status' in item) out.status = resolveStatus(item.status as string);
  if ('priority' in item) out.priority = resolvePriority(item.priority as string);

  return out;
}
