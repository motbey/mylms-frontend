// PATH: lib/api/locations.ts

import { supabase } from "../supabaseClient";

export interface Location {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Returns all active locations, ordered by name ASC.
 */
export async function listLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Location[];
}

