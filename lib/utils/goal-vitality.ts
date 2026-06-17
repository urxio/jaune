import type { Goal, GoalStep } from '@/lib/types'

/* ── TYPES ── */

export type VitalitySignal = 'on_track' | 'at_risk' | 'urgent' | 'overdue' | 'near_finish'

export type GoalVitality = {
  signal:   VitalitySignal
  label:    string
  detail:   string | null
  daysLeft?: number
}

/* ── ACCENT COLOURS ── */

export const VITALITY_STRIPE: Record<VitalitySignal, string> = {
  at_risk:     '#e0a060',
  urgent:      '#e06060',
  overdue:     '#e06060',
  near_finish: 'var(--sage)',
  on_track:    'transparent',
}

export const VITALITY_BADGE: Record<Exclude<VitalitySignal, 'on_track'>, {
  bg: string; color: string; icon: string
}> = {
  at_risk:     { bg: 'rgba(224,160,96,0.13)',  color: '#e0a060',      icon: '⚠' },
  urgent:      { bg: 'rgba(224,96,96,0.13)',   color: '#e06060',      icon: '⏱' },
  overdue:     { bg: 'rgba(224,96,96,0.13)',   color: '#e06060',      icon: '⚠' },
  near_finish: { bg: 'rgba(122,158,138,0.14)', color: 'var(--sage)',  icon: '◎' },
}

export const VITALITY_PROGRESS: Record<Exclude<VitalitySignal, 'on_track'>, string> = {
  at_risk:     'linear-gradient(90deg, #8a5000 0%, #e0a060 100%)',
  urgent:      'linear-gradient(90deg, #8a2020 0%, #e06060 100%)',
  overdue:     'linear-gradient(90deg, #8a2020 0%, #e06060 100%)',
  near_finish: 'linear-gradient(90deg, #4a7a60 0%, #8ab89a 100%)',
}

export const VITALITY_STATUS_BADGE: Record<VitalitySignal, { bg: string; color: string; label: string }> = {
  on_track:    { bg: 'rgba(60,110,80,0.28)',   color: '#70b888', label: 'ON PACE' },
  near_finish: { bg: 'rgba(60,110,80,0.28)',   color: '#70b888', label: 'ALMOST THERE' },
  at_risk:     { bg: 'rgba(160,80,60,0.28)',   color: '#c87878', label: 'NEEDS PUSH' },
  urgent:      { bg: 'rgba(180,60,60,0.28)',   color: '#e07070', label: 'URGENT' },
  overdue:     { bg: 'rgba(180,60,60,0.28)',   color: '#e07070', label: 'OVERDUE' },
}

export const VITALITY_RING_STROKE: Record<VitalitySignal, string> = {
  on_track:    '#d4a853',
  near_finish: '#8ab89a',
  at_risk:     '#e0a060',
  urgent:      '#e06060',
  overdue:     '#e06060',
}

/* ── VITALITY COMPUTATION ── */

export function computeGoalVitality(goal: Goal, steps: GoalStep[]): GoalVitality {
  const now = Date.now()

  /* ── 1. Overdue ── */
  if (goal.target_date) {
    const daysLeft = Math.ceil(
      (new Date(goal.target_date + 'T23:59:59').getTime() - now) / 86400000
    )

    if (daysLeft < 0 && goal.progress_pct < 100) {
      const n = Math.abs(daysLeft)
      return {
        signal:  'overdue',
        label:   'Overdue',
        detail:  `${n} day${n !== 1 ? 's' : ''} past deadline`,
        daysLeft,
      }
    }

    /* ── 2. Urgent: ≤7 days, <80% ── */
    if (daysLeft <= 7 && daysLeft >= 0 && goal.progress_pct < 80) {
      return {
        signal:  'urgent',
        label:   daysLeft === 0 ? 'Due today' : `${daysLeft}d left`,
        detail:  `${goal.progress_pct}% complete`,
        daysLeft,
      }
    }
  }

  /* ── 3. Near finish: 80-99% ── */
  if (goal.progress_pct >= 80 && goal.progress_pct < 100) {
    return {
      signal: 'near_finish',
      label:  'Almost there',
      detail: `${goal.progress_pct}% complete`,
    }
  }

  /* ── 4. At risk: no progress in 14+ days ──
     Use most recent step completion as the activity timestamp.
     Fall back to goal.updated_at if no steps have been completed.      ── */
  let lastActivityMs: number

  const completedSteps = steps.filter(s => s.completed && s.completed_at)
  if (completedSteps.length > 0) {
    lastActivityMs = Math.max(
      ...completedSteps.map(s => new Date(s.completed_at!).getTime())
    )
  } else {
    lastActivityMs = new Date(goal.updated_at).getTime()
  }

  const daysSince = Math.floor((now - lastActivityMs) / 86400000)

  if (daysSince >= 14 && goal.progress_pct < 80) {
    return {
      signal: 'at_risk',
      label:  'Stalled',
      detail: `${daysSince} day${daysSince !== 1 ? 's' : ''} without progress`,
    }
  }

  return { signal: 'on_track', label: 'On track', detail: null }
}

/* ── MILESTONE DETECTION ──
   Returns the milestone (25 | 50 | 75 | 100) if the progress
   just crossed it, otherwise null.                             ── */
export function getMilestoneCrossed(
  prevPct: number,
  newPct:  number
): 25 | 50 | 75 | 100 | null {
  for (const m of [25, 50, 75, 100] as const) {
    if (prevPct < m && newPct >= m) return m
  }
  return null
}
