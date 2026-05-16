'use server'

import { createClient } from '@/lib/supabase/server'
import { markBriefStale } from '@/lib/db/briefs'
import { updateMemoryStats } from '@/lib/memory/update-stats'
import { updateMemoryInsights } from '@/lib/memory/update-insights'
import { updatePeopleMemory } from '@/lib/memory/update-people'
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

  // Use client-provided date if available; otherwise look up user's stored timezone
  const today = input.localDate ?? await getUserLocalDate(user.id)

  const { error } = await supabase
    .from('check_ins')
    .upsert(
      {
        user_id: user.id,
        energy_level: input.energy_level,
        mood_note: input.mood_note,
        blockers: input.blockers,
        highlight: input.highlight,
        date: today,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

  if (error) throw new Error(error.message)

  // Mark today's brief as stale so it regenerates with new check-in data
  await markBriefStale(user.id)

  // Fire-and-forget: update memory stats (pure computation — no Claude call)
  void updateMemoryStats(user.id).catch(err => console.error('[checkin] memory stats:', err))

  // Fire-and-forget: update AI insights if enough data and throttle allows
  // (throttled internally to once per 6 days — safe to call every check-in)
  void updateMemoryInsights(user.id).catch(err => console.error('[checkin] memory insights:', err))

  // Fire-and-forget: extract people mentioned in journals + mood notes
  // (throttled internally to once per 5 days — safe to call every check-in)
  void updatePeopleMemory(user.id).catch(err => console.error('[checkin] people memory:', err))

  revalidatePath('/brief')
  revalidatePath('/checkin')
  revalidatePath('/', 'layout')
}
