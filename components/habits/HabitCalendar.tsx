'use client'

import { useState, useEffect } from 'react'
import type { HabitWithLogs } from '@/lib/types'
import { logHabitAction, unlogHabitAction } from '@/app/actions/habits'
import { useToast } from '@/components/ui/ToastContext'
import { HABIT_COLORS } from '@/lib/habits/colors'

/* ── CONSTANTS ── */
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW = ['S','M','T','W','T','F','S']

/* ── HELPERS ── */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function isHabitScheduledOnDate(habit: HabitWithLogs, dateStr: string): boolean {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(new Date(dateStr + 'T12:00:00').getDay())
}

/* Completion tier → fill color
   4 bands: none | some (<40%) | most (40–79%) | all (≥80%) */
function completionTier(pct: number): 'none' | 'some' | 'most' | 'all' {
  if (pct === 0)    return 'none'
  if (pct < 0.4)   return 'some'
  if (pct < 0.8)   return 'most'
  return 'all'
}
const TIER_COLORS = {
  none: 'rgba(255,255,255,0.07)',
  some: '#5C3D10',
  most: '#8A5F14',
  all:  '#BF8B1C',
} as const
function completionColor(pct: number, scheduled: boolean): string {
  if (!scheduled || pct < 0) return 'transparent'
  return TIER_COLORS[completionTier(pct)]
}

type LogMap = Map<string, Set<string>>

/* ── MAIN COMPONENT ── */
export default function HabitCalendar({ habits, today }: {
  habits: HabitWithLogs[]
  today: string
}) {
  const toast = useToast()
  const todayDate = new Date(today + 'T12:00:00')
  const [year,  setYear]  = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth())
  const [logMap, setLogMap] = useState<LogMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [pendingSet, setPendingSet] = useState<Set<string>>(new Set())
  const [selectedDay, setSelectedDay] = useState<string | null>(today)

  const isCurrentMonth =
    year  === todayDate.getFullYear() &&
    month === todayDate.getMonth()

  /* Fetch logs whenever month changes */
  useEffect(() => {
    setLoading(true)
    fetch(`/api/habits/logs?year=${year}&month=${month + 1}`)
      .then(r => r.json())
      .then((data: { habitId: string; dates: string[] }[]) => {
        const m = new Map<string, Set<string>>()
        data.forEach(({ habitId, dates }) => m.set(habitId, new Set(dates)))
        setLogMap(m)
      })
      .catch(err => { console.error(err); toast.error('Failed to load habit logs') })
      .finally(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (isCurrentMonth) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    setYear(todayDate.getFullYear())
    setMonth(todayDate.getMonth())
  }

  const toggleLog = async (habitId: string, date: string) => {
    const key = `${habitId}:${date}`
    if (pendingSet.has(key) || date > today) return
    const wasDone = (logMap.get(habitId) ?? new Set()).has(date)
    setLogMap(prev => {
      const next = new Map(prev)
      const d = new Set(next.get(habitId) ?? [])
      wasDone ? d.delete(date) : d.add(date)
      next.set(habitId, d)
      return next
    })
    setPendingSet(p => new Set([...p, key]))
    try {
      if (wasDone) await unlogHabitAction(habitId, date)
      else         await logHabitAction(habitId, date)
    } catch {
      setLogMap(prev => {
        const next = new Map(prev)
        const d = new Set(next.get(habitId) ?? [])
        wasDone ? d.add(date) : d.delete(date)
        next.set(habitId, d)
        return next
      })
    } finally {
      setPendingSet(p => { const n = new Set(p); n.delete(key); return n })
    }
  }

  /* Build calendar cells */
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  /* Month-level completion % for the footer stat */
  const daysInMonth2 = getDaysInMonth(year, month)
  const pastDays = Array.from({ length: daysInMonth2 }, (_, i) => {
    const d = toDateStr(year, month, i + 1)
    return d <= today ? d : null
  }).filter(Boolean) as string[]

  let totalOpps = 0, totalDone = 0
  pastDays.forEach(d => {
    const scheduled = habits.filter(h => isHabitScheduledOnDate(h, d))
    totalOpps += scheduled.length
    totalDone += scheduled.filter(h => (logMap.get(h.id) ?? new Set()).has(d)).length
  })
  const monthPct = totalOpps > 0 ? Math.round((totalDone / totalOpps) * 100) : 0

  return (
    <div style={{ marginTop: '20px' }}>
      {/* ── Outer card ── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
        opacity: loading ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}>

        {/* ── Header: OVERVIEW label + month heading + nav ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>
              Overview
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.1 }}>
              {MONTHS[month]} {year}
            </div>
          </div>

          {/* prev / Today / next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={prevMonth}
              className="icon-btn"
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-1)', cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                transition: 'background 0.15s',
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              onClick={goToday}
              className="icon-btn"
              style={{
                background: isCurrentMonth ? 'var(--bg-0)' : 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: '20px', padding: '0 16px', height: '34px',
                color: isCurrentMonth ? 'var(--text-0)' : 'var(--text-2)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                boxShadow: isCurrentMonth ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="icon-btn"
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isCurrentMonth ? 'var(--text-3)' : 'var(--text-1)',
                cursor: isCurrentMonth ? 'default' : 'pointer',
                fontSize: '16px', lineHeight: 1,
                opacity: isCurrentMonth ? 0.3 : 1,
                transition: 'all 0.15s',
              }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        {/* ── Day-of-week headers (single letter) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
          {DOW.map((d, i) => (
            <div key={i} style={{
              textAlign: 'center', fontSize: '10px', fontWeight: 700,
              color: 'var(--text-3)', letterSpacing: '0.06em',
              paddingBottom: '6px',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* ── Calendar tile grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`pad-${idx}`} style={{ aspectRatio: '1' }} />
            }

            const dateStr  = toDateStr(year, month, day)
            const isToday  = dateStr === today
            const isFuture = dateStr > today

            const scheduledHabits = habits.filter(h => isHabitScheduledOnDate(h, dateStr))
            const doneCount = isFuture ? 0 : scheduledHabits.filter(h =>
              (logMap.get(h.id) ?? new Set()).has(dateStr)
            ).length
            const totalCount = scheduledHabits.length
            const pct = totalCount > 0 && !isFuture ? doneCount / totalCount : -1
            const hasScheduled = totalCount > 0

            const bgColor = isFuture ? 'transparent' : completionColor(pct, hasScheduled)
            const isPending = scheduledHabits.some(h => pendingSet.has(`${h.id}:${dateStr}`))

            const isSelected = selectedDay === dateStr
            const isClickable = hasScheduled && !isFuture

            return (
              <div
                key={dateStr}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : -1}
                onClick={() => {
                  if (isClickable) setSelectedDay(isSelected ? null : dateStr)
                }}
                onKeyDown={e => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    setSelectedDay(isSelected ? null : dateStr)
                  }
                }}
                style={{
                  aspectRatio: '1',
                  borderRadius: '10px',
                  background: bgColor,
                  border: isSelected
                    ? '2px solid var(--gold)'
                    : isToday
                    ? '2px solid rgba(212,168,83,0.45)'
                    : '1px solid rgba(255,255,255,0.05)',
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: isFuture ? 0.22 : isPending ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  padding: '7px 6px 5px',
                  transition: 'border-color 0.15s, opacity 0.15s',
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Day number */}
                <span style={{
                  fontSize: '13px',
                  fontWeight: isSelected || isToday ? 700 : 500,
                  color: isSelected || isToday
                    ? 'var(--gold)'
                    : pct >= 0.8
                    ? '#E8C96A'
                    : 'var(--text-1)',
                  lineHeight: 1,
                }}>
                  {day}
                </span>

                {/* Completion fraction */}
                {hasScheduled && !isFuture && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: pct >= 0.8 ? 'rgba(232,201,106,0.80)' : 'var(--text-3)',
                    lineHeight: 1,
                    marginTop: '3px',
                  }}>
                    {doneCount}/{totalCount}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Legend + month % ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '20px', paddingTop: '16px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {[
              { label: 'none',  color: TIER_COLORS.none },
              { label: 'some',  color: TIER_COLORS.some },
              { label: 'most',  color: TIER_COLORS.most },
              { label: 'all',   color: TIER_COLORS.all  },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
          {totalOpps > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)' }}>
              {monthPct}% this month
            </span>
          )}
        </div>
        {/* ── Day summary panel ── */}
        {selectedDay && (() => {
          const selHabits   = habits.filter(h => isHabitScheduledOnDate(h, selectedDay))
          if (selHabits.length === 0) return null
          const doneCount   = selHabits.filter(h => (logMap.get(h.id) ?? new Set()).has(selectedDay)).length
          const canToggle   = selectedDay <= today
          const selDate     = new Date(selectedDay + 'T12:00:00')
          const isSelToday  = selectedDay === today
          const dayLabel    = selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

          return (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              {/* Summary header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '3px' }}>
                    {isSelToday ? 'Today' : canToggle ? 'Past' : 'Upcoming'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400, color: 'var(--text-0)' }}>
                    {dayLabel}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{doneCount}</span> of {selHabits.length} completed
                  </span>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="icon-btn"
                    aria-label="Close"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Habit rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {selHabits.map(h => {
                  const done      = (logMap.get(h.id) ?? new Set()).has(selectedDay)
                  const isPend    = pendingSet.has(`${h.id}:${selectedDay}`)

                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      {/* Emoji chip */}
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                        {h.emoji}
                      </div>
                      <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.name}
                      </span>
                      {canToggle ? (
                        <button
                          onClick={() => toggleLog(h.id, selectedDay)}
                          disabled={isPend}
                          className="icon-btn"
                          style={{
                            background: done ? 'var(--gold-dim)' : 'var(--bg-2)',
                            border: `1px solid ${done ? 'var(--gold)' : 'var(--border)'}`,
                            borderRadius: '20px', padding: '5px 14px',
                            fontSize: '12px', fontWeight: 600,
                            color: done ? 'var(--gold)' : 'var(--text-3)',
                            cursor: isPend ? 'wait' : 'pointer',
                            opacity: isPend ? 0.5 : 1,
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          {done ? '✓ Done' : 'Missed'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-3)', flexShrink: 0 }}>Upcoming</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {habits.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-3)', fontSize: '14px' }}>
          Add habits to see your monthly progress.
        </div>
      )}
    </div>
  )
}
