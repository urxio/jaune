import { createClient } from '@/lib/supabase/server'
import type { LocusEvent } from '@/lib/types'

/** Fetch all Locus events whose start falls within [startISO, endISO]. */
export async function getLocusEvents(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<LocusEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('locus_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_datetime', startISO)
    .lte('start_datetime', endISO)
    .order('start_datetime', { ascending: true })
  if (error) { console.error('getLocusEvents:', error); return [] }
  return (data ?? []) as LocusEvent[]
}

export type CreateLocusEventInput = {
  title: string
  startDatetime: string  // ISO with tz offset
  endDatetime: string
  isAllDay?: boolean
  location?: string | null
  description?: string | null
  color?: string | null
}

export async function createLocusEvent(
  userId: string,
  input: CreateLocusEventInput,
): Promise<LocusEvent> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('locus_events')
    .insert({
      user_id:        userId,
      title:          input.title.trim(),
      start_datetime: input.startDatetime,
      end_datetime:   input.endDatetime,
      is_all_day:     input.isAllDay ?? false,
      location:       input.location ?? null,
      description:    input.description ?? null,
      color:          input.color ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as LocusEvent
}

export async function deleteLocusEvent(userId: string, eventId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('locus_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function updateLocusEvent(
  userId: string,
  eventId: string,
  updates: Partial<{
    title: string
    start_datetime: string
    end_datetime: string
    is_all_day: boolean
    location: string | null
    description: string | null
    color: string | null
  }>,
): Promise<LocusEvent> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('locus_events')
    .update(updates)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as LocusEvent
}
