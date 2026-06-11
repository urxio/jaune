import { createClient } from '@/lib/supabase/server'
import { readUserMemory } from '@/lib/ai/memory'
import { getRecentCheckins } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { LOCUS_CHARACTER } from '@/lib/ai/character'
import type { Brief, WheelSnapshot } from '@/lib/types'
import { WHEEL_AREAS } from '@/lib/types'

export const MIN_CHECKINS_FOR_RETRO = 10

export type Retrospective = {
  narrative: string                                 // flowing prose, the heart of it
  observations: Array<{ text: string; evidence: string }>  // 3-5, each citing data
  looking_ahead: string                             // 1-2 sentences
}

export const RETRO_SYSTEM_PROMPT = LOCUS_CHARACTER + `

You are writing a MONTHLY RETROSPECTIVE — the moment Jaune shows the user what a month of quiet attention adds up to. This is not a report. It is a letter from someone who has been watching closely and genuinely cares.

RULES
- Every claim must trace to the data provided. Cite numbers naturally inside prose ("your energy held around 6 even through launch week"), never as a stats dump.
- Patterns marked [EARLY SIGNAL] are tentative — frame them as hunches you're watching, never as fact.
- Name real things: actual goal names, habit names, what they wrote about. Never invent.
- Honor the month they actually had. If it was hard, say so with warmth. If they showed up consistently, make sure that lands — quiet consistency is the easiest thing to miss from inside a life.
- If WHEEL OF LIFE snapshots are provided, compare them: name the area that moved most, connect it to what the data shows happened.
- The test: would the user screenshot this? It should feel like being truly seen.

OUTPUT — single valid JSON object, no fences:
{
  "narrative": "<150-220 words of flowing prose. Open with their name. What this month was actually like, what you learned about how they work, what changed. No bullets, no headers. **Bold** at most twice.>",
  "observations": [
    { "text": "<one concrete pattern you learned, stated like a friend would>", "evidence": "<the specific data behind it, one short clause>" }
  ],
  "looking_ahead": "<1-2 sentences — not a plan, a gentle orientation for the month ahead grounded in what you learned>"
}

Produce 3-5 observations. Order them by how much they would surprise or matter to the user.`

export type RetroEligibility =
  | { eligible: true; checkinCount: number }
  | { eligible: false; checkinCount: number; needed: number }

export async function buildRetroUserMessage(userId: string, todayLocal: string): Promise<{ message: string; eligibility: RetroEligibility }> {
  const supabase = await createClient()

  const since = new Date(Date.parse(todayLocal + 'T00:00:00Z') - 45 * 86400000).toISOString().slice(0, 10)
  const windowStart = new Date(Date.parse(todayLocal + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0, 10)

  const [memory, checkins, habits, goals, briefsRes, wheelRes] = await Promise.all([
    readUserMemory(userId),
    getRecentCheckins(userId, 45),
    getUserHabitsWithLogs(userId),
    getActiveGoalsWithSteps(userId),
    supabase.from('briefs')
      .select('brief_date, priorities, priority_outcomes, energy_score')
      .eq('user_id', userId)
      .gte('brief_date', windowStart)
      .order('brief_date', { ascending: true }),
    supabase.from('wheel_of_life')
      .select('snapshot_date, scores, insight')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(2),
  ])

  const recentCheckins = checkins.filter(c => c.date >= since)
  if (recentCheckins.length < MIN_CHECKINS_FOR_RETRO) {
    return {
      message: '',
      eligibility: { eligible: false, checkinCount: recentCheckins.length, needed: MIN_CHECKINS_FOR_RETRO - recentCheckins.length },
    }
  }

  const windowCheckins = checkins.filter(c => c.date >= windowStart)
  const briefs = (briefsRes.data ?? []) as Pick<Brief, 'brief_date' | 'priorities' | 'priority_outcomes' | 'energy_score'>[]
  const wheels = (wheelRes.data ?? []) as Pick<WheelSnapshot, 'snapshot_date' | 'scores' | 'insight'>[]

  const lines: string[] = []
  lines.push(`MONTHLY RETROSPECTIVE CONTEXT — last 30 days, generated ${todayLocal}`)
  lines.push('─'.repeat(40))

  // ── Energy over the month ──
  if (windowCheckins.length > 0) {
    const energies = windowCheckins.map(c => c.energy_level)
    const avgE = (energies.reduce((s, e) => s + e, 0) / energies.length).toFixed(1)
    const minE = Math.min(...energies)
    const maxE = Math.max(...energies)
    lines.push(`ENERGY: ${windowCheckins.length} check-ins this month · avg ${avgE}/10 · range ${minE}-${maxE}`)
    if (memory?.energy?.best_day) lines.push(`  Long-term pattern: peaks ${memory.energy.best_day}s, dips ${memory.energy.worst_day}s · overall trend ${memory.energy.trend}`)
  }

  // ── Prediction accuracy ──
  const predictions = (memory?.prediction_history ?? []).filter(p => p.date >= windowStart)
  if (predictions.length >= 5) {
    const avgErr = (predictions.reduce((s, p) => s + Math.abs(p.predicted - p.actual), 0) / predictions.length).toFixed(1)
    const within1 = Math.round((predictions.filter(p => Math.abs(p.predicted - p.actual) <= 1).length / predictions.length) * 100)
    lines.push(`JAUNE'S PREDICTION ACCURACY: ${predictions.length} morning energy guesses · avg ${avgErr} pts off · ${within1}% within ±1`)
  }

  // ── Priority follow-through ──
  const withOutcomes = briefs.filter(b => b.priority_outcomes && b.priority_outcomes.outcomes.length > 0)
  if (withOutcomes.length >= 3) {
    const all = withOutcomes.flatMap(b => b.priority_outcomes!.outcomes)
    const done = all.filter(o => o.outcome === 'done').length
    const partial = all.filter(o => o.outcome === 'partial').length
    const skipped = all.filter(o => o.outcome === 'skipped').length
    lines.push(`PLAN FOLLOW-THROUGH: ${withOutcomes.length} days reviewed · ${done} done, ${partial} partial, ${skipped} skipped of ${all.length} suggested priorities`)
    const skippedTitles = withOutcomes.flatMap(b => b.priority_outcomes!.outcomes.filter(o => o.outcome === 'skipped').map(o => o.title))
    if (skippedTitles.length >= 3) {
      lines.push(`  Often skipped: ${skippedTitles.slice(0, 5).map(t => `"${t}"`).join(', ')}`)
    }
  }

  // ── Habits ──
  if (habits.length > 0) {
    lines.push(`HABITS (last 30 days):`)
    if (memory?.habits?.strongest?.length) {
      memory.habits.strongest.forEach(h => lines.push(`  ${h.emoji} ${h.name}: ${h.rate_pct}% — holding strong`))
    }
    if (memory?.habits?.needs_work?.length) {
      memory.habits.needs_work.forEach(h => lines.push(`  ${h.emoji} ${h.name}: ${h.rate_pct}% — struggling`))
    }
  }

  // ── Correlations (already gated upstream) ──
  const correlations = memory?.correlations
  if (correlations?.habits?.length) {
    lines.push(`DISCOVERED CORRELATIONS:`)
    correlations.habits.forEach(h => {
      const tag = h.early_signal ? ' [EARLY SIGNAL]' : ''
      lines.push(`  ${h.habit_emoji} ${h.habit_name} → next-day energy ${h.diff > 0 ? '+' : ''}${h.diff} pts (${h.sample_size} pairs)${tag}`)
    })
  }

  // ── Goals ──
  if (goals.length > 0) {
    lines.push(`GOALS:`)
    goals.forEach(g => {
      const doneSteps = g.steps.filter(s => s.completed && s.completed_at && s.completed_at.slice(0, 10) >= windowStart).length
      lines.push(`  [${g.category}] "${g.title}" at ${g.progress_pct}%${doneSteps > 0 ? ` · ${doneSteps} steps completed this month` : ''}${g.target_date ? ` · due ${g.target_date}` : ''}`)
    })
  }

  // ── Mood themes & blockers ──
  if (memory?.mood_themes?.length) lines.push(`RECURRING MOOD THEMES: ${memory.mood_themes.slice(0, 6).join(', ')}`)
  if (memory?.blockers?.frequent?.length) lines.push(`FREQUENT BLOCKERS: ${memory.blockers.frequent.slice(0, 3).join(' · ')}`)

  // ── Daily narrative summaries (the texture of the month) ──
  const summaries = (memory?.daily_summaries ?? []).filter(s => s.date >= windowStart)
  if (summaries.length > 0) {
    lines.push(`DAILY SUMMARIES (their month, day by day):`)
    summaries.slice(-15).forEach(s => lines.push(`  ${s.date}: ${s.summary}`))
  }

  // ── Wheel of life comparison ──
  if (wheels.length > 0) {
    const labelFor = (key: string) => WHEEL_AREAS.find(a => a.key === key)?.label ?? key
    const [latest, previous] = wheels
    lines.push(`WHEEL OF LIFE (self-rated 1-10):`)
    lines.push(`  ${latest.snapshot_date}: ${Object.entries(latest.scores).map(([k, v]) => `${labelFor(k)} ${v}`).join(' · ')}`)
    if (previous) {
      lines.push(`  ${previous.snapshot_date}: ${Object.entries(previous.scores).map(([k, v]) => `${labelFor(k)} ${v}`).join(' · ')}`)
      lines.push(`  Compare these — name the area that moved most.`)
    }
  }

  return { message: lines.join('\n'), eligibility: { eligible: true, checkinCount: recentCheckins.length } }
}

export function parseRetrospective(raw: string): Retrospective | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const obj = JSON.parse(cleaned)
    if (typeof obj.narrative !== 'string' || !Array.isArray(obj.observations)) return null
    return {
      narrative: obj.narrative,
      observations: obj.observations
        .filter((o: unknown): o is { text: string; evidence: string } =>
          typeof o === 'object' && o !== null &&
          typeof (o as Record<string, unknown>).text === 'string' &&
          typeof (o as Record<string, unknown>).evidence === 'string')
        .slice(0, 5),
      looking_ahead: typeof obj.looking_ahead === 'string' ? obj.looking_ahead : '',
    }
  } catch {
    return null
  }
}
