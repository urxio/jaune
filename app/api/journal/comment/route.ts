import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { saveLocusComment } from '@/lib/db/journals'

export const runtime = 'nodejs'
export const maxDuration = 20

const SYSTEM_FIRST_PASS = `You are Locus, a personal AI life assistant. A user has chosen to share a journal entry with you and wants your response. This is an opt-in, personal moment — they invited you in.

Write a warm, direct, personal response to what they shared. Think of yourself as a thoughtful friend who has been paying attention.

Rules for the comment:
- Be specific: reference what they actually wrote, don't be generic
- 2–4 sentences
- Can end with one genuine question, or just leave space — don't force a question if it doesn't fit
- Conversational and human, not clinical or coaching-speak
- Don't start with "I" — vary the opening
- Don't say "Thank you for sharing" or anything performative
- Don't give unsolicited advice unless the tone clearly invites it

Good examples:
- "That tension between wanting to slow down and not being able to is real — and it sounds exhausting to hold. What does a day that doesn't feel like catching up look like to you?"
- "The way you described that meeting says a lot — sounds like you've been carrying it since. Makes sense it's still in your head."
- "There's something quietly proud in how you wrote about that. Like you surprised yourself a little."

Clarification (rare exception):
In the rare case where the entry is genuinely too ambiguous to respond meaningfully — for example, a single short sentence missing crucial context, or a name/event that's load-bearing but unexplained — you may ask ONE short clarifying question instead. This should be very rare. Default to commenting whenever you can.

Don't ask a clarification just to be thorough or to gather more info. Only do it if NOT asking would force you to give a generic, hollow response.

Response format: valid JSON only, no markdown fences.
Either:  { "comment": "string" }
Or (rare): { "clarification": "short question" }`

const SYSTEM_FOLLOWUP = `You are Locus, a personal AI life assistant. Earlier you asked the user a clarifying question about their journal entry. They've answered. Now write the warm, direct, personal response you would have written originally — informed by what they clarified.

Rules:
- Be specific, reference both the entry and their clarification
- 2–4 sentences
- Conversational, not clinical
- Don't say "Thanks for clarifying" or restate the question
- Don't ask another clarification

Response format: valid JSON only, no markdown fences.
{ "comment": "string" }`

function extractJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let content: string
  let date: string
  let clarification: string | null
  let clarificationAnswer: string | null
  try {
    const body = await request.json()
    content = body.content ?? ''
    date = body.date ?? ''
    clarification = typeof body.clarification === 'string' ? body.clarification : null
    clarificationAnswer = typeof body.clarificationAnswer === 'string' ? body.clarificationAnswer : null
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const trimmed = content.trim()
  if (!trimmed || !date) return NextResponse.json({ error: 'Missing content or date' }, { status: 400 })

  const isFollowup = clarification && clarificationAnswer

  try {
    const client = getAnthropicClient()
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      system: isFollowup ? SYSTEM_FOLLOWUP : SYSTEM_FIRST_PASS,
      messages: [{
        role: 'user',
        content: isFollowup
          ? `Journal entry:\n"${trimmed}"\n\nYour earlier clarifying question:\n"${clarification}"\n\nTheir answer:\n"${clarificationAnswer}"`
          : `Journal entry:\n"${trimmed}"`,
      }],
    })

    const raw = res.content.find(b => b.type === 'text')?.text ?? ''
    const parsed = extractJson(raw)
    if (!parsed) {
      console.error('[journal/comment] no JSON in response:', raw)
      return NextResponse.json({ comment: null })
    }

    const comment = typeof parsed.comment === 'string' && parsed.comment.trim()
      ? parsed.comment.trim()
      : null

    // Only the first pass may return a clarification
    const clarificationOut = !isFollowup && typeof parsed.clarification === 'string' && parsed.clarification.trim()
      ? parsed.clarification.trim()
      : null

    if (clarificationOut) {
      // Don't persist — wait for the user's answer
      return NextResponse.json({ clarification: clarificationOut })
    }

    if (!comment) {
      console.error('[journal/comment] no comment, parsed:', parsed)
      return NextResponse.json({ comment: null })
    }

    await saveLocusComment(user.id, date, comment)
    return NextResponse.json({ comment })
  } catch (err) {
    console.error('[journal/comment]', err)
    return NextResponse.json({ comment: null })
  }
}
