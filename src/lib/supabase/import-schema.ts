import { z } from 'zod';

// Acepta tanto los códigos de enum como las etiquetas en español —
// la normalización real ocurre en normalizeTaskStatus/normalizeTaskPriority
// (src/lib/task-constants.ts) antes de enviar el payload al RPC.
const statusValue = z.string().optional();
const priorityValue = z.string().optional();

const baseItemFields = {
  temp_id: z.string().optional(),
  // Fase 8A — código humano opcional. Si viene, se respeta tal cual;
  // si no viene, la función SQL import_project_tasks lo autogenera.
  code: z.string().optional().nullable(),
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional().nullable(),
  status: statusValue,
  priority: priorityValue,
  due_date: z.string().optional().nullable(),
  assignee_names: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
};

export const importSubtaskSchema = z.object(baseItemFields);

export const importTaskSchema = z.object({
  ...baseItemFields,
  subtasks: z.array(importSubtaskSchema).optional(),
});

export const importPayloadSchema = z.object({
  tasks: z.array(importTaskSchema).min(1, 'Debe incluir al menos una tarea'),
});

export type ImportSubtaskInput = z.infer<typeof importSubtaskSchema>;
export type ImportTaskInput = z.infer<typeof importTaskSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;

// ---------------------------------------------------------------------------
// Fase 8B — Actualización masiva por código
//
// Formato distinto al de importación: array PLANO, no anidado. Cada elemento
// se direcciona por su `code` humano (F3 para tarea, F3-T08 para subtarea) y
// la presencia de guión decide de cuál de las dos tablas se trata.
//
// Semántica de patch: sólo se escriben las claves PRESENTES en el objeto. Por
// eso todos los campos son `.optional()` y ninguno tiene default — un default
// convertiría "clave ausente" en "escribir el default", que es exactamente lo
// contrario de lo que se pide.
//
// `null` explícito SÍ se respeta como borrado deliberado, pero sólo en las
// columnas que admiten NULL. En las NOT NULL (title, status, priority,
// is_blocked) se rechaza acá para que el error salga legible en la
// vista previa y no como una violación cruda de Postgres al confirmar.
// ---------------------------------------------------------------------------

const updatableFields = {
  title: z.string().min(1, 'El título no puede quedar vacío').optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().nullable().optional(),
  // Sólo tareas — subtasks no tiene estas dos columnas.
  is_blocked: z.boolean().optional(),
  blocked_reason: z.string().nullable().optional(),
  // Si la clave viene, reemplaza el set completo de responsables.
  assignees: z.array(z.string()).optional(),
};

// strictObject rechaza cualquier clave desconocida, y con eso rechaza también
// los intentos de tocar id, project_id o task_id, que no son actualizables.
export const updateItemSchema = z.strictObject({
  code: z.string().min(1, 'El código es requerido'),
  ...updatableFields,
});

export const updatePayloadSchema = z
  .array(updateItemSchema)
  .min(1, 'Debe incluir al menos un elemento');

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePayload = z.infer<typeof updatePayloadSchema>;
