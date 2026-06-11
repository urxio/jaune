/**
 * updateMemoryStats — runs after every check-in.
 * Pure computation (no Claude call). Updates energy, blocker,
 * mood-theme, habit-rate, and correlation stats in the user_memory table.
 * Non-fatal: never throws, never blocks the check-in flow.
 */

import { createClient } from '@/lib/supabase/server'
import { patchUserMemory } from '@/lib/ai/memory'
import type { UserMemory } from '@/lib/ai/memory'

/* ── STOP WORDS for mood theme extraction ── */
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','to','of','in','for',
  'on','with','at','by','from','as','it','its','this','that',
  'these','those','my','your','his','her','our','their','we',
  'you','he','she','they','i','me','him','us','them','not',
  'but','and','or','so','if','about','bit','feeling','feel',
  'felt','like','just','very','quite','good','bad','today',
  'day','week','been','some','then','than','when','what','more',
  'also','still','really','going','little','much','well','here',
  'there','which','into','time','get','got','even','been','want',
  'need','work','make','said','know','think','come','back',
])

/* ── HELPERS ── */
function roundTo1(n: number): number {
  return Math.round(n * 10) / 10
}
function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : roundTo1(nums.reduce((s, n) => s + n, 0) / nums.length)
}
function nextDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

/* ── MAIN ── */
export async function updateMemoryStats(userId: string): Promise<void> {
  try {
    const supabase = await createClient()

    // Fetch up to 90 days of check-ins
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const sinceStr = since.toISOString().split('T')[0]

    const { data: checkins } = await supabase
      .from('check_ins')
      .select('date, energy_level, mood_note, blockers')
      .eq('user_id', userId)
      .gte('date', sinceStr)
      .order('date', { ascending: true })

    if (!checkins || checkins.length === 0) return

    /* ── ENERGY STATS ── */
    const overallAvg = avg(checkins.map(c => c.energy_level))
    const recent14   = checkins.slice(-14)
    const prior14    = checkins.slice(-28, -14)
    const recentAvg  = avg(recent14.map(c => c.energy_level))
    const priorAvg   = avg(prior14.map(c => c.energy_level))

    const trend: UserMemory['energy']['trend'] =
      prior14.length < 3 ? 'stable' :
      recentAvg - priorAvg > 0.5  ? 'improving' :
      recentAvg - priorAvg < -0.5 ? 'declining'  : 'stable'

    const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const buckets: Record<string, number[]> = {}
    checkins.forEach(c => {
      const d = DAY[new Date(c.date + 'T12:00:00').getDay()]
      if (!buckets[d]) buckets[d] = []
      buckets[d].push(c.energy_level)
    })
    const byDay: Record<string, number> = {}
    Object.entries(buckets).forEach(([d, vals]) => {
      if (vals.length >= 2) byDay[d] = avg(vals)
    })
    const sorted = Object.entries(byDay).sort((a, b) => b[1] - a[1])
    const bestDay  = sorted[0]?.[0] ?? null
    const worstDay = sorted[sorted.length - 1]?.[0] ?? null

    /* ── BLOCKER FREQUENCY ── */
    const blockerFreq: Record<string, number> = {}
    checkins.forEach(c => {
      ;(c.blockers ?? []).forEach((b: string) => {
        if (b !== 'No blockers today') blockerFreq[b] = (blockerFreq[b] ?? 0) + 1
      })
    })
    const frequent = Object.entries(blockerFreq)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([b]) => b)

    /* ── MOOD THEMES (from mood notes + journal entries) ── */
    const wordFreq: Record<string, number> = {}

    checkins.forEach(c => {
      if (!c.mood_note) return
      c.mood_note
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 4 && !STOP_WORDS.has(w))
        .forEach((w: string) => { wordFreq[w] = (wordFreq[w] ?? 0) + 1 })
    })

    const { data: journals } = await supabase
      .from('journal_entries')
      .select('content')
      .eq('user_id', userId)
      .gte('date', sinceStr)
      .gt('content', '')

    ;(journals ?? []).forEach((j: { content: string }) => {
      j.content
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 4 && !STOP_WORDS.has(w))
        .forEach((w: string) => { wordFreq[w] = (wordFreq[w] ?? 0) + 2 })
    })

    const moodThemes = Object.entries(wordFreq)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)

    /* ── HABIT RATES (last 30 days) ── */
    const thirtyAgo = new Date()
    thirtyAgo.setDate(thirtyAgo.getDate() - 30)
    const sinceDate = thirtyAgo.toISOString().split('T')[0]

    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from('habits').select('id, name, emoji, target_count').eq('user_id', userId),
      // Fetch logged_date too — needed for correlation computation
      supabase.from('habit_logs').select('habit_id, logged_date').eq('user_id', userId).gte('logged_date', sinceStr),
    ])

    const logCounts = new Map<string, number>()
    logs?.forEach(l => logCounts.set(l.habit_id, (logCounts.get(l.habit_id) ?? 0) + 1))

    const habitRates = (habits ?? []).map(h => {
      const done   = logCounts.get(h.id) ?? 0
      const target = Math.max(1, Math.round(h.target_count * (30 / 7)))
      const rate   = Math.min(100, Math.round((done / target) * 100))
      return { name: h.name, emoji: h.emoji, rate_pct: rate }
    })

    const strongest = habitRates
      .filter(h => h.rate_pct >= 65)
      .sort((a, b) => b.rate_pct - a.rate_pct)
      .slice(0, 3)
    const needsWork = habitRates
      .filter(h => h.rate_pct < 50)
      .sort((a, b) => a.rate_pct - b.rate_pct)
      .slice(0, 3)

    /* ── HABIT → NEXT-DAY ENERGY CORRELATIONS ── */
    // Build date → energy lookup
    const energyByDate = new Map(checkins.map(c => [c.date, c.energy_level]))

    // Group logs by habit_id → set of logged dates
    const logsByHabit = new Map<string, Set<string>>()
    logs?.forEach(l => {
      if (!logsByHabit.has(l.habit_id)) logsByHabit.set(l.habit_id, new Set())
      logsByHabit.get(l.habit_id)!.add(l.logged_date)
    })

    type HabitCorrelation = {
      habit_id:            string
      habit_name:          string
      habit_emoji:         string
      energy_when_done:    number
      energy_when_skipped: number
      diff:                number   // positive = habit boosts next-day energy
      sample_size:         number   // total paired observations (done + skipped)
      early_signal:        boolean  // under 20 pairs — present as tentative
    }

    const habitCorrelations: HabitCorrelation[] = []

    for (const habit of (habits ?? [])) {
      const loggedDates = logsByHabit.get(habit.id) ?? new Set<string>()
      const nextWhenDone: number[]    = []
      const nextWhenSkipped: number[] = []

      checkins.forEach(c => {
        const nd = nextDate(c.date)
        const nextEnergy = energyByDate.get(nd)
        if (nextEnergy == null) return  // no check-in next day

        if (loggedDates.has(c.date)) {
          nextWhenDone.push(nextEnergy)
        } else {
          nextWhenSkipped.push(nextEnergy)
        }
      })

      // Hard gate: enough data on BOTH sides, and at least 10 pairs total.
      // One confidently-stated false pattern costs more trust than ten true ones earn.
      const totalPairs = nextWhenDone.length + nextWhenSkipped.length
      if (nextWhenDone.length < 5 || nextWhenSkipped.length < 5 || totalPairs < 10) continue

      const avgDone    = avg(nextWhenDone)
      const avgSkipped = avg(nextWhenSkipped)
      const diff       = roundTo1(avgDone - avgSkipped)

      if (Math.abs(diff) < 0.5) continue  // not strong enough signal

      habitCorrelations.push({
        habit_id:            habit.id,
        habit_name:          habit.name,
        habit_emoji:         habit.emoji,
        energy_when_done:    avgDone,
        energy_when_skipped: avgSkipped,
        diff,
        sample_size:         totalPairs,
        early_signal:        totalPairs < 20,
      })
    }

    // Sort by strength of signal, keep top 5
    habitCorrelations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    const topHabitCorrelations = habitCorrelations.slice(0, 5)

    /* ── KEYWORD → SAME-DAY ENERGY CORRELATIONS ── */
    type KeywordCorrelation = {
      word:             string
      energy_with:      number
      energy_without:   number
      diff:             number   // positive = word associated with higher energy
      sample_size:      number   // total mood-note check-ins compared
      early_signal:     boolean  // under 20 — present as tentative
    }

    const keywordCorrelations: KeywordCorrelation[] = []
    const checkinsWithMood = checkins.filter(c => c.mood_note && c.mood_note.trim())

    moodThemes.slice(0, 15).forEach(word => {
      const withWord    = checkinsWithMood.filter(c => c.mood_note!.toLowerCase().includes(word))
      const withoutWord = checkinsWithMood.filter(c => !c.mood_note!.toLowerCase().includes(word))

      const totalCompared = withWord.length + withoutWord.length
      if (withWord.length < 5 || withoutWord.length < 5 || totalCompared < 10) return

      const avgWith    = avg(withWord.map(c => c.energy_level))
      const avgWithout = avg(withoutWord.map(c => c.energy_level))
      const diff       = roundTo1(avgWith - avgWithout)

      if (Math.abs(diff) < 0.7) return  // higher bar for keyword signals (noisier)

      keywordCorrelations.push({
        word,
        energy_with:    avgWith,
        energy_without: avgWithout,
        diff,
        sample_size:    totalCompared,
        early_signal:   totalCompared < 20,
      })
    })

    keywordCorrelations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    const topKeywordCorrelations = keywordCorrelations.slice(0, 3)

    /* ── WRITE via patchUserMemory — never wipes unrelated fields ── */
    await patchUserMemory(userId, {
      energy:      { overall_avg: overallAvg, recent_avg: recentAvg, trend, by_day: byDay, best_day: bestDay, worst_day: worstDay },
      habits:      { strongest, needs_work: needsWork },
      blockers:    { frequent, frequencies: blockerFreq },
      mood_themes: moodThemes,
      checkin_count: checkins.length,
      last_stats_update: new Date().toISOString(),
      correlations: {
        habits:      topHabitCorrelations,
        keywords:    topKeywordCorrelations,
        computed_at: new Date().toISOString(),
      },
    })
  } catch (err) {
    // Non-fatal — never block the check-in
    console.error('[memory:update-stats]', err)
  }
}
