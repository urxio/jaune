'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type GoalFormData = {
  title: string
  category: string
  timeframe: string
  progress_pct: number
  target_date: string | null
  status: string
  tracking_mode: 'manual' | 'steps' | 'habits'
}

export async function createGoalAction(data: GoalFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: created, error } = await supabase.from('goals').insert({
    user_id: user.id,
    title: data.title,
    category: data.category,
    timeframe: data.timeframe,
    progress_pct: data.tracking_mode === 'habits' ? 0 : data.progress_pct,
    target_date: data.target_date || null,
    status: data.status,
    tracking_mode: data.tracking_mode,
  }).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/brief')
  return created
}

export async function updateGoalAction(goalId: string, data: Partial<GoalFormData>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('goals')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/brief')
}

/**
 * Reset a goal back to a fresh state: progress to 0%, all steps unchecked,
 * and every habit linked to it unlinked (so it stops contributing to
 * habit-tracked progress). A completed goal is reopened to 'active'.
 */
export async function resetGoalAction(goalId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: goal, error: goalErr } = await supabase
    .from('goals')
    .select('status')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()
  if (goalErr) throw new Error(goalErr.message)

  const { error } = await supabase
    .from('goals')
    .update({
      progress_pct: 0,
      status: goal.status === 'completed' ? 'active' : goal.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  const { error: stepsErr } = await supabase
    .from('goal_steps')
    .update({ completed: false, completed_at: null })
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
  if (stepsErr) throw new Error(stepsErr.message)

  const { error: habitsErr } = await supabase
    .from('habits')
    .update({ goal_id: null, goal_target_count: null })
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
  if (habitsErr) throw new Error(habitsErr.message)

  revalidatePath('/goals')
  revalidatePath('/habits')
  revalidatePath('/brief')
  revalidatePath('/', 'layout')
}

export async function deleteGoalAction(goalId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/brief')
}
