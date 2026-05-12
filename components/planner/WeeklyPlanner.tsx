'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { HabitWithLogs, GoalWithSteps, WeeklyPlanBlock, CalendarEvent } from '@/lib/types'
import { useToast } from '@/components/ui/ToastContext'
import {
  addPlanBlock,
  removePlanBlock,
  acceptSuggestion,
  dismissSuggestion,
  saveSuggestions,
  setHabitTimeOfDay,
} from '@/app/actions/planner'

/* ── Constants ── */

const SLOTS = ['morning', 'afternoon', 'evening'] as const
type Slot = typeof SLOTS[number]

const SLOT_LABELS: Record<Slot, string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ── Helpers ── */

function getWeekStart(offset: number): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function isHabitOnDay(habit: HabitWithLogs, dow: number): boolean {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(dow)
}

// Column index (0-6) to day of week number (0=Sun…6=Sat)
// Week starts Monday, so col 0 = Monday (1), col 6 = Sunday (0)
function colToDow(col: number): number {
  return col === 6 ? 0 : col + 1
}

/** Map a calendar event to its time slot based on the event's local start hour. */
function getSlotForEvent(ev: CalendarEvent): Slot {
  if (ev.isAllDay) return 'morning'
  const hour = new Date(ev.start).getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** Format a calendar event time for display inside a cell (e.g. "9:00 AM"). */
function fmtEventTime(ev: CalendarEvent): string {
  if (ev.isAllDay) return 'All day'
  return new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/* ── Types ── */

type SelectedItem =
  | { kind: 'habit'; habit: HabitWithLogs }
  | { kind: 'goal'; goalId: string; title: string }
  | { kind: 'custom' }
  | null

type SuggestedRawBlock = {
  day_of_week: number
  time_slot: Slot
  title: string
  type: 'goal' | 'custom'
  reference_id: string | null
  reason: string
}

/* ── Props ── */

type Props = {
  habits: HabitWithLogs[]
  goals: GoalWithSteps[]
  initialPlan: WeeklyPlanBlock[]
  weekStart: string
  today: string
  calendarEvents?: CalendarEvent[]
}

/* ── Main Component ── */

export default function WeeklyPlanner({
  habits,
  goals,
  initialPlan,
  weekStart: initialWeekStart,
  today,
  calendarEvents = [],
}: Props) {
  const toast = useToast()
  const [planBlocks, setPlanBlocks] = useState<WeeklyPlanBlock[]>(initialPlan)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [customText, setCustomText] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [narrativeVisible, setNarrativeVisible] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [localHabits, setLocalHabits] = useState<HabitWithLogs[]>(habits)
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())

  useEffect(() => { setLocalHabits(habits) }, [habits])

  useEffect(() => {
    const ws = getWeekStart(weekOffset)
    setWeekStart(ws)
    fetch(`/api/planner/week?weekStart=${ws}`)
      .then(r => r.json())
      .then((data: WeeklyPlanBlock[]) => setPlanBlocks(data))
      .catch(err => { console.error('fetch week plan:', err); toast.error('Failed to load plan') })
  }, [weekOffset])

  /* ── Calendar event lookups (memoised) ── */

  // Build colDates once here so memos can reference it too
  const colDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const weekEnd = colDates[6]

  /**
   * Calendar events that fall in the visible week, indexed by "dateStr|slot".
   * All-day events are excluded here — they appear in the all-day strip.
   */
  const calByCell = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of calendarEvents) {
      if (ev.isAllDay) continue
      const dateStr = ev.start.slice(0, 10)
      if (dateStr < colDates[0] || dateStr > weekEnd) continue
      const slot = getSlotForEvent(ev)
      const key = `${dateStr}|${slot}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [calendarEvents, colDates, weekEnd])

  /** All-day events indexed by dateStr. */
  const allDayByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of calendarEvents) {
      if (!ev.isAllDay) continue
      const dateStr = ev.start.slice(0, 10)
      if (dateStr < colDates[0] || dateStr > weekEnd) continue
      if (!map.has(dateStr)) map.set(dateStr, [])
      map.get(dateStr)!.push(ev)
    }
    return map
  }, [calendarEvents, colDates, weekEnd])

  /** Total event count per day (timed + all-day) for load indicators. */
  const loadByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const ev of calendarEvents) {
      const dateStr = ev.start.slice(0, 10)
      if (dateStr < colDates[0] || dateStr > weekEnd) continue
      map.set(dateStr, (map.get(dateStr) ?? 0) + 1)
    }
    return map
  }, [calendarEvents, colDates, weekEnd])

  /* ── Handlers ── */

  async function handleCellClick(col: number, slot: Slot) {
    if (!selectedItem) return
    const cellDate = colDates[col]
    if (cellDate < today) return
    if (selectedItem.kind === 'habit' && weekOffset !== 0) return
    const dow = colToDow(col)
    const cellKey = `${col}-${slot}`

    if (selectedItem.kind === 'habit') {
      const habit = selectedItem.habit
      setPendingCells(prev => new Set(prev).add(cellKey))
      setLocalHabits(prev =>
        prev.map(h => h.id === habit.id ? { ...h, time_of_day: slot } : h)
      )
      setSelectedItem(null)
      try {
        await setHabitTimeOfDay(habit.id, slot)
      } catch (err) {
        console.error('setHabitTimeOfDay:', err); toast.error('Failed to update habit time')
        setLocalHabits(prev =>
          prev.map(h => h.id === habit.id ? { ...h, time_of_day: habit.time_of_day } : h)
        )
      } finally {
        setPendingCells(prev => { const s = new Set(prev); s.delete(cellKey); return s })
      }
      return
    }

    if (selectedItem.kind === 'goal') {
      const title = selectedItem.title
      const goalId = selectedItem.goalId
      const optimistic: WeeklyPlanBlock = {
        id: `optimistic-${Date.now()}`,
        user_id: '',
        week_start: weekStart,
        day_of_week: dow,
        time_slot: slot,
        title,
        type: 'goal',
        reference_id: goalId,
        accepted: true,
        position: 0,
        created_at: new Date().toISOString(),
      }
      setPlanBlocks(prev => [...prev, optimistic])
      setSelectedItem(null)
      try {
        const saved = await addPlanBlock(weekStart, dow, slot, title, 'goal', goalId)
        setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
      } catch (err) {
        console.error('addPlanBlock goal:', err); toast.error('Failed to add goal to plan')
        setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id))
      }
      return
    }

    if (selectedItem.kind === 'custom') {
      const title = customText.trim()
      if (!title) return
      const optimistic: WeeklyPlanBlock = {
        id: `optimistic-${Date.now()}`,
        user_id: '',
        week_start: weekStart,
        day_of_week: dow,
        time_slot: slot,
        title,
        type: 'custom',
        reference_id: null,
        accepted: true,
        position: 0,
        created_at: new Date().toISOString(),
      }
      setPlanBlocks(prev => [...prev, optimistic])
      setSelectedItem(null)
      setCustomText('')
      try {
        const saved = await addPlanBlock(weekStart, dow, slot, title, 'custom')
        setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
      } catch (err) {
        console.error('addPlanBlock custom:', err); toast.error('Failed to add task to plan')
        setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id))
      }
    }
  }

  async function handleRemoveBlock(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try {
      await removePlanBlock(block.id)
    } catch (err) {
      console.error('removePlanBlock:', err); toast.error('Failed to remove block')
      setPlanBlocks(prev => [...prev, block])
    }
  }

  async function handleRemoveHabitSlot(habit: HabitWithLogs) {
    const prev = habit.time_of_day
    setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: null } : h))
    try {
      await setHabitTimeOfDay(habit.id, null)
    } catch (err) {
      console.error('removeHabitSlot:', err); toast.error('Failed to remove habit slot')
      setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: prev } : h))
    }
  }

  async function handleAccept(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: true } : b))
    try {
      await acceptSuggestion(block.id)
    } catch (err) {
      console.error('acceptSuggestion:', err); toast.error('Failed to accept suggestion')
      setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: false } : b))
    }
  }

  async function handleDismiss(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try {
      await dismissSuggestion(block.id)
    } catch (err) {
      console.error('dismissSuggestion:', err); toast.error('Failed to dismiss suggestion')
      setPlanBlocks(prev => [...prev, block])
    }
  }

  async function handleQuickSlot(habit: HabitWithLogs, slot: Slot) {
    const prev = habit.time_of_day
    setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: slot } : h))
    try {
      await setHabitTimeOfDay(habit.id, slot)
    } catch (err) {
      console.error('handleQuickSlot:', err); toast.error('Failed to save slot')
      setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: prev } : h))
    }
  }

  async function handleAISuggest() {
    setSuggesting(true)
    setSuggestError('')
    try {
      const res = await fetch('/api/planner/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, calendarEvents }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ? `${body.error}: ${body.detail}` : (body.error ?? `Request failed (${res.status})`))
      }
      const { blocks, narrative: newNarrative } = await res.json() as {
        blocks: SuggestedRawBlock[]
        narrative: string
        summary: string
      }

      const VALID_SLOTS = new Set(['morning', 'afternoon', 'evening'])
      const clean = blocks.filter(b =>
        typeof b.title === 'string' &&
        b.title.trim() &&
        VALID_SLOTS.has(b.time_slot) &&
        typeof b.day_of_week === 'number' &&
        b.day_of_week >= 0 && b.day_of_week <= 6
      ).map(b => ({
        weekStart,
        dayOfWeek: b.day_of_week,
        timeSlot: b.time_slot,
        title: b.title.trim(),
        type: (b.type === 'goal' ? 'goal' : 'custom') as 'goal' | 'custom',
        referenceId: b.type === 'goal' && b.reference_id ? b.reference_id : undefined,
      }))

      if (clean.length === 0) throw new Error('No valid suggestions returned')

      const saved = await saveSuggestions(clean)
      setPlanBlocks(prev => [...prev, ...saved])

      if (newNarrative) {
        setNarrative(newNarrative)
        setNarrativeVisible(true)
      }
    } catch (err) {
      console.error('handleAISuggest:', err); toast.error('AI suggestions failed — try again')
      setSuggestError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSuggesting(false)
    }
  }

  /* ── Computed ── */

  const isPastWeek = weekOffset < 0
  const isSelecting = selectedItem !== null && !isPastWeek
  const todayDow = new Date(today + 'T12:00:00').getDay()

  const weekEndDate = addDays(weekStart, 6)
  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEndDate)}`

  const hasCalendar = calendarEvents.length > 0

  /* ── Render ── */

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400, color: 'var(--text-0)', margin: 0 }}>
            Weekly Rhythm
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{weekLabel}</span>
            {hasCalendar && weekOffset === 0 && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'rgba(96,160,200,0.12)', border: '1px solid rgba(96,160,200,0.3)', color: 'rgba(96,160,200,0.9)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                📅 Calendar synced
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-1)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >← Prev</button>
          <button
            onClick={() => setWeekOffset(0)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', background: weekOffset === 0 ? 'var(--gold-dim)' : 'var(--bg-1)', color: weekOffset === 0 ? 'var(--gold)' : 'var(--text-1)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: weekOffset === 0 ? 600 : 400 }}
          >This Week</button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-1)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >Next →</button>
          <button
            onClick={handleAISuggest}
            disabled={suggesting}
            style={{ padding: '6px 14px', border: 'none', background: suggesting ? 'var(--bg-2)' : 'var(--gold)', color: suggesting ? 'var(--text-3)' : '#131110', borderRadius: '6px', cursor: suggesting ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {suggesting
              ? <><SpinnerIcon />Analyzing…</>
              : <>✦ {narrativeVisible ? 'Re-analyze' : 'Analyze Week'}</>
            }
          </button>
        </div>
      </div>

      {/* ── AI error banner ── */}
      {suggestError && (
        <div style={{ background: 'rgba(200,80,60,0.08)', border: '1px solid rgba(200,80,60,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#e07060', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{suggestError}</span>
          <button onClick={() => setSuggestError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0, padding: 0 }}>×</button>
        </div>
      )}

      {/* ── AI Intelligence Panel ── */}
      {narrativeVisible && narrative && (
        <div style={{
          background: 'rgba(212,168,83,0.06)',
          border: '1px solid rgba(212,168,83,0.22)',
          borderLeft: '3px solid var(--gold)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          animation: 'fadeUp 0.25s var(--ease) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>✦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '5px' }}>
                Locus Week Intelligence
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', margin: 0, lineHeight: 1.6 }}>
                {narrative}
              </p>
            </div>
            <button
              onClick={() => setNarrativeVisible(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
          </div>
        </div>
      )}

      {/* ── Selected item banner ── */}
      {selectedItem && (
        <div style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid var(--gold)', borderRadius: '8px', padding: '8px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            {selectedItem.kind === 'habit' && `Placing: ${selectedItem.habit.emoji} ${selectedItem.habit.name}`}
            {selectedItem.kind === 'goal' && `Placing: "${selectedItem.title}"`}
            {selectedItem.kind === 'custom' && `Placing: "${customText}"`}
          </span>
          <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>— click a cell to place</span>
          <button onClick={() => setSelectedItem(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Calendar legend (only if calendar is connected and viewing current week) */}
          {hasCalendar && weekOffset === 0 && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(96,160,200,0.07)', border: '1px solid rgba(96,160,200,0.2)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(96,160,200,0.8)', marginBottom: '6px' }}>
                📅 Calendar
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                Blue blocks are your Google Calendar events. They&apos;re read-only — use <strong>✦ Analyze Week</strong> to get AI suggestions that work around them.
              </div>
            </div>
          )}

          {/* Habits */}
          <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--glass-card-border)' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Habits</div>
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {localHabits.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '6px 4px' }}>No habits yet</div>
              )}
              {localHabits.map(habit => {
                const isSelected = selectedItem?.kind === 'habit' && selectedItem.habit.id === habit.id
                return (
                  <div
                    key={habit.id}
                    style={{ padding: '7px 8px', borderRadius: '6px', border: `1px solid ${isSelected ? 'var(--gold)' : 'transparent'}`, background: isSelected ? 'rgba(212,168,83,0.1)' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }} onClick={() => setSelectedItem(isSelected ? null : { kind: 'habit', habit })}>
                      <span style={{ fontSize: '14px' }}>{habit.emoji}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-1)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {SLOTS.map(slot => {
                        const active = habit.time_of_day === slot
                        return (
                          <button
                            key={slot}
                            onClick={e => { e.stopPropagation(); handleQuickSlot(habit, slot) }}
                            style={{ flex: 1, padding: '2px 0', border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`, background: active ? 'rgba(212,168,83,0.2)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text-3)', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: active ? 700 : 400, letterSpacing: '0.03em', transition: 'all 0.12s' }}
                          >
                            {slot === 'morning' ? 'M' : slot === 'afternoon' ? 'A' : 'E'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Goals */}
          <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--glass-card-border)' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Goals</div>
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {goals.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '6px 4px' }}>No active goals</div>
              )}
              {goals.map(goal => {
                const isSelected = selectedItem?.kind === 'goal' && selectedItem.goalId === goal.id
                return (
                  <div
                    key={goal.id}
                    onClick={() => setSelectedItem(isSelected ? null : { kind: 'goal', goalId: goal.id, title: goal.title })}
                    style={{ padding: '7px 8px', borderRadius: '6px', border: `1px solid ${isSelected ? 'var(--gold)' : 'transparent'}`, background: isSelected ? 'rgba(212,168,83,0.1)' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ fontSize: '12px', color: 'var(--text-0)', fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Custom block */}
          <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--glass-card-border)' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Custom Block</div>
            </div>
            <div style={{ padding: '10px' }}>
              <input
                type="text"
                placeholder="Block title…"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customText.trim()) setSelectedItem({ kind: 'custom' }) }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                disabled={!customText.trim()}
                onClick={() => { if (customText.trim()) setSelectedItem({ kind: 'custom' }) }}
                style={{ marginTop: '8px', width: '100%', padding: '7px', border: 'none', background: customText.trim() ? 'var(--gold)' : 'var(--bg-2)', color: customText.trim() ? '#131110' : 'var(--text-3)', borderRadius: '6px', cursor: customText.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, transition: 'all 0.12s' }}
              >
                Place →
              </button>
            </div>
          </div>
        </aside>

        {/* ── Grid ── */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{ minWidth: '560px' }}>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
              <div /> {/* slot label spacer */}
              {Array.from({ length: 7 }, (_, col) => {
                const dow = colToDow(col)
                const dateStr = colDates[col]
                const isToday = dateStr === today
                const load = loadByDate.get(dateStr) ?? 0
                return (
                  <div key={col} style={{ textAlign: 'center', padding: '8px 4px 6px', borderRadius: '6px 6px 0 0', background: isToday ? 'rgba(212,168,83,0.12)' : 'transparent' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: isToday ? 'var(--gold)' : 'var(--text-1)' }}>{DOW_SHORT[dow]}</div>
                    <div style={{ fontSize: '10px', color: isToday ? 'var(--gold)' : 'var(--text-3)', marginTop: '1px' }}>
                      {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    {/* Calendar load dots */}
                    {load > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '4px' }}>
                        {Array.from({ length: Math.min(load, 5) }, (_, i) => (
                          <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(96,160,200,0.6)' }} />
                        ))}
                        {load > 5 && <span style={{ fontSize: '8px', color: 'rgba(96,160,200,0.6)', lineHeight: '4px' }}>+</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* All-Day strip */}
            {hasCalendar && weekOffset === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', paddingRight: '6px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'right', width: '100%' }}>All day</span>
                </div>
                {colDates.map((dateStr, col) => {
                  const allDayEvents = allDayByDate.get(dateStr) ?? []
                  const isToday = dateStr === today
                  return (
                    <div
                      key={col}
                      style={{ minHeight: '22px', padding: '2px 3px', display: 'flex', flexWrap: 'wrap', gap: '2px', borderRadius: '4px', background: isToday ? 'rgba(212,168,83,0.04)' : 'transparent' }}
                    >
                      {allDayEvents.map(ev => (
                        <AllDayBadge key={ev.id} event={ev} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Slot rows */}
            {SLOTS.map(slot => (
              <div key={slot} style={{ display: 'grid', gridTemplateColumns: '72px repeat(7, 1fr)', gap: '2px', marginBottom: '2px', alignItems: 'stretch' }}>
                {/* Slot label */}
                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 6px 8px 0', height: '140px', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{SLOT_LABELS[slot]}</span>
                </div>

                {/* 7 day cells */}
                {Array.from({ length: 7 }, (_, col) => {
                  const dow = colToDow(col)
                  const dateStr = colDates[col]
                  const isToday = dateStr === today
                  const isPastDate = dateStr < today
                  const habitSelected = selectedItem?.kind === 'habit'
                  const isDropTarget = isSelecting && !isPastDate && !(habitSelected && weekOffset !== 0)
                  const cellKey = `${col}-${slot}`
                  const isPending = pendingCells.has(cellKey)

                  const habitBlocks = localHabits.filter(h =>
                    isHabitOnDay(h, dow) && h.time_of_day === slot &&
                    (!h.ends_at || dateStr <= h.ends_at)
                  )
                  const dayPlanBlocks = planBlocks.filter(b =>
                    b.day_of_week === dow && b.time_slot === slot && b.week_start === weekStart
                  )
                  // Calendar events for this cell (timed events only; all-day shown in strip)
                  const cellCalEvents = weekOffset === 0
                    ? (calByCell.get(`${dateStr}|${slot}`) ?? [])
                    : []

                  return (
                    <div
                      key={col}
                      onClick={() => handleCellClick(col, slot)}
                      style={{
                        height: '140px',
                        padding: '5px',
                        border: `1px solid ${isDropTarget ? 'rgba(212,168,83,0.4)' : 'var(--border)'}`,
                        borderRadius: '6px',
                        background: isToday ? 'rgba(212,168,83,0.04)' : 'var(--bg-0)',
                        cursor: isDropTarget ? 'crosshair' : 'default',
                        transition: 'border-color 0.12s, background 0.12s',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        overflowY: 'auto',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={e => {
                        if (isDropTarget) {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(212,168,83,0.1)'
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (isDropTarget) {
                          (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(212,168,83,0.04)' : 'var(--bg-0)'
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,168,83,0.4)'
                        }
                      }}
                    >
                      {isPending && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.04)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '14px', height: '14px', border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        </div>
                      )}

                      {/* Calendar event blocks (read-only, shown first) */}
                      {cellCalEvents.map(ev => (
                        <CalendarBlock key={ev.id} event={ev} />
                      ))}

                      {/* Habit blocks */}
                      {habitBlocks.map(habit => (
                        <HabitBlock key={habit.id} habit={habit} onRemove={() => handleRemoveHabitSlot(habit)} />
                      ))}

                      {/* Plan blocks */}
                      {dayPlanBlocks.map(block => (
                        <PlanBlock
                          key={block.id}
                          block={block}
                          onRemove={() => handleRemoveBlock(block)}
                          onAccept={() => handleAccept(block)}
                          onDismiss={() => handleDismiss(block)}
                        />
                      ))}

                      {/* Drop hint */}
                      {isDropTarget && cellCalEvents.length === 0 && habitBlocks.length === 0 && dayPlanBlocks.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <span style={{ fontSize: '18px', color: 'var(--gold)' }}>+</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes tooltipIn { from { opacity:0; transform:translateY(3px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )
}

/* ── Icons ── */

function SpinnerIcon() {
  return (
    <div style={{ width: '12px', height: '12px', border: '2px solid #131110', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  )
}

/* ── Tooltip ── */
function Tooltip({ text, anchorRect }: { text: string; anchorRect: DOMRect }) {
  const top  = anchorRect.top - 8
  const left = anchorRect.left + anchorRect.width / 2
  const node = (
    <div style={{
      position: 'fixed', top, left, transform: 'translate(-50%, -100%)',
      background: 'var(--bg-0)', border: '1px solid var(--border-md)',
      borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: 'var(--text-0)',
      whiteSpace: 'pre-wrap', maxWidth: '260px', wordBreak: 'break-word',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 9999, pointerEvents: 'none',
      animation: 'tooltipIn 0.1s ease both', lineHeight: 1.4,
    }}>
      {text}
      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--border-md)' }} />
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(node, document.body) : null
}

/* ── Calendar sub-components ── */

/** Read-only badge for all-day events (shown in the all-day strip). */
function AllDayBadge({ event }: { event: CalendarEvent }) {
  return (
    <div
      title={event.title}
      style={{
        fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
        background: 'rgba(96,160,200,0.15)', border: '1px solid rgba(96,160,200,0.3)',
        color: 'rgba(140,190,220,0.9)', whiteSpace: 'nowrap',
        overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis',
        fontWeight: 500,
      }}
    >
      {event.title}
    </div>
  )
}

/** Read-only timed calendar event block shown inside a slot cell. */
function CalendarBlock({ event }: { event: CalendarEvent }) {
  const [hovered, setHovered] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)

  return (
    <div
      onMouseEnter={() => {
        setHovered(true)
        if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
          setTooltipRect(titleRef.current.getBoundingClientRect())
        }
      }}
      onMouseLeave={() => { setHovered(false); setTooltipRect(null) }}
      onClick={e => e.stopPropagation()}
      style={{
        padding: '3px 6px',
        borderRadius: '5px',
        background: 'rgba(96,160,200,0.14)',
        border: '1px solid rgba(96,160,200,0.32)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        flexShrink: 0,
        opacity: hovered ? 0.9 : 1,
        transition: 'opacity 0.1s',
      }}
    >
      {tooltipRect && <Tooltip text={`📅 ${event.title}${event.location ? `\n${event.location}` : ''}`} anchorRect={tooltipRect} />}
      <div style={{ fontSize: '9.5px', color: 'rgba(120,180,220,0.85)', fontWeight: 600, lineHeight: 1, letterSpacing: '0.02em' }}>
        {fmtEventTime(event)}
      </div>
      <div
        ref={titleRef}
        style={{ fontSize: '11px', color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {event.title}
      </div>
      {event.location && (
        <div style={{ fontSize: '9.5px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.location}
        </div>
      )}
    </div>
  )
}

/* ── Plan sub-components ── */

function HabitBlock({ habit, onRemove }: { habit: HabitWithLogs; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  return (
    <div
      onMouseEnter={() => {
        setHovered(true)
        if (textRef.current && textRef.current.scrollWidth > textRef.current.clientWidth) {
          setTooltipRect(textRef.current.getBoundingClientRect())
        }
      }}
      onMouseLeave={() => { setHovered(false); setTooltipRect(null) }}
      onClick={e => { e.stopPropagation(); if (hovered) onRemove() }}
      style={{ padding: '4px 6px', borderRadius: '5px', background: 'rgba(122,158,138,0.2)', border: '1px solid rgba(122,158,138,0.35)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', transition: 'background 0.12s', position: 'relative', flexShrink: 0 }}
    >
      {tooltipRect && <Tooltip text={`${habit.emoji} ${habit.name}`} anchorRect={tooltipRect} />}
      {hovered && <span style={{ fontSize: '13px', color: 'var(--text-2)', flexShrink: 0, lineHeight: 1 }}>×</span>}
      <span style={{ fontSize: '12px' }}>{habit.emoji}</span>
      <span ref={textRef} style={{ fontSize: '11px', color: 'var(--text-1)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
    </div>
  )
}

function PlanBlock({
  block, onRemove, onAccept, onDismiss,
}: {
  block: WeeklyPlanBlock
  onRemove: () => void
  onAccept: () => void
  onDismiss: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const isGhost = !block.accepted

  const bgColor     = block.type === 'goal' ? 'rgba(212,168,83,0.15)' : 'rgba(96,144,200,0.15)'
  const borderColor = block.type === 'goal' ? 'rgba(212,168,83,0.4)'  : 'rgba(96,144,200,0.4)'

  return (
    <div
      onMouseEnter={() => {
        setHovered(true)
        if (textRef.current && textRef.current.scrollWidth > textRef.current.clientWidth) {
          setTooltipRect(textRef.current.getBoundingClientRect())
        }
      }}
      onMouseLeave={() => { setHovered(false); setTooltipRect(null) }}
      onClick={e => e.stopPropagation()}
      style={{ padding: '4px 6px', borderRadius: '5px', background: bgColor, border: `1px ${isGhost ? 'dashed' : 'solid'} ${borderColor}`, opacity: isGhost ? 0.75 : 1, transition: 'opacity 0.12s', position: 'relative', flexShrink: 0 }}
    >
      {tooltipRect && <Tooltip text={block.title} anchorRect={tooltipRect} />}
      {isGhost && hovered && (
        <div style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%)', display: 'flex', gap: '2px' }}>
          <button onClick={e => { e.stopPropagation(); onAccept() }} title="Accept" style={{ width: '18px', height: '18px', border: 'none', background: 'rgba(122,158,138,0.4)', color: 'var(--text-0)', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDismiss() }} title="Dismiss" style={{ width: '18px', height: '18px', border: 'none', background: 'rgba(220,80,60,0.25)', color: 'var(--text-0)', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
        </div>
      )}
      {!isGhost && hovered && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%)', width: '14px', height: '14px', border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>×</button>
      )}
      <div ref={textRef} style={{ fontSize: '11px', color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: hovered ? (isGhost ? '42px' : '18px') : '0' }}>
        {block.title}
      </div>
    </div>
  )
}
