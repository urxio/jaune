import { createClient } from '@/lib/supabase/server'
import { getAllGoalsWithSteps } from '@/lib/db/goals'
import { getUserHabits } from '@/lib/db/habits'
import { syncHabitGoalProgress } from '@/app/actions/goal-steps'
import GoalsList from '@/components/goals/GoalsList'

export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [goals, habits] = await Promise.all([
    getAllGoalsWithSteps(user.id),
    getUserHabits(user.id),
  ])

  // Re-sync every habit-tracked goal on page load so progress is always
  // up-to-date — covers pre-linked habits, manual DB edits, etc.
  const habitTrackedGoals = goals.filter(g => g.tracking_mode === 'habits')
  if (habitTrackedGoals.length > 0) {
    await Promise.all(
      habitTrackedGoals.map(g => syncHabitGoalProgress(g.id, user.id, supabase))
    )
    // Re-fetch goals so the synced progress_pct values are reflected in the UI
    const fresh = await getAllGoalsWithSteps(user.id)
    goals.splice(0, goals.length, ...fresh)
  }

  // Build completion counts for ALL habits linked to any goal
  // so the goal card can render per-habit progress mini-bars regardless of tracking_mode.
  const linkedHabitIds = habits
    .filter(h => h.goal_id)
    .map(h => h.id)

  let habitCompletions: Record<string, number> = {}
  if (linkedHabitIds.length > 0) {
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .in('habit_id', linkedHabitIds)
    for (const log of (logs ?? [])) {
      habitCompletions[log.habit_id] = (habitCompletions[log.habit_id] ?? 0) + 1
    }
  }

  return (
    <GoalsList
      goals={goals}
      habits={habits}
      existingHabitNames={habits.map(h => h.name)}
      habitCompletions={habitCompletions}
    />
  )
}
