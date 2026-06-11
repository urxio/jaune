import { createClient } from '@/lib/supabase/server'
import type { WheelSnapshot } from '@/lib/types'

export async function getLatestWheelSnapshot(userId: string): Promise<WheelSnapshot | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wheel_of_life')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}
