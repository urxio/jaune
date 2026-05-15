import { createClient } from '@/lib/supabase/server'
import { getTodayCheckin } from '@/lib/db/checkins'
import { getTodayBrief, getRecentBriefs } from '@/lib/db/briefs'
import { readUserMemory } from '@/lib/ai/memory'
import CheckinTabs from '@/components/checkin/CheckinTabs'

export const dynamic = 'force-dynamic'

export default async function CheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [existing, memory, todayBrief, pastBriefs] = await Promise.all([
    getTodayCheckin(user.id),
    readUserMemory(user.id),
    getTodayBrief(user.id),
    getRecentBriefs(user.id, 14),
  ])

  return (
    <CheckinTabs
      existingCheckin={existing}
      memory={memory}
      hasBrief={!!todayBrief}
      pastBriefs={pastBriefs}
    />
  )
}
