'use client'

import { useState, useTransition } from 'react'
import type { HabitWithLogs, Habit } from '@/lib/types'
import { deleteHabitAction } from '@/app/actions/habits'
import { HABIT_COLORS } from '@/lib/habits/colors'
import { PencilIcon, TrashIcon } from '@/components/ui/Icons'
import IconBtn from '@/components/ui/IconBtn'
import ConfirmDelete from '@/components/ui/ConfirmDelete'

/* ── CONSTANTS ── */
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOW_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ── LOCAL HELPERS ── */
export function isScheduledOn(date: string, daysOfWeek: number[] | null): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return true
  return daysOfWeek.includes(new Date(date + 'T12:00:00').getDay())
}

export function daysUntilEnd(endsAt: string | null): number | null {
  if (!endsAt) return null
  return Math.ceil((new Date(endsAt + 'T12:00:00').getTime() - Date.now()) / 86400000)
}

export function freqDisplay(habit: Habit): string {
  if (habit.days_of_week && habit.days_of_week.length > 0 && habit.days_of_week.length < 7) {
    const sorted = [...habit.days_of_week].sort((a, b) => a - b)
    if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays'
    if (JSON.stringify(sorted) === JSON.stringify([0, 6])) return 'Weekends'
    return sorted.map(d => DOW_NAMES[d]).join(' · ')
  }
  const legacy: Record<string, string> = { daily: 'Daily', '3x_week': '3× / week', weekdays: 'Weekdays' }
  return legacy[habit.frequency] ?? habit.frequency
}

export function computeStreak(loggedDates: Set<string>, today: string, daysOfWeek: number[] | null): number {
  if (loggedDates.size === 0) return 0
  let startDate: string | null = null
  let scan = today
  for (let i = 0; i < 14; i++) {
    if (isScheduledOn(scan, daysOfWeek) && loggedDates.has(scan)) {
      startDate = scan; break
    }
    const d = new Date(scan + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    scan = d.toISOString().split('T')[0]
  }
  if (!startDate) return 0
  let cur = startDate
  let streak = 0
  for (let i = 0; i < 200; i++) {
    if (!isScheduledOn(cur, daysOfWeek)) {
      const d = new Date(cur + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      cur = d.toISOString().split('T')[0]
      continue
    }
    if (loggedDates.has(cur)) {
      streak++
      const d = new Date(cur + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      cur = d.toISOString().split('T')[0]
    } else {
      break
    }
  }
  return streak
}

/* ── HABIT CARD ── */
export default function HabitCard({ habit, loggedDates, streak, colorIndex, last28, today, pendingSet, onToggle, onEdit, onDelete }: {
  habit: HabitWithLogs
  loggedDates: Set<string>
  streak: number
  colorIndex: number
  last28: string[]
  today: string
  pendingSet: Set<string>
  onToggle: (date: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMonth, setShowMonth]         = useState(false)
  const [monthOffset, setMonthOffset]     = useState(0)
  const [isPending, startTransition]      = useTransition()

  const habitColor = HABIT_COLORS[colorIndex % HABIT_COLORS.length]
  const todayDone  = loggedDates.has(today)
  const endDays    = daysUntilEnd(habit.ends_at ?? null)

  // 28-day progress
  const scheduledLast28 = last28.filter(d => isScheduledOn(d, habit.days_of_week ?? null))
  const doneLast28      = scheduledLast28.filter(d => loggedDates.has(d))
  const progressPct     = scheduledLast28.length > 0 ? Math.round((doneLast28.length / scheduledLast28.length) * 100) : 0

  // Current month (always fixed to today's month for the inline grid)
  const todayDateObj   = new Date(today + 'T12:00:00')
  const curYear        = todayDateObj.getFullYear()
  const curMonth       = todayDateObj.getMonth()
  const curFirstDow    = new Date(curYear, curMonth, 1).getDay()
  const curDaysInMonth = new Date(curYear, curMonth + 1, 0).getDate()
  const curMonthName   = todayDateObj.toLocaleDateString('en-US', { month: 'short' })

  // Month calendar data (for the "Month ▾" dropdown, tracks monthOffset)
  const baseDate = new Date(today + 'T12:00:00')
  baseDate.setDate(1)
  baseDate.setMonth(baseDate.getMonth() + monthOffset)
  const year        = baseDate.getFullYear()
  const month       = baseDate.getMonth()
  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName   = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handleDelete = () => {
    startTransition(async () => {
      await deleteHabitAction(habit.id)
      onDelete()
    })
  }

  return (
    <div
      style={{
        background: 'var(--glass-card-bg)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.22)' : 'var(--glass-card-border)'}`,
        boxShadow: 'var(--glass-card-shadow-sm)',
        borderRadius: '16px',
        padding: '14px 16px',
        transition: 'border-color 0.2s var(--ease)',
        opacity: habit.isScheduledToday ? 1 : 0.65,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
    >
      {/* ── Top row: icon · name · calendar · streak · actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Colored icon square — click to toggle today */}
        <button
          onClick={() => onToggle(today)}
          title={todayDone ? 'Mark undone' : 'Mark done today'}
          disabled={pendingSet.has(`${habit.id}:${today}`)}
          style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            background: todayDone ? habitColor : `${habitColor}28`,
            border: `2px solid ${todayDone ? habitColor : `${habitColor}55`}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: pendingSet.has(`${habit.id}:${today}`) ? 'wait' : 'pointer',
            transition: 'all 0.2s var(--ease)',
            boxShadow: todayDone ? `0 4px 16px ${habitColor}44` : 'none',
            padding: 0,
          }}
        >
          {todayDone
            ? <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <path d="M5 11.5l4.5 4.5 7.5-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            : <span style={{ fontSize: '20px', lineHeight: 1 }}>{habit.emoji}</span>
          }
        </button>

        {/* Name + meta */}
        <div style={{ minWidth: 0, width: '140px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-0)', lineHeight: 1.2 }}>{habit.name}</span>
            {!habit.isScheduledToday && (
              <span style={{ fontSize: '10px', color: 'var(--text-3)', fontStyle: 'italic' }}>not today</span>
            )}
            {habit.linkedGoal && (
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.04em', background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '120px' }}>
                <span>↗</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.linkedGoal.title}</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>{freqDisplay(habit)}</span>
            {endDays !== null && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: endDays <= 3 ? '#e07060' : 'var(--text-3)', background: endDays <= 3 ? 'rgba(200,80,60,0.08)' : 'var(--bg-3)', border: `1px solid ${endDays <= 3 ? 'rgba(200,80,60,0.2)' : 'var(--border)'}`, borderRadius: '5px', padding: '1px 6px' }}>
                {endDays <= 0 ? 'Ended' : endDays === 1 ? 'Ends tomorrow' : endDays <= 7 ? `${endDays}d left` : `Until ${habit.ends_at}`}
              </span>
            )}
          </div>
        </div>

        {/* Mini-calendar — inline, occupies the empty space */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>
            {curMonthName}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 11px)', gap: '2px', marginBottom: '2px' }}>
            {DOW_LABELS.map((d, i) => (
              <div key={i} style={{ width: '11px', textAlign: 'center', fontSize: '7px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.02em' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 11px)', gap: '2px' }}>
            {Array.from({ length: curFirstDow }, (_, i) => (
              <div key={`pad-${i}`} style={{ width: '11px', height: '11px', flexShrink: 0 }} />
            ))}
            {Array.from({ length: curDaysInMonth }, (_, i) => {
              const dayNum  = i + 1
              const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const done      = loggedDates.has(dateStr)
              const isToday   = dateStr === today
              const isFuture  = dateStr > today
              const scheduled = isScheduledOn(dateStr, habit.days_of_week ?? null)
              const pending   = pendingSet.has(`${habit.id}:${dateStr}`)
              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={isFuture ? -1 : 0}
                  onClick={() => !isFuture && onToggle(dateStr)}
                  onKeyDown={e => !isFuture && (e.key === 'Enter' || e.key === ' ') && onToggle(dateStr)}
                  title={`${dateStr} — ${done ? 'logged ✓' : scheduled ? 'not logged' : 'not scheduled'}`}
                  style={{
                    width: '11px', height: '11px',
                    borderRadius: '2px',
                    border: isToday
                      ? `1.5px solid ${habitColor}`
                      : !scheduled && !isFuture
                      ? '1px dashed rgba(255,255,255,0.12)'
                      : 'none',
                    background: done
                      ? habitColor
                      : scheduled && !isFuture
                        ? 'var(--bg-3)'
                        : !scheduled && !isFuture
                        ? 'transparent'
                        : 'var(--bg-2)',
                    cursor: pending ? 'wait' : isFuture ? 'default' : 'pointer',
                    opacity: pending ? 0.4 : isFuture ? 0.15 : 1,
                    transition: 'background 0.15s, opacity 0.15s',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Right: streak badge + edit/delete */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          {streak > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'oklch(0.78 0.13 70)' }}>
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 14c-2.5 0-5-1.8-5-5 0-2.2 1.8-4 3-5.5.6 1 1.2 1.8 2 2.5.8-1.2.8-2.8.8-4 1.2 1 3.2 3.2 3.2 7 0 2.8-2 5-4 5Z" />
              </svg>
              <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>{streak}</span>
            </div>
          )}
          <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
            {confirmDelete ? (
              <ConfirmDelete onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
            ) : (
              <div style={{ display: 'flex', gap: '4px', opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                <IconBtn title="Edit" onClick={onEdit}><PencilIcon /></IconBtn>
                <IconBtn title="Delete" danger onClick={() => setConfirmDelete(true)}><TrashIcon /></IconBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress + month toggle ── */}
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Progress bar */}
        <div style={{ flex: 1 }}>
          <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '4px', width: `${progressPct}%`, background: habitColor, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', fontWeight: 500 }}>
            {progressPct}% completion · last 28 days
          </div>
        </div>
        {/* Month dropdown toggle */}
        <button
          onClick={() => setShowMonth(v => !v)}
          style={{
            background: showMonth ? `${habitColor}22` : 'var(--bg-2)',
            border: `1px solid ${showMonth ? `${habitColor}55` : 'var(--border)'}`,
            borderRadius: '8px', padding: '5px 11px',
            fontSize: '11px', fontWeight: 600,
            color: showMonth ? habitColor : 'var(--text-3)',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="2" width="12" height="11" rx="2"/>
            <path d="M4 1v2M10 1v2M1 6h12"/>
          </svg>
          {showMonth ? 'Hide ▲' : 'Month ▾'}
        </button>
      </div>

      {/* ── Monthly calendar dropdown ── */}
      {showMonth && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, lineHeight: 1 }}
            >←</button>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{monthName}</span>
            <button
              onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
              disabled={monthOffset >= 0}
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: monthOffset < 0 ? 'var(--text-2)' : 'var(--border)', cursor: monthOffset < 0 ? 'pointer' : 'default', padding: '5px 10px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, lineHeight: 1 }}
            >→</button>
          </div>
          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DOW_LABELS.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '9px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em', paddingBottom: '4px' }}>{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum  = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const done      = loggedDates.has(dateStr)
              const scheduled = isScheduledOn(dateStr, habit.days_of_week ?? null)
              const isToday   = dateStr === today
              const isFuture  = dateStr > today
              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={isFuture ? -1 : 0}
                  onClick={() => !isFuture && onToggle(dateStr)}
                  onKeyDown={e => !isFuture && (e.key === 'Enter' || e.key === ' ') && onToggle(dateStr)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '7px',
                    border: isToday ? `2px solid ${habitColor}` : 'none',
                    background: done ? habitColor : scheduled && !isFuture ? 'var(--bg-3)' : 'transparent',
                    cursor: isFuture ? 'default' : 'pointer',
                    opacity: isFuture ? 0.25 : scheduled ? 1 : 0.2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: done ? 700 : 400,
                    color: done ? '#fff' : isToday ? habitColor : 'var(--text-2)',
                    transition: 'background 0.15s',
                    boxSizing: 'border-box',
                  }}
                >
                  {dayNum}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
