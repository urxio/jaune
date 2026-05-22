import { createClient } from '@/lib/supabase/server'

/* ── TYPES ───────────────────────────────────────────── */

export type SelfProfile = {
  occupation: string
  relationship_status: 'single' | 'in_relationship' | 'married' | 'other' | 'prefer_not_to_say' | ''
  has_kids: boolean | null
  work_arrangement: 'remote' | 'office' | 'hybrid' | 'other' | ''
  personality: string[]   // e.g. ['Introvert', 'Morning person', 'Analytical']
  life_context: string    // 1-2 sentence free text written by user
  saved_at: string
}

export type ClarifyingAnswer = {
  question: string
  answer: string
  answered_at: string   // ISO timestamp
  brief_date: string    // YYYY-MM-DD
}

export type PersonMemory = {
  name: string              // "Sarah" | "mom" | "my boss"
  relationship: string      // "friend" | "family" | "partner" | "colleague" | "manager" | "other"
  mentions: number
  last_mentioned: string    // YYYY-MM-DD
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  context: string           // 1 sentence — how they appear in the user's life
}

export type UserMemory = {
  energy: {
    overall_avg: number          // all-time average
    recent_avg: number           // last 14 days
    trend: 'improving' | 'declining' | 'stable'
    by_day: Record<string, number>  // e.g. { Mon: 7.2, Tue: 6.1 }
    best_day: string | null
    worst_day: string | null
  }
  habits: {
    strongest: Array<{ name: string; emoji: string; rate_pct: number }>
    needs_work: Array<{ name: string; emoji: string; rate_pct: number }>
  }
  blockers: {
    frequent: string[]                     // top blockers by frequency
    frequencies: Record<string, number>    // blocker → count
  }
  mood_themes: string[]    // recurring words from mood notes
  insights: string[]       // AI-generated observations, max 8
  checkin_count: number
  last_stats_update: string
  last_insights_update: string | null
  // Patterns page cache
  pattern_narratives?: string[]
  pattern_generated_at?: string | null
  // People / relationship memory
  people_memory?: {
    people: PersonMemory[]
    last_updated: string
  }
  // Self-reported profile — set during onboarding, editable later
  self_profile?: SelfProfile
  // Clarifying Q&A — questions the AI asked, answers the user provided
  clarifying_qa?: ClarifyingAnswer[]
  // Pending questions to show after today's brief (cleared when answered/skipped)
  pending_clarifications?: {
    brief_date: string
    questions: string[]
  }
  // Habit audit dismissals — { 'YYYY-MM-DD': ['habitId', ...] } — cross-device sync
  audit_dismissals?: Record<string, string[]>
  // Date (YYYY-MM-DD local) when the check-in follow-up question was answered or skipped
  checkin_followup_dismissed_date?: string
  // Narrative summaries of each day's check-in conversation — last 30 days
  daily_summaries?: Array<{
    date: string         // YYYY-MM-DD
    summary: string      // 2-3 sentence narrative of the day
    generated_at: string // ISO timestamp
  }>
  // Behaviour-energy correlations — computed by updateMemoryStats
  correlations?: {
    habits: Array<{
      habit_id:            string
      habit_name:          string
      habit_emoji:         string
      energy_when_done:    number  // avg next-day energy after logging habit
      energy_when_skipped: number  // avg next-day energy without logging
      diff:                number  // positive = habit boosts energy
      sample_size:         number
    }>
    keywords: Array<{
      word:           string
      energy_with:    number  // avg energy on days word appears in mood note
      energy_without: number
      diff:           number  // positive = word associated with higher energy
      sample_size:    number
    }>
    computed_at: string
  }
}

/* ── READ ────────────────────────────────────────────── */

export async function readUserMemory(userId: string): Promise<UserMemory | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('user_memory')
      .select('data')
      .eq('user_id', userId)
      .single()
    return (data?.data as UserMemory) ?? null
  } catch {
    return null // table may not exist yet — always non-fatal
  }
}

/* ── PATCH (safe write — never wipes unrelated fields) ── */

/**
 * The ONLY correct way to write to user_memory.
 * Always reads current state first, merges the patch on top,
 * then writes back — so callers only own the fields they pass.
 *
 * Using .upsert() with onConflict ensures the row is created if missing.
 */
export async function patchUserMemory(
  userId: string,
  patch: Partial<UserMemory>,
): Promise<void> {
  const supabase = await createClient()
  // Read current state so we never lose unrelated fields
  const { data } = await supabase
    .from('user_memory')
    .select('data')
    .eq('user_id', userId)
    .single()
  const current = (data?.data ?? {}) as UserMemory
  await supabase
    .from('user_memory')
    .upsert(
      { user_id: userId, data: { ...current, ...patch }, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
}

/* ── FORMAT SELF PROFILE FOR PROMPT ─────────────────── */

export function formatSelfProfileForPrompt(memory: UserMemory | null): string {
  const p = memory?.self_profile
  if (!p) return ''
  const tags = Array.isArray(p.personality) ? p.personality : []
  // Only include if at least one field is set
  if (!p.occupation && !p.relationship_status && tags.length === 0 && !p.life_context) return ''

  const lines: string[] = []
  lines.push('── ABOUT THIS PERSON ──')

  if (p.occupation) lines.push(`Occupation: ${p.occupation}`)

  const relLabel: Record<string, string> = {
    single: 'Single', in_relationship: 'In a relationship',
    married: 'Married', other: 'Other',
  }
  if (p.relationship_status && p.relationship_status !== 'prefer_not_to_say') {
    lines.push(`Relationship: ${relLabel[p.relationship_status] ?? p.relationship_status}`)
  }
  if (p.has_kids === true)  lines.push('Kids: Yes')
  if (p.has_kids === false) lines.push('Kids: No')

  if (p.work_arrangement && p.work_arrangement !== 'other') {
    const wLabel: Record<string, string> = { remote: 'Remote', office: 'Office', hybrid: 'Hybrid' }
    lines.push(`Work setup: ${wLabel[p.work_arrangement] ?? p.work_arrangement}`)
  }
  if (tags.length > 0) {
    lines.push(`Personality: ${tags.join(' · ')}`)
  }
  if (p.life_context?.trim()) {
    lines.push(`Context: "${p.life_context.trim()}"`)
  }

  lines.push('── END ABOUT THIS PERSON ──')
  return lines.join('\n')
}

/* ── FORMAT FOR PROMPT ───────────────────────────────── */

export function formatMemoryForPrompt(memory: UserMemory | null): string {
  if (!memory || !memory.checkin_count || memory.checkin_count < 5 || !memory.energy) return ''

  const lines: string[] = []
  lines.push('── LONG-TERM MEMORY ──')
  lines.push(`Jaune has learned the following from ${memory.checkin_count} check-ins with this user:`)
  lines.push('')

  // Energy patterns
  const arrow = memory.energy.trend === 'improving' ? '↑' : memory.energy.trend === 'declining' ? '↓' : '→'
  const energyParts: string[] = [`overall avg ${memory.energy.overall_avg}/10`]
  if (Math.abs(memory.energy.recent_avg - memory.energy.overall_avg) >= 0.3) {
    energyParts.push(`recent 14d avg ${memory.energy.recent_avg}/10 ${arrow} ${memory.energy.trend}`)
  } else {
    energyParts.push(`trend: ${arrow} ${memory.energy.trend}`)
  }
  if (memory.energy.best_day) energyParts.push(`peaks on ${memory.energy.best_day}s`)
  if (memory.energy.worst_day && memory.energy.worst_day !== memory.energy.best_day) {
    energyParts.push(`dips on ${memory.energy.worst_day}s`)
  }
  lines.push(`Energy: ${energyParts.join(' · ')}`)

  // Habit consistency
  const habitParts: string[] = []
  if (memory.habits.strongest.length > 0) {
    const h = memory.habits.strongest[0]
    habitParts.push(`${h.emoji} ${h.name} is rock-solid (${h.rate_pct}% last 30d)`)
  }
  if (memory.habits.needs_work.length > 0) {
    const h = memory.habits.needs_work[0]
    habitParts.push(`${h.emoji} ${h.name} needs attention (${h.rate_pct}% last 30d)`)
  }
  if (habitParts.length > 0) lines.push(`Habits: ${habitParts.join(' · ')}`)

  // Recurring blockers
  if (memory.blockers.frequent.length > 0) {
    const details = memory.blockers.frequent.slice(0, 4).map(b => {
      const n = memory.blockers.frequencies[b] ?? 0
      return n >= 3 ? `"${b}" (${n}×)` : `"${b}"`
    })
    lines.push(`Recurring blockers: ${details.join(' · ')}`)
  }

  // Mood themes
  if (memory.mood_themes.length > 0) {
    lines.push(`Mood themes: ${memory.mood_themes.slice(0, 6).join(', ')}`)
  }

  // AI-generated insights
  if (memory.insights.length > 0) {
    lines.push('')
    lines.push('Patterns learned over time:')
    memory.insights.forEach(insight => lines.push(`• ${insight}`))
  }

  lines.push('── END MEMORY ──')
  return lines.join('\n')
}

/* ── SAVE PENDING CLARIFICATIONS ────────────────────── */

export async function savePendingClarifications(
  userId: string,
  briefDate: string,
  questions: string[]
): Promise<void> {
  if (!questions.length) return
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('user_memory')
      .select('data')
      .eq('user_id', userId)
      .single()
    const current = (data?.data ?? {}) as UserMemory
    const updated: UserMemory = {
      ...current,
      pending_clarifications: { brief_date: briefDate, questions },
    }
    await supabase
      .from('user_memory')
      .upsert({ user_id: userId, data: updated }, { onConflict: 'user_id' })
  } catch (err) {
    console.error('savePendingClarifications:', err)
  }
}

/* ── FORMAT CLARIFYING Q&A FOR PROMPT ───────────────── */

export function formatClarifyingQAForPrompt(memory: UserMemory | null): string {
  const qa = memory?.clarifying_qa?.slice(-12)
  if (!qa?.length) return ''
  const lines: string[] = []
  lines.push('── CLARIFIED CONTEXT ──')
  lines.push('The user has directly answered these questions to help Jaune understand them better:')
  lines.push('')
  qa.forEach(item => {
    lines.push(`Q: ${item.question}`)
    lines.push(`A: ${item.answer}`)
    lines.push('')
  })
  lines.push('── END CLARIFIED CONTEXT ──')
  return lines.join('\n')
}

/* ── FORMAT CORRELATIONS FOR PROMPT ─────────────────── */

export function formatCorrelationsForPrompt(memory: UserMemory | null): string {
  const c = memory?.correlations
  if (!c) return ''
  const lines: string[] = []
  const entries: string[] = []

  c.habits.forEach(h => {
    if (h.diff >= 0.5) {
      entries.push(`• ${h.habit_emoji} ${h.habit_name} days → next-day energy +${h.diff} pts (avg ${h.energy_when_done}/10 vs ${h.energy_when_skipped}/10 when skipped, ${h.sample_size} data points)`)
    } else if (h.diff <= -0.5) {
      entries.push(`• Missing ${h.habit_emoji} ${h.habit_name} → next-day energy ${h.diff} pts (${h.sample_size} data points)`)
    }
  })

  c.keywords.forEach(k => {
    if (k.diff >= 0.7) {
      entries.push(`• Mentioning "${k.word}" in mood notes → energy +${k.diff} pts that day (${k.sample_size} occurrences)`)
    } else if (k.diff <= -0.7) {
      entries.push(`• Mentioning "${k.word}" → energy ${k.diff} pts that day (${k.sample_size} occurrences)`)
    }
  })

  if (entries.length === 0) return ''

  lines.push('── BEHAVIOUR-ENERGY CORRELATIONS ──')
  lines.push('Statistically observed patterns from this user\'s data (reference these when relevant):')
  entries.forEach(e => lines.push(e))
  lines.push('── END CORRELATIONS ──')
  return lines.join('\n')
}

/* ── FORMAT DAILY SUMMARIES FOR PROMPT ──────────────── */

export function formatDailySummariesForPrompt(memory: UserMemory | null): string {
  const summaries = memory?.daily_summaries
  if (!summaries || summaries.length === 0) return ''

  // Show last 5 days only — older context is stale and causes the AI to
  // surface irrelevant events or confuse past completions with today's status.
  const recent = [...summaries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  const lines: string[] = []
  lines.push('── RECENT DAYS (PAST context — these are previous days, NOT today) ──')
  lines.push('What the user experienced in recent past check-ins. Reference only when still relevant — never present past events as today\'s status:')
  lines.push('')
  recent.forEach(s => {
    lines.push(`${s.date} (past): ${s.summary}`)
  })
  lines.push('── END RECENT DAYS ──')
  return lines.join('\n')
}

/* ── FORMAT PEOPLE FOR PROMPT ────────────────────────── */

export function formatPeopleForPrompt(memory: UserMemory | null): string {
  const people = memory?.people_memory?.people
  if (!people || people.length === 0) return ''

  const lines: string[] = []
  lines.push('── RELATIONSHIPS ──')
  lines.push('People this user mentions often (learned from journals & mood notes):')

  people.slice(0, 6).forEach(p => {
    const now = Date.now()
    const lastMs = new Date(p.last_mentioned).getTime()
    const daysAgo = Math.floor((now - lastMs) / 86400000)
    const recency = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`

    const sentimentIcon = p.sentiment === 'positive' ? '✦'
      : p.sentiment === 'negative' ? '↓'
      : p.sentiment === 'mixed' ? '~'
      : '·'

    lines.push(`• ${p.name} [${p.relationship}] — ${p.mentions}× mentions, last ${recency} — ${sentimentIcon} ${p.context}`)
  })

  lines.push('── END RELATIONSHIPS ──')
  return lines.join('\n')
}

export function formatCatchupForPrompt(catchupPeople: { name: string; notes: string | null }[]): string {
  if (catchupPeople.length === 0) return ''
  const lines: string[] = []
  lines.push('── CATCH-UP LIST ──')
  lines.push('The user has explicitly flagged these people as someone they want to reconnect with:')
  catchupPeople.forEach(p => {
    lines.push(`• ${p.name}${p.notes ? ` — ${p.notes}` : ''}`)
  })
  lines.push('── END CATCH-UP LIST ──')
  return lines.join('\n')
}
