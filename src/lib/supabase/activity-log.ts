import { createAuthServerClient } from './server';
import { getActiveUser } from './active-user';

// ---------------------------------------------------------------------------
// Etapa 3, paso 1 — activity_log (ARQUITECTURA-WORKPLAN.md §3).
//
// No 'use server': this is a plain helper imported by server action
// modules, same reason update-normalize.ts and work-plan.ts skip the
// directive — a module with 'use server' can only export async functions
// meant to be called directly from the client, and this one is only ever
// called from inside other server actions.
// ---------------------------------------------------------------------------

// Etapa 3, paso 4 — 'project' se agrega para la fila de resumen que inserta
// import_work_plan (una por corrida, no una por entidad creada). Esa fila la
// escribe la propia función SQL con un INSERT directo, no logActivityChange:
// este helper solo amplía el tipo para que el resto del código (lectura de
// filas de activity_log, si alguna vez se agrega) sepa que 'project' es un
// entity_type válido.
export type ActivityEntityType = 'phase' | 'task' | 'subtask' | 'project';

/**
 * Best-effort audit trail. Never throws and never returns an error to the
 * caller: by the time this runs, the real write to the entity already
 * succeeded (callers invoke this AFTER their own `if (error) return`), so a
 * failed log insert is not worth surfacing as a failure of the operation
 * the user actually asked for. Failures are logged to console only.
 *
 * `user_id` comes from `getActiveUser()` internally — never accepted as a
 * parameter, so a caller cannot forge who made the change.
 */
export async function logActivityChange(
  entityType: ActivityEntityType,
  entityId: number,
  field: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  try {
    const activeUser = await getActiveUser();
    if (!activeUser) return;

    const supabase = await createAuthServerClient();
    const { error } = await supabase.from('activity_log').insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: activeUser.id,
      field,
      old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
      new_value: newValue === null || newValue === undefined ? null : String(newValue),
    });

    if (error) {
      console.error('[logActivityChange] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[logActivityChange] unexpected error:', err);
  }
}
