'use server'

import { createClient } from '@/lib/supabase/server'
import { createLocusEvent, deleteLocusEvent } from '@/lib/db/locus-events'
import { revalidatePath } from 'next/cache'
import type { LocusEvent } from '@/lib/types'

export async function createLocusEventAction(input: {
  title: string
  startDatetime: string
  endDatetime: string
  isAllDay?: boolean
  location?: string | null
  description?: string | null
  color?: string | null
}): Promise<LocusEvent> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const event = await createLocusEvent(user.id, input)
  revalidatePath('/planner')
  return event
}

export async function deleteLocusEventAction(eventId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await deleteLocusEvent(user.id, eventId)
  revalidatePath('/planner')
}
