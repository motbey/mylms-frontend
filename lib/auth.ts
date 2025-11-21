import { supabase } from './supabaseClient';
import { UserRole } from '../types';
import { User } from '@supabase/supabase-js';

interface UserAndRole {
  user: User | null;
  role: UserRole | string | null;
}

export async function getUserAndRole(): Promise<UserAndRole> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = 'exact one row not found' which is fine for new users
    console.error('Error fetching user active_role:', error.message);
    return { user, role: null };
  }

  return { user, role: data?.role ?? null };
}

export function redirectByRole(role: UserRole | string | null): string {
  if (!role) {
    return '/login';
  }
  switch (role) {
    case UserRole.Admin:
    case UserRole.SubAdmin:
      return '/admin';
    case UserRole.User:
    case UserRole.Security:
      return '/dashboard';
    default:
      return '/login';
  }
}