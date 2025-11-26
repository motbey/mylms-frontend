import { supabase } from '../../../lib/supabaseClient';

export type WorkshopDeliveryMode = 'online' | 'onsite' | 'hybrid';

export interface Workshop {
  id: string;
  title: string;
  description: string | null;
  delivery_mode: WorkshopDeliveryMode;
  location: string | null;
  max_seats: number | null;
  is_mandatory: boolean;
  allow_self_enrol: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopSession {
  id: string;
  workshop_id: string;
  start_at: string;
  end_at: string;
  location_override: string | null;
  max_seats_override: number | null;
  facilitator: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkshopEnrolment {
  id: string;
  session_id: string;
  user_id: string;
  enrolment_type: 'self' | 'assigned' | 'system';
  is_mandatory: boolean;
  status: 'enrolled' | 'waitlisted' | 'cancelled' | 'completed' | 'no_show';
  attended: boolean;
  attended_at: string | null;
  attendance_marked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkshopParams {
  title: string;
  description?: string;
  deliveryMode?: WorkshopDeliveryMode;
  location?: string;
  maxSeats?: number | null;
  isMandatory?: boolean;
  allowSelfEnrol?: boolean;
}

export async function createWorkshop(
  params: CreateWorkshopParams,
): Promise<Workshop> {
  const {
    title,
    description,
    deliveryMode = 'onsite',
    location,
    maxSeats = null,
    isMandatory = false,
    allowSelfEnrol = true,
  } = params;

  const { data, error } = await supabase
    .from('workshops')
    .insert({
      title,
      description,
      delivery_mode: deliveryMode,
      location,
      max_seats: maxSeats,
      is_mandatory: isMandatory,
      allow_self_enrol: allowSelfEnrol,
    })
    .select(
      'id, title, description, delivery_mode, location, max_seats, is_mandatory, allow_self_enrol, created_by, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('createWorkshop error', error);
    throw error;
  }

  return data as Workshop;
}

export async function listWorkshops(): Promise<Workshop[]> {
  const { data, error } = await supabase
    .from('workshops')
    .select(
      'id, title, description, delivery_mode, location, max_seats, is_mandatory, allow_self_enrol, created_by, created_at, updated_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listWorkshops error', error);
    throw error;
  }

  return (data ?? []) as Workshop[];
}

export interface CreateWorkshopSessionParams {
  workshopId: string;
  startAt: string;
  endAt: string;
  locationOverride?: string;
  maxSeatsOverride?: number | null;
  facilitator?: string;
}

export async function createWorkshopSession(
  params: CreateWorkshopSessionParams,
): Promise<WorkshopSession> {
  const {
    workshopId,
    startAt,
    endAt,
    locationOverride,
    maxSeatsOverride = null,
    facilitator,
  } = params;

  const { data, error } = await supabase
    .from('workshop_sessions')
    .insert({
      workshop_id: workshopId,
      start_at: startAt,
      end_at: endAt,
      location_override: locationOverride,
      max_seats_override: maxSeatsOverride,
      facilitator,
    })
    .select(
      'id, workshop_id, start_at, end_at, location_override, max_seats_override, facilitator, is_cancelled, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('createWorkshopSession error', error);
    throw error;
  }

  return data as WorkshopSession;
}

export async function listSessionsForWorkshop(
  workshopId: string,
): Promise<WorkshopSession[]> {
  const { data, error } = await supabase
    .from('workshop_sessions')
    .select(
      'id, workshop_id, start_at, end_at, location_override, max_seats_override, facilitator, is_cancelled, created_at, updated_at',
    )
    .eq('workshop_id', workshopId)
    .order('start_at', { ascending: true });

  if (error) {
    console.error('listSessionsForWorkshop error', error);
    throw error;
  }

  return (data ?? []) as WorkshopSession[];
}

export interface EnrolInWorkshopSessionParams {
  sessionId: string;
  userId: string;
  enrolmentType?: 'self' | 'assigned' | 'system';
  isMandatory?: boolean;
}

export async function enrolInWorkshopSession(
  params: EnrolInWorkshopSessionParams,
): Promise<WorkshopEnrolment> {
  const {
    sessionId,
    userId,
    enrolmentType = 'self',
    isMandatory = false,
  } = params;

  const { data, error } = await supabase
    .from('workshop_enrolments')
    .insert({
      session_id: sessionId,
      user_id: userId,
      enrolment_type: enrolmentType,
      is_mandatory: isMandatory,
    })
    .select(
      'id, session_id, user_id, enrolment_type, is_mandatory, status, attended, attended_at, attendance_marked_by, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('enrolInWorkshopSession error', error);
    throw error;
  }

  return data as WorkshopEnrolment;
}

export interface MarkAttendanceParams {
  enrolmentId: string;
  attended: boolean;
}

export async function markWorkshopAttendance(
  params: MarkAttendanceParams,
): Promise<WorkshopEnrolment> {
  const { enrolmentId, attended } = params;

  const { data, error } = await supabase
    .from('workshop_enrolments')
    .update({
      attended,
      attended_at: attended ? new Date().toISOString() : null,
      status: attended ? 'completed' : 'no_show',
    })
    .eq('id', enrolmentId)
    .select(
      'id, session_id, user_id, enrolment_type, is_mandatory, status, attended, attended_at, attendance_marked_by, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('markWorkshopAttendance error', error);
    throw error;
  }

  return data as WorkshopEnrolment;
}

