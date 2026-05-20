'use server'

import { createClient } from '@/lib/supabase/server'
import { generateGoalSteps } from '@/lib/ai/goal-steps'
import { revalidatePath } from 'next/cache'
import type { GoalStep } from '@/lib/types'

/* ── AI GENERATION ──────────────────────────────────── */

/** Generate AI steps for a newly created goal and save them to DB. */
export async function generateAndSaveStepsAction(goalId: string): Promise<GoalStep[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: goal } = await supabase
    .from('goals')
    .select('title, category, timeframe, target_date, progress_pct')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()
  if (!goal) throw new Error('Goal not found')

  const rawSteps = await generateGoalSteps(goal)
  if (rawSteps.length === 0) return []

  const toInsert = rawSteps.map((s, i) => ({
    goal_id: goalId,
    user_id: user.id,
    title: s.title.trim(),
    due_date: s.due_date ?? null,
    completed: false,
    position: i,
  }))

  const { data: saved, error } = await supabase
    .from('goal_steps')
    .insert(toInsert)
    .select()
  if (error) throw new Error(error.message)

  revalidatePath('/goals')
  revalidatePath('/brief')
  revalidatePath('/', 'layout')
  return (saved ?? []) as GoalStep[]
}

/* ── TOGGLE (check/uncheck a step) ─────────────────── */

/** Toggle a step and sync the parent goal's progress_pct. */
export async function toggleStepAction(stepId: string, completed: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: step, error } = await supabase
    .from('goal_steps')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', stepId)
    .eq('user_id', user.id)
    .select('goal_id')
    .single()
  if (error) throw new Error(error.message)

  await syncGoalProgress(step.goal_id, user.id)
  revalidatePath('/goals')
  revalidatePath('/brief')
  revalidatePath('/', 'layout')
}

/* ── CREATE ─────────────────────────────────────────── */

export async function createStepAction(
  goalId: string,
  title: string,
  due_date: string | null
): Promise<GoalStep> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get current max position
  const { data: last } = await supabase
    .from('goal_steps')
    .select('position')
    .eq('goal_id', goalId)
    .order('position', { ascending: false })
    .limit(1)
    .single()
  const position = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('goal_steps')
    .insert({ goal_id: goalId, user_id: user.id, title: title.trim(), due_date, completed: false, position })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await syncGoalProgress(goalId, user.id)
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
  return data as GoalStep
}

/* ── UPDATE ─────────────────────────────────────────── */

export async function updateStepAction(
  stepId: string,
  updates: { title?: string; due_date?: string | null }
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('goal_steps')
    .update(updates)
    .eq('id', stepId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
}

/* ── DELETE ─────────────────────────────────────────── */

export async function deleteStepAction(stepId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: step } = await supabase
    .from('goal_steps')
    .delete()
    .eq('id', stepId)
    .eq('user_id', user.id)
    .select('goal_id')
    .single()

  if (step?.goal_id) await syncGoalProgress(step.goal_id, user.id)
  revalidatePath('/goals')
  revalidatePath('/brief')
  revalidatePath('/', 'layout')
}

/* ── INTERNAL: recalculate goal.progress_pct from steps ── */

async function syncGoalProgress(goalId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { data: steps } = await supabase
    .from('goal_steps')
    .select('completed')
    .eq('goal_id', goalId)

  if (!steps || steps.length === 0) return

  const done = steps.filter(s => s.completed).length
  const pct  = Math.round((done / steps.length) * 100)

  await supabase
    .from('goals')
    .update({ progress_pct: pct, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('user_id', userId)
}

/* ── EXPORTED: recalculate goal.progress_pct from linked habit logs ── */

/**
 * For a goal with tracking_mode = 'habits', recomputes progress_pct as:
 *   total_completed_logs / total_scheduled_days_in_window × 100
 *
 * Window = goal.created_at → goal.target_date (or today if no target_date).
 * Multiple linked habits are summed together (not averaged) so every
 * scheduled occurrence across all habits counts equally.
 */
export async function syncHabitGoalProgress(
  goalId: string,
  userId: string,
  // Accept an existing authenticated client to avoid session-propagation
  // issues when called from within another server action.
  // Falls back to creating a new client when called standalone.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingClient?: any,
): Promise<void> {
  const supabase = existingClient ?? (await createClient())

  // ── 1. Fetch all habits linked to this goal ────────────────────────────
  const { data: habits, error: habitsErr } = await supabase
    .from('habits')
    .select('id, goal_target_count')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
  if (habitsErr) {
    console.error('[syncHabitGoalProgress] habits fetch failed:', habitsErr)
    return
  }
  if (!habits || habits.length === 0) return

  type HabitRow = { id: string; goal_target_count: number | null }

  const habitIds = (habits as HabitRow[]).map(h => h.id)

  // ── 2. Count all logs for those habits ─────────────────────────────────
  const { data: logs, error: logsErr } = await supabase
    .from('habit_logs')
    .select('habit_id')
    .in('habit_id', habitIds)
  if (logsErr) console.error('[syncHabitGoalProgress] logs fetch failed:', logsErr)

  const completionsByHabit = new Map<string, number>()
  for (const l of (logs ?? []) as { habit_id: string }[]) {
    completionsByHabit.set(l.habit_id, (completionsByHabit.get(l.habit_id) ?? 0) + 1)
  }

  // ── 3. Compute per-habit progress (count-target mode only) ─────────────
  //   pct = completions / goal_target_count × 100
  //   Habits without a target count are skipped — they don't contribute
  //   to the average so they don't silently drag progress to 0.
  const habitPcts: number[] = []

  for (const habit of habits as HabitRow[]) {
    if (!habit.goal_target_count || habit.goal_target_count <= 0) continue
    const completed = completionsByHabit.get(habit.id) ?? 0
    habitPcts.push(Math.min(100, Math.round((completed / habit.goal_target_count) * 100)))
  }

  if (habitPcts.length === 0) return

  // ── 4. Average all per-habit pcts ──────────────────────────────────────
  const pct = Math.round(habitPcts.reduce((s, p) => s + p, 0) / habitPcts.length)

  const { error: updateErr } = await supabase
    .from('goals')
    .update({ progress_pct: pct, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('user_id', userId)
  if (updateErr) {
    console.error('[syncHabitGoalProgress] goal update failed:', updateErr)
  } else {
    console.log(`[syncHabitGoalProgress] goal ${goalId.slice(0,8)} → ${pct}% across ${habitPcts.length} habit(s): [${habitPcts.join(', ')}]`)
  }
}
