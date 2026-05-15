'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CheckIn, HabitWithLogs, GoalWithSteps, Brief } from '@/lib/types'

type Props = {
  checkins: CheckIn[]
  habits:   HabitWithLogs[]
  goals:    GoalWithSteps[]
  briefs:   Brief[]
}

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function dateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function energyToLabel(level: number): string {
  if (level >= 9) return 'Exceptional'
  if (level >= 7) return 'High'
  if (level >= 5) return 'Steady'
  if (level >= 3) return 'Low'
  return 'Depleted'
}

type HabitStat = { id: string; name: string; emoji: string; done: number; target: number }

function buildReflection(
  checkins: CheckIn[],
  habitStats: HabitStat[],
  goals: GoalWithSteps[],
  briefs: Brief[],
) {
  const worked: string[] = []
  const adjust: string[] = []

  // Energy
  const highEnergyDays = checkins.filter(c => c.energy_level >= 7)
  const lowEnergyDays  = checkins.filter(c => c.energy_level < 5)
  const avgEnergy = checkins.length
    ? checkins.reduce((s, c) => s + c.energy_level, 0) / checkins.length
    : null

  if (highEnergyDays.length >= 3) {
    worked.push(`Strong energy across ${highEnergyDays.length} days — you were consistently at 7 or above.`)
  } else if (avgEnergy != null && avgEnergy >= 6) {
    worked.push(`Solid average energy of ${avgEnergy.toFixed(1)} — you stayed above baseline most of the week.`)
  }
  if (lowEnergyDays.length >= 2) {
    const days = lowEnergyDays.map(c =>
      new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    ).join(' and ')
    adjust.push(`Energy dipped below 5 on ${days} — worth examining what drained you those days.`)
  }

  // Highlights from check-ins
  const highlights = checkins.filter(c => c.highlight && c.highlight.trim().length > 0)
  if (highlights.length > 0) {
    worked.push(`You logged ${highlights.length} highlight${highlights.length > 1 ? 's' : ''} — moments worth building on.`)
  }

  // Blockers
  const withBlockers = checkins.filter(c => c.blockers && c.blockers.length > 0)
  if (withBlockers.length >= 2) {
    adjust.push(`Blockers showed up on ${withBlockers.length} days — identifying their root cause could unlock your next gear.`)
  }

  // Habits
  const onTrack = habitStats.filter(h => h.target > 0 && h.done >= h.target)
  const offTrack = habitStats.filter(h => h.target > 0 && h.done < h.target * 0.5)
  if (onTrack.length > 0) {
    worked.push(`${onTrack.map(h => `${h.emoji} ${h.name}`).join(', ')} hit ${onTrack.length > 1 ? 'their' : 'its'} target — consistency is compounding.`)
  }
  if (offTrack.length > 0) {
    adjust.push(`${offTrack.map(h => h.name).join(', ')} fell short of halfway — consider reducing friction or resetting the target.`)
  }

  // Goals
  const progressingGoals = goals.filter(g => g.progress_pct >= 50)
  if (progressingGoals.length > 0) {
    worked.push(`${progressingGoals.length > 1 ? `${progressingGoals.length} goals are` : `"${progressingGoals[0].title}" is`} past the halfway mark — you're in motion.`)
  }

  // Pull one insight from briefs if available
  if (briefs.length > 0 && briefs[0].insight_text) {
    const insight = briefs[0].insight_text
    if (insight.length < 180) {
      worked.push(insight)
    }
  }

  // Fallbacks
  if (worked.length === 0) worked.push('You showed up this week — that alone is worth noting.')
  if (adjust.length === 0) adjust.push('No clear friction points this week — keep the streak going and watch for where energy starts to dip.')

  return { worked, adjust }
}

function WeeklyReflection({
  checkins,
  habitStats,
  goals,
  briefs,
}: {
  checkins: CheckIn[]
  habitStats: HabitStat[]
  goals: GoalWithSteps[]
  briefs: Brief[]
}) {
  const { worked, adjust } = buildReflection(checkins, habitStats, goals, briefs)

  return (
    <section style={{ marginBottom: '32px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '20px' }}>
        Weekly Reflection from Locus
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* What worked */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--sage)', opacity: 0.9 }}>↑</span>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--sage)', margin: 0, opacity: 0.9 }}>
              What worked
            </p>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {worked.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', color: 'var(--sage)', opacity: 0.6, marginTop: '3px', flexShrink: 0 }}>—</span>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-1)', margin: 0 }}>{item}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* What to adjust */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--gold)', opacity: 0.9 }}>↻</span>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', margin: 0, opacity: 0.9 }}>
              What to adjust
            </p>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {adjust.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', color: 'var(--gold)', opacity: 0.6, marginTop: '3px', flexShrink: 0 }}>—</span>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-1)', margin: 0 }}>{item}</p>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  )
}

function smoothCurvePath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = i === 0 ? pts[0] : pts[i - 1]
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const [x3, y3] = i + 2 < pts.length ? pts[i + 2] : pts[i + 1]
    const cp1x = x1 + (x2 - x0) / 6
    const cp1y = y1 + (y2 - y0) / 6
    const cp2x = x2 - (x3 - x1) / 6
    const cp2y = y2 - (y3 - y1) / 6
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`)
  }
  return d.join(' ')
}

function EnergyCurveChart({ days, checkinByDay }: { days: string[]; checkinByDay: Map<string, CheckIn> }) {
  const W = 560; const H = 140
  const padL = 8; const padR = 8; const padT = 20; const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const xOf = (i: number) => padL + (i / (days.length - 1)) * chartW
  const yOf = (v: number) => padT + (1 - (v - 1) / 9) * chartH

  const dataPoints: [number, number, number, number][] = []
  days.forEach((day, i) => {
    const ci = checkinByDay.get(day)
    if (ci) dataPoints.push([i, xOf(i), yOf(ci.energy_level), ci.energy_level])
  })

  const curvePts: [number, number][] = dataPoints.map(([, x, y]) => [x, y])
  const linePath = smoothCurvePath(curvePts)

  const areaPath = curvePts.length > 1
    ? `${linePath} L ${curvePts[curvePts.length - 1][0]} ${padT + chartH} L ${curvePts[0][0]} ${padT + chartH} Z`
    : ''

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      aria-label="Energy this week"
    >
      <defs>
        <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7eb89a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7eb89a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c8a96e" />
          <stop offset="100%" stopColor="#7eb89a" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {[2, 4, 6, 8, 10].map(v => (
        <line
          key={v}
          x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)}
          stroke="oklch(1 0 0 / 0.06)" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      {areaPath && <path d={areaPath} fill="url(#energyGrad)" />}

      {/* Curve line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Data points + value labels */}
      {dataPoints.map(([, x, y, val]) => {
        const color = val >= 7 ? '#7eb89a' : val >= 5 ? '#c8a96e' : '#c08060'
        return (
          <g key={x}>
            <circle cx={x} cy={y} r="4" fill={color} stroke="oklch(0.14 0 0)" strokeWidth="1.5" />
            <text
              x={x} y={y - 10}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-serif)"
              fill="oklch(1 0 0 / 0.7)"
            >{val}</text>
          </g>
        )
      })}

      {/* Empty day markers */}
      {days.map((day, i) => {
        if (checkinByDay.has(day)) return null
        return (
          <circle key={day} cx={xOf(i)} cy={padT + chartH} r="2" fill="oklch(1 0 0 / 0.12)" />
        )
      })}

      {/* X-axis day labels */}
      {days.map((day, i) => (
        <text
          key={day}
          x={xOf(i)} y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="oklch(1 0 0 / 0.35)"
          fontFamily="var(--font-sans, sans-serif)"
          fontWeight="500"
          letterSpacing="0.04em"
        >{dayLabels[i]}</text>
      ))}
    </svg>
  )
}

export default function WeeklyReview({ checkins, habits, goals, briefs }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const { monday, sunday } = getWeekBounds(weekOffset)
  const isCurrentWeek = weekOffset === 0

  const weekCheckins = checkins.filter(c => {
    const d = new Date(c.date + 'T12:00:00')
    return d >= monday && d <= sunday
  })

  const weekBriefs = briefs.filter(b => {
    const d = new Date(b.brief_date + 'T12:00:00')
    return d >= monday && d <= sunday
  })

  const avgEnergy = weekCheckins.length
    ? Math.round((weekCheckins.reduce((s, c) => s + c.energy_level, 0) / weekCheckins.length) * 10) / 10
    : null

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return dateStr(d)
  })

  const checkinByDay = new Map(weekCheckins.map(c => [c.date, c]))

  const habitWeekStats = habits.map(h => {
    const done = h.logs.filter(l => weekDays.includes(l.logged_date)).length
    return { id: h.id, name: h.name, emoji: h.emoji, done, target: h.target_count }
  }).filter(h => h.target > 0)

  const totalHabitsDone   = habitWeekStats.reduce((s, h) => s + h.done, 0)
  const totalHabitsTarget = habitWeekStats.reduce((s, h) => s + h.target, 0)
  const habitRate = totalHabitsTarget > 0 ? Math.round((totalHabitsDone / totalHabitsTarget) * 100) : null

  const activeGoals = goals.filter(g => g.status === 'active')

  const weekLabel = `${formatShort(monday)} – ${formatShort(sunday)}`

  const statCards = [
    { label: 'Check-ins', value: weekCheckins.length, sub: `of 7 days`, color: weekCheckins.length >= 5 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Avg energy', value: avgEnergy != null ? `${avgEnergy}` : '—', sub: avgEnergy ? energyToLabel(Math.round(avgEnergy)) : 'no data', color: avgEnergy != null && avgEnergy >= 6 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Habits done', value: habitRate != null ? `${habitRate}%` : '—', sub: `${totalHabitsDone} of ${totalHabitsTarget}`, color: habitRate != null && habitRate >= 70 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Active goals', value: activeGoals.length, sub: activeGoals.length > 0 ? `${Math.round(activeGoals.reduce((s, g) => s + g.progress_pct, 0) / activeGoals.length)}% avg` : 'none yet', color: 'var(--text-0)' },
  ]

  return (
    <div className="review-shell" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          Weekly Review
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text-0)', margin: 0 }}>
            {isCurrentWeek ? <>This <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>week.</em></> : weekLabel}
          </h1>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.12)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-0)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              aria-label="Previous week"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4L6 8l4 4"/></svg>
            </button>
            <button
              onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
              disabled={isCurrentWeek}
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.12)', background: 'transparent', color: isCurrentWeek ? 'var(--text-3)' : 'var(--text-2)', cursor: isCurrentWeek ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isCurrentWeek ? 0.3 : 1, transition: 'color 0.15s' }}
              onMouseEnter={e => { if (!isCurrentWeek) (e.currentTarget.style.color = 'var(--text-0)') }}
              onMouseLeave={e => { if (!isCurrentWeek) (e.currentTarget.style.color = 'var(--text-2)') }}
              aria-label="Next week"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4"/></svg>
            </button>
          </div>
        </div>
        {!isCurrentWeek && (
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>{weekLabel}</p>
        )}
      </header>

      {/* ── Stats — 4 across on desktop, 2×2 on mobile ── */}
      <div className="review-stats-4">
        {statCards.map(({ label, value, sub, color }) => (
          <div key={label} className="glass-card" style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>{label}</p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 400, color, lineHeight: 1, marginBottom: '5px' }}>{value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mid: Energy by day + Habits side by side on desktop ── */}
      {(weekCheckins.length > 0 || habitWeekStats.length > 0) && (
        <div className="glass-card" style={{ padding: '24px 26px', marginBottom: '20px' }}>
        <div className="review-mid" style={{ marginBottom: 0 }}>

          {/* Energy curve chart */}
          {weekCheckins.length > 0 && (
            <section>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
                Energy this week
              </p>
              <EnergyCurveChart days={weekDays} checkinByDay={checkinByDay} />
            </section>
          )}

          {/* Habits */}
          {habitWeekStats.length > 0 && (
            <section>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
                Habits
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {habitWeekStats.map((h, i) => {
                  const pct = Math.round((h.done / h.target) * 100)
                  const onTrack = pct >= 100
                  return (
                    <li key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)' }}>
                      <span style={{ fontSize: '15px', flexShrink: 0 }}>{h.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-1)', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</p>
                        <div style={{ height: '2px', background: 'oklch(1 0 0 / 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: onTrack ? 'var(--sage)' : 'var(--gold)', borderRadius: '2px', transition: 'width 0.4s' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', color: onTrack ? 'var(--sage)' : 'var(--text-3)', flexShrink: 0 }}>
                        {h.done}/{h.target}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

        </div>
        </div>
      )}

      {/* ── Goals — full width ── */}
      {activeGoals.length > 0 && (
        <div className="glass-card" style={{ padding: '24px 26px', marginBottom: '20px' }}>
        <section style={{ marginBottom: 0 }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
            Goals
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeGoals.map(g => (
              <li key={g.id}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text-0)', margin: '0 0 8px', lineHeight: 1.3 }}>{g.title}</p>
                <div style={{ height: '2px', background: 'oklch(1 0 0 / 0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${g.progress_pct}%`, background: 'var(--gold)', opacity: 0.8, borderRadius: '2px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  {g.steps.find(s => !s.completed) && (
                    <p style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', margin: 0 }}>
                      Next — {g.steps.find(s => !s.completed)?.title}
                    </p>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--gold)', opacity: 0.8, marginLeft: 'auto' }}>{g.progress_pct}%</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        </div>
      )}

      {/* ── Weekly Reflection from Locus ── */}
      {(weekCheckins.length > 0 || weekBriefs.length > 0) && (
        <WeeklyReflection
          checkins={weekCheckins}
          habitStats={habitWeekStats}
          goals={activeGoals}
          briefs={weekBriefs}
        />
      )}

      {/* ── Empty state ── */}
      {weekCheckins.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text-2)', marginBottom: '8px' }}>
            {isCurrentWeek ? 'Nothing logged yet this week.' : 'No data for this week.'}
          </p>
          {isCurrentWeek && (
            <Link href="/checkin" style={{ fontSize: '14px', color: 'var(--gold)', textDecoration: 'none', fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
              Start with a check-in →
            </Link>
          )}
        </div>
      )}

    </div>
  )
}
