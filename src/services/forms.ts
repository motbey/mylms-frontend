import { supabase } from '../../lib/supabaseClient';
import type { FormSchema } from '../types/forms';

export interface DbForm {
  id: string;
  name: string;
  schema: FormSchema;
  version: number;
  created_by: string | null;
  created_at: string | null;
}

function mapDbFormToFormSchema(row: any): DbForm {
  return {
    id: row.id,
    name: row.name,
    schema: row.schema as FormSchema,
    version: row.version,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
  };
}

export async function listForms(): Promise<DbForm[]> {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading forms', error);
    throw error;
  }

  return (data ?? []).map(mapDbFormToFormSchema);
}

export async function getFormById(formId: string): Promise<DbForm | null> {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', formId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // no rows found
      return null;
    }
    console.error('Error loading form', error);
    throw error;
  }

  if (!data) return null;

  return mapDbFormToFormSchema(data);
}

interface CreateFormInput {
  name: string;
  schema: FormSchema;
  createdBy: string;
}

export async function createForm(input: CreateFormInput): Promise<DbForm> {
  const { data, error } = await supabase
    .from('forms')
    .insert({
      name: input.name,
      schema: input.schema,
      version: 1,
      created_by: input.createdBy,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating form', error);
    throw error;
  }

  return mapDbFormToFormSchema(data);
}

interface UpdateFormInput {
  name?: string;
  schema?: FormSchema;
}

export async function updateForm(
  formId: string,
  input: UpdateFormInput
): Promise<DbForm> {
  const payload: Record<string, any> = {};
  if (typeof input.name === 'string') {
    payload.name = input.name;
  }
  if (input.schema) {
    payload.schema = input.schema;
  }

  const { data, error } = await supabase
    .from('forms')
    .update(payload)
    .eq('id', formId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating form', error);
    throw error;
  }

  return mapDbFormToFormSchema(data);
}

interface DuplicateFormInput {
  formId: string;
  createdBy: string;
  nameOverride?: string;
}

export async function duplicateForm(
  input: DuplicateFormInput
): Promise<DbForm> {
  const original = await getFormById(input.formId);
  if (!original) {
    throw new Error('Form not found for duplication');
  }

  const newName = input.nameOverride || `Copy - ${original.name}`;

  const { data, error } = await supabase
    .from('forms')
    .insert({
      name: newName,
      schema: original.schema,
      version: 1,
      created_by: input.createdBy,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error duplicating form', error);
    throw error;
  }

  return mapDbFormToFormSchema(data);
}

// ===== User's Assigned Forms =====

export interface MyForm {
  assignment_id: string;
  form_id: string;
  form_name: string;
  assigned_at: string;
  due_at: string | null;
  status: 'Completed' | 'Rejected' | 'Submitted' | 'Started' | 'Not Started';
  submitted_at: string | null;
  started_at: string | null;
}

export async function listMyForms(): Promise<MyForm[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // 1. Fetch relevant assignments (direct and 'all')
  const { data: assignments, error: assignmentsError } = await supabase
    .from('form_assignments')
    .select('id, form_id, created_at, due_at, started_at')
    .or(`target_type.eq.all,and(target_type.eq.user,target_id.eq.${user.id})`);

  if (assignmentsError) throw assignmentsError;
  if (!assignments || assignments.length === 0) return [];

  const formIds = [...new Set(assignments.map(a => a.form_id))];

  // 2. Fetch latest submissions for these forms by the current user
  const { data: submissions, error: submissionsError } = await supabase
    .from('form_submissions')
    .select('form_id, submitted_at, reviewed_at, review_status, status')
    .eq('user_id', user.id)
    .in('form_id', formIds)
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (submissionsError) throw submissionsError;
  
  // Create a map of the latest submission for each form
  const submissionMap = new Map<string, typeof submissions[0]>();
  if (submissions) {
    for (const sub of submissions) {
      if (!submissionMap.has(sub.form_id)) { // Since they are ordered by latest, first one we find is the one we keep
        submissionMap.set(sub.form_id, sub);
      }
    }
  }

  // 3. Fetch form details
  const { data: forms, error: formsError } = await supabase
    .from('forms')
    .select('id, name')
    .in('id', formIds);

  if (formsError) throw formsError;

  const formMap = new Map<string, string>();
  if (forms) {
    for (const form of forms) {
      formMap.set(form.id, form.name);
    }
  }

  // 4. Combine data and calculate status
  const myForms: MyForm[] = assignments.map(assignment => {
    let status: MyForm['status'];
    const submission = submissionMap.get(assignment.form_id);

    if (submission?.review_status === 'approved') {
        status = 'Completed';
    } else if (submission?.review_status === 'rejected') {
        status = 'Rejected';
    } else if (submission?.status === 'submitted') {
        status = 'Submitted';
    } else if (submission?.status === 'started' || assignment.started_at) {
        status = 'Started';
    } else {
        status = 'Not Started';
    }

    return {
      assignment_id: assignment.id,
      form_id: assignment.form_id,
      form_name: formMap.get(assignment.form_id) || 'Unknown Form',
      assigned_at: assignment.created_at,
      due_at: assignment.due_at,
      status: status,
      submitted_at: submission?.submitted_at || null,
      started_at: assignment.started_at,
    };
  });
  
  // Sort to bring actionable items to the top
  myForms.sort((a, b) => {
    const statusOrder = { 'Rejected': 1, 'Started': 2, 'Not Started': 3, 'Submitted': 4, 'Completed': 5 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
  });

  return myForms;
}
