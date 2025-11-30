// PATH: lib/api/states.ts

import { supabase } from "../supabaseClient";

export interface State {
  code: string;
  name: string;
}

/**
 * Returns all states, ordered by name ASC.
 */
export async function listStates(): Promise<State[]> {
  const { data, error } = await supabase
    .from("states")
    .select("code, name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as State[];
}

