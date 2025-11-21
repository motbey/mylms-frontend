import { supabase } from '../../lib/supabaseClient';
import type { UsersListRow, UsersListParams } from '../types/users';

export async function fetchUsers(params: UsersListParams): Promise<{ rows: UsersListRow[]; total: number }> {
  const { p_search = '', p_sort = 'name', p_dir = 'asc', p_limit = 25, p_offset = 0 } = params || {};
  
  const { data, error } = await supabase.rpc('list_users', {
    p_search,
    p_sort,
    p_dir,
    p_limit,
    p_offset,
  });

  if (error) {
    console.error("Error fetching users from RPC:", error);
    throw new Error(error.message || "An unknown error occurred while fetching users.");
  }

  const rows = (data ?? []) as UsersListRow[];
  const total = rows.length ? rows[0].total_count : 0;
  
  return { rows, total };
}