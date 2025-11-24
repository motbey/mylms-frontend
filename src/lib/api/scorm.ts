import { supabase } from '../../../lib/supabaseClient';

export interface ScormModuleSummary {
  id: string;
  title: string;
}

export async function listScormModules(): Promise<ScormModuleSummary[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("id, title")
    .eq("type", "scorm")
    .order("title", { ascending: true });

  if (error) {
    console.error("listScormModules error", error);
    throw error;
  }

  return data ?? [];
}