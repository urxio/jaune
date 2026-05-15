import { createClient } from '@/lib/supabase/server'
import { dateInTz } from '@/lib/utils/date'

export async function getUserTimezone(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', userId)
    .single()
  return data?.timezone ?? 'UTC'
}

/**
 * Returns today's date string (YYYY-MM-DD) in the user's stored timezone.
 * Use this on the server instead of new Date().toISOString().split('T')[0].
 */
export async function getUserLocalDate(userId: string): Promise<string> {
  const tz = await getUserTimezone(userId)
  return dateInTz(tz)
}
