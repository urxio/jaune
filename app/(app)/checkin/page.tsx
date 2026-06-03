import { createClient } from '@/lib/supabase/server'
import { getTodayCheckin, getRecentCheckins } from '@/lib/db/checkins'
import { getTodayBrief, getRecentBriefs } from '@/lib/db/briefs'
import { readUserMemory } from '@/lib/ai/memory'
import { getUserTimezone } from '@/lib/db/users'
import { dateInTz } from '@/lib/utils/date'
import CheckinTabs from '@/components/checkin/CheckinTabs'

export const dynamic = 'force-dynamic'

export default async function CheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [existing, memory, todayBrief, pastBriefs, tz, recentCheckins] = await Promise.all([
    getTodayCheckin(user.id),
    readUserMemory(user.id),
    getTodayBrief(user.id),
    getRecentBriefs(user.id, 14),
    getUserTimezone(user.id),
    getRecentCheckins(user.id, 7),
  ])

  const today = dateInTz(tz)
  const followupAlreadyDone = memory?.checkin_followup_dismissed_date === today

  return (
    <CheckinTabs
      existingCheckin={existing}
      memory={memory}
      hasBrief={!!todayBrief}
      pastBriefs={pastBriefs}
      followupAlreadyDone={followupAlreadyDone}
      recentCheckins={recentCheckins}
    />
  )
}
