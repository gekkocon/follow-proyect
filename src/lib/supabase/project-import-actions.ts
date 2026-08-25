'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import { importPayloadSchema, type ImportPayload, type ImportTaskInput, type ImportSubtaskInput } from './import-schema';
import { updatePayloadSchema, type UpdateItemInput } from './import-schema';
import { normalizeTaskStatus, normalizeTaskPriority } from '@/src/lib/task-constants';
import { getProjectTasksFull } from './project-task-actions';
import {
  diffItem,
  isSubtaskCode,
  normalizeCode,
  parentCodeOf,
  resolveUserId,
  toRpcItem,
  validateItemShape,
  EMPTY_UPDATE_PREVIEW,
  type ResolvedUser,
  type UpdatePlanItem,
  type UpdatePreview,
} from './update-normalize';

export type ImportPreview = {
  error: string | null;
  tasksCount: number;
  subtasksCount: number;
  duplicateTitles: string[];
};

export type ImportResult = {
  error: string | null;
  tasksCreated: number;
  subtasksCreated: number;
};

function parsePayload(raw: unknown): { data: ImportPayload | null; error: string | null } {
  const parsed = importPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { data: null, error: `JSON inválido: ${first.path.join('.')} — ${first.message}` };
  }
  return { data: parsed.data, error: null };
}

/** Normaliza status/priority (acepta español o código de enum) y limpia campos vacíos. */
function normalizeForRpc(tasks: ImportTaskInput[]) {
  const normalizeItem = (item: ImportTaskInput | ImportSubtaskInput) => ({
    ...item,
    status: normalizeTaskStatus(item.status),
    priority: normalizeTaskPriority(item.priority),
    description: item.description || null,
    start_date: item.start_date || null,
    due_date: item.due_date || null,
    // Fase 8A — un code vacío o en blanco cuenta como ausente, para que el
    // RPC caiga en la autogeneración en vez de insertar una cadena vacía.
    code: item.code?.trim() || null,
  });

  return tasks.map((t) => ({
    ...normalizeItem(t),
    subtasks: (t.subtasks ?? []).map(normalizeItem),
  }));
}

/**
 * Valida el JSON y calcula cuántas tareas/subtareas se crearían, sin escribir nada.
 * Detecta títulos de tareas duplicados (contra las ya existentes en el proyecto y
 * dentro del propio archivo importado) para que la vista previa pueda avisar antes
 * de confirmar — no bloquea la importación, solo informa.
 */
export async function previewProjectImport(
  projectId: number,
  rawPayload: unknown
): Promise<ImportPreview> {
  const { data, error } = parsePayload(rawPayload);
  if (!data) {
    return { error, tasksCount: 0, subtasksCount: 0, duplicateTitles: [] };
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('tasks')
    .select('title')
    .eq('project_id', projectId);

  const existingTitles = new Set((existing ?? []).map((t) => t.title.trim().toLowerCase()));
  const seenInFile = new Set<string>();
  const duplicates = new Set<string>();

  let subtasksCount = 0;
  for (const task of data.tasks) {
    const key = task.title.trim().toLowerCase();
    if (existingTitles.has(key) || seenInFile.has(key)) duplicates.add(task.title);
    seenInFile.add(key);
    subtasksCount += task.subtasks?.length ?? 0;
  }

  return {
    error: null,
    tasksCount: data.tasks.length,
    subtasksCount,
    duplicateTitles: Array.from(duplicates),
  };
}

/**
 * Importa tareas y subtareas dentro de una única transacción en la base de datos
 * (función import_project_tasks, migración 009). Si cualquier fila falla, no se
 * crea nada — el proyecto nunca queda con una importación a medias.
 */
export async function importProjectTasks(
  projectId: number,
  rawPayload: unknown
): Promise<ImportResult> {
  const { data, error } = parsePayload(rawPayload);
  if (!data) {
    return { error, tasksCreated: 0, subtasksCreated: 0 };
  }

  const supabase = createServerClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc('import_project_tasks', {
    p_project_id: projectId,
    p_tasks: normalizeForRpc(data.tasks),
  });

  if (rpcError) {
    return { error: rpcError.message, tasksCreated: 0, subtasksCreated: 0 };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');

  return {
    error: null,
    tasksCreated: rpcData?.tasks_created ?? 0,
    subtasksCreated: rpcData?.subtasks_created ?? 0,
  };
}

// ===========================================================================
// Fase 8B — Actualización masiva por código
//
// Direcciona filas existentes por su `code` humano y aplica un PATCH: sólo se
// escriben las claves presentes en cada objeto. La función SQL
// update_project_tasks (migración 011) hace el trabajo en una sola
// transacción; acá se valida antes para que los errores salgan legibles en la
// vista previa en vez de como excepciones crudas de Postgres al confirmar.
// ===========================================================================

export type UpdateResult = {
  error: string | null;
  updated: number;
  created: number;
  skipped: number;
};

type ParsedUpdate = {
  /** Pares (código ya normalizado, objeto del payload). */
  items: { code: string; item: UpdateItemInput }[];
  /** Errores que impiden confirmar y no dependen del estado de la base. */
  blocking: string[];
  warnings: string[];
  error: string | null;
};

/**
 * Valida el JSON, normaliza los códigos a mayúsculas y aplica las reglas que
 * no necesitan leer la base: forma del objeto, alias de estado/prioridad,
 * campos ajenos a la tabla de destino y códigos duplicados dentro del payload.
 */
function parseUpdatePayload(raw: unknown): ParsedUpdate {
  const parsed = updatePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first.path.length ? `[${first.path.join('.')}] ` : '';
    return { items: [], blocking: [], warnings: [], error: `JSON inválido: ${where}${first.message}` };
  }

  const items: { code: string; item: UpdateItemInput }[] = [];
  const blocking: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of parsed.data) {
    const code = normalizeCode(item.code);
    if (!code) {
      blocking.push('Hay un elemento con el código vacío.');
      continue;
    }
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);

    const shape = validateItemShape(item, code);
    blocking.push(...shape.blocking);
    warnings.push(...shape.warnings);

    items.push({ code, item });
  }

  // Array.from y no for..of sobre el Set: el target de tsconfig es es5 y la
  // iteración directa de un Set no compila (TS2802).
  for (const code of Array.from(duplicates)) {
    blocking.push(`Código duplicado dentro del archivo: ${code}.`);
  }

  return { items, blocking, warnings, error: null };
}

async function loadUsers(): Promise<ResolvedUser[]> {
  const supabase = createServerClient();
  const { data } = await supabase.from('users').select('id, name');
  return (data ?? []) as ResolvedUser[];
}

/**
 * Calcula, sin escribir nada, qué haría la actualización: qué se actualiza,
 * qué queda igual, qué código no existe y qué errores impiden confirmar.
 *
 * `createMissing` no cambia lo que se mide: cambia cómo se lee el grupo de las
 * no encontradas (se omiten u se crean) y agrega la exigencia de `title` para
 * las que se van a crear.
 */
export async function previewProjectUpdate(
  projectId: number,
  rawPayload: unknown,
  createMissing: boolean
): Promise<UpdatePreview> {
  const parsed = parseUpdatePayload(rawPayload);
  if (parsed.error) {
    return { ...EMPTY_UPDATE_PREVIEW, error: parsed.error, createMissing };
  }

  const [tasks, users] = await Promise.all([getProjectTasksFull(projectId), loadUsers()]);

  const taskByCode = new Map<string, (typeof tasks)[number]>();
  const subtaskByCode = new Map<string, (typeof tasks)[number]['subtasks'][number]>();
  let nullCodeTasks = 0;
  let nullCodeSubtasks = 0;

  for (const task of tasks) {
    if (task.code) taskByCode.set(task.code, task);
    else nullCodeTasks += 1;

    for (const subtask of task.subtasks) {
      if (subtask.code) subtaskByCode.set(subtask.code, subtask);
      else nullCodeSubtasks += 1;
    }
  }

  const toUpdate: UpdatePlanItem[] = [];
  const unchanged: string[] = [];
  const notFound: string[] = [];
  const blocking = [...parsed.blocking];
  const warnings = [...parsed.warnings];

  for (const { code, item } of parsed.items) {
    const kind = isSubtaskCode(code) ? 'subtask' : 'task';

    // Un nombre que no resuelve aborta la función SQL, así que tiene que
    // bloquear acá: si sólo advirtiera, la vista previa diría que está todo
    // bien y el commit moriría después con un error crudo.
    if (Array.isArray(item.assignees)) {
      for (const name of item.assignees) {
        if (resolveUserId(name, users) === null) {
          blocking.push(`${code}: responsable no encontrado "${name}".`);
        }
      }
    }

    if (kind === 'subtask') {
      const parentCode = parentCodeOf(code);
      if (!taskByCode.has(parentCode)) {
        blocking.push(
          `${code}: el prefijo "${parentCode}" no corresponde a ninguna tarea del proyecto.`
        );
        continue;
      }
    }

    const current = kind === 'subtask' ? subtaskByCode.get(code) : taskByCode.get(code);

    if (!current) {
      notFound.push(code);
      if (createMissing && !item.title?.trim()) {
        blocking.push(`${code}: no se puede crear sin "title".`);
      }
      continue;
    }

    const changes = diffItem(item, current, users);
    if (changes.length === 0) {
      unchanged.push(code);
    } else {
      toUpdate.push({ code, kind, title: current.title, changes });
    }
  }

  return {
    error: null,
    toUpdate,
    unchanged,
    notFound,
    blocking,
    warnings,
    nullCodeTasks,
    nullCodeSubtasks,
    createMissing,
  };
}

/**
 * Aplica la actualización llamando a update_project_tasks (migración 011).
 * Todo-o-nada: cualquier excepción de Postgres revierte la llamada entera y
 * vuelve como string en { error }, nunca como excepción.
 */
export async function updateProjectTasks(
  projectId: number,
  rawPayload: unknown,
  createMissing: boolean
): Promise<UpdateResult> {
  const parsed = parseUpdatePayload(rawPayload);
  if (parsed.error) {
    return { error: parsed.error, updated: 0, created: 0, skipped: 0 };
  }
  if (parsed.blocking.length > 0) {
    return { error: parsed.blocking[0], updated: 0, created: 0, skipped: 0 };
  }

  const supabase = createServerClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc('update_project_tasks', {
    p_project_id: projectId,
    p_payload: parsed.items.map(({ code, item }) => toRpcItem(item, code)),
    p_create_missing: createMissing,
  });

  if (rpcError) {
    return { error: rpcError.message, updated: 0, created: 0, skipped: 0 };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');

  return {
    error: null,
    updated: rpcData?.updated ?? 0,
    created: rpcData?.created ?? 0,
    skipped: rpcData?.skipped ?? 0,
  };
}
