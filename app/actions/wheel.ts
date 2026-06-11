'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserLocalDate } from '@/lib/db/users'
import { revalidatePath } from 'next/cache'
import { WHEEL_AREAS, type WheelScores } from '@/lib/types'

const VALID_KEYS = new Set(WHEEL_AREAS.map(a => a.key))

export async function saveWheelSnapshot(scores: WheelScores) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const clean: WheelScores = {}
  for (const [key, value] of Object.entries(scores)) {
    if (!VALID_KEYS.has(key)) continue
    const n = Math.round(Number(value))
    if (n >= 1 && n <= 10) clean[key] = n
  }
  if (Object.keys(clean).length !== WHEEL_AREAS.length) {
    throw new Error('All areas must be rated 1-10')
  }

  const today = await getUserLocalDate(user.id)
  const { error } = await supabase
    .from('wheel_of_life')
    .upsert(
      { user_id: user.id, scores: clean, snapshot_date: today, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,snapshot_date' },
    )
  if (error) throw new Error(error.message)

  revalidatePath('/review')
}
