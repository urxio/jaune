'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WeeklyPlanBlock } from '@/lib/types'

export async function addPlanBlock(
  weekStart: string,
  dayOfWeek: number,
  timeSlot: string,
  title: string,
  type: 'goal' | 'custom',
  referenceId?: string,
): Promise<WeeklyPlanBlock> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('weekly_plans')
    .insert({
      user_id: user.id,
      week_start: weekStart,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      title,
      type,
      reference_id: referenceId ?? null,
      accepted: true,
      position: 0,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/planner')
  revalidatePath('/brief')

  return data as WeeklyPlanBlock
}

export async function removePlanBlock(blockId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('weekly_plans')
    .delete()
    .eq('id', blockId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/planner')
  revalidatePath('/brief')
}

export async function acceptSuggestion(blockId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('weekly_plans')
    .update({ accepted: true })
    .eq('id', blockId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/planner')
  revalidatePath('/brief')
}

export async function dismissSuggestion(blockId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('weekly_plans')
    .delete()
    .eq('id', blockId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/planner')
}

export async function saveSuggestions(
  blocks: Array<{
    weekStart: string
    dayOfWeek: number
    timeSlot: string
    title: string
    type: 'goal' | 'custom'
    referenceId?: string
  }>
): Promise<WeeklyPlanBlock[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = blocks.map((b, i) => ({
    user_id: user.id,
    week_start: b.weekStart,
    day_of_week: b.dayOfWeek,
    time_slot: b.timeSlot,
    title: b.title,
    type: b.type,
    reference_id: b.referenceId ?? null,
    accepted: false,
    position: i,
  }))

  const { data, error } = await supabase
    .from('weekly_plans')
    .insert(rows)
    .select()
  if (error) throw new Error(error.message)

  revalidatePath('/planner')

  return (data ?? []) as WeeklyPlanBlock[]
}

export async function setHabitTimeOfDay(
  habitId: string,
  timeOfDay: string | null,  // "HH:MM" (e.g. "07:30") or null to clear
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('habits')
    .update({ time_of_day: timeOfDay })
    .eq('id', habitId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/planner')
  revalidatePath('/brief')
}
