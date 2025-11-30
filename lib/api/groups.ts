// PATH: lib/api/groups.ts

import { supabase } from "../supabaseClient";

export interface Group {
  id: string;
  name: string;
  type: string | null;
  created_at: string;
}

export interface GroupFilter {
  id?: string;
  group_id: string;
  role: string | null;
  company_id: string | null;
  job_title_id: string | null;
  state_code: string | null;
  location_id: string | null;
  created_at?: string;
}

export interface GroupMemberProfile {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  company_id: string | null;
  job_title_id: string | null;
  state_code: string | null;
  location_id: string | null;
}

/**
 * Group member profile with exclusion status.
 */
export interface GroupMemberProfileWithStatus extends GroupMemberProfile {
  is_excluded: boolean;
}

/**
 * Group with member count, used on the "All Groups" list page.
 */
export interface GroupWithMemberCount extends Group {
  member_count: number;
}

// ---------- Basic CRUD for groups ----------

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, type, created_at")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data as Group[];
}

/**
 * Use the RPC `get_groups_with_member_counts` to fetch groups with member counts.
 */
export async function getGroupsWithMemberCounts(): Promise<GroupWithMemberCount[]> {
  const { data, error } = await supabase.rpc("get_groups_with_member_counts");

  if (error) {
    throw new Error(error.message);
  }

  // Ensure we always return a number (fallback 0 just in case)
  return (data ?? []).map((g: any) => ({
    ...g,
    member_count: g.member_count ?? 0,
  })) as GroupWithMemberCount[];
}

export async function getGroup(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, type, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Group | null;
}

export async function createGroup(input: {
  name: string;
  type: string | null;
}): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: input.name,
      type: input.type,
    })
    .select("id, name, type, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Group;
}

export async function updateGroup(
  id: string,
  input: { name: string; type: string | null }
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .update({
      name: input.name,
      type: input.type,
    })
    .eq("id", id)
    .select("id, name, type, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Group;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------- Filters ----------

export async function getGroupFilters(groupId: string): Promise<GroupFilter[]> {
  const { data, error } = await supabase
    .from("group_filters")
    .select("*")
    .eq("group_id", groupId);

  if (error) {
    throw new Error(error.message);
  }

  return data as GroupFilter[];
}

export async function saveGroupFilters(
  groupId: string,
  filters: Omit<GroupFilter, "id" | "group_id" | "created_at">[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("group_filters")
    .delete()
    .eq("group_id", groupId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (filters.length === 0) {
    return;
  }

  const payload = filters.map((f) => ({
    group_id: groupId,
    role: f.role,
    company_id: f.company_id,
    job_title_id: f.job_title_id,
    state_code: f.state_code,
    location_id: f.location_id,
  }));

  const { error: insertError } = await supabase
    .from("group_filters")
    .insert(payload);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

// ---------- Member preview ----------

export async function getGroupMemberProfiles(
  groupId: string
): Promise<GroupMemberProfile[]> {
  const { data, error } = await supabase.rpc("get_group_member_profiles", {
    p_group_id: groupId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GroupMemberProfile[];
}

// Assign all matching members to a group via RPC
export async function assignGroupMembers(groupId: string): Promise<void> {
  if (!groupId) {
    throw new Error("Group ID is required to assign members.");
  }

  const { data, error } = await supabase.rpc("assign_group_members", {
    p_group_id: groupId,
  });

  if (error) {
    console.error("assignGroupMembers error", error);
    throw new Error(error.message || "Failed to assign group members.");
  }

  // RPC returns void, so we just return here
  return;
}

// Get member profiles with exclusion status via RPC
export async function getGroupMemberProfilesWithStatus(
  groupId: string
): Promise<GroupMemberProfileWithStatus[]> {
  const { data, error } = await supabase.rpc(
    "get_group_member_profiles_with_status",
    { p_group_id: groupId }
  );

  if (error) throw error;

  return data as GroupMemberProfileWithStatus[];
}

// Exclude a user from a group
export async function excludeUserFromGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("group_member_exclusions")
    .insert({ group_id: groupId, user_id: userId });

  if (error) {
    throw error;
  }
}

// Include a user back in a group (remove from exclusions)
export async function includeUserInGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("group_member_exclusions")
    .delete()
    .match({ group_id: groupId, user_id: userId });

  if (error) {
    throw error;
  }
}
