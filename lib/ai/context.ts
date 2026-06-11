import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { getYesterdayBrief } from '@/lib/db/briefs'
import { getTodayCheckin, getRecentCheckins } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { readUserMemory, type UserMemory } from '@/lib/ai/memory'
import { getTodayJournal, getRecentJournals } from '@/lib/db/journals'
import { getPeople } from '@/lib/db/people'
import { getCalendarEventsForAI } from '@/lib/google/calendar'
import type { CheckIn, HabitWithLogs, GoalWithSteps, JournalEntry, Person, CalendarEvent } from '@/lib/types'

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
  catchupPeople: Pick<Person, 'name' | 'notes'>[]
  calendarEvents: CalendarEvent[]
  /** Yesterday's plan + what the user said happened to it (null if no brief or no outcomes recorded). */
  yesterdayPlan: { date: string; outcomes: { title: string; outcome: string }[] } | null
}

export async function buildBriefContext(userId: string, date: string): Promise<BriefContext> {
  const [goalsWithSteps, todayCheckin, recentCheckins, habits, memory, todayJournal, recentJournals, allPeople, calendarEvents, yesterdayBrief] = await Promise.all([
    getActiveGoalsWithSteps(userId),
    getTodayCheckin(userId),
    getRecentCheckins(userId, 7),
    getUserHabitsWithLogs(userId),
    readUserMemory(userId),
    getTodayJournal(userId),
    getRecentJournals(userId, 7),
    getPeople(userId),
    getCalendarEventsForAI(userId),
    getYesterdayBrief(userId, date),
  ])

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
    catchupPeople,
    calendarEvents,
    yesterdayPlan:
      yesterdayBrief?.priority_outcomes && yesterdayBrief.priority_outcomes.outcomes.length > 0
        ? { date: yesterdayBrief.brief_date, outcomes: yesterdayBrief.priority_outcomes.outcomes }
        : null,
  }
}
