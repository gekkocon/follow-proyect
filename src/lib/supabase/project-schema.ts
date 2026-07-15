import { z } from 'zod';

// Keep form types as simple strings so react-hook-form stays happy.
// Coercion to number/null is handled in the server action.
export const projectFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'overdue']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  owner_id: z.string().optional(),   // "" or "42" — parsed to number|null in action
  start_date: z.string().optional(), // "" or "YYYY-MM-DD"
  due_date: z.string().optional(),   // "" or "YYYY-MM-DD"
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
