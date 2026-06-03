'use server'

import { createClient } from '@/lib/supabase/server'
import { markBriefStale } from '@/lib/db/briefs'
import { updateMemoryStats } from '@/lib/memory/update-stats'
import { updateMemoryInsights } from '@/lib/memory/update-insights'
import { updatePeopleMemory } from '@/lib/memory/update-people'
import { patchUserMemory } from '@/lib/ai/memory'
import { revalidatePath } from 'next/cache'
import { getUserLocalDate } from '@/lib/db/users'

type CheckinInput = {
  energy_level: number
  mood_note: string | null
  blockers: string[]
  highlight: string | null
  localDate?: string  // YYYY-MM-DD from the client's browser
}

export async function submitCheckin(input: CheckinInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const serverToday = await getUserLocalDate(user.id)
  const targetDate = input.localDate ?? serverToday
  const isBackfill = targetDate !== serverToday

  const { error } = await supabase
    .from('check_ins')
    .upsert(
      {
        user_id: user.id,
        energy_level: input.energy_level,
        mood_note: input.mood_note,
        blockers: input.blockers,
        highlight: input.highlight,
        date: targetDate,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

  if (error) throw new Error(error.message)

  // Mark today's brief as stale so it regenerates with new check-in data
  await markBriefStale(user.id)

  // Fire-and-forget: update memory stats (pure computation — no Claude call)
  void updateMemoryStats(user.id).catch(err => console.error('[checkin] memory stats:', err))

  if (isBackfill) {
    // Backfill: queue a deferred insights refresh instead of calling Claude immediately.
    // The flag is read on the next brief generation and triggers updateMemoryInsights there,
    // so multiple backfill saves collapse into a single Claude call.
    void patchUserMemory(user.id, { needs_insights_refresh: true })
      .catch(err => console.error('[checkin] flag insights refresh:', err))
  } else {
    // Today's check-in: run insights normally (throttled internally to once per 6 days)
    void updateMemoryInsights(user.id).catch(err => console.error('[checkin] memory insights:', err))
  }

  // Fire-and-forget: extract people mentioned in journals + mood notes
  // (throttled internally to once per 5 days — safe to call every check-in)
  void updatePeopleMemory(user.id).catch(err => console.error('[checkin] people memory:', err))

  revalidatePath('/brief')
  revalidatePath('/checkin')
  revalidatePath('/', 'layout')
}
