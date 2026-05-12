import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { readUserMemory } from '@/lib/ai/memory'
import { getAnthropicClient } from '@/lib/ai/client'
import type { CalendarEvent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

type SuggestedBlock = {
  day_of_week: number
  time_slot: 'morning' | 'afternoon' | 'evening'
  title: string
  type: 'goal' | 'custom'
  reference_id: string | null
  reason: string
}

type SuggestResponse = {
  narrative: string
  blocks: SuggestedBlock[]
  summary: string
}

/** Format calendar events as a per-day schedule string for the AI prompt. */
function formatCalendarSchedule(events: CalendarEvent[], weekStart: string): string {
  if (!events.length) return 'No calendar events found for this week.'

  // Build a date range for the week (Mon–Sun)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const lines: string[] = ['CALENDAR SCHEDULE THIS WEEK:']

  for (const dateStr of days) {
    const dayEvents = events.filter(ev => ev.start.slice(0, 10) === dateStr)
    const d = new Date(dateStr + 'T12:00:00')
    const label = `${DOW[d.getDay()]} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    if (dayEvents.length === 0) {
      lines.push(`  ${label}: (open)`)
    } else {
      lines.push(`  ${label}:`)
      for (const ev of dayEvents) {
        if (ev.isAllDay) {
          lines.push(`    • ${ev.title} [all day]`)
        } else {
          const start = new Date(ev.start)
          const end   = new Date(ev.end)
          const fmt = (t: Date) => t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const hour = start.getHours()
          const slot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
          lines.push(`    • ${fmt(start)}–${fmt(end)}: ${ev.title} [${slot}]`)
        }
      }
    }
  }

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let weekStart: string
  let calendarEvents: CalendarEvent[] = []
  try {
    const body = await request.json()
    weekStart = body.weekStart
    if (!weekStart) throw new Error('missing weekStart')
    if (Array.isArray(body.calendarEvents)) calendarEvents = body.calendarEvents
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const [habits, goals, memory] = await Promise.all([
    getUserHabitsWithLogs(user.id),
    getActiveGoalsWithSteps(user.id),
    readUserMemory(user.id),
  ])

  const habitSummary = habits.map(h => {
    const days = h.days_of_week && h.days_of_week.length > 0
      ? `days: [${h.days_of_week.join(',')}]`
      : 'every day'
    const slot = h.time_of_day ? `, time_of_day: ${h.time_of_day}` : ', time_of_day: unset'
    return `- ${h.emoji} "${h.name}" [${days}${slot}]`
  }).join('\n')

  const goalSummary = goals.map(g => {
    const deadline = g.target_date ? `, due: ${g.target_date}` : ''
    return `- id:${g.id} "${g.title}" [${g.category}${deadline}]`
  }).join('\n')

  const energyContext = memory?.energy?.best_day
    ? `Best energy day: ${memory.energy.best_day}, recent avg: ${memory.energy.recent_avg}/10`
    : 'Energy patterns: unknown'

  const calendarSchedule = formatCalendarSchedule(calendarEvents, weekStart)

  const prompt = `You are Locus. Analyze the week of ${weekStart} and suggest a smart plan.

${calendarSchedule}

HABITS:
${habitSummary || '(none)'}

GOALS:
${goalSummary || '(none)'}

ENERGY PATTERNS:
${energyContext}

INSTRUCTIONS:
1. Write a "narrative" — 2-3 sentences analyzing this specific week: which days are heavy with commitments, which days have open windows, and how the user should approach the week. Be specific (name days). Keep it warm and direct.
2. Suggest plan blocks that work AROUND the existing calendar — don't suggest a block in a slot already occupied by a calendar event. Suggest 4-8 blocks total:
   - For habits with no time_of_day: suggest best slot based on type (morning = exercise/meditation, evening = reading/journaling)
   - Suggest 2-4 focused goal work blocks spread across open days
   - Keep weekends (day_of_week 0=Sun, 6=Sat) lighter — 1-2 blocks max
   - day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

Return ONLY valid JSON, no markdown fences:
{
  "narrative": "2-3 sentence week analysis referencing specific days and calendar load",
  "blocks": [{"day_of_week":N,"time_slot":"morning|afternoon|evening","title":"...","type":"goal|custom","reference_id":"uuid or null","reason":"one sentence why this slot"}],
  "summary": "same as narrative"
}`

  const client = getAnthropicClient()

  let rawText = ''
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: 'You are a JSON API. Respond with a single valid JSON object only. No markdown, no prose, no code fences. Just the raw JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    for (const block of response.content) {
      if (block.type === 'text') { rawText = block.text; break }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Claude API call failed (planner suggest):', message)
    return NextResponse.json({ error: 'AI generation failed', detail: message }, { status: 502 })
  }

  let parsed: SuggestResponse
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    parsed = JSON.parse(jsonMatch[0]) as SuggestResponse
    if (!Array.isArray(parsed.blocks)) throw new Error('No blocks array in response')
    if (typeof parsed.narrative !== 'string') parsed.narrative = parsed.summary ?? ''
    if (typeof parsed.summary !== 'string') parsed.summary = parsed.narrative
  } catch (err) {
    console.error('Failed to parse planner suggestion:', err)
    console.error('Raw AI response:', rawText)
    return NextResponse.json({ error: 'Failed to parse AI response', detail: rawText.slice(0, 300) }, { status: 500 })
  }

  return NextResponse.json(parsed)
}
