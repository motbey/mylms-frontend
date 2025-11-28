// PATH: lib/api/workshopEnrolments.ts

import { supabase } from "../supabaseClient";

export interface WorkshopEnrolment {
  id: string;
  session_id: string;
  user_id: string;
  enrolment_type: string | null;
  is_mandatory: boolean;
  status: string;
  attended: boolean;
  attended_at: string | null;
  attendance_marked_by: string | null;
  created_at: string;
  updated_at: string;
  learner_name?: string | null;
  learner_email?: string | null;
}

export interface CreateWorkshopEnrolmentsParams {
  sessionId: string;
  userIds: string[];
  enrolmentType?: string;
  isMandatory?: boolean;
}

export interface EnrolCompanyInSessionParams {
  sessionId: string;
  companyId: string;
  enrolmentType?: string;
  isMandatory?: boolean;
}

export interface EnrolUsersInSessionParams {
  sessionId: string;
  userIds: string[]; // array of user UUIDs
  isMandatory?: boolean; // default false
}

export interface CompanyEnrolResultSummary {
  createdCount: number; // number of new enrolments created
  skippedCount: number; // number of users who were already enrolled in this workshop
  totalTargets: number; // total number of users considered (created + skipped)
}

// List all enrolments for a given session
export async function listEnrolmentsForSession(
  sessionId: string
): Promise<WorkshopEnrolment[]> {
  const { data: enrolments, error } = await supabase
    .from("workshop_enrolments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listEnrolmentsForSession error", error);
    throw error;
  }

  if (!enrolments || enrolments.length === 0) return [];

  // Collect unique user_ids
  const userIds = Array.from(
    new Set(enrolments.map((e) => e.user_id).filter(Boolean))
  );

  let profilesById: Record<
    string,
    { full_name: string | null; email: string | null }
  > = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("listEnrolmentsForSession profiles error", profilesError);
      throw profilesError;
    }

    profilesById =
      profiles?.reduce(
        (
          acc,
          p: {
            user_id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
          }
        ) => {
          // Combine first_name and last_name into full_name
          const fullName =
            [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
          acc[p.user_id] = { full_name: fullName, email: p.email };
          return acc;
        },
        {} as Record<string, { full_name: string | null; email: string | null }>
      ) ?? {};
  }

  return enrolments.map((e) => ({
    ...e,
    learner_name: profilesById[e.user_id]?.full_name ?? null,
    learner_email: profilesById[e.user_id]?.email ?? null,
  })) as WorkshopEnrolment[];
}

// Enrol specific users into a session
export async function createWorkshopEnrolments(
  params: CreateWorkshopEnrolmentsParams
): Promise<WorkshopEnrolment[]> {
  const {
    sessionId,
    userIds,
    enrolmentType = "manual",
    isMandatory = true,
  } = params;

  if (!userIds.length) return [];

  const rows = userIds.map((userId) => ({
    session_id: sessionId,
    user_id: userId,
    enrolment_type: enrolmentType,
    is_mandatory: isMandatory,
    status: "pending",
    attended: false,
  }));

  const { data, error } = await supabase
    .from("workshop_enrolments")
    .insert(rows)
    .select(
      "id, session_id, user_id, enrolment_type, is_mandatory, status, attended, attended_at, attendance_marked_by, created_at, updated_at"
    );

  if (error) {
    console.error("createWorkshopEnrolments error", error);
    throw error;
  }

  return (data ?? []) as WorkshopEnrolment[];
}

// Enrol ALL active users in a company into a session (via Postgres function)
export async function enrolCompanyInSession(
  params: EnrolCompanyInSessionParams
): Promise<CompanyEnrolResultSummary> {
  const {
    sessionId,
    companyId,
    enrolmentType = "company",
    isMandatory = true,
  } = params;

  const { data, error } = await supabase.rpc(
    "enrol_company_in_workshop_session",
    {
      _session_id: sessionId,
      _company_id: companyId,
      _enrolment_type: enrolmentType,
      _is_mandatory: isMandatory,
    }
  );

  if (error) {
    console.error("enrolCompanyInSession error", error);
    throw error;
  }

  // RPC now returns rows with { user_id: uuid, was_created: boolean }
  const rows = (data ?? []) as Array<{ user_id: string; was_created: boolean }>;

  const createdCount = rows.filter((row) => row.was_created === true).length;
  const skippedCount = rows.filter((row) => row.was_created === false).length;
  const totalTargets = rows.length;

  return {
    createdCount,
    skippedCount,
    totalTargets,
  };
}

// Enrol specific users into a session (via Postgres function)
export async function enrolUsersInSession({
  sessionId,
  userIds,
  isMandatory = false,
}: EnrolUsersInSessionParams): Promise<{
  data: WorkshopEnrolment[] | null;
  error: Error | null;
}> {
  if (!userIds.length) {
    return { error: new Error("No users selected"), data: null };
  }

  const { data, error } = await supabase.rpc(
    "enrol_users_in_workshop_session",
    {
      _session_id: sessionId,
      _user_ids: userIds,
      _enrolment_type: "manual",
      _is_mandatory: isMandatory,
    }
  );

  if (error) {
    console.error("enrolUsersInSession error", error);
    return { data: null, error };
  }

  return { data: (data ?? []) as WorkshopEnrolment[], error: null };
}

// Enrol a single user into a session (via Postgres function)
// Throws if the learner is already enrolled in this workshop
export async function enrolUserInWorkshopSession(params: {
  sessionId: string;
  userId: string;
  enrolmentType?: string; // default 'manual'
  isMandatory?: boolean; // default false
}): Promise<WorkshopEnrolment> {
  const { sessionId, userId, enrolmentType, isMandatory } = params;

  const { data, error } = await supabase.rpc("enrol_user_in_workshop_session", {
    p_session_id: sessionId,
    p_user_id: userId,
    p_enrolment_type: enrolmentType ?? "manual",
    p_is_mandatory: isMandatory ?? false,
  });

  if (error) {
    throw error;
  }

  return data as WorkshopEnrolment;
}

// Delete an enrolment from a session
export async function deleteWorkshopEnrolment(
  enrolmentId: string
): Promise<void> {
  const { error } = await supabase
    .from("workshop_enrolments")
    .delete()
    .eq("id", enrolmentId);

  if (error) {
    console.error("deleteWorkshopEnrolment error", error);
    throw error;
  }
}
