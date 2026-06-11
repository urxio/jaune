import { createClient } from '@/lib/supabase/server'
import { getUserLocalDate } from '@/lib/db/users'
import type { Brief, PriorityOutcome } from '@/lib/types'

export async function getTodayBrief(userId: string, localDate?: string): Promise<Brief | null> {
  const supabase = await createClient()
  const today = localDate ?? await getUserLocalDate(userId)
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('user_id', userId)
    .eq('brief_date', today)
    .eq('stale', false)
    .single()
  if (error) return null
  return data
}

export async function storeBrief(userId: string, brief: Omit<Brief, 'id' | 'user_id' | 'generated_at' | 'stale' | 'priority_outcomes'>): Promise<Brief | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('briefs')
    .upsert(
      { ...brief, user_id: userId, generated_at: new Date().toISOString(), stale: false },
      { onConflict: 'user_id,brief_date' }
    )
    .select()
    .single()
  if (error) { console.error('storeBrief:', error); return null }
  return data
}

export async function getRecentBriefs(userId: string, limit = 14): Promise<Brief[]> {
  const supabase = await createClient()
  const today = await getUserLocalDate(userId)
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('user_id', userId)
    .eq('stale', false)
    .lt('brief_date', today)           // exclude today
    .order('brief_date', { ascending: false })
    .limit(limit)
  if (error) { console.error('getRecentBriefs:', error); return [] }
  return data ?? []
}

/**
 * Yesterday's brief (stale or not — the user saw its priorities either way).
 * Used to review priority outcomes during the next morning's check-in.
 */
export async function getYesterdayBrief(userId: string, localDate?: string): Promise<Brief | null> {
  const supabase = await createClient()
  const today = localDate ?? await getUserLocalDate(userId)
  const yesterdayMs = Date.parse(today + 'T00:00:00Z') - 86400000
  const yesterday = new Date(yesterdayMs).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('user_id', userId)
    .eq('brief_date', yesterday)
    .maybeSingle()
  if (error) return null
  return data
}

export async function savePriorityOutcomes(
  userId: string,
  briefDate: string,
  outcomes: PriorityOutcome[],
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('briefs')
    .update({ priority_outcomes: { recorded_at: new Date().toISOString(), outcomes } })
    .eq('user_id', userId)
    .eq('brief_date', briefDate)
  if (error) { console.error('savePriorityOutcomes:', error); return false }
  return true
}

export async function markBriefStale(userId: string): Promise<void> {
  const supabase = await createClient()
  const today = await getUserLocalDate(userId)
  const { error } = await supabase
    .from('briefs')
    .update({ stale: true })
    .eq('user_id', userId)
    .eq('brief_date', today)
  if (error) console.error('markBriefStale:', error)
}
