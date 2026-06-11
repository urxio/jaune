'use server'

import { createClient } from '@/lib/supabase/server'
import { savePriorityOutcomes } from '@/lib/db/briefs'
import { revalidatePath } from 'next/cache'
import type { PriorityOutcome } from '@/lib/types'

const VALID_OUTCOMES = new Set(['done', 'partial', 'skipped'])

export async function submitPriorityOutcomes(briefDate: string, outcomes: PriorityOutcome[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const clean = outcomes
    .filter(o => o.title && VALID_OUTCOMES.has(o.outcome))
    .map(o => ({ title: String(o.title).slice(0, 200), outcome: o.outcome }))

  const ok = await savePriorityOutcomes(user.id, briefDate, clean)
  if (!ok) throw new Error('Failed to save outcomes')

  revalidatePath('/checkin')
}
