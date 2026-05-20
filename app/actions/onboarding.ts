'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserLocalDate } from '@/lib/db/users'
import { dateInTz } from '@/lib/utils/date'
import type { SelfProfile } from '@/lib/ai/memory'
import { patchUserMemory } from '@/lib/ai/memory'
import { deriveFrequencyMeta } from '@/lib/habits/utils'

export type GoalInput = {
  title: string
  category: string
  timeframe: string
}

export type HabitInput = {
  name: string
  emoji: string
  days_of_week: number[]  // empty = every day
  goal_index: number | null  // index into the goals array; resolved to goal_id on save
}

export type ProfileInput = {
  occupation: string
  relationship_status: SelfProfile['relationship_status']
  has_kids: boolean | null
  work_arrangement: SelfProfile['work_arrangement']
  personality: string[]
  life_context: string
}

export async function completeOnboarding(
  goals: GoalInput[],
  habits: HabitInput[],
  profile: ProfileInput,
  firstCheckin: { energy_level: number; mood_note: string | null },
  timezone?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Use the client-provided timezone to compute today's date so the check-in
  // date matches what getTodayCheckin will query after the timezone is saved.
  const today = timezone ? dateInTz(timezone) : await getUserLocalDate(user.id)

  // 1. Save goals — select back IDs so habits can reference them
  const savedGoalIds: (string | null)[] = goals.map(() => null)
  if (goals.length > 0) {
    const { data: savedGoals, error } = await supabase.from('goals').insert(
      goals.map(g => ({
        user_id: user.id,
        title: g.title,
        category: g.category,
        timeframe: g.timeframe,
        progress_pct: 0,
        status: 'active',
        target_date: null,
      }))
    ).select('id')
    if (error) throw new Error('Failed to save goals: ' + error.message)
    // Map position → DB id (insert preserves order)
    savedGoals?.forEach((row, i) => { savedGoalIds[i] = row.id })
  }

  // 2. Save habits — link to goal when goal_index is set
  if (habits.length > 0) {
    const { error } = await supabase.from('habits').insert(
      habits.map(h => {
        const { frequency, target_count } = deriveFrequencyMeta(h.days_of_week)
        const goalId = (h.goal_index != null && savedGoalIds[h.goal_index]) ? savedGoalIds[h.goal_index] : null
        return {
          user_id: user.id,
          name: h.name,
          emoji: h.emoji,
          frequency,
          target_count,
          days_of_week: h.days_of_week.length > 0 ? h.days_of_week : null,
          ends_at: null,
          goal_id: goalId,
        }
      })
    )
    if (error) throw new Error('Failed to save habits: ' + error.message)
  }

  // 3. Save self profile to user_memory JSONB
  const hasProfile = profile.occupation || profile.relationship_status || profile.personality.length > 0 || profile.life_context
  if (hasProfile) {
    const selfProfile: SelfProfile = {
      ...profile,
      saved_at: new Date().toISOString(),
    }
    await patchUserMemory(user.id, { self_profile: selfProfile })
  }

  // 4. Save first check-in
  await supabase.from('check_ins').upsert(
    {
      user_id: user.id,
      energy_level: firstCheckin.energy_level,
      mood_note: firstCheckin.mood_note,
      blockers: [],
      date: today,
      checked_in_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  )

  // 5. Mark onboarded
  await supabase
    .from('users')
    .update({
      onboarded_at: new Date().toISOString(),
      ...(timezone ? { timezone } : {}),
    })
    .eq('id', user.id)

  revalidatePath('/brief')
  revalidatePath('/checkin')
  revalidatePath('/goals')
}
