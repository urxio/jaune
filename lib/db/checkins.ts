import { createClient } from '@/lib/supabase/server'
import type { CheckIn } from '@/lib/types'
import { getUserLocalDate } from '@/lib/db/users'
import { daysAgoInTz, dateInTz } from '@/lib/utils/date'

export async function getTodayCheckin(userId: string, localDate?: string): Promise<CheckIn | null> {
  const supabase = await createClient()
  const today = localDate ?? await getUserLocalDate(userId)
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  if (error) return null
  return data
}

/** Returns the date ('YYYY-MM-DD') of the user's most recent check-in, or null if they've never checked in. */
export async function getLastCheckinDate(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('check_ins')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return data.date
}

export async function getRecentCheckins(userId: string, days: number): Promise<CheckIn[]> {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('users').select('timezone').eq('id', userId).single()
  const tz = profile?.timezone ?? 'UTC'
  const since = daysAgoInTz(days, tz)
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false })
  if (error) { console.error('getRecentCheckins:', error); return [] }
  return data ?? []
}

export async function createCheckin(
  userId: string,
  energy_level: number,
  mood_note: string | null,
  blockers: string[]
): Promise<CheckIn | null> {
  const supabase = await createClient()
  const today = await getUserLocalDate(userId)
  const { data, error } = await supabase
    .from('check_ins')
    .upsert(
      { user_id: userId, energy_level, mood_note, blockers, date: today, checked_in_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single()
  if (error) { console.error('createCheckin:', error); return null }
  return data
}
