export type UsersListRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  company: string | null;
  location: string | null;
  state: string | null;
  roles: string[] | null;
  role: string | null;
  created_at: string | null;     // ISO string from RPC
  total_count: number;
};

export type UsersListParams = {
  p_search?: string;
  p_sort?: 'name' | 'email' | 'job_title' | 'company' | 'location' | 'state' | 'created';
  p_dir?: 'asc' | 'desc';
  p_limit?: number;
  p_offset?: number;
};
