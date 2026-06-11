'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitBriefFeedback(
  briefId: string,
  briefDate: string,
  rating: 'up' | 'down',
  comment?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (rating !== 'up' && rating !== 'down') throw new Error('Invalid rating')

  const { error } = await supabase
    .from('brief_feedback')
    .upsert(
      {
        user_id: user.id,
        brief_id: briefId,
        brief_date: briefDate,
        rating,
        comment: comment?.trim().slice(0, 500) || null,
      },
      { onConflict: 'user_id,brief_id' },
    )
  if (error) throw new Error(error.message)
}
