import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { getUserLocalDate } from '@/lib/db/users'
import { RETRO_SYSTEM_PROMPT, buildRetroUserMessage, parseRetrospective } from '@/lib/ai/retrospective'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = await getUserLocalDate(user.id)
  const month = today.slice(0, 7) // YYYY-MM

  // Cached for this calendar month?
  const { data: cached } = await supabase
    .from('monthly_retrospectives')
    .select('retrospective, generated_at')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle()
  if (cached) {
    return NextResponse.json({ available: true, cached: true, month, ...cached })
  }

  const { message, eligibility } = await buildRetroUserMessage(user.id, today)
  if (!eligibility.eligible) {
    return NextResponse.json({
      available: false,
      month,
      checkinCount: eligibility.checkinCount,
      needed: eligibility.needed,
    })
  }

  let rawText = ''
  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: RETRO_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })
    for (const block of response.content) {
      if (block.type === 'text') { rawText = block.text; break }
    }
  } catch (err) {
    console.error('[retrospective] Claude call failed:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }

  const retrospective = parseRetrospective(rawText)
  if (!retrospective) {
    console.error('[retrospective] parse failed:', rawText.slice(0, 200))
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }

  const generated_at = new Date().toISOString()
  const { error: storeError } = await supabase
    .from('monthly_retrospectives')
    .upsert(
      { user_id: user.id, month, retrospective, generated_at },
      { onConflict: 'user_id,month' },
    )
  if (storeError) console.error('[retrospective] store failed:', storeError)

  return NextResponse.json({ available: true, cached: false, month, retrospective, generated_at })
}
