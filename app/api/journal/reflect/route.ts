import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { getRecentJournals } from '@/lib/db/journals'
import { LOCUS_CHARACTER } from '@/lib/ai/character'

export const runtime = 'nodejs'
export const maxDuration = 20

const SYSTEM = LOCUS_CHARACTER + `\n\nYou have access to a user's recent journal entries. Your job is to surface ONE meaningful observation or pattern — something specific that would genuinely help them understand themselves better.

Rules:
- Be specific: reference what they actually wrote, not generic advice
- Look for patterns across entries if available (recurring themes, emotions, words, contexts)
- If there's genuinely nothing interesting to surface, return null — don't force it
- 1–2 sentences max
- It's an observation, not advice and not a question — like a thoughtful friend noticing something
- Don't start with "I notice" — vary the framing
- Never reference "your journal entries" or "across your entries" — just state the observation naturally

Good examples:
- "You've mentioned feeling stretched thin before end-of-week deadlines three times this month."
- "Energy tends to drop in your writing whenever meetings come up — might be worth looking at your calendar."
- "This is the second time this week your manager has come up — sounds like that dynamic is taking up mental space."
- "There's a pattern of your best days starting with early morning focus blocks."

Bad examples (too generic):
- "You seem to be feeling stressed."
- "It looks like you have a lot going on."

Response format: valid JSON only, no markdown fences.
{ "reflection": "string or null" }`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ reflection: null })

  let content: string
  try {
    const body = await request.json()
    content = body.content ?? ''
  } catch {
    return NextResponse.json({ reflection: null })
  }

  const trimmed = content.trim()
  if (!trimmed) return NextResponse.json({ reflection: null })

  // Fetch recent entries for pattern detection (exclude today — it's in `content`)
  const recentJournals = await getRecentJournals(user.id, 30)
  const pastEntries = recentJournals
    .filter(j => j.content.trim())
    .slice(0, 10) // cap at 10 entries to keep prompt lean

  // Build context block
  const pastContext = pastEntries.length > 0
    ? pastEntries
        .map(j => `[${j.date}] ${j.content.slice(0, 280).trim()}${j.content.length > 280 ? '…' : ''}`)
        .join('\n\n')
    : null

  const userMessage = pastContext
    ? `Today's entry:\n"${trimmed}"\n\nRecent past entries:\n${pastContext}`
    : `Today's entry:\n"${trimmed}"`

  try {
    const client = getAnthropicClient()
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 160,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = res.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned)
    const reflection = typeof parsed.reflection === 'string' && parsed.reflection.trim()
      ? parsed.reflection.trim()
      : null

    return NextResponse.json({ reflection })
  } catch (err) {
    console.error('[journal/reflect]', err)
    return NextResponse.json({ reflection: null })
  }
}
