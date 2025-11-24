import { supabase } from '../../../lib/supabaseClient';

export interface FormSummary {
  id: string;
  name: string;
}

export async function listForms(): Promise<FormSummary[]> {
  const { data, error } = await supabase
    .from("forms")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("listForms error", error);
    throw error;
  }

  return data ?? [];
}