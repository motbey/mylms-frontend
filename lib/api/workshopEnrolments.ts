// PATH: lib/api/workshopEnrolments.ts

import { supabase } from '../supabaseClient';

export interface WorkshopEnrolment {
  id: string;
  session_id: string;
  user_id: string;
  enrolment_type: string; // 'admin' | 'self' | 'import' etc.
  is_mandatory: boolean;
  status: string; // 'enrolled' | 'waitlisted' | 'cancelled' | 'no_show' | 'completed'
  attended: boolean;
  attended_at: string | null;
  attendance_marked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkshopEnrolmentsParams {
  sessionId: string;
  userIds: string[];            // one or many users to enrol
  enrolmentType?: string;       // default: 'admin'
  isMandatory?: boolean;        // default: false
  initialStatus?: string;       // default: 'enrolled'
}

export async function listEnrolmentsForSession(
  sessionId: string,
): Promise<WorkshopEnrolment[]> {
  const { data, error } = await supabase
    .from('workshop_enrolments')
    .select(
      'id, session_id, user_id, enrolment_type, is_mandatory, status, attended, attended_at, attendance_marked_by, created_at, updated_at',
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listEnrolmentsForSession error', error);
    throw error;
  }

  return (data ?? []) as WorkshopEnrolment[];
}

/**
 * Enrol one or more users into a workshop session.
 * NOTE: This does not yet check for duplicates or capacity limits –
 * we'll add that logic in later steps.
 */
export async function createWorkshopEnrolments(
  params: CreateWorkshopEnrolmentsParams,
): Promise<WorkshopEnrolment[]> {
  const {
    sessionId,
    userIds,
    enrolmentType = 'admin',
    isMandatory = false,
    initialStatus = 'enrolled',
  } = params;

  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  if (!userIds || userIds.length === 0) {
    throw new Error('At least one userId is required');
  }

  const rowsToInsert = userIds.map((userId) => ({
    session_id: sessionId,
    user_id: userId,
    enrolment_type: enrolmentType,
    is_mandatory: isMandatory,
    status: initialStatus,
    attended: false,
    attended_at: null,
    attendance_marked_by: null,
  }));

  const { data, error } = await supabase
    .from('workshop_enrolments')
    .insert(rowsToInsert)
    .select(
      'id, session_id, user_id, enrolment_type, is_mandatory, status, attended, attended_at, attendance_marked_by, created_at, updated_at',
    );

  if (error) {
    console.error('createWorkshopEnrolments error', error);
    throw error;
  }

  return (data ?? []) as WorkshopEnrolment[];
}

