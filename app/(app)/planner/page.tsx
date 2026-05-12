import { createClient } from '@/lib/supabase/server'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { getWeeklyPlan } from '@/lib/db/planner'
import { getCalendarEventsForAI } from '@/lib/google/calendar'
import { isCalendarConnected } from '@/lib/db/calendar'
import { getLocusEvents } from '@/lib/db/locus-events'
import WeeklyPlanner from '@/components/planner/WeeklyPlanner'
import { getMondayOfWeek } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

export default async function PlannerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const weekStart = getMondayOfWeek()
  const weekEnd   = (() => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })()
  const today = new Date().toISOString().split('T')[0]

  const [habits, goals, initialPlan, calendarEvents, hasGoogleCalendar, locusEvents] = await Promise.all([
    getUserHabitsWithLogs(user.id),
    getActiveGoalsWithSteps(user.id),
    getWeeklyPlan(user.id, weekStart),
    getCalendarEventsForAI(user.id),
    isCalendarConnected(user.id),
    getLocusEvents(user.id, `${weekStart}T00:00:00Z`, `${weekEnd}T23:59:59Z`),
  ])

  return (
    <WeeklyPlanner
      habits={habits}
      goals={goals}
      initialPlan={initialPlan}
      weekStart={weekStart}
      today={today}
      calendarEvents={calendarEvents}
      locusEvents={locusEvents}
      hasGoogleCalendar={hasGoogleCalendar}
    />
  )
}
