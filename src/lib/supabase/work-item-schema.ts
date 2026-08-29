import { z } from 'zod';

// -----------------------------------------------------------------
// Common fields shared by bug / debt / question_rfc
// -----------------------------------------------------------------
const baseWorkItemSchema = z.object({
  project_id: z.number().int().positive(),
  title: z.string().min(1, 'El título es obligatorio.').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  // Optional link to where this work item came from — zero or more
  // origins in the DB, but the create form only needs one at a time.
  origin_type: z.enum(['phase', 'task', 'subtask']).optional(),
  origin_id: z.number().int().positive().optional(),
  // Not a column on work_items — pulled out before the insert/update and
  // used separately to call syncWorkItemAssignees, same split TaskInput/
  // SubtaskInput already use for assigneeIds.
  assigneeIds: z.array(z.number()).optional().default([]),
});

// -----------------------------------------------------------------
// Type-specific fields — nullable in DB, optional here
// -----------------------------------------------------------------
const bugFieldsSchema = z.object({
  severity: z.enum(['minor', 'major', 'blocker']).optional(),
  environment: z.string().max(200).optional(),
  version: z.string().max(50).optional(),
  reproduction_steps: z.string().max(5000).optional(),
  expected_behavior: z.string().max(2000).optional(),
  actual_behavior: z.string().max(2000).optional(),
});

const debtFieldsSchema = z.object({
  impact: z.enum(['low', 'medium', 'high']).optional(),
  proposed_solution: z.string().max(5000).optional(),
  estimated_effort: z.string().max(100).optional(),
  target_phase_id: z.number().int().positive().optional(),
});

const questionRfcFieldsSchema = z.object({
  options: z.array(z.string()).optional(),
  recommendation: z.string().max(5000).optional(),
});

// -----------------------------------------------------------------
// Discriminated union by `type` — matches work_item_type enum
// -----------------------------------------------------------------
export const createWorkItemSchema = z.discriminatedUnion('type', [
  baseWorkItemSchema.merge(bugFieldsSchema).extend({ type: z.literal('bug') }),
  baseWorkItemSchema.merge(debtFieldsSchema).extend({ type: z.literal('debt') }),
  baseWorkItemSchema.merge(questionRfcFieldsSchema).extend({ type: z.literal('question_rfc') }),
]);

export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

// updateWorkItem: same fields as create minus project_id/type (both
// immutable after creation), everything optional since it's a patch.
export const updateWorkItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['open', 'in_progress', 'awaiting_decision', 'resolved', 'discarded']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  severity: z.enum(['minor', 'major', 'blocker']).optional(),
  environment: z.string().max(200).optional(),
  version: z.string().max(50).optional(),
  reproduction_steps: z.string().max(5000).optional(),
  expected_behavior: z.string().max(2000).optional(),
  actual_behavior: z.string().max(2000).optional(),
  resolution: z.string().max(5000).optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  proposed_solution: z.string().max(5000).optional(),
  estimated_effort: z.string().max(100).optional(),
  target_phase_id: z.number().int().positive().optional(),
  options: z.array(z.string()).optional(),
  recommendation: z.string().max(5000).optional(),
  final_decision: z.string().max(5000).optional(),
  // Same shape as subtasks.checklist in ARQUITECTURA-WORKPLAN.md. The
  // client always sends the full array — no partial patch of one item.
  checklist: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        done: z.boolean(),
        order: z.number(),
      })
    )
    .optional(),
  assigneeIds: z.array(z.number()).optional().default([]),
});

export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
