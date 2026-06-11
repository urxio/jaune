import { createClient } from '@/lib/supabase/server'
import { getRecentCheckins } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { getRecentBriefs } from '@/lib/db/briefs'
import WeeklyReview from '@/components/review/WeeklyReview'
import MonthlyRetrospective from '@/components/review/MonthlyRetrospective'
import LifeCheckCard from '@/components/review/LifeCheckCard'
import { getLatestWheelSnapshot } from '@/lib/db/wheel'
import { getUserLocalDate } from '@/lib/db/users'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [checkins, habits, goals, briefs, latestWheel, today] = await Promise.all([
    getRecentCheckins(user.id, 14),
    getUserHabitsWithLogs(user.id),
    getActiveGoalsWithSteps(user.id),
    getRecentBriefs(user.id, 14),
    getLatestWheelSnapshot(user.id),
    getUserLocalDate(user.id),
  ])

  // Quarterly cadence: show the life check when no snapshot exists in ~90 days
  const ninetyDaysAgo = new Date(Date.parse(today + 'T00:00:00Z') - 90 * 86400000)
    .toISOString().slice(0, 10)
  const needsLifeCheck = !latestWheel || latestWheel.snapshot_date < ninetyDaysAgo

  return (
    <>
      <WeeklyReview
        checkins={checkins}
        habits={habits}
        goals={goals}
        briefs={briefs}
      />
      <div className="review-shell">
        {needsLifeCheck && <LifeCheckCard previousScores={latestWheel?.scores ?? null} />}
        <MonthlyRetrospective />
      </div>
    </>
  )
}
