import { supabase } from '../../lib/supabaseClient';

export interface DbGroup {
  id: string;
  name: string;
}

export async function listGroups(): Promise<DbGroup[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error loading groups', error);
    throw error;
  }

  return (data ?? []) as DbGroup[];
}