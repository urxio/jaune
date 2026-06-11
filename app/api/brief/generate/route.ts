import { NextResponse, type NextRequest } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'
import { getTodayBrief, storeBrief } from '@/lib/db/briefs'
import { buildBriefContext } from '@/lib/ai/context'
import { SYSTEM_PROMPT, buildUserMessage } from '@/lib/ai/prompts'
import { parseBriefResponse } from '@/lib/ai/parse'
import { getAnthropicClient } from '@/lib/ai/client'
import { getUserLocalDate } from '@/lib/db/users'
import { readUserMemory, savePendingClarifications, patchUserMemory } from '@/lib/ai/memory'
import { updateMemoryInsights } from '@/lib/memory/update-insights'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 1. Auth check
  const { supabase, user } = await createClientFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = await getUserLocalDate(user.id)

  // 2. Check cache — return non-stale brief if exists (skip insights check if cached)
  const { force } = await request.json().catch(() => ({ force: false }))
  if (!force) {
    const cached = await getTodayBrief(user.id)
    if (cached) {
      return NextResponse.json({ brief: cached, cached: true })
    }
  }

  // 3. If backfill entries are pending an insights refresh, run it now (before building context)
  const memory = await readUserMemory(user.id)
  if (memory?.needs_insights_refresh) {
    await patchUserMemory(user.id, { needs_insights_refresh: false })
    void updateMemoryInsights(user.id).catch(err => console.error('[brief] deferred insights refresh:', err))
  }

  // 4. Build context from user's data
  let context
  try {
    context = await buildBriefContext(user.id, today)
  } catch (err) {
    console.error('buildBriefContext failed:', err)
    return NextResponse.json({ error: 'Failed to load user context' }, { status: 500 })
  }

  // 4. Build prompt
  let userMessage: string
  try {
    userMessage = buildUserMessage(context)
  } catch (err) {
    console.error('buildUserMessage failed:', err)
    return NextResponse.json({ error: 'Failed to build prompt', detail: String(err) }, { status: 500 })
  }

  const client = getAnthropicClient()

  let rawText = ''
  let tokensUsed = 0

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    tokensUsed = response.usage.input_tokens + response.usage.output_tokens

    // Extract text from response (may include thinking blocks)
    for (const block of response.content) {
      if (block.type === 'text') {
        rawText = block.text
        break
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Claude API call failed:', message)
    // Surface the real error in development
    return NextResponse.json(
      { error: 'AI generation failed', detail: message },
      { status: 502 }
    )
  }

  // 5. Parse response
  const parsed = parseBriefResponse(rawText)

  // 5b. Save clarifying questions to memory (fire-and-forget)
  if (parsed.clarifying_questions.length > 0) {
    void savePendingClarifications(user.id, today, parsed.clarifying_questions).catch(
      err => console.error('savePendingClarifications failed:', err)
    )
  }

  // 6. Store in DB
  const stored = await storeBrief(user.id, {
    brief_date: today,
    model_used: 'claude-haiku-4-5',
    raw_prompt: userMessage,
    priorities: parsed.priorities,
    insight_text: parsed.insight_text,
    energy_score: parsed.energy_score,
    tokens_used: tokensUsed,
  })

  if (!stored) {
    // Return parsed data even if storage fails
    return NextResponse.json({
      brief: {
        id: 'temp',
        user_id: user.id,
        brief_date: today,
        generated_at: new Date().toISOString(),
        model_used: 'claude-opus-4-6',
        raw_prompt: null,
        ...parsed,
        stale: false,
        tokens_used: tokensUsed,
      },
      cached: false,
      clarifying_questions: parsed.clarifying_questions,
    })
  }

  return NextResponse.json({ brief: stored, cached: false, clarifying_questions: parsed.clarifying_questions })
}
