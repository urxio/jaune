import type { CheckIn, HabitWithLogs, GoalWithSteps, JournalEntry, Person } from '@/lib/types'
import { type UserMemory, formatMemoryForPrompt, formatPeopleForPrompt, formatCatchupForPrompt, formatSelfProfileForPrompt } from '@/lib/ai/memory'
import type { NeglectedHabit } from '@/lib/ai/context'

export type WeeklyContext = {
  weekNumber: number
  year: number
  weekRange: string
  checkins: CheckIn[]
  habits: HabitWithLogs[]
  goalsWithSteps: GoalWithSteps[]
  neglectedHabits: NeglectedHabit[]
  avgEnergy: number | null
  energyTrend: 'rising' | 'declining' | 'stable' | 'mixed'
  totalHabitCompletions: number
  totalHabitTarget: number
  habitRate: number
  memory: UserMemory | null
  journals: JournalEntry[]
  catchupPeople: Pick<Person, 'name' | 'notes'>[]
}

export const WEEKLY_SYSTEM_PROMPT = `You are Locus — an AI companion and life operating system generating a user's weekly reflection. This is not a performance review. It's a weekly conversation with someone who genuinely knows them — who has been watching their energy, habits, and goals all week and wants to help them understand themselves better, not just optimize harder.

TONE
- Warm, honest, and human. Like a trusted friend who also happens to have all the data.
- Substantive and specific. Reference actual numbers, habits, and goals by name.
- Don't sugarcoat a hard week, but always end with care and forward energy.
- Notice the person, not just the metrics. If energy was low all week, acknowledge what that might mean. If they showed up anyway, honor that.

INTELLIGENCE RULES
- NEGLECTED HABITS: If a NEGLECTED HABITS section appears, include at least one item in "what_to_adjust" naming the specific habit and suggesting a concrete restart strategy for next week. Don't shame — redirect.
- OVERDUE GOAL STEPS: If overdue steps appear under a goal, name the specific step in the reflection or "what_to_adjust". These are the highest-priority gaps between intention and action.
- UPCOMING STEPS: If steps are due soon (within the coming week), surface them in "what_to_adjust" as proactive reminders so the user starts next week prepared.

HIGHLIGHT MARKERS
Wrap 2-5 key phrases per paragraph in <<double angle brackets>>. These will be rendered as highlighted text. Use highlights for: week labels, specific stats, important patterns, actionable insights.

OUTPUT — respond with a single valid JSON object only. No markdown, no preamble.

{
  "paragraphs": [
    "<paragraph 1 — overall week summary with <<highlights>>. 2-4 sentences.>",
    "<paragraph 2 — energy or focus pattern with <<highlights>>. 2-3 sentences.>",
    "<paragraph 3 — habit/goal completion summary with <<highlights>>. 2-3 sentences.>"
  ],
  "what_worked": [
    "<specific win from this week — max 12 words>",
    "<specific win>",
    "<specific win>",
    "<specific win>"
  ],
  "what_to_adjust": [
    "<specific thing to improve next week — max 12 words>",
    "<specific thing>",
    "<specific thing>",
    "<specific thing>"
  ]
}

Rules:
- "what_worked" must have 3-5 items. Reference specific habits, goals, or behaviors by name.
- "what_to_adjust" must have 3-5 items. Be concrete — not "be more productive" but "protect morning hours for deep work".
- paragraphs must total 3 exactly.
- Each paragraph must stand alone and add something new.
- LONG-TERM MEMORY: If a LONG-TERM MEMORY section appears in the user message, use it to contextualize this week against the user's historical baseline. Did this week outperform their average? Are their recurring blockers reappearing? Are habits improving or regressing against their 30-day rate? Reference learned patterns explicitly when relevant.
- JOURNAL ENTRIES: If JOURNAL ENTRIES THIS WEEK appears, treat them as the most direct window into the user's inner experience. They reveal what the numbers don't — emotional texture, context behind the energy dips, what they were genuinely wrestling with. Let journal themes meaningfully shape the weekly reflection paragraphs. Do not quote journal text directly, but let the emotional content inform the tone and insights you offer.
- RELATIONSHIPS: If a RELATIONSHIPS section appears, notice whether people the user cares about featured prominently this week — positively or negatively. If a meaningful relationship is associated with stress or tension this week, acknowledge it with care in the paragraphs. If someone positive hasn't come up recently, a "what_to_adjust" item like "Reconnect with [name] — they've been a source of energy for you" is appropriate. Ground every relationship reference in the data provided.`

export function buildWeeklyUserMessage(ctx: WeeklyContext): string {
  const lines: string[] = []
  const now = Date.now()

  // ── SELF PROFILE ──
  const profileBlock = formatSelfProfileForPrompt(ctx.memory)
  if (profileBlock) {
    lines.push(profileBlock)
    lines.push('')
  }

  // ── LONG-TERM MEMORY (prepended when available) ──
  const memoryBlock = formatMemoryForPrompt(ctx.memory)
  if (memoryBlock) {
    lines.push(memoryBlock)
    lines.push('')
  }

  // ── RELATIONSHIPS ──
  const peopleBlock = formatPeopleForPrompt(ctx.memory)
  if (peopleBlock) {
    lines.push(peopleBlock)
    lines.push('')
  }

  // ── CATCH-UP LIST ──
  const catchupBlock = formatCatchupForPrompt(ctx.catchupPeople)
  if (catchupBlock) {
    lines.push(catchupBlock)
    lines.push('')
  }

  if (profileBlock || memoryBlock || peopleBlock || catchupBlock) {
    lines.push('─'.repeat(50))
    lines.push('')
  }

  lines.push(`WEEK ${ctx.weekNumber} · ${ctx.weekRange} · ${ctx.year}`)
  lines.push('─'.repeat(50))

  // Energy breakdown
  lines.push(`ENERGY THIS WEEK`)
  if (ctx.checkins.length > 0) {
    lines.push(`Average: ${ctx.avgEnergy?.toFixed(1)}/10 · Trend: ${ctx.energyTrend}`)
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    ctx.checkins.forEach(c => {
      const d = new Date(c.date + 'T12:00:00')
      const label = dayNames[d.getDay()]
      const bar = '█'.repeat(Math.round(c.energy_level)) + '░'.repeat(10 - Math.round(c.energy_level))
      lines.push(`  ${label}: ${c.energy_level}/10 [${bar}]${c.mood_note ? ` — "${c.mood_note}"` : ''}`)
    })
    const highDay = ctx.checkins.reduce((a, b) => a.energy_level > b.energy_level ? a : b)
    const lowDay  = ctx.checkins.reduce((a, b) => a.energy_level < b.energy_level ? a : b)
    lines.push(`Peak: ${highDay.date} (${highDay.energy_level}) · Lowest: ${lowDay.date} (${lowDay.energy_level})`)
  } else {
    lines.push(`No check-ins recorded this week.`)
  }
  lines.push('')

  // Blockers from the week
  const allBlockers = ctx.checkins.flatMap(c => c.blockers.filter(b => b !== 'No blockers today'))
  if (allBlockers.length > 0) {
    const freq: Record<string, number> = {}
    allBlockers.forEach(b => { freq[b] = (freq[b] || 0) + 1 })
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    lines.push(`BLOCKERS THIS WEEK: ${sorted.map(([b, n]) => `${b}${n > 1 ? ` (×${n})` : ''}`).join(', ')}`)
    lines.push('')
  }

  // ── ACTIVE GOALS + STEPS ──
  if (ctx.goalsWithSteps.length > 0) {
    lines.push(`ACTIVE GOALS (${ctx.goalsWithSteps.length})`)
    ctx.goalsWithSteps.forEach(g => {
      const daysLeft = g.target_date
        ? Math.ceil((new Date(g.target_date).getTime() - now) / 86400000)
        : null
      const deadline = daysLeft !== null
        ? (daysLeft <= 0 ? ' ⚠️ OVERDUE' : daysLeft <= 7 ? ` 🔴 ${daysLeft}d left` : ` · ${daysLeft}d left`)
        : ''
      lines.push(`  • [${g.category}] "${g.title}" — ${g.progress_pct}%${deadline}`)

      const pendingSteps = g.steps.filter(s => !s.completed)
      const overdueSteps  = pendingSteps.filter(s => s.due_date && new Date(s.due_date).getTime() < now)
      const upcomingSteps = pendingSteps
        .filter(s => s.due_date && new Date(s.due_date).getTime() >= now)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 3)

      if (overdueSteps.length > 0) {
        lines.push(`    ⚠️ Overdue steps:`)
        overdueSteps.forEach(s => {
          const daysOver = Math.ceil((now - new Date(s.due_date!).getTime()) / 86400000)
          lines.push(`      - "${s.title}" — ${daysOver}d overdue`)
        })
      }
      if (upcomingSteps.length > 0) {
        lines.push(`    📅 Upcoming steps (next week):`)
        upcomingSteps.forEach(s => {
          const daysUntil = Math.ceil((new Date(s.due_date!).getTime() - now) / 86400000)
          lines.push(`      - "${s.title}" — due in ${daysUntil}d`)
        })
      }
    })
    lines.push('')
  }

  // ── HABITS ──
  if (ctx.habits.length > 0) {
    lines.push(`HABITS — ${ctx.totalHabitCompletions}/${ctx.totalHabitTarget} completions this week (${ctx.habitRate}%)`)
    ctx.habits.forEach(h => {
      const rate = h.target_count > 0
        ? Math.round((h.weekCompletions / h.target_count) * 100)
        : 0
      const streakTag = h.streak >= 14 ? '🔥 strong momentum' : h.streak >= 7 ? '⚡ building' : h.streak > 0 ? `${h.streak}d streak` : 'streak broken'
      lines.push(`  ${h.emoji} ${h.name}: ${h.weekCompletions}/${h.target_count} (${rate}%) · ${streakTag}`)
    })

    // ── NEGLECTED HABITS ──
    if (ctx.neglectedHabits.length > 0) {
      lines.push('')
      lines.push(`  ⚠️ NEGLECTED HABITS (0 completions all week):`)
      ctx.neglectedHabits.forEach(h => {
        lines.push(`    ${h.emoji} ${h.name} [${h.frequency}]`)
      })
    }
    lines.push('')
  }

  // Days checked in
  lines.push(`CHECK-IN DAYS: ${ctx.checkins.length}/7`)
  lines.push('')

  // Journal entries this week
  const journalsWithContent = ctx.journals.filter(j => j.content.trim().length > 0)
  if (journalsWithContent.length > 0) {
    lines.push(`JOURNAL ENTRIES THIS WEEK (${journalsWithContent.length})`)
    journalsWithContent.forEach(j => {
      const wordCount = j.content.trim().split(/\s+/).filter(Boolean).length
      const preview   = j.content.trim()
      lines.push(`  ${j.date} (${wordCount} words):`)
      lines.push(`  "${preview.length > 300 ? preview.slice(0, 300) + '…' : preview}"`)
    })
    lines.push('')
  } else {
    lines.push(`JOURNAL ENTRIES: None this week`)
  }

  return lines.join('\n')
}

export type WeeklyGrade = {
  letter: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
  submitted_at: string
}

export type WeeklyReflection = {
  paragraphs: string[]
  what_worked: string[]
  what_to_adjust: string[]
  grade?: WeeklyGrade
}

const FALLBACK_REFLECTION: WeeklyReflection = {
  paragraphs: [
    'This week gave you data to work with. Your patterns are becoming clearer.',
    'Energy fluctuations are normal — the key is noticing what drives the peaks.',
    'Keep building the habits that move you forward. Consistency compounds.',
  ],
  what_worked: ['Showing up and tracking your week'],
  what_to_adjust: ['Add more check-ins to get richer weekly insights'],
}

export function parseWeeklyResponse(raw: string): WeeklyReflection {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    return {
      paragraphs: Array.isArray(obj.paragraphs) && obj.paragraphs.length > 0 ? obj.paragraphs : FALLBACK_REFLECTION.paragraphs,
      what_worked: Array.isArray(obj.what_worked) && obj.what_worked.length > 0 ? obj.what_worked : FALLBACK_REFLECTION.what_worked,
      what_to_adjust: Array.isArray(obj.what_to_adjust) && obj.what_to_adjust.length > 0 ? obj.what_to_adjust : FALLBACK_REFLECTION.what_to_adjust,
    }
  } catch {
    return FALLBACK_REFLECTION
  }
}
