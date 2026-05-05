import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'
import { readUserMemory, formatMemoryForPrompt, formatSelfProfileForPrompt, formatClarifyingQAForPrompt } from '@/lib/ai/memory'
import { getTodayCheckin } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoals } from '@/lib/db/goals'
import { getUserLocalDate } from '@/lib/db/users'
import { getCachedPulse, storePulse } from '@/lib/db/pulse'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'
export const maxDuration = 20

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const force     = new URL(req.url).searchParams.has('force')
  const todayDate = await getUserLocalDate(user.id)
  const hour      = new Date().getHours()

  if (!force) {
    const cached = await getCachedPulse(user.id, todayDate, hour)
    if (cached) {
      return new Response(cached, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  }

  const [memory, checkin, habits, goals] = await Promise.all([
    readUserMemory(user.id),
    getTodayCheckin(user.id),
    getUserHabitsWithLogs(user.id),
    getActiveGoals(user.id),
  ])

  const dayName   = new Date(todayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const scheduledToday  = habits.filter(h => h.isScheduledToday)
  const doneToday       = scheduledToday.filter(h => h.logs.some(l => l.logged_date === todayDate))
  const active          = goals.filter(g => g.status === 'active')

  // ── Context blocks ──────────────────────────────────────────────────────
  const memoryBlock      = formatMemoryForPrompt(memory)
  const profileBlock     = formatSelfProfileForPrompt(memory)
  const clarifyingBlock  = formatClarifyingQAForPrompt(memory)

  const todayBlock = [
    `Today: ${dayName} ${timeOfDay}`,
    checkin
      ? `Already checked in — energy ${checkin.energy_level}/10${checkin.mood_note ? `, mood: "${checkin.mood_note}"` : ''}`
      : 'Has not checked in yet today',
    scheduledToday.length > 0
      ? `Habits today: ${scheduledToday.map(h => `${h.emoji} ${h.name}${h.motivation ? ` (why: ${h.motivation})` : ''}`).join('; ')} (${doneToday.length}/${scheduledToday.length} done)`
      : 'No habits scheduled today',
    active.length > 0
      ? `Active goals: ${active.map(g => `${g.title} (${g.progress_pct}%)`).join(', ')}`
      : 'No active goals',
    habits.length > 0
      ? `Top streaks: ${habits.filter(h => h.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 2).map(h => `${h.emoji} ${h.name} – ${h.streak} day streak`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n')

  const contextParts = [profileBlock, memoryBlock, clarifyingBlock, todayBlock].filter(Boolean)
  const context = contextParts.join('\n\n')

  const system = `You are Locus, a warm and perceptive AI life companion. Your job is to write a short, specific, thoughtful message to open the user's home page pulse.

Rules:
- 2–4 sentences. Enough to feel substantive but not overwhelming.
- Be genuinely specific — reference actual data points (streaks, patterns, goals, energy trends, day of week, personality, life context). Never be generic.
- Sound like a thoughtful friend who has been paying attention, not a productivity app.
- No filler words like "It looks like..." or "I noticed that..." — just say the thing.
- No emoji. No exclamation marks. No questions.
- Vary your angle based on the time of day: morning = set the tone for the day; afternoon = check in on momentum; evening = reflect on what happened.
- If you have no meaningful data yet, say something warm and grounding about the day ahead.
- Do NOT mention the check-in, habits list, or goals — those are shown separately on the page.`

  const client = getAnthropicClient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = ''
      try {
        const response = await client.messages.create({
          model:      'claude-haiku-4-5',
          max_tokens: 220,
          system,
          messages: [{ role: 'user', content: context || 'New user, no data yet.' }],
          stream: true,
        })
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        if (accumulated) {
          storePulse(user.id, todayDate, hour, accumulated).catch(err =>
            console.error('[pulse] store error:', err)
          )
        }
      } catch (err) {
        console.error('[pulse] stream error:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
