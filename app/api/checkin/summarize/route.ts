import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { readUserMemory, patchUserMemory } from '@/lib/ai/memory'
import type { UserMemory } from '@/lib/ai/memory'
import { LOCUS_CHARACTER } from '@/lib/ai/character'

export const runtime = 'nodejs'
export const maxDuration = 30

type Message = { role: 'user' | 'assistant'; content: string }

const SUMMARIZE_SYSTEM = LOCUS_CHARACTER + `\n\nYou create concise narrative memory entries from daily check-in conversations.

Read the conversation and write 2-3 sentences that capture:
- The qualitative texture of the day — not just the energy number, but the WHY behind it
- Specific context: work situations, events, decisions, circumstances they mentioned
- Emotional tone — stress points, bright spots, what was weighing on them or lifting them
- Any intentions, commitments, or concerns they expressed going forward

Rules:
- Be specific and concrete. Reference real things mentioned by name (projects, people, tasks).
- Write in past tense, third-person narrative style ("They were dealing with...", "Felt energised by...").
- 2-3 sentences max. Dense with real detail — no filler.
- Do NOT restate the energy score as a number — describe how they were feeling qualitatively.
- Ignore the structured data tags (<checkin_data>, <show_brief>) — those are system tokens, not content.
- If the conversation was very short or contained no meaningful personal detail, write: "Brief check-in, minimal context shared."
- Output only the narrative text. Nothing else.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let messages: Message[]
  let date: string

  try {
    const body = await request.json()
    messages = body.messages ?? []
    date     = body.date ?? new Date().toISOString().split('T')[0]
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Need at least 2 real exchanges to summarize meaningfully
  const meaningful = messages.filter(m => m.content.trim().length > 0)
  if (meaningful.length < 2) {
    return Response.json({ ok: true, skipped: true })
  }

  // Format conversation for Claude
  const convo = messages
    .filter(m => m.content.trim())
    .map(m => `${m.role === 'user' ? 'User' : 'Locus'}: ${m.content.trim()}`)
    .join('\n')

  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 200,
      system:     SUMMARIZE_SYSTEM,
      messages:   [{ role: 'user', content: convo }],
    })

    const summary = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    if (!summary || summary.length < 10) {
      return Response.json({ ok: true, skipped: true })
    }

    // Read current summaries, append new one, keep last 30 days
    const memory  = (await readUserMemory(user.id)) ?? {} as UserMemory
    const existing = memory.daily_summaries ?? []
    const updated = [
      ...existing.filter(s => s.date !== date),
      { date, summary, generated_at: new Date().toISOString() },
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    await patchUserMemory(user.id, { daily_summaries: updated })

    return Response.json({ ok: true, summary })
  } catch (err) {
    console.error('[checkin/summarize]', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
