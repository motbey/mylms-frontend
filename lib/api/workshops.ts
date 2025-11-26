// lib/api/workshops.ts
// API helpers for Workshops

import { supabase } from '../supabaseClient';

export type WorkshopDeliveryMode = 'onsite' | 'online' | 'hybrid';

export interface Workshop {
  id: string;
  title: string;
  description: string | null;
  delivery_mode: WorkshopDeliveryMode;
  location: string | null;
  max_seats: number | null;
  is_mandatory: boolean;
  allow_self_enrol: boolean;
  workshop_date: string | null; // date (YYYY-MM-DD) from DB
  start_time: string | null;    // timestamptz ISO string
  end_time: string | null;      // timestamptz ISO string
  created_at: string;
}

export interface CreateWorkshopParams {
  title: string;
  description?: string;
  deliveryMode?: WorkshopDeliveryMode;
  location?: string;
  maxSeats?: number | null;
  isMandatory?: boolean;
  allowSelfEnrol?: boolean;
  /**
   * Workshop calendar date in `YYYY-MM-DD` format.
   */
  workshopDate: string;
  /**
   * Full ISO datetime string for the start (e.g. `2025-11-26T09:00:00+08:00`).
   */
  startDateTime: string;
  /**
   * Full ISO datetime string for the end (e.g. `2025-11-26T11:00:00+08:00`).
   */
  endDateTime: string;
}

export async function listWorkshops(): Promise<Workshop[]> {
  const { data, error } = await supabase
    .from('workshops')
    .select(
      'id, title, description, delivery_mode, location, max_seats, is_mandatory, allow_self_enrol, workshop_date, start_time, end_time, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listWorkshops error', error);
    throw error;
  }

  return (data ?? []) as Workshop[];
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
    workshopDate,
    startDateTime,
    endDateTime,
  } = params;

  const { data, error } = await supabase
    .from('workshops')
    .insert({
      title,
      description: description ?? null,
      delivery_mode: deliveryMode,
      location: location ?? null,
      max_seats: maxSeats,
      is_mandatory: isMandatory,
      allow_self_enrol: allowSelfEnrol,
      workshop_date: workshopDate,
      start_time: startDateTime,
      end_time: endDateTime,
    })
    .select(
      'id, title, description, delivery_mode, location, max_seats, is_mandatory, allow_self_enrol, workshop_date, start_time, end_time, created_at',
    )
    .single();

  if (error) {
    console.error('createWorkshop error', error);
    throw error;
  }

  return data as Workshop;
}
