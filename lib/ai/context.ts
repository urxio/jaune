import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { getTodayCheckin, getRecentCheckins } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { readUserMemory, type UserMemory } from '@/lib/ai/memory'
import { getTodayJournal, getRecentJournals } from '@/lib/db/journals'
import { getPlanForDate } from '@/lib/db/planner'
import { getContextualNotes } from '@/lib/db/memory-notes'
import { getPeople } from '@/lib/db/people'
import type { CheckIn, HabitWithLogs, GoalWithSteps, JournalEntry, WeeklyPlanBlock, MemoryNote, Person } from '@/lib/types'

export type NeglectedHabit = {
  name: string
  emoji: string
  frequency: string
  linkedGoal: { id: string; title: string; category: string } | null
}

export type BriefContext = {
  date: string
  goalsWithSteps: GoalWithSteps[]
  todayCheckin: CheckIn | null
  recentCheckins: CheckIn[]
  habits: HabitWithLogs[]
  neglectedHabits: NeglectedHabit[]  // habits with 0 completions this week
  avgEnergy: number | null
  weekHabitRate: number // 0-100
  memory: UserMemory | null
  todayJournal: JournalEntry | null
  recentJournals: JournalEntry[]
  isFirstBrief: boolean
  todayPlan: WeeklyPlanBlock[]
  memoryNotes: MemoryNote[]  // contextual notes to surface today
  catchupPeople: Pick<Person, 'name' | 'notes'>[]
}

export async function buildBriefContext(userId: string, date: string): Promise<BriefContext> {
  const [goalsWithSteps, todayCheckin, recentCheckins, habits, memory, todayJournal, recentJournals, todayPlan, allPeople] = await Promise.all([
    getActiveGoalsWithSteps(userId),
    getTodayCheckin(userId),
    getRecentCheckins(userId, 7),
    getUserHabitsWithLogs(userId),
    readUserMemory(userId),
    getTodayJournal(userId),
    getRecentJournals(userId, 7),
    getPlanForDate(userId, date),
    getPeople(userId),
  ])

  // Build topic keywords from today's context for memory note matching
  const topicKeywords = [
    ...goalsWithSteps.map(g => g.category),
    ...goalsWithSteps.map(g => g.title.toLowerCase().split(' ')).flat(),
    ...habits.map(h => h.name.toLowerCase()),
    todayCheckin?.mood_note ?? '',
  ].filter(Boolean)

  const avgEnergy = recentCheckins.length
    ? Math.round((recentCheckins.reduce((s, c) => s + c.energy_level, 0) / recentCheckins.length) * 10) / 10
    : null

  const totalPossibleCompletions = habits.reduce((sum, h) => sum + h.target_count, 0)
  const totalActualCompletions = habits.reduce((sum, h) => sum + h.weekCompletions, 0)
  const weekHabitRate = totalPossibleCompletions > 0
    ? Math.round((totalActualCompletions / totalPossibleCompletions) * 100)
    : 0

  // Habits with zero completions this week — consistently ignored
  const neglectedHabits: NeglectedHabit[] = habits
    .filter(h => h.weekCompletions === 0)
    .map(h => ({ name: h.name, emoji: h.emoji, frequency: h.frequency, linkedGoal: h.linkedGoal ?? null }))

  // First brief: user onboarded today OR has no prior check-ins
  const { data: profileRow } = await (await import('@/lib/supabase/server')).createClient()
    .then(s => s.from('users').select('onboarded_at').eq('id', userId).single())
  const onboardedAt = (profileRow as { onboarded_at?: string } | null)?.onboarded_at
  const onboardedToday = onboardedAt ? onboardedAt.slice(0, 10) === date : false
  const isFirstBrief = onboardedToday || recentCheckins.length === 0

  const memoryNotes = await getContextualNotes(userId, date, topicKeywords)

  const catchupPeople = allPeople
    .filter(p => p.want_catchup)
    .map(p => ({ name: p.name, notes: p.notes }))

  return {
    date,
    goalsWithSteps,
    todayCheckin,
    recentCheckins,
    habits,
    neglectedHabits,
    avgEnergy,
    weekHabitRate,
    memory,
    todayJournal,
    recentJournals,
    isFirstBrief,
    todayPlan,
    memoryNotes,
    catchupPeople,
  }
}
