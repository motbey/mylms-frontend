// PATH: lib/api/profiles.ts

import { supabase } from '../supabaseClient';

export interface ProfileSummary {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_id: string | null;
}

export async function searchActiveProfiles(
  query: string,
  limit = 20,
): Promise<ProfileSummary[]> {
  const term = query.trim();
  if (!term) return [];

  const pattern = `%${term}%`;

  // Assumption: profiles.role = 'inactive' means not active.
  // Return only active users.
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'user_id, email, first_name, last_name, company_id',
    )
    .or(
      `first_name.ilike.${pattern},` +
      `last_name.ilike.${pattern},` +
      `email.ilike.${pattern}`
    )
    .neq('role', 'inactive')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('searchActiveProfiles error', error);
    throw error;
  }

  return (data ?? []) as ProfileSummary[];
}

