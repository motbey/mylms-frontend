// lib/api/workshopSessions.ts
// API helpers for workshop sessions

import { supabase } from '../supabaseClient';

export interface WorkshopSession {
  id: string;
  workshop_id: string;
  start_at: string; // ISO datetime string
  end_at: string;   // ISO datetime string
  location_override: string | null;
  max_seats_override: number | null;
  facilitator: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkshopSessionParams {
  workshopId: string;
  startDateTime: string;  // ISO string, e.g. 2025-11-26T09:00:00+08:00
  endDateTime: string;    // ISO string, must be after startDateTime
  locationOverride?: string;
  maxSeatsOverride?: number | null;
  facilitator?: string;
}

export interface UpdateWorkshopSessionParams {
  sessionId: string;          // workshop_sessions.id
  startDateTime: string;      // ISO string
  endDateTime: string;        // ISO string
  locationOverride?: string;  // optional, undefined = leave unchanged, empty string = clear
  maxSeatsOverride?: number | null; // optional, undefined = leave unchanged
  facilitator?: string;       // optional, undefined = leave unchanged, empty string = clear
  isCancelled?: boolean;      // optional, undefined = leave unchanged
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

export async function createWorkshopSession(
  params: CreateWorkshopSessionParams,
): Promise<WorkshopSession> {
  const {
    workshopId,
    startDateTime,
    endDateTime,
    locationOverride,
    maxSeatsOverride = null,
    facilitator,
  } = params;

  const { data, error } = await supabase
    .from('workshop_sessions')
    .insert({
      workshop_id: workshopId,
      start_at: startDateTime,
      end_at: endDateTime,
      location_override: locationOverride ?? null,
      max_seats_override: maxSeatsOverride,
      facilitator: facilitator ?? null,
      is_cancelled: false,
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

export async function updateWorkshopSession(
  params: UpdateWorkshopSessionParams,
): Promise<WorkshopSession> {
  const {
    sessionId,
    startDateTime,
    endDateTime,
    locationOverride,
    maxSeatsOverride,
    facilitator,
    isCancelled,
  } = params;

  // Build a partial update object
  const update: Record<string, any> = {
    start_at: startDateTime,
    end_at: endDateTime,
  };

  if (locationOverride !== undefined) {
    update.location_override =
      locationOverride === '' ? null : locationOverride;
  }

  if (maxSeatsOverride !== undefined) {
    update.max_seats_override = maxSeatsOverride;
  }

  if (facilitator !== undefined) {
    update.facilitator = facilitator === '' ? null : facilitator;
  }

  if (isCancelled !== undefined) {
    update.is_cancelled = isCancelled;
  }

  const { data, error } = await supabase
    .from('workshop_sessions')
    .update(update)
    .eq('id', sessionId)
    .select(
      'id, workshop_id, start_at, end_at, location_override, max_seats_override, facilitator, is_cancelled, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('updateWorkshopSession error', error);
    throw error;
  }

  return data as WorkshopSession;
}
