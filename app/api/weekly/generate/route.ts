import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecentCheckins } from '@/lib/db/checkins'
import { getUserHabitsWithLogs } from '@/lib/db/habits'
import { getActiveGoalsWithSteps } from '@/lib/db/goals'
import { getRecentJournals } from '@/lib/db/journals'
import { getAnthropicClient } from '@/lib/ai/client'
import { readUserMemory } from '@/lib/ai/memory'
import { getPeople } from '@/lib/db/people'
import { updateMemoryInsights } from '@/lib/memory/update-insights'
import { updatePeopleMemory } from '@/lib/memory/update-people'
import { upsertWeeklyReflection } from '@/lib/db/weekly-reflections'
import {
  WEEKLY_SYSTEM_PROMPT,
  buildWeeklyUserMessage,
  parseWeeklyResponse,
  type WeeklyContext,
} from '@/lib/ai/weekly-prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekRange(today: Date) {
  const dow = today.getDay() || 7
  const mon = new Date(today); mon.setDate(today.getDate() - dow + 1)
  const sun = new Date(today); sun.setDate(today.getDate() - dow + 7)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${mon.toLocaleDateString('en-US', opts)} – ${sun.toLocaleDateString('en-US', opts)}`
}

function getEnergyTrend(checkins: { energy_level: number }[]): WeeklyContext['energyTrend'] {
  if (checkins.length < 2) return 'stable'
  const first = checkins[checkins.length - 1].energy_level
  const last  = checkins[0].energy_level
  const diff  = last - first
  if (Math.abs(diff) < 1) return 'stable'
  return diff > 0 ? 'rising' : 'declining'
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()

  const [checkins, habits, goalsWithSteps, memory, journals, allPeople] = await Promise.all([
    getRecentCheckins(user.id, 7),
    getUserHabitsWithLogs(user.id),
    getActiveGoalsWithSteps(user.id),
    readUserMemory(user.id),
    getRecentJournals(user.id, 7),
    getPeople(user.id),
  ])

  const neglectedHabits = habits
    .filter(h => h.weekCompletions === 0)
    .map(h => ({ name: h.name, emoji: h.emoji, frequency: h.frequency, linkedGoal: h.linkedGoal ?? null }))

  const avgEnergy = checkins.length
    ? Math.round((checkins.reduce((s, c) => s + c.energy_level, 0) / checkins.length) * 10) / 10
    : null

  const totalTarget = habits.reduce((s, h) => s + h.target_count, 0)
  const totalDone   = habits.reduce((s, h) => s + h.weekCompletions, 0)
  const habitRate   = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0

  const ctx: WeeklyContext = {
    weekNumber: getWeekNumber(today),
    year: today.getFullYear(),
    weekRange: getWeekRange(today),
    checkins,
    habits,
    goalsWithSteps,
    neglectedHabits,
    avgEnergy,
    energyTrend: getEnergyTrend(checkins),
    totalHabitCompletions: totalDone,
    totalHabitTarget: totalTarget,
    habitRate,
    memory,
    journals,
    catchupPeople: allPeople.filter(p => p.want_catchup).map(p => ({ name: p.name, notes: p.notes })),
  }

  const userMessage = buildWeeklyUserMessage(ctx)
  const client = getAnthropicClient()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: WEEKLY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = response.content.find(b => b.type === 'text')?.text ?? ''
    const reflection = parseWeeklyResponse(rawText)

    // Persist to DB so reflection is available across all devices
    await upsertWeeklyReflection(user.id, ctx.weekNumber, ctx.year, reflection)
      .catch(err => console.error('[weekly] DB save failed:', err))

    // Fire-and-forget: update AI insights from accumulated data (throttled to once per 6 days)
    updateMemoryInsights(user.id).catch(err => console.error('[weekly] insight update failed:', err))
    updatePeopleMemory(user.id).catch(err => console.error('[weekly] people memory failed:', err))

    return NextResponse.json({
      reflection,
      weekNumber: ctx.weekNumber,
      weekRange: ctx.weekRange,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Weekly generation failed:', msg)
    return NextResponse.json({ error: 'Generation failed', detail: msg }, { status: 502 })
  }
}
