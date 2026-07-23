import { z } from 'zod';

// Acepta tanto los códigos de enum como las etiquetas en español —
// la normalización real ocurre en normalizeTaskStatus/normalizeTaskPriority
// (src/lib/task-constants.ts) antes de enviar el payload al RPC.
const statusValue = z.string().optional();
const priorityValue = z.string().optional();

const baseItemFields = {
  temp_id: z.string().optional(),
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional().nullable(),
  status: statusValue,
  priority: priorityValue,
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  estimated_cost: z.number().optional().nullable(),
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
