import { createClient } from '@/lib/supabase/server'

export async function getCachedPulse(userId: string, date: string, hour: number): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pulse_cache')
    .select('text')
    .eq('user_id', userId)
    .eq('pulse_date', date)
    .eq('pulse_hour', hour)
    .single()
  return data?.text ?? null
}

export async function storePulse(userId: string, date: string, hour: number, text: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('pulse_cache')
    .upsert(
      { user_id: userId, pulse_date: date, pulse_hour: hour, text },
      { onConflict: 'user_id,pulse_date,pulse_hour' }
    )
}

// Drop every cached pulse for the day so the next load regenerates with fresh
// context — used after a reply teaches Jaune something that should change it.
export async function clearPulseForDate(userId: string, date: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('pulse_cache')
    .delete()
    .eq('user_id', userId)
    .eq('pulse_date', date)
}
