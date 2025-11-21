import { supabase } from '../../lib/supabaseClient';

export type Profile = {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  roles: string[];
  role: string;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, first_name, last_name, roles, role')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return data as Profile | null;
}

export async function setActiveRole(nextRole: 'admin' | 'user'): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating active role:', error);
      throw new Error('Could not switch role. Please try again.');
    }
}