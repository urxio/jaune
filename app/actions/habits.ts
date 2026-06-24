'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { deriveFrequencyMeta } from '@/lib/habits/utils'
import { syncHabitGoalProgress } from '@/app/actions/goal-steps'

/* ── LOG / UNLOG (any date) ── */

export async function logHabitAction(habitId: string, date?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const logged_date = date ?? new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, user_id: user.id, logged_date },
      { onConflict: 'habit_id,logged_date' }
    )
  if (error) throw new Error(error.message)

  // If this habit is linked to a habit-tracked goal, sync its progress
  await maybeSyncGoalProgress(supabase, habitId, user.id)

  revalidatePath('/habits')
  revalidatePath('/brief')
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
}

export async function unlogHabitAction(habitId: string, date?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const logged_date = date ?? new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habitId)
    .eq('user_id', user.id)
    .eq('logged_date', logged_date)
  if (error) throw new Error(error.message)

  // If this habit is linked to a habit-tracked goal, sync its progress
  await maybeSyncGoalProgress(supabase, habitId, user.id)

  revalidatePath('/habits')
  revalidatePath('/brief')
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
}

/** Check if the habit's linked goal uses tracking_mode='habits'; if so, sync.
 *  Uses the already-authenticated client to avoid session-propagation issues. */
async function maybeSyncGoalProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  habitId: string,
  userId: string,
): Promise<void> {
  const { data: habit, error: hErr } = await supabase
    .from('habits')
    .select('goal_id')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()
  if (hErr) { console.error('[maybeSyncGoalProgress] habit fetch:', hErr); return }
  if (!habit?.goal_id) return

  const { data: goal, error: gErr } = await supabase
    .from('goals')
    .select('tracking_mode')
    .eq('id', habit.goal_id)
    .eq('user_id', userId)
    .single()
  if (gErr) { console.error('[maybeSyncGoalProgress] goal fetch:', gErr); return }
  if (goal?.tracking_mode !== 'habits') return

  // Pass the same authenticated client — avoids creating a second session
  await syncHabitGoalProgress(habit.goal_id, userId, supabase)
}

/** Link (or unlink) an existing habit to a goal and optionally set a target count. */
export async function linkHabitToGoalAction(
  habitId: string,
  goalId: string | null,
  goalTargetCount: number | null,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: current } = await supabase
    .from('habits')
    .select('goal_id, goal_linked_at')
    .eq('id', habitId)
    .eq('user_id', user.id)
    .single()

  // Only stamp a fresh link date when actually (re-)linking to a different
  // goal — re-saving the same link (e.g. updating its target count) must
  // not reset the window progress is counted from.
  const isNewLink = !!goalId && current?.goal_id !== goalId
  const goal_linked_at = goalId
    ? (isNewLink || !current?.goal_linked_at ? new Date().toISOString() : current.goal_linked_at)
    : null

  const { error } = await supabase
    .from('habits')
    .update({ goal_id: goalId, goal_target_count: goalId ? goalTargetCount : null, goal_linked_at })
    .eq('id', habitId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  if (goalId) await maybeSyncGoalProgress(supabase, habitId, user.id)

  revalidatePath('/habits')
  revalidatePath('/goals')
}

/* ── CRUD ── */

export type HabitFormData = {
  name: string
  emoji: string
  days_of_week: number[]        // empty [] = every day; [1,3,5] = Mon/Wed/Fri
  ends_at: string | null        // ISO date or null
  goal_id: string | null        // optional link to a goal
  goal_target_count: number | null  // completions target for the linked goal
  motivation: string | null     // why the user wants this habit
  time_of_day: string | null    // specific HH:MM time (e.g. "07:30"), or null
}


export async function createHabitAction(data: HabitFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { frequency, target_count } = deriveFrequencyMeta(data.days_of_week)
  const days_of_week = data.days_of_week.length > 0 ? data.days_of_week : null

  const { data: created, error } = await supabase.from('habits').insert({
    user_id: user.id,
    name: data.name.trim(),
    emoji: data.emoji,
    frequency,
    days_of_week,
    target_count,
    ends_at: data.ends_at || null,
    goal_id: data.goal_id || null,
    goal_target_count: data.goal_id ? (data.goal_target_count || null) : null,
    goal_linked_at: data.goal_id ? new Date().toISOString() : null,
    motivation: data.motivation?.trim() || null,
    time_of_day: data.time_of_day || null,
  }).select().single()
  if (error) throw new Error(error.message)

  // If linked to a habit-tracked goal, sync goal progress immediately
  // so pre-existing log data is reflected without needing a new check-in.
  if (data.goal_id) await maybeSyncGoalProgress(supabase, created.id, user.id)

  revalidatePath('/habits')
  revalidatePath('/brief')
  revalidatePath('/goals')

  return created
}

export async function updateHabitAction(habitId: string, data: HabitFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { frequency, target_count } = deriveFrequencyMeta(data.days_of_week)
  const days_of_week = data.days_of_week.length > 0 ? data.days_of_week : null

  const { data: current } = await supabase
    .from('habits')
    .select('goal_id, goal_linked_at')
    .eq('id', habitId)
    .eq('user_id', user.id)
    .single()

  // Only stamp a fresh link date when the linked goal is actually changing —
  // editing other habit fields while the link stays the same must not reset
  // the window progress is counted from.
  const isNewLink = !!data.goal_id && current?.goal_id !== data.goal_id
  const goal_linked_at = data.goal_id
    ? (isNewLink || !current?.goal_linked_at ? new Date().toISOString() : current.goal_linked_at)
    : null

  const { error } = await supabase
    .from('habits')
    .update({
      name: data.name.trim(),
      emoji: data.emoji,
      frequency,
      days_of_week,
      target_count,
      ends_at: data.ends_at || null,
      goal_id: data.goal_id || null,
      goal_target_count: data.goal_id ? (data.goal_target_count || null) : null,
      goal_linked_at,
      motivation: data.motivation?.trim() || null,
      time_of_day: data.time_of_day || null,
    })
    .eq('id', habitId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  // Re-sync goal progress whenever a habit is linked/updated —
  // covers linking a pre-existing habit that already has log data.
  if (data.goal_id) await maybeSyncGoalProgress(supabase, habitId, user.id)

  revalidatePath('/habits')
  revalidatePath('/brief')
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
}

/**
 * Set (or clear) a habit's time, either for a single calendar date
 * ("this occurrence only") or for every occurrence ("all").
 *
 * scope='all'  → updates habits.time_of_day + deletes any per-date overrides
 * scope='this' → upserts a row in habit_time_overrides for that date
 */
export async function setHabitTimeAction(
  habitId: string,
  date: string,          // YYYY-MM-DD — only used when scope='this'
  timeOfDay: string | null,  // "HH:MM" or null to clear
  scope: 'this' | 'all',
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (scope === 'all') {
    const { error } = await supabase
      .from('habits')
      .update({ time_of_day: timeOfDay })
      .eq('id', habitId)
      .eq('user_id', user.id)
    if (error) throw new Error(error.message)
    // Wipe overrides — the habit-level value now applies everywhere
    await supabase
      .from('habit_time_overrides')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
  } else {
    const { error } = await supabase
      .from('habit_time_overrides')
      .upsert(
        { user_id: user.id, habit_id: habitId, date, time_of_day: timeOfDay },
        { onConflict: 'habit_id,date' },
      )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/brief')
}

export async function deleteHabitAction(habitId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Logs cascade-delete via FK in Supabase, but delete explicitly to be safe
  await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('user_id', user.id)

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/habits')
  revalidatePath('/brief')
}
