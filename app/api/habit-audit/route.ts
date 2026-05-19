import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { readUserMemory, patchUserMemory } from '@/lib/ai/memory'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { habitId, habitName, habitEmoji, motivation, reason, auditDate } = await req.json() as {
    habitId:    string
    habitName:  string
    habitEmoji: string
    motivation: string | null
    reason:     string
    auditDate:  string
  }

  // ── Store blocker + mark audit as dismissed in user memory ───────────────
  try {
    const memory   = await readUserMemory(user.id)
    const blockers = { ...(memory?.blockers ?? { frequent: [], frequencies: {} }) }
    const key      = reason.trim().toLowerCase().slice(0, 60)
    blockers.frequencies[key] = (blockers.frequencies[key] ?? 0) + 1
    blockers.frequent = Object.entries(blockers.frequencies)
      .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)

    const dismissals = { ...(memory?.audit_dismissals ?? {}) }
    if (!dismissals[auditDate]) dismissals[auditDate] = []
    if (!dismissals[auditDate].includes(habitId)) dismissals[auditDate].push(habitId)

    await patchUserMemory(user.id, { blockers, audit_dismissals: dismissals })
  } catch { /* non-fatal */ }

  // ── Stream AI empathetic response ────────────────────────────────────────
  const memory = await readUserMemory(user.id)
  const energyCtx = memory?.energy
    ? `Their recent energy avg is ${memory.energy.recent_avg}/10 (${memory.energy.trend}).`
    : ''

  const system = `You are Jaune, a warm and perceptive AI life companion. Be concise and human — like a thoughtful friend, not a therapist or productivity coach.`

  const userMsg = [
    `The user missed their habit "${habitEmoji} ${habitName}" yesterday.`,
    motivation ? `They originally wanted this habit because: "${motivation}".` : '',
    `When asked what got in the way, they said: "${reason}".`,
    energyCtx,
    ``,
    `Respond with exactly 2 sentences:`,
    `1. Acknowledge what got in the way — be specific to what they said, no judgment.`,
    `2. One small, concrete reframe or micro-tip that connects back to their why (if available).`,
    `No filler phrases ("I see", "It sounds like", "That makes sense"). No questions. No emoji.`,
  ].filter(Boolean).join('\n')

  const client  = getAnthropicClient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model:      'claude-haiku-4-5',
          max_tokens: 150,
          system,
          messages:   [{ role: 'user', content: userMsg }],
          stream:     true,
        })
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        console.error('[habit-audit] stream error:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
