// PATH: lib/api/companies.ts

import { supabase } from '../supabaseClient';

export interface Company {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Returns all active companies, ordered by name ASC.
 */
export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, is_active, created_at')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('listCompanies error', error);
    throw error;
  }

  return (data ?? []) as Company[];
}

