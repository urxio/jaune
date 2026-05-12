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

// ── Grid constants ─────────────────────────────────────────────────────────────
const START_HOUR = 7   // 7 AM
const END_HOUR   = 22  // 10 PM
const HOURS      = END_HOUR - START_HOUR  // 15
const HOUR_PX    = 64  // px per hour
const GRID_H     = HOURS * HOUR_PX        // 960px

// ── Date helpers ───────────────────────────────────────────────────────────────

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

function colToDow(col: number): number { return col === 6 ? 0 : col + 1 }

function isHabitOnDay(h: HabitWithLogs, dow: number): boolean {
  if (!h.days_of_week || h.days_of_week.length === 0) return true
  return h.days_of_week.includes(dow)
}

// ── Time ↔ pixel helpers ──────────────────────────────────────────────────────

function minuteToY(totalMinutes: number): number {
  return (totalMinutes - START_HOUR * 60) * (HOUR_PX / 60)
}

function yToSnappedTime(y: number): { hour: number; minute: number } {
  const totalMin = START_HOUR * 60 + Math.round((y / HOUR_PX) * 60 / 15) * 15
  const clamped  = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - 15, totalMin))
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 }
}

function eventTop(ev: CalendarEvent): number {
  const d = new Date(ev.start)
  return Math.max(0, minuteToY(d.getHours() * 60 + d.getMinutes()))
}

function eventHeight(ev: CalendarEvent): number {
  const start    = new Date(ev.start)
  const end      = new Date(ev.end)
  const durMin   = Math.max(15, (end.getTime() - start.getTime()) / 60000)
  const maxMin   = (END_HOUR - START_HOUR) * 60
  const startMin = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60
  return Math.min(durMin, maxMin - startMin) * (HOUR_PX / 60)
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${pad2(m)} ${ampm}`
}

/** ISO datetime string for a given date + hour/minute, in local timezone offset */
function localISO(dateStr: string, h: number, m: number): string {
  const d     = new Date(`${dateStr}T${pad2(h)}:${pad2(m)}:00`)
  const off   = -d.getTimezoneOffset()
  const sign  = off >= 0 ? '+' : '-'
  const ah    = Math.floor(Math.abs(off) / 60)
  const am    = Math.abs(off) % 60
  return `${dateStr}T${pad2(h)}:${pad2(m)}:00${sign}${pad2(ah)}:${pad2(am)}`
}

// ── Event overlap layout ──────────────────────────────────────────────────────

type LayoutEvent = CalendarEvent & { laneIdx: number; laneCount: number }

function layoutDayEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (!events.length) return []
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  // Each "lane" tracks the endTime of the last event assigned to it
  const laneEnds: number[] = []

  const withLane = sorted.map(ev => {
    const startMs = new Date(ev.start).getTime()
    const endMs   = new Date(ev.end).getTime()
    let lane = laneEnds.findIndex(end => end <= startMs)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
    laneEnds[lane] = endMs
    return { ev, lane }
  })

  const total = laneEnds.length || 1
  return withLane.map(({ ev, lane }) => ({ ...ev, laneIdx: lane, laneCount: total }))
}

// ── Slot ↔ hour ───────────────────────────────────────────────────────────────

type Slot = 'morning' | 'afternoon' | 'evening'
const SLOT_HOURS: Record<Slot, number> = { morning: 7, afternoon: 12, evening: 18 }
const SLOT_EMOJI: Record<Slot, string> = { morning: '🌅', afternoon: '☀️', evening: '🌙' }

function hourToSlot(hour: number): Slot {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

// ── Types ─────────────────────────────────────────────────────────────────────

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ClickPoint = {
  dateStr: string
  hour: number
  minute: number
  clientX: number
  clientY: number
}

type PopupMode = 'choose' | 'event' | 'habit' | 'goal' | 'custom'

type SuggestedRawBlock = {
  day_of_week: number
  time_slot: Slot
  title: string
  type: 'goal' | 'custom'
  reference_id: string | null
  reason: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  habits: HabitWithLogs[]
  goals: GoalWithSteps[]
  initialPlan: WeeklyPlanBlock[]
  weekStart: string
  today: string
  calendarEvents?: CalendarEvent[]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeeklyPlanner({
  habits,
  goals,
  initialPlan,
  weekStart: initialWeekStart,
  today,
  calendarEvents = [],
}: Props) {
  const toast = useToast()

  // ── Core state ──
  const [planBlocks,  setPlanBlocks]  = useState<WeeklyPlanBlock[]>(initialPlan)
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [weekStart,   setWeekStart]   = useState(initialWeekStart)
  const [localHabits, setLocalHabits] = useState<HabitWithLogs[]>(habits)
  const [suggesting,  setSuggesting]  = useState(false)
  const [narrative,   setNarrative]   = useState('')
  const [narrativeVisible, setNarrativeVisible] = useState(false)
  const [suggestError,     setSuggestError]     = useState('')

  // ── Local calendar events (+ optimistically-added events) ──
  const [localCalEvents, setLocalCalEvents] = useState<CalendarEvent[]>(calendarEvents)

  // ── Click-to-add popup ──
  const [click,      setClick]      = useState<ClickPoint | null>(null)
  const [popupMode,  setPopupMode]  = useState<PopupMode>('choose')
  const [evTitle,    setEvTitle]    = useState('')
  const [evStart,    setEvStart]    = useState('')  // HH:MM
  const [evEnd,      setEvEnd]      = useState('')  // HH:MM
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')
  const [customText, setCustomText] = useState('')

  // ── Current time ──
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setLocalHabits(habits) }, [habits])
  useEffect(() => { setLocalCalEvents(calendarEvents) }, [calendarEvents])

  useEffect(() => {
    const ws = getWeekStart(weekOffset)
    setWeekStart(ws)
    fetch(`/api/planner/week?weekStart=${ws}`)
      .then(r => r.json())
      .then((data: WeeklyPlanBlock[]) => setPlanBlocks(data))
      .catch(() => toast.error('Failed to load plan'))
  }, [weekOffset])

  // Close popup on outside click
  useEffect(() => {
    if (!click) return
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('cal-popup')
      if (popup && !popup.contains(e.target as Node)) closePopup()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [click])

  // ── Memos ──

  const colDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const weekEnd = colDates[6]

  /** All-day events for the visible week, indexed by dateStr */
  const allDayByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of localCalEvents) {
      if (!ev.isAllDay) continue
      const d = ev.start.slice(0, 10)
      if (d < colDates[0] || d > weekEnd) continue
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(ev)
    }
    return m
  }, [localCalEvents, colDates, weekEnd])

  /** Timed events per dateStr, with lane layout computed */
  const timedByDate = useMemo(() => {
    const m = new Map<string, LayoutEvent[]>()
    for (const col of colDates) {
      const evs = localCalEvents.filter(ev => !ev.isAllDay && ev.start.slice(0, 10) === col)
      m.set(col, layoutDayEvents(evs))
    }
    return m
  }, [localCalEvents, colDates])

  const hasCalendar = localCalEvents.length > 0

  // ── Handlers ──

  function openPopup(dateStr: string, clientX: number, clientY: number, hour: number, minute: number) {
    const slot = hourToSlot(hour)
    const endH = hour + 1 > END_HOUR ? hour : hour + 1
    setClick({ dateStr, hour, minute, clientX, clientY })
    setPopupMode('choose')
    setEvTitle('')
    setEvStart(`${pad2(hour)}:${pad2(minute)}`)
    setEvEnd(`${pad2(endH)}:${pad2(minute)}`)
    setCreateErr('')
    setCustomText('')
  }

  function closePopup() { setClick(null); setPopupMode('choose') }

  function handleGridClick(dateStr: string, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-event]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const { hour, minute } = yToSnappedTime(y)
    openPopup(dateStr, e.clientX, e.clientY, hour, minute)
  }

  async function handleCreateCalendarEvent() {
    if (!click || !evTitle.trim()) return
    setCreating(true)
    setCreateErr('')
    try {
      const [sh, sm] = evStart.split(':').map(Number)
      const [eh, em] = evEnd.split(':').map(Number)
      const startISO = localISO(click.dateStr, sh, sm)
      const endISO   = localISO(click.dateStr, eh, em)

      const res = await fetch('/api/calendar/events', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: evTitle.trim(), startDateTime: startISO, endDateTime: endISO }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 412) {
          setCreateErr('Connect Google Calendar in Settings first.')
          return
        }
        if (res.status === 403) {
          setCreateErr('Reconnect Google Calendar in Settings to enable creating events.')
          return
        }
        setCreateErr(data.error ?? 'Failed to create event')
        return
      }

      // Optimistically add to local state
      const optimisticEvent: CalendarEvent = {
        id:           data.eventId ?? `local-${Date.now()}`,
        title:        evTitle.trim(),
        start:        startISO,
        end:          endISO,
        isAllDay:     false,
        calendarName: 'Google Calendar',
        location:     null,
        description:  null,
      }
      setLocalCalEvents(prev => [...prev, optimisticEvent])
      toast.success('Event created in Google Calendar')
      closePopup()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  async function handleAddHabit(habit: HabitWithLogs) {
    if (!click) return
    const slot = hourToSlot(click.hour)
    const prev = habit.time_of_day
    setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: slot } : h))
    closePopup()
    try {
      await setHabitTimeOfDay(habit.id, slot)
      toast.success(`${habit.emoji} ${habit.name} moved to ${slot}`)
    } catch {
      toast.error('Failed to assign habit time')
      setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: prev } : h))
    }
  }

  async function handleAddGoalBlock(goal: GoalWithSteps) {
    if (!click) return
    const slot = hourToSlot(click.hour)
    const dow  = new Date(click.dateStr + 'T12:00:00').getDay()
    const optimistic: WeeklyPlanBlock = {
      id: `opt-${Date.now()}`, user_id: '', week_start: weekStart,
      day_of_week: dow, time_slot: slot, title: goal.title,
      type: 'goal', reference_id: goal.id, accepted: true, position: 0,
      created_at: new Date().toISOString(),
    }
    setPlanBlocks(prev => [...prev, optimistic])
    closePopup()
    try {
      const saved = await addPlanBlock(weekStart, dow, slot, goal.title, 'goal', goal.id)
      setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
    } catch {
      toast.error('Failed to add goal block')
      setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id))
    }
  }

  async function handleAddCustomBlock() {
    if (!click || !customText.trim()) return
    const slot = hourToSlot(click.hour)
    const dow  = new Date(click.dateStr + 'T12:00:00').getDay()
    const title = customText.trim()
    const optimistic: WeeklyPlanBlock = {
      id: `opt-${Date.now()}`, user_id: '', week_start: weekStart,
      day_of_week: dow, time_slot: slot, title,
      type: 'custom', reference_id: null, accepted: true, position: 0,
      created_at: new Date().toISOString(),
    }
    setPlanBlocks(prev => [...prev, optimistic])
    closePopup()
    try {
      const saved = await addPlanBlock(weekStart, dow, slot, title, 'custom')
      setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
    } catch {
      toast.error('Failed to add block')
      setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id))
    }
  }

  async function handleRemoveHabitSlot(habit: HabitWithLogs) {
    const prev = habit.time_of_day
    setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: null } : h))
    try { await setHabitTimeOfDay(habit.id, null) }
    catch { toast.error('Failed to remove habit slot'); setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: prev } : h)) }
  }

  async function handleRemoveBlock(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try { await removePlanBlock(block.id) }
    catch { toast.error('Failed to remove block'); setPlanBlocks(prev => [...prev, block]) }
  }

  async function handleAccept(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: true } : b))
    try { await acceptSuggestion(block.id) }
    catch { toast.error('Failed to accept'); setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: false } : b)) }
  }

  async function handleDismiss(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try { await dismissSuggestion(block.id) }
    catch { toast.error('Failed to dismiss'); setPlanBlocks(prev => [...prev, block]) }
  }

  async function handleAISuggest() {
    setSuggesting(true); setSuggestError('')
    try {
      const res = await fetch('/api/planner/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, calendarEvents: localCalEvents }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? body.error ?? `Request failed (${res.status})`)
      }
      const { blocks, narrative: nav } = await res.json() as { blocks: SuggestedRawBlock[]; narrative: string; summary: string }

      const VALID_SLOTS = new Set(['morning', 'afternoon', 'evening'])
      const clean = blocks
        .filter(b => typeof b.title === 'string' && b.title.trim() && VALID_SLOTS.has(b.time_slot) && typeof b.day_of_week === 'number' && b.day_of_week >= 0 && b.day_of_week <= 6)
        .map(b => ({
          weekStart, dayOfWeek: b.day_of_week, timeSlot: b.time_slot, title: b.title.trim(),
          type: (b.type === 'goal' ? 'goal' : 'custom') as 'goal' | 'custom',
          referenceId: b.type === 'goal' && b.reference_id ? b.reference_id : undefined,
        }))
      if (!clean.length) throw new Error('No valid suggestions returned')

      const saved = await saveSuggestions(clean)
      setPlanBlocks(prev => [...prev, ...saved])
      if (nav) { setNarrative(nav); setNarrativeVisible(true) }
    } catch (err) {
      toast.error('AI suggestions failed — try again')
      setSuggestError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSuggesting(false) }
  }

  // ── Computed ──

  const weekEndDate = addDays(weekStart, 6)
  function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEndDate)}`
  const nowY = minuteToY(nowMinutes)
  const todayVisible = today >= colDates[0] && today <= weekEnd
  const showNowLine  = weekOffset === 0 && todayVisible && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60

  // ── Popup positioning ──
  function popupStyle(): React.CSSProperties {
    if (!click) return {}
    const W = 300, H = popupMode === 'event' ? 320 : popupMode === 'habit' ? 280 : popupMode === 'goal' ? 260 : popupMode === 'custom' ? 180 : 140
    const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const left = Math.max(8, Math.min(vw - W - 8, click.clientX - W / 2))
    const top  = Math.max(8, Math.min(vh - H - 8, click.clientY + 16))
    return { position: 'fixed', top, left, width: `${W}px`, zIndex: 9000 }
  }

  // ── Render ──

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--text-0)', margin: 0 }}>
            Weekly Rhythm
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{weekLabel}</span>
            {hasCalendar && weekOffset === 0 && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'rgba(96,160,200,0.12)', border: '1px solid rgba(96,160,200,0.3)', color: 'rgba(140,190,220,0.9)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                📅 synced
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={navBtnStyle}>← Prev</button>
          <button onClick={() => setWeekOffset(0)} style={{ ...navBtnStyle, ...(weekOffset === 0 && { background: 'var(--gold-dim)', color: 'var(--gold)', fontWeight: 600 }) }}>This Week</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={navBtnStyle}>Next →</button>
          <button onClick={handleAISuggest} disabled={suggesting} style={{ padding: '6px 14px', border: 'none', background: suggesting ? 'var(--bg-2)' : 'var(--gold)', color: suggesting ? 'var(--text-3)' : '#131110', borderRadius: '6px', cursor: suggesting ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {suggesting ? <><SpinIcon />Analyzing…</> : <>✦ {narrativeVisible ? 'Re-analyze' : 'Analyze Week'}</>}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {suggestError && (
        <div style={{ background: 'rgba(200,80,60,0.08)', border: '1px solid rgba(200,80,60,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#e07060', display: 'flex', gap: '8px' }}>
          <span>⚠ {suggestError}</span>
          <button onClick={() => setSuggestError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
        </div>
      )}

      {/* ── AI Intelligence Panel ── */}
      {narrativeVisible && narrative && (
        <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderLeft: '3px solid var(--gold)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--gold)', flexShrink: 0, fontSize: '13px' }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '5px' }}>Locus Week Intelligence</div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', margin: 0, lineHeight: 1.6 }}>{narrative}</p>
            </div>
            <button onClick={() => setNarrativeVisible(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
          </div>
        </div>
      )}

      {/* ── Calendar grid ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-0)' }}>

        {/* Day headers (sticky) */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-0)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {colDates.map((dateStr, col) => {
            const dow    = colToDow(col)
            const isTdy  = dateStr === today
            const load   = (timedByDate.get(dateStr)?.length ?? 0) + (allDayByDate.get(dateStr)?.length ?? 0)
            return (
              <div key={col} style={{ padding: '10px 8px 8px', textAlign: 'center', borderRight: col < 6 ? '1px solid var(--border)' : undefined, background: isTdy ? 'rgba(212,168,83,0.06)' : undefined }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: isTdy ? 'var(--gold)' : 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{DOW_SHORT[dow]}</div>
                <div style={{ fontSize: '22px', fontWeight: isTdy ? 700 : 400, color: isTdy ? 'var(--gold)' : 'var(--text-0)', lineHeight: 1.2 }}>
                  {new Date(dateStr + 'T12:00:00').getDate()}
                </div>
                {load > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '3px' }}>
                    {Array.from({ length: Math.min(load, 4) }, (_, i) => (
                      <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(96,160,200,0.55)' }} />
                    ))}
                    {load > 4 && <span style={{ fontSize: '8px', color: 'rgba(96,160,200,0.55)' }}>+</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* All-day strip */}
        {hasCalendar && weekOffset === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: '28px' }}>
            <div style={{ borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>All day</span>
            </div>
            {colDates.map((dateStr, col) => {
              const evs = allDayByDate.get(dateStr) ?? []
              return (
                <div key={col} style={{ padding: '3px 4px', display: 'flex', flexWrap: 'wrap', gap: '2px', borderRight: col < 6 ? '1px solid var(--border)' : undefined }}>
                  {evs.map(ev => (
                    <span key={ev.id} title={ev.title} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(96,160,200,0.18)', border: '1px solid rgba(96,160,200,0.3)', color: 'rgba(140,190,220,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {ev.title}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Rhythm strip — habits + plan blocks per day */}
        <RhythmStrip
          colDates={colDates}
          weekStart={weekStart}
          today={today}
          localHabits={localHabits}
          planBlocks={planBlocks}
          onRemoveHabit={handleRemoveHabitSlot}
          onRemoveBlock={handleRemoveBlock}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onCellClick={(dateStr, clientX, clientY) => {
            openPopup(dateStr, clientX, clientY, 8, 0)
            setPopupMode('habit')
          }}
        />

        {/* Time grid */}
        <div style={{ overflowY: 'auto', maxHeight: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', height: `${GRID_H}px`, position: 'relative' }}>

            {/* Time labels */}
            <div style={{ borderRight: '1px solid var(--border)', position: 'relative' }}>
              {Array.from({ length: HOURS }, (_, i) => (
                <div key={i} style={{ position: 'absolute', top: `${i * HOUR_PX - 8}px`, right: '8px', fontSize: '10px', color: 'var(--text-3)', userSelect: 'none', fontWeight: 500 }}>
                  {((START_HOUR + i) % 12) || 12}{START_HOUR + i < 12 ? 'am' : 'pm'}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {colDates.map((dateStr, col) => {
              const isToday    = dateStr === today
              const isPast     = dateStr < today
              const dayEvents  = timedByDate.get(dateStr) ?? []

              return (
                <div
                  key={col}
                  onClick={e => !isPast && handleGridClick(dateStr, e)}
                  style={{
                    position: 'relative',
                    borderRight: col < 6 ? '1px solid var(--border)' : undefined,
                    background: isToday ? 'rgba(212,168,83,0.03)' : undefined,
                    cursor: isPast ? 'default' : 'pointer',
                  }}
                >
                  {/* Hour lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} style={{ position: 'absolute', top: `${i * HOUR_PX}px`, left: 0, right: 0, borderTop: `1px solid var(--border)`, pointerEvents: 'none' }} />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} style={{ position: 'absolute', top: `${i * HOUR_PX + HOUR_PX / 2}px`, left: 0, right: 0, borderTop: `1px dashed rgba(255,255,255,0.04)`, pointerEvents: 'none' }} />
                  ))}

                  {/* Current time line */}
                  {showNowLine && isToday && (
                    <div style={{ position: 'absolute', top: `${nowY}px`, left: 0, right: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(220,80,60,0.9)', marginLeft: '-4px', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: '1.5px', background: 'rgba(220,80,60,0.5)' }} />
                    </div>
                  )}

                  {/* Calendar event blocks */}
                  {dayEvents.map(ev => {
                    const top    = eventTop(ev)
                    const height = eventHeight(ev)
                    const W = 100 / ev.laneCount
                    const L = ev.laneIdx * W
                    const startTime = new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    return (
                      <div
                        key={ev.id}
                        data-event="1"
                        title={`${ev.title}${ev.location ? `\n${ev.location}` : ''}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top:    `${top}px`,
                          height: `${Math.max(height, 20)}px`,
                          left:   `${L + 1}%`,
                          width:  `${W - 2}%`,
                          background: 'rgba(66,133,244,0.18)',
                          border: '1px solid rgba(66,133,244,0.45)',
                          borderLeft: '3px solid rgba(66,133,244,0.8)',
                          borderRadius: '4px',
                          padding: '2px 5px',
                          overflow: 'hidden',
                          zIndex: 2,
                          boxSizing: 'border-box',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ fontSize: '9.5px', color: 'rgba(130,180,255,0.9)', fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{startTime}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(200,225,255,0.95)', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: height < 36 ? 'nowrap' : 'normal' }}>{ev.title}</div>
                        {ev.location && height >= 48 && (
                          <div style={{ fontSize: '10px', color: 'rgba(160,200,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.location}</div>
                        )}
                      </div>
                    )
                  })}

                  {/* "Click to add" hint on hover */}
                  {!isPast && (
                    <div className="cal-add-hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '40%', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px' }}>+ Click to add</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Click-to-add popup ── */}
      {click && createPortal(
        <div
          id="cal-popup"
          style={{
            ...popupStyle(),
            background: 'var(--bg-1)',
            border: '1px solid var(--border-md)',
            borderRadius: '10px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            animation: 'fadeUp 0.15s var(--ease) both',
          }}
        >
          {/* Popup header */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-0)' }}>
                {new Date(click.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px' }}>{formatTime(click.hour, click.minute)}</div>
            </div>
            <button onClick={closePopup} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0 }}>×</button>
          </div>

          <div style={{ padding: '10px 14px 14px' }}>
            {/* Choose mode */}
            {popupMode === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <PopupOptionBtn icon="📅" label="New Calendar Event" onClick={() => setPopupMode('event')} />
                <PopupOptionBtn icon={SLOT_EMOJI[hourToSlot(click.hour)]} label={`Assign Habit to ${hourToSlot(click.hour)}`} onClick={() => setPopupMode('habit')} />
                <PopupOptionBtn icon="🎯" label="Add Goal Block" onClick={() => setPopupMode('goal')} />
                <PopupOptionBtn icon="📝" label="Custom Block" onClick={() => setPopupMode('custom')} />
              </div>
            )}

            {/* Event creation form */}
            {popupMode === 'event' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setPopupMode('choose')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>← Back</button>
                <input
                  autoFocus
                  placeholder="Event title"
                  value={evTitle}
                  onChange={e => setEvTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCalendarEvent() }}
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '3px' }}>Start</div>
                    <input type="time" value={evStart} onChange={e => setEvStart(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '3px' }}>End</div>
                    <input type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                {createErr && <div style={{ fontSize: '11px', color: '#e07060', lineHeight: 1.4 }}>{createErr}</div>}
                <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>Saves to your primary Google Calendar</div>
                <button
                  onClick={handleCreateCalendarEvent}
                  disabled={creating || !evTitle.trim()}
                  style={{ padding: '8px', border: 'none', background: (!evTitle.trim() || creating) ? 'var(--bg-2)' : 'var(--gold)', color: (!evTitle.trim() || creating) ? 'var(--text-3)' : '#131110', borderRadius: '6px', cursor: (!evTitle.trim() || creating) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  {creating ? 'Creating…' : 'Create Event'}
                </button>
              </div>
            )}

            {/* Habit picker */}
            {popupMode === 'habit' && (
              <div>
                <button onClick={() => setPopupMode('choose')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>← Back</button>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>
                  Assign a habit to <strong style={{ color: 'var(--text-0)' }}>{hourToSlot(click.hour)}</strong>:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                  {localHabits.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No habits yet — add some in Habits.</div>}
                  {localHabits.map(h => (
                    <button
                      key={h.id}
                      onClick={() => handleAddHabit(h)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-0)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <span style={{ fontSize: '16px' }}>{h.emoji}</span>
                      <span style={{ flex: 1 }}>{h.name}</span>
                      {h.time_of_day && <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{SLOT_EMOJI[h.time_of_day as Slot]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Goal block picker */}
            {popupMode === 'goal' && (
              <div>
                <button onClick={() => setPopupMode('choose')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>← Back</button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                  {goals.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No active goals.</div>}
                  {goals.map(g => (
                    <button
                      key={g.id}
                      onClick={() => handleAddGoalBlock(g)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-0)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom block */}
            {popupMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setPopupMode('choose')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>← Back</button>
                <input
                  autoFocus
                  placeholder="Block title…"
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomBlock() }}
                  style={inputStyle}
                />
                <button
                  onClick={handleAddCustomBlock}
                  disabled={!customText.trim()}
                  style={{ padding: '8px', border: 'none', background: customText.trim() ? 'var(--gold)' : 'var(--bg-2)', color: customText.trim() ? '#131110' : 'var(--text-3)', borderRadius: '6px', cursor: customText.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 600 }}
                >Add Block</button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin   { to { transform: rotate(360deg) } }
        .cal-day-col:hover .cal-add-hint { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-1)',
  color: 'var(--text-1)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
  background: 'var(--bg-0)', color: 'var(--text-0)', borderRadius: '6px',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}

// ── Rhythm strip ──────────────────────────────────────────────────────────────

type RhythmProps = {
  colDates: string[]
  weekStart: string
  today: string
  localHabits: HabitWithLogs[]
  planBlocks: WeeklyPlanBlock[]
  onRemoveHabit: (h: HabitWithLogs) => void
  onRemoveBlock: (b: WeeklyPlanBlock) => void
  onAccept: (b: WeeklyPlanBlock) => void
  onDismiss: (b: WeeklyPlanBlock) => void
  onCellClick: (dateStr: string, clientX: number, clientY: number) => void
}

function RhythmStrip({ colDates, weekStart, today, localHabits, planBlocks, onRemoveHabit, onRemoveBlock, onAccept, onDismiss, onCellClick }: RhythmProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Strip header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px 5px 6px', borderBottom: collapsed ? undefined : '1px solid var(--border)', gap: '6px' }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px', padding: '1px 4px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Rhythm</span>
        </button>
        <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>habits &amp; plans · click a day to add</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {colDates.map((dateStr, col) => {
            const dow = colToDow(col)
            const isToday = dateStr === today

            const dayHabits = localHabits.filter(h =>
              isHabitOnDay(h, dow) && h.time_of_day !== null && (!h.ends_at || dateStr <= h.ends_at)
            )
            const dayBlocks = planBlocks.filter(b =>
              b.day_of_week === dow && b.week_start === weekStart
            )
            const hasItems = dayHabits.length > 0 || dayBlocks.length > 0

            return (
              <div
                key={col}
                style={{ padding: '5px 4px', borderRight: col < 6 ? '1px solid var(--border)' : undefined, background: isToday ? 'rgba(212,168,83,0.03)' : undefined, minHeight: '44px', display: 'flex', flexDirection: 'column', gap: '3px' }}
              >
                {dayHabits.map(h => (
                  <RhythmChip
                    key={h.id}
                    label={`${h.emoji} ${h.name}`}
                    subLabel={h.time_of_day ? SLOT_EMOJI[h.time_of_day as Slot] : ''}
                    color="green"
                    onRemove={() => onRemoveHabit(h)}
                  />
                ))}
                {dayBlocks.map(b => (
                  <RhythmChip
                    key={b.id}
                    label={b.title}
                    subLabel={SLOT_EMOJI[b.time_slot as Slot]}
                    color={b.type === 'goal' ? 'gold' : 'blue'}
                    ghost={!b.accepted}
                    onRemove={b.accepted ? () => onRemoveBlock(b) : undefined}
                    onAccept={!b.accepted ? () => onAccept(b) : undefined}
                    onDismiss={!b.accepted ? () => onDismiss(b) : undefined}
                  />
                ))}
                {/* Add button */}
                <button
                  onClick={e => onCellClick(dateStr, e.clientX, e.clientY)}
                  style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: '4px', color: 'var(--text-3)', cursor: 'pointer', fontSize: '10px', padding: '1px 5px', lineHeight: 1.6, marginTop: hasItems ? '0' : 'auto' }}
                >+</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type RhythmChipProps = {
  label: string
  subLabel: string
  color: 'green' | 'gold' | 'blue'
  ghost?: boolean
  onRemove?: () => void
  onAccept?: () => void
  onDismiss?: () => void
}

function RhythmChip({ label, subLabel, color, ghost, onRemove, onAccept, onDismiss }: RhythmChipProps) {
  const [hovered, setHovered] = useState(false)
  const bg = color === 'green' ? 'rgba(122,158,138,0.18)' : color === 'gold' ? 'rgba(212,168,83,0.15)' : 'rgba(96,144,200,0.15)'
  const br = color === 'green' ? 'rgba(122,158,138,0.4)' : color === 'gold' ? 'rgba(212,168,83,0.4)' : 'rgba(96,144,200,0.35)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: bg, border: `1px ${ghost ? 'dashed' : 'solid'} ${br}`, borderRadius: '4px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: ghost ? 0.75 : 1, fontSize: '10px', minWidth: 0 }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)', fontWeight: 500 }}>{label}</span>
      <span style={{ flexShrink: 0, fontSize: '9px' }}>{subLabel}</span>
      {hovered && ghost && onAccept && onDismiss && (
        <>
          <button onClick={e => { e.stopPropagation(); onAccept() }} style={{ background: 'rgba(122,158,138,0.4)', border: 'none', borderRadius: '2px', color: 'var(--text-0)', cursor: 'pointer', fontSize: '9px', padding: '0 3px', lineHeight: '14px' }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDismiss() }} style={{ background: 'rgba(220,80,60,0.25)', border: 'none', borderRadius: '2px', color: 'var(--text-0)', cursor: 'pointer', fontSize: '10px', padding: '0 3px', lineHeight: '14px' }}>✕</button>
        </>
      )}
      {hovered && !ghost && onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
      )}
    </div>
  )
}

// ── Misc sub-components ────────────────────────────────────────────────────────

function PopupOptionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-0)', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontWeight: 500, transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function SpinIcon() {
  return <div style={{ width: '12px', height: '12px', border: '2px solid #131110', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
}
