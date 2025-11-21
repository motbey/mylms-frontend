import { supabase } from '../../lib/supabaseClient';

// ===== Types =====

export type FormAssignmentTargetType = 'user' | 'group' | 'all';

export interface DbFormAssignment {
  id: string;
  form_id: string;
  target_type: FormAssignmentTargetType;
  target_id: string | null;
  is_dynamic: boolean;
  due_at: string | null; // ISO date string or null
  created_by: string;
  created_at: string;
}

export interface CreateFormAssignmentInput {
  formId: string;
  targetType: FormAssignmentTargetType;
  targetId?: string | null; // required when targetType is 'user' or 'group'
  isDynamic?: boolean; // only relevant when targetType = 'group'
  dueAt?: string | null; // ISO datetime string or null
  createdBy: string;
}

// ===== Mapper =====

function mapRowToDbFormAssignment(row: any): DbFormAssignment {
  return {
    id: row.id,
    form_id: row.form_id,
    target_type: row.target_type,
    target_id: row.target_id,
    is_dynamic: row.is_dynamic,
    due_at: row.due_at,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

// ===== Service Functions =====

/**
 * Lists all assignments for a specific form.
 * @param formId The UUID of the form.
 * @returns A promise that resolves to an array of form assignments.
 */
export async function listAssignmentsForForm(formId: string): Promise<DbFormAssignment[]> {
  const { data, error } = await supabase
    .from('form_assignments')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading form assignments', error);
    throw error;
  }

  return (data ?? []).map(mapRowToDbFormAssignment);
}

/**
 * Creates a new assignment for a form.
 * @param input The details of the assignment to create.
 * @returns A promise that resolves to the newly created assignment.
 */
export async function createFormAssignment(
  input: CreateFormAssignmentInput
): Promise<DbFormAssignment> {
  // Guard clause for required targetId
  if ((input.targetType === 'user' || input.targetType === 'group') && !input.targetId) {
    throw new Error('A target ID is required for user and group assignments.');
  }

  const payload: any = {
    form_id: input.formId,
    target_type: input.targetType,
    target_id: input.targetType === 'all' ? null : input.targetId ?? null,
    is_dynamic: input.targetType === 'group' ? Boolean(input.isDynamic) : false,
    due_at: input.dueAt ?? null,
    created_by: input.createdBy,
  };

  const { data, error } = await supabase
    .from('form_assignments')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating form assignment', error);
    throw error;
  }

  return mapRowToDbFormAssignment(data);
}

/**
 * Deletes a form assignment by its ID.
 * @param id The UUID of the assignment to delete.
 */
export async function deleteFormAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('form_assignments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting form assignment', error);
    throw error;
  }
}
