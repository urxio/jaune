import { createClient } from '@/lib/supabase/server'
import { getTodayCheckin } from '@/lib/db/checkins'
import { getActiveGoals } from '@/lib/db/goals'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getTodayBrief } from '@/lib/db/briefs'
import HomeDashboard from '@/components/home/HomeDashboard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [checkin, goals, habits, brief, profile] = await Promise.all([
    getTodayCheckin(user.id),
    getActiveGoals(user.id),
    getUserHabitsWithLogs(user.id),
    getTodayBrief(user.id),
    supabase.from('users').select('name').eq('id', user.id).single().then(r => r.data),
  ])

  return (
    <HomeDashboard
      checkin={checkin}
      goals={goals}
      habits={habits}
      brief={brief}
      userName={profile?.name ?? null}
    />
  )
}
