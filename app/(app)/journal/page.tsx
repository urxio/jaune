import { createClient } from '@/lib/supabase/server'
import { getTodayJournal, getRecentJournals } from '@/lib/db/journals'
import JournalSection from '@/components/checkin/JournalSection'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [todayJournal, recentJournals] = await Promise.all([
    getTodayJournal(user.id),
    getRecentJournals(user.id, 90),
  ])

  return (
    <JournalSection
      existing={todayJournal}
      recentJournals={recentJournals}
    />
  )
}
