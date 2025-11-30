// PATH: lib/api/jobTitles.ts

import { supabase } from "../supabaseClient";

export interface JobTitle {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Returns all active job titles, ordered by name ASC.
 */
export async function listJobTitles(): Promise<JobTitle[]> {
  const { data, error } = await supabase
    .from("job_titles")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JobTitle[];
}

