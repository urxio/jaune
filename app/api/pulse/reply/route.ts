import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { LOCUS_CHARACTER } from '@/lib/ai/character'
import {
  readUserMemory,
  patchUserMemory,
  formatMemoryForPrompt,
  formatSelfProfileForPrompt,
  formatClarifyingQAForPrompt,
} from '@/lib/ai/memory'
import type { ClarifyingAnswer } from '@/lib/ai/memory'
import { getUserTimezone } from '@/lib/db/users'
import { dateInTz } from '@/lib/utils/date'
import { clearPulseForDate } from '@/lib/db/pulse'

export const runtime = 'nodejs'
export const maxDuration = 30

type Message = { role: 'user' | 'assistant'; content: string }

// Hidden block Jaune appends when the user corrects or adds context the pulse
// drew on — parsed server-side, never shown to the user.
const MEMORY_RE = /<memory>\s*([\s\S]*?)\s*<\/memory>/

function buildSystem(pulseText: string, contextBlock: string): string {
  return LOCUS_CHARACTER + `

The user just read this message you wrote them on their home page (their "pulse"):

"""
${pulseText || '(the pulse message)'}
"""

They tapped "Reply to Jaune" to talk back about it — usually because something in it was off, out of date, or missing context. Have a short, natural conversation:
- Keep every response to 1–2 sentences. This is a quick exchange, not an essay.
- If they're correcting something, acknowledge it plainly and warmly — no defensiveness, no over-apologising.
- If a correction is vague, ask one clarifying question before assuming.
- Never re-paste the pulse or explain how you generated it.

When the user tells you something true about themselves that should shape future messages — a correction to something you got wrong, or new context about their life, work, or what they're focused on — append a hidden memory block on its own final line. The user never sees this:

<memory>
{"note":"<one concise sentence, written as a durable fact about the user>"}
</memory>

Memory rules:
- Only append it when there is a real, lasting fact to remember. Skip it for small talk, acknowledgements, or anything tied to just today.
- Write the note as a standalone fact (e.g. "Works night shifts, so mornings are for winding down, not starting the day"), not as a reference to this conversation.
- Append at most one memory block per reply.

${contextBlock ? `What you already know about this person:\n\n${contextBlock}` : ''}`.trim()
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let messages: Message[]
  let pulseText = ''
  try {
    const body = await request.json()
    messages = body.messages ?? []
    pulseText = typeof body.pulseText === 'string' ? body.pulseText : ''
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Bad request', { status: 400 })
  }

  const memory = await readUserMemory(user.id)
  const contextBlock = [
    formatSelfProfileForPrompt(memory),
    formatMemoryForPrompt(memory),
    formatClarifyingQAForPrompt(memory),
  ].filter(Boolean).join('\n\n')

  const client  = getAnthropicClient()
  const system  = buildSystem(pulseText, contextBlock)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = ''
      try {
        const response = await client.messages.create({
          model:      'claude-haiku-4-5',
          max_tokens: 300,
          system,
          messages,
          stream: true,
        })
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        console.error('[pulse/reply] stream error:', err)
      } finally {
        controller.close()
      }

      // Persist any memory the reply captured, then drop today's cached pulse so
      // it regenerates with the correction. Never blocks the response.
      const match = accumulated.match(MEMORY_RE)
      if (match) {
        try {
          const note = (JSON.parse(match[1]) as { note?: string }).note?.trim()
          if (note) {
            const tz    = await getUserTimezone(user.id)
            const today = dateInTz(tz)
            const entry: ClarifyingAnswer = {
              question:    'Something the user clarified when replying to their pulse',
              answer:      note,
              answered_at: new Date().toISOString(),
              brief_date:  today,
            }
            const updatedQA = [...(memory?.clarifying_qa ?? []), entry].slice(-30)
            await patchUserMemory(user.id, { clarifying_qa: updatedQA })
            await clearPulseForDate(user.id, today)
          }
        } catch (err) {
          console.error('[pulse/reply] memory persist error:', err)
        }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
