'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import { importPayloadSchema, type ImportPayload, type ImportTaskInput, type ImportSubtaskInput } from './import-schema';
import { normalizeTaskStatus, normalizeTaskPriority } from '@/src/lib/task-constants';

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
