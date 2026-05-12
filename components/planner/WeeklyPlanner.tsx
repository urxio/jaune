'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { HabitWithLogs, GoalWithSteps, WeeklyPlanBlock, CalendarEvent, LocusEvent } from '@/lib/types'
import { useToast } from '@/components/ui/ToastContext'
import {
  addPlanBlock,
  removePlanBlock,
  acceptSuggestion,
  dismissSuggestion,
  saveSuggestions,
} from '@/app/actions/planner'
import { setHabitTimeAction } from '@/app/actions/habits'
import { createLocusEventAction, deleteLocusEventAction } from '@/app/actions/locus-events'

// ── Grid constants ─────────────────────────────────────────────────────────────
const START_HOUR = 7
const END_HOUR   = 22
const HOURS      = END_HOUR - START_HOUR
const HOUR_PX    = 64
const GRID_H     = HOURS * HOUR_PX

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getWeekStart(offset: number): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  return d.toISOString().split('T')[0]
}

function colToDow(col: number): number { return col === 6 ? 0 : col + 1 }

function isHabitOnDay(h: HabitWithLogs, dow: number): boolean {
  if (!h.days_of_week || h.days_of_week.length === 0) return true
  return h.days_of_week.includes(dow)
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function minuteToY(totalMinutes: number): number {
  return (totalMinutes - START_HOUR * 60) * (HOUR_PX / 60)
}

function yToSnappedTime(y: number): { hour: number; minute: number } {
  const total   = START_HOUR * 60 + Math.round((y / HOUR_PX) * 60 / 15) * 15
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - 15, total))
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 }
}

function eventTop(ev: CalendarEvent): number {
  const d = new Date(ev.start)
  const startMin = d.getHours() * 60 + d.getMinutes()
  // Clamp to grid start — events beginning before 7am show from the top
  return minuteToY(Math.max(startMin, START_HOUR * 60))
}

function eventHeight(ev: CalendarEvent): number {
  const start = new Date(ev.start)
  const end   = new Date(ev.end)
  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin   = end.getHours()   * 60 + end.getMinutes()
  // Clamp both ends to the visible grid window
  const visibleStart = Math.max(startMin, START_HOUR * 60)
  const visibleEnd   = Math.min(endMin,   END_HOUR   * 60)
  const visibleMin   = Math.max(15, visibleEnd - visibleStart)
  return visibleMin * (HOUR_PX / 60)
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${pad2(m)} ${ampm}`
}

function formatHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return formatTime(h, m)
}

function localISO(dateStr: string, h: number, m: number): string {
  const d   = new Date(`${dateStr}T${pad2(h)}:${pad2(m)}:00`)
  const off = -d.getTimezoneOffset()
  const s   = off >= 0 ? '+' : '-'
  const ah  = Math.floor(Math.abs(off) / 60)
  const am  = Math.abs(off) % 60
  return `${dateStr}T${pad2(h)}:${pad2(m)}:00${s}${pad2(ah)}:${pad2(am)}`
}

function locusToCalEvent(ev: LocusEvent): CalendarEvent {
  return {
    id:           ev.id,
    title:        ev.title,
    start:        ev.is_all_day ? ev.start_datetime.slice(0, 10) : ev.start_datetime,
    end:          ev.is_all_day ? ev.end_datetime.slice(0, 10)   : ev.end_datetime,
    isAllDay:     ev.is_all_day,
    calendarName: 'Locus',
    location:     ev.location,
    description:  ev.description,
    source:       'locus',
  }
}

// ── Overlap layout ─────────────────────────────────────────────────────────────

type LayoutEvent = CalendarEvent & { laneIdx: number; laneCount: number }

function layoutDayEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (!events.length) return []
  const sorted   = [...events].sort((a, b) => a.start.localeCompare(b.start))
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

// ── Types ──────────────────────────────────────────────────────────────────────

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A habit's effective presence on a specific calendar date. */
type HabitOnDay = {
  habit: HabitWithLogs
  /** Resolved time for this date: override > habit.time_of_day > null */
  effectiveTime: string | null
  /** True if this date has an explicit override row (even if null). */
  hasOverride: boolean
}

type ClickPoint = {
  dateStr: string
  hour: number
  minute: number
  clientX: number
  clientY: number
}

type PopupMode = 'choose' | 'event' | 'habit' | 'goal' | 'custom'
type EventSource = 'locus' | 'google'

type SuggestedRawBlock = {
  day_of_week: number
  time_slot: string
  title: string
  type: 'goal' | 'custom'
  reference_id: string | null
  reason: string
}

type HabitMenuState = {
  habit: HabitWithLogs
  dateStr: string
  clientX: number
  clientY: number
  currentTime: string | null
}

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  habits: HabitWithLogs[]
  goals: GoalWithSteps[]
  initialPlan: WeeklyPlanBlock[]
  weekStart: string
  today: string
  calendarEvents?: CalendarEvent[]
  locusEvents?: LocusEvent[]
  habitOverrides?: Record<string, string | null>
  hasGoogleCalendar?: boolean
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WeeklyPlanner({
  habits,
  goals,
  initialPlan,
  weekStart: initialWeekStart,
  today,
  calendarEvents    = [],
  locusEvents       = [],
  habitOverrides    = {},
  hasGoogleCalendar = false,
}: Props) {
  const toast = useToast()

  // ── Core state ──
  const [planBlocks,   setPlanBlocks]   = useState<WeeklyPlanBlock[]>(initialPlan)
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [weekStart,    setWeekStart]    = useState(initialWeekStart)
  const [localHabits,  setLocalHabits]  = useState<HabitWithLogs[]>(habits)
  const [localOverrides, setLocalOverrides] = useState<Record<string, string | null>>(habitOverrides)
  const [suggesting,   setSuggesting]   = useState(false)
  const [narrative,    setNarrative]    = useState('')
  const [narrativeVisible, setNarrativeVisible] = useState(false)
  const [suggestError, setSuggestError] = useState('')

  // ── Calendar state ──
  const [localGCalEvents,  setLocalGCalEvents]  = useState<CalendarEvent[]>(calendarEvents)
  const [localLocusEvents, setLocalLocusEvents] = useState<LocusEvent[]>(locusEvents)

  // ── Click popup state ──
  const [click,       setClick]       = useState<ClickPoint | null>(null)
  const [popupMode,   setPopupMode]   = useState<PopupMode>('choose')
  const [evTitle,     setEvTitle]     = useState('')
  const [evStart,     setEvStart]     = useState('')
  const [evEnd,       setEvEnd]       = useState('')
  const [evSource,    setEvSource]    = useState<EventSource>('locus')
  const [creating,    setCreating]    = useState(false)
  const [createErr,   setCreateErr]   = useState('')
  const [customText,  setCustomText]  = useState('')

  // ── Habit right-click / time-edit state ──
  const [habitMenu,     setHabitMenu]     = useState<HabitMenuState | null>(null)
  const [habitTimeEdit, setHabitTimeEdit] = useState<{ habit: HabitWithLogs; dateStr: string } | null>(null)
  const [editTime,      setEditTime]      = useState('')
  const [editScope,     setEditScope]     = useState<'this' | 'all'>('all')
  const [savingTime,    setSavingTime]    = useState(false)

  // ── Current time ──
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setLocalHabits(habits) }, [habits])
  useEffect(() => { setLocalGCalEvents(calendarEvents) }, [calendarEvents])
  useEffect(() => { setLocalLocusEvents(locusEvents) }, [locusEvents])
  useEffect(() => { setLocalOverrides(habitOverrides) }, [habitOverrides])

  // When week changes: fetch plan blocks + locus events + overrides for that week
  useEffect(() => {
    const ws = getWeekStart(weekOffset)
    setWeekStart(ws)
    const we = addDays(ws, 6)
    Promise.all([
      fetch(`/api/planner/week?weekStart=${ws}`).then(r => r.json()),
      fetch(`/api/locus/events?start=${ws}&end=${we}`).then(r => r.json()),
    ]).then(([plan, locus]) => {
      setPlanBlocks(plan as WeeklyPlanBlock[])
      setLocalLocusEvents((locus as { events: LocusEvent[] }).events ?? [])
      setLocalOverrides((locus as { habitOverrides: Record<string, string | null> }).habitOverrides ?? {})
    }).catch(() => toast.error('Failed to load plan'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  // Close popups on outside click
  useEffect(() => {
    if (!click && !habitMenu) return
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('cal-popup')
      const menu  = document.getElementById('habit-ctx-menu')
      if (popup && !popup.contains(e.target as Node)) closePopup()
      if (menu  && !menu.contains(e.target as Node))  setHabitMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [click, habitMenu])

  // ── Memos ──────────────────────────────────────────────────────────────────

  const colDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const weekEnd = colDates[6]

  const allCalEvents = useMemo<CalendarEvent[]>(() => [
    ...localLocusEvents.map(locusToCalEvent),
    ...localGCalEvents.map(ev => ({ ...ev, source: 'google' as const })),
  ], [localLocusEvents, localGCalEvents])

  const allDayByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of allCalEvents) {
      if (!ev.isAllDay) continue
      const d = ev.start.slice(0, 10)
      if (d < colDates[0] || d > weekEnd) continue
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(ev)
    }
    return m
  }, [allCalEvents, colDates, weekEnd])

  const timedByDate = useMemo(() => {
    const m = new Map<string, LayoutEvent[]>()
    for (const col of colDates) {
      const evs = allCalEvents.filter(ev => !ev.isAllDay && ev.start.slice(0, 10) === col)
      m.set(col, layoutDayEvents(evs))
    }
    return m
  }, [allCalEvents, colDates])

  /**
   * All habits scheduled for each day, with their effective time resolved.
   * effectiveTime = override[habitId_date] ?? habit.time_of_day ?? null
   */
  const habitsByDate = useMemo(() => {
    const m = new Map<string, HabitOnDay[]>()
    for (const col of colDates) {
      const dow = new Date(col + 'T12:00:00').getDay()
      const scheduled = localHabits.filter(h =>
        isHabitOnDay(h, dow) && (!h.ends_at || col <= h.ends_at)
      )
      m.set(col, scheduled.map(habit => {
        const key = `${habit.id}_${col}`
        const hasOverride = key in localOverrides
        const effectiveTime = hasOverride ? localOverrides[key] : habit.time_of_day
        return { habit, effectiveTime: effectiveTime ?? null, hasOverride }
      }))
    }
    return m
  }, [localHabits, colDates, localOverrides])

  const loadByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const ev of allCalEvents) {
      const d = ev.start.slice(0, 10)
      if (d < colDates[0] || d > weekEnd) continue
      m.set(d, (m.get(d) ?? 0) + 1)
    }
    for (const [d, hs] of habitsByDate) {
      m.set(d, (m.get(d) ?? 0) + hs.length)
    }
    return m
  }, [allCalEvents, habitsByDate, colDates, weekEnd])

  // ── Handlers: popup ─────────────────────────────────────────────────────────

  function openPopup(dateStr: string, cx: number, cy: number, hour: number, minute: number) {
    const endH = Math.min(hour + 1, END_HOUR - 1)
    setClick({ dateStr, hour, minute, clientX: cx, clientY: cy })
    setPopupMode('choose')
    setEvTitle('')
    setEvStart(`${pad2(hour)}:${pad2(minute)}`)
    setEvEnd(`${pad2(endH)}:${pad2(minute)}`)
    setEvSource('locus')
    setCreateErr('')
    setCustomText('')
    setHabitMenu(null)
  }

  function closePopup() { setClick(null); setPopupMode('choose') }

  function handleGridClick(dateStr: string, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-event]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { hour, minute } = yToSnappedTime(e.clientY - rect.top)
    openPopup(dateStr, e.clientX, e.clientY, hour, minute)
  }

  async function handleCreateEvent() {
    if (!click || !evTitle.trim()) return
    setCreating(true); setCreateErr('')
    try {
      const [sh, sm] = evStart.split(':').map(Number)
      const [eh, em] = evEnd.split(':').map(Number)
      const startISO = localISO(click.dateStr, sh, sm)
      const endISO   = localISO(click.dateStr, eh, em)

      if (evSource === 'google') {
        const res  = await fetch('/api/calendar/events', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: evTitle.trim(), startDateTime: startISO, endDateTime: endISO }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 412) { setCreateErr('Connect Google Calendar in Settings first.'); return }
          if (res.status === 403) { setCreateErr('Reconnect Google Calendar in Settings to enable event creation.'); return }
          setCreateErr(data.error ?? 'Failed to create event'); return
        }
        const opt: CalendarEvent = {
          id: data.eventId ?? `gcal-opt-${Date.now()}`,
          title: evTitle.trim(), start: startISO, end: endISO,
          isAllDay: false, calendarName: 'Google Calendar',
          location: null, description: null, source: 'google',
        }
        setLocalGCalEvents(prev => [...prev, opt])
      } else {
        const saved = await createLocusEventAction({
          title: evTitle.trim(), startDatetime: startISO, endDatetime: endISO,
        })
        setLocalLocusEvents(prev => [...prev, saved])
      }

      toast.success(`Event created${evSource === 'google' ? ' in Google Calendar' : ' in Locus'}`)
      closePopup()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setCreating(false) }
  }

  async function handleDeleteLocusEvent(id: string) {
    setLocalLocusEvents(prev => prev.filter(e => e.id !== id))
    try { await deleteLocusEventAction(id) }
    catch { toast.error('Failed to delete event') }
  }

  // Schedules a habit at clicked time for ALL occurrences (from click popup)
  async function handleAddHabit(habit: HabitWithLogs) {
    if (!click) return
    const timeStr = `${pad2(click.hour)}:${pad2(click.minute)}`
    const prevTime = habit.time_of_day
    setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: timeStr } : h))
    // Clear overrides since the habit-level time now governs
    setLocalOverrides(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) { if (key.startsWith(habit.id + '_')) delete next[key] }
      return next
    })
    closePopup()
    try {
      await setHabitTimeAction(habit.id, click.dateStr, timeStr, 'all')
      toast.success(`${habit.emoji} ${habit.name} scheduled at ${timeStr}`)
    } catch {
      toast.error('Failed to schedule habit')
      setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: prevTime } : h))
    }
  }

  // ── Handlers: habit right-click / time edit ─────────────────────────────────

  function handleHabitContextMenu(
    e: React.MouseEvent,
    habit: HabitWithLogs,
    dateStr: string,
    currentTime: string | null,
  ) {
    e.preventDefault()
    e.stopPropagation()
    setHabitMenu({ habit, dateStr, clientX: e.clientX, clientY: e.clientY, currentTime })
    setClick(null)
  }

  function openHabitTimeEdit(habit: HabitWithLogs, dateStr: string, currentTime: string | null) {
    setEditTime(currentTime ?? '')
    setEditScope('all')
    setHabitTimeEdit({ habit, dateStr })
    setHabitMenu(null)
  }

  async function handleSaveHabitTime() {
    if (!habitTimeEdit) return
    setSavingTime(true)
    const { habit, dateStr } = habitTimeEdit
    const newTime = editTime || null
    // Snapshot for rollback
    const prevHabits    = localHabits
    const prevOverrides = localOverrides

    try {
      if (editScope === 'all') {
        setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: newTime } : h))
        setLocalOverrides(prev => {
          const next = { ...prev }
          for (const key of Object.keys(next)) { if (key.startsWith(habit.id + '_')) delete next[key] }
          return next
        })
      } else {
        setLocalOverrides(prev => ({ ...prev, [`${habit.id}_${dateStr}`]: newTime }))
      }

      await setHabitTimeAction(habit.id, dateStr, newTime, editScope)
      toast.success(
        editScope === 'all'
          ? `${habit.emoji} ${habit.name} — time updated for all occurrences`
          : `${habit.emoji} ${habit.name} — updated for ${fmtDate(dateStr)} only`,
      )
      setHabitTimeEdit(null)
    } catch {
      toast.error('Failed to update habit time')
      setLocalHabits(prevHabits)
      setLocalOverrides(prevOverrides)
    } finally { setSavingTime(false) }
  }

  async function handleClearHabitTime(habit: HabitWithLogs, dateStr: string, scope: 'this' | 'all') {
    const prevHabits    = localHabits
    const prevOverrides = localOverrides
    setHabitMenu(null)

    if (scope === 'all') {
      setLocalHabits(hs => hs.map(h => h.id === habit.id ? { ...h, time_of_day: null } : h))
      setLocalOverrides(prev => {
        const next = { ...prev }
        for (const key of Object.keys(next)) { if (key.startsWith(habit.id + '_')) delete next[key] }
        return next
      })
    } else {
      setLocalOverrides(prev => ({ ...prev, [`${habit.id}_${dateStr}`]: null }))
    }

    try {
      await setHabitTimeAction(habit.id, dateStr, null, scope)
    } catch {
      toast.error('Failed to clear habit time')
      setLocalHabits(prevHabits)
      setLocalOverrides(prevOverrides)
    }
  }

  // ── Handlers: plan blocks ───────────────────────────────────────────────────

  async function handleAddGoalBlock(goal: GoalWithSteps) {
    if (!click) return
    const slot = click.hour < 12 ? 'morning' : click.hour < 18 ? 'afternoon' : 'evening'
    const dow  = new Date(click.dateStr + 'T12:00:00').getDay()
    const optimistic: WeeklyPlanBlock = {
      id: `opt-${Date.now()}`, user_id: '', week_start: weekStart,
      day_of_week: dow, time_slot: slot as 'morning' | 'afternoon' | 'evening',
      title: goal.title, type: 'goal', reference_id: goal.id,
      accepted: true, position: 0, created_at: new Date().toISOString(),
    }
    setPlanBlocks(prev => [...prev, optimistic])
    closePopup()
    try {
      const saved = await addPlanBlock(weekStart, dow, slot, goal.title, 'goal', goal.id)
      setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
    } catch { toast.error('Failed to add goal block'); setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id)) }
  }

  async function handleAddCustomBlock() {
    if (!click || !customText.trim()) return
    const slot  = click.hour < 12 ? 'morning' : click.hour < 18 ? 'afternoon' : 'evening'
    const dow   = new Date(click.dateStr + 'T12:00:00').getDay()
    const title = customText.trim()
    const optimistic: WeeklyPlanBlock = {
      id: `opt-${Date.now()}`, user_id: '', week_start: weekStart,
      day_of_week: dow, time_slot: slot as 'morning' | 'afternoon' | 'evening',
      title, type: 'custom', reference_id: null,
      accepted: true, position: 0, created_at: new Date().toISOString(),
    }
    setPlanBlocks(prev => [...prev, optimistic])
    closePopup()
    try {
      const saved = await addPlanBlock(weekStart, dow, slot, title, 'custom')
      setPlanBlocks(prev => prev.map(b => b.id === optimistic.id ? saved : b))
    } catch { toast.error('Failed to add block'); setPlanBlocks(prev => prev.filter(b => b.id !== optimistic.id)) }
  }

  async function handleRemoveBlock(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try { await removePlanBlock(block.id) }
    catch { toast.error('Failed to remove block'); setPlanBlocks(prev => [...prev, block]) }
  }

  async function handleAccept(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: true } : b))
    try { await acceptSuggestion(block.id) }
    catch { setPlanBlocks(prev => prev.map(b => b.id === block.id ? { ...b, accepted: false } : b)) }
  }

  async function handleDismiss(block: WeeklyPlanBlock) {
    setPlanBlocks(prev => prev.filter(b => b.id !== block.id))
    try { await dismissSuggestion(block.id) }
    catch { setPlanBlocks(prev => [...prev, block]) }
  }

  async function handleAISuggest() {
    setSuggesting(true); setSuggestError('')
    try {
      const res = await fetch('/api/planner/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, calendarEvents: allCalEvents }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail ?? b.error ?? `Request failed (${res.status})`)
      }
      const { blocks, narrative: nav } = await res.json() as { blocks: SuggestedRawBlock[]; narrative: string; summary: string }
      const VALID = new Set(['morning', 'afternoon', 'evening'])
      const clean = blocks
        .filter(b => typeof b.title === 'string' && b.title.trim() && VALID.has(b.time_slot) && typeof b.day_of_week === 'number' && b.day_of_week >= 0 && b.day_of_week <= 6)
        .map(b => ({ weekStart, dayOfWeek: b.day_of_week, timeSlot: b.time_slot, title: b.title.trim(), type: (b.type === 'goal' ? 'goal' : 'custom') as 'goal' | 'custom', referenceId: b.type === 'goal' && b.reference_id ? b.reference_id : undefined }))
      if (!clean.length) throw new Error('No valid suggestions returned')
      const saved = await saveSuggestions(clean)
      setPlanBlocks(prev => [...prev, ...saved])
      if (nav) { setNarrative(nav); setNarrativeVisible(true) }
    } catch (err) {
      toast.error('AI suggestions failed — try again')
      setSuggestError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSuggesting(false) }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const weekEnd2  = addDays(weekStart, 6)
  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd2)}`
  const nowY      = minuteToY(nowMinutes)
  const showNow   = weekOffset === 0 && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60

  function popupStyle(): React.CSSProperties {
    if (!click) return {}
    const W  = 240
    const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const H  = popupMode === 'event' ? 260 : popupMode === 'habit' ? 280 : popupMode === 'goal' ? 240 : popupMode === 'custom' ? 130 : 196
    return {
      position: 'fixed',
      top:  Math.max(8, Math.min(vh - H - 8, click.clientY + 8)),
      left: Math.max(8, Math.min(vw - W - 8, click.clientX - W / 2)),
      width: `${W}px`, zIndex: 9000,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--text-0)', margin: 0 }}>Weekly Rhythm</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{weekLabel}</span>
            {hasGoogleCalendar && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'rgba(96,160,200,0.12)', border: '1px solid rgba(96,160,200,0.3)', color: 'rgba(140,190,220,0.9)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>📅 GCal synced</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={navBtn}>← Prev</button>
          <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, ...(weekOffset === 0 && { background: 'var(--gold-dim)', color: 'var(--gold)', fontWeight: 600 }) }}>This Week</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={navBtn}>Next →</button>
          <button onClick={handleAISuggest} disabled={suggesting} style={{ padding: '6px 14px', border: 'none', background: suggesting ? 'var(--bg-2)' : 'var(--gold)', color: suggesting ? 'var(--text-3)' : '#131110', borderRadius: '6px', cursor: suggesting ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {suggesting ? <><SpinIcon />Analyzing…</> : <>✦ {narrativeVisible ? 'Re-analyze' : 'Analyze Week'}</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {suggestError && (
        <div style={{ background: 'rgba(200,80,60,0.08)', border: '1px solid rgba(200,80,60,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#e07060', display: 'flex', gap: '8px' }}>
          <span>⚠ {suggestError}</span>
          <button onClick={() => setSuggestError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
        </div>
      )}

      {/* AI narrative */}
      {narrativeVisible && narrative && (
        <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderLeft: '3px solid var(--gold)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--gold)', fontSize: '13px', flexShrink: 0 }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '5px' }}>Locus Week Intelligence</div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', margin: 0, lineHeight: 1.6 }}>{narrative}</p>
            </div>
            <button onClick={() => setNarrativeVisible(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <LegendDot color="rgba(212,168,83,0.7)" label="Event" />
        {hasGoogleCalendar && <LegendDot color="rgba(66,133,244,0.7)" label="Google Cal" />}
        <LegendDot color="rgba(100,160,130,0.7)" label="Habit" />
        <span style={{ fontSize: '11px', color: 'var(--text-3)', marginLeft: 'auto', opacity: 0.7 }}>Click grid to add · right-click habit to edit time</span>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-0)' }}>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-0)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {colDates.map((dateStr, col) => {
            const dow   = colToDow(col)
            const isTdy = dateStr === today
            const load  = loadByDate.get(dateStr) ?? 0
            return (
              <div key={col} style={{ padding: '10px 8px 8px', textAlign: 'center', borderRight: col < 6 ? '1px solid var(--border)' : undefined, background: isTdy ? 'rgba(212,168,83,0.06)' : undefined }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: isTdy ? 'var(--gold)' : 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{DOW_SHORT[dow]}</div>
                <div style={{ fontSize: '22px', fontWeight: isTdy ? 700 : 400, color: isTdy ? 'var(--gold)' : 'var(--text-0)', lineHeight: 1.2 }}>
                  {new Date(dateStr + 'T12:00:00').getDate()}
                </div>
                {load > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '3px' }}>
                    {Array.from({ length: Math.min(load, 5) }, (_, i) => (
                      <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(96,160,200,0.5)' }} />
                    ))}
                    {load > 5 && <span style={{ fontSize: '8px', color: 'rgba(96,160,200,0.5)' }}>+</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* All-day strip */}
        {allCalEvents.some(e => e.isAllDay) && (
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: '26px' }}>
            <div style={{ borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>All day</span>
            </div>
            {colDates.map((dateStr, col) => {
              const evs = allDayByDate.get(dateStr) ?? []
              return (
                <div key={col} style={{ padding: '3px 4px', display: 'flex', flexWrap: 'wrap', gap: '2px', borderRight: col < 6 ? '1px solid var(--border)' : undefined }}>
                  {evs.map(ev => (
                    <AllDayChip key={ev.id} event={ev} onDelete={ev.source === 'locus' ? () => handleDeleteLocusEvent(ev.id) : undefined} />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Habits strip — habits with no scheduled time for that day */}
        <HabitsStrip
          colDates={colDates}
          today={today}
          habitsByDate={habitsByDate}
          onContextMenu={handleHabitContextMenu}
        />

        {/* Plan blocks strip */}
        <PlanStrip
          colDates={colDates}
          weekStart={weekStart}
          today={today}
          planBlocks={planBlocks}
          onRemove={handleRemoveBlock}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onAddClick={(dateStr, cx, cy) => openPopup(dateStr, cx, cy, 9, 0)}
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
              const isToday   = dateStr === today
              const isPast    = dateStr < today
              const dayEvents = timedByDate.get(dateStr) ?? []
              // Only habits WITH an effective time go into the time grid
              const timedHabits = (habitsByDate.get(dateStr) ?? []).filter(h => h.effectiveTime !== null)

              return (
                <div
                  key={col}
                  onClick={e => !isPast && handleGridClick(dateStr, e)}
                  style={{
                    position: 'relative',
                    borderRight: col < 6 ? '1px solid var(--border)' : undefined,
                    background: isToday ? 'rgba(212,168,83,0.025)' : undefined,
                    cursor: isPast ? 'default' : 'pointer',
                  }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} style={{ position: 'absolute', top: `${i * HOUR_PX}px`, left: 0, right: 0, borderTop: '1px solid var(--border)', pointerEvents: 'none' }} />
                  ))}
                  {/* Half-hour dashes */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} style={{ position: 'absolute', top: `${i * HOUR_PX + HOUR_PX / 2}px`, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.035)', pointerEvents: 'none' }} />
                  ))}

                  {/* Current time line */}
                  {showNow && isToday && (
                    <div style={{ position: 'absolute', top: `${nowY}px`, left: 0, right: 0, zIndex: 6, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(220,70,50,0.9)', marginLeft: '-4px', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: '1.5px', background: 'rgba(220,70,50,0.45)' }} />
                    </div>
                  )}

                  {/* Timed habit blocks */}
                  {timedHabits.map(({ habit, effectiveTime }, i) => {
                    const [hh, mm] = (effectiveTime ?? '08:00').split(':').map(Number)
                    const top = Math.max(0, minuteToY(hh * 60 + mm))
                    return (
                      <HabitBlock
                        key={habit.id}
                        habit={habit}
                        top={top + i * 2}
                        effectiveTime={effectiveTime!}
                        onContextMenu={e => handleHabitContextMenu(e, habit, dateStr, effectiveTime)}
                      />
                    )
                  })}

                  {/* Calendar / Locus event blocks */}
                  {dayEvents.map(ev => {
                    const top    = eventTop(ev)
                    const height = eventHeight(ev)
                    const W = 100 / ev.laneCount
                    const L = ev.laneIdx * W
                    const isLocus = ev.source === 'locus'
                    const startTime = new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    return (
                      <EventBlock
                        key={ev.id}
                        ev={ev}
                        top={top}
                        height={Math.max(height, 20)}
                        left={`${L + 1}%`}
                        width={`${W - 2}%`}
                        startTime={startTime}
                        isLocus={isLocus}
                        onDelete={isLocus ? () => handleDeleteLocusEvent(ev.id) : undefined}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Click popup ────────────────────────────────────────────────────────── */}
      {click && createPortal(
        <div
          id="cal-popup"
          style={{
            ...popupStyle(),
            background: '#1c1a17',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
            overflow: 'hidden',
            animation: 'fadeUp 0.12s ease both',
          }}
        >
          {/* Compact header */}
          <div style={{ padding: '9px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {popupMode !== 'choose' && (
                <button onClick={() => setPopupMode('choose')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px', padding: '0 4px 0 0', lineHeight: 1 }}>‹</button>
              )}
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                {DOW_SHORT[new Date(click.dateStr + 'T12:00:00').getDay()]}, {new Date(click.dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{formatTime(click.hour, click.minute)}</span>
            </div>
            <button onClick={closePopup} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
          </div>

          {/* Body */}
          {popupMode === 'choose' && (
            <div style={{ padding: '4px' }}>
              <PopupRow icon="✦" label="New Event" hint={hasGoogleCalendar ? 'Locus or Google Cal' : 'Locus calendar'} onClick={() => setPopupMode('event')} />
              <PopupRow icon="⊕" label="Schedule Habit" hint={formatTime(click.hour, click.minute)} onClick={() => setPopupMode('habit')} />
              <PopupRow icon="◎" label="Goal Block" hint="Work session" onClick={() => setPopupMode('goal')} />
              <PopupRow icon="—" label="Custom Block" hint="Freeform" onClick={() => setPopupMode('custom')} />
            </div>
          )}

          {popupMode === 'event' && (
            <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input autoFocus placeholder="Event title" value={evTitle} onChange={e => setEvTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateEvent()} style={popupInput} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="time" value={evStart} onChange={e => setEvStart(e.target.value)} style={{ ...popupInput, flex: 1, colorScheme: 'dark' }} />
                <span style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>→</span>
                <input type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} style={{ ...popupInput, flex: 1, colorScheme: 'dark' }} />
              </div>
              {hasGoogleCalendar && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  {(['locus', 'google'] as EventSource[]).map(src => (
                    <button key={src} onClick={() => setEvSource(src)} style={{ flex: 1, padding: '5px 8px', border: `1px solid ${evSource === src ? (src === 'locus' ? 'rgba(212,168,83,0.5)' : 'rgba(66,133,244,0.4)') : 'rgba(255,255,255,0.08)'}`, background: evSource === src ? (src === 'locus' ? 'rgba(212,168,83,0.12)' : 'rgba(66,133,244,0.12)') : 'transparent', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: evSource === src ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                      {src === 'locus' ? '✦ Locus' : '📅 Google'}
                    </button>
                  ))}
                </div>
              )}
              {createErr && <div style={{ fontSize: '11px', color: '#e07060' }}>{createErr}</div>}
              <button onClick={handleCreateEvent} disabled={creating || !evTitle.trim()} style={{ padding: '8px', border: 'none', background: (!evTitle.trim() || creating) ? 'rgba(255,255,255,0.07)' : 'var(--gold)', color: (!evTitle.trim() || creating) ? 'rgba(255,255,255,0.3)' : '#131110', borderRadius: '7px', cursor: (!evTitle.trim() || creating) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {creating ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          )}

          {popupMode === 'habit' && (
            <div style={{ padding: '6px 4px 4px' }}>
              <div style={{ padding: '0 10px 6px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                Schedule at {formatTime(click.hour, click.minute)}
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {localHabits.length === 0 && <div style={{ padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>No habits yet.</div>}
                {localHabits.map(h => (
                  <button key={h.id} onClick={() => handleAddHabit(h)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontSize: '15px', flexShrink: 0 }}>{h.emoji}</span>
                    <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{h.name}</span>
                    {h.time_of_day && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{h.time_of_day}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {popupMode === 'goal' && (
            <div style={{ padding: '6px 4px 4px' }}>
              <div style={{ padding: '0 10px 6px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Add a goal work session</div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {goals.length === 0 && <div style={{ padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>No active goals.</div>}
                {goals.map(g => (
                  <button key={g.id} onClick={() => handleAddGoalBlock(g)}
                    style={{ display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >{g.title}</button>
                ))}
              </div>
            </div>
          )}

          {popupMode === 'custom' && (
            <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input autoFocus placeholder="Block title…" value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomBlock()} style={popupInput} />
              <button onClick={handleAddCustomBlock} disabled={!customText.trim()} style={{ padding: '8px', border: 'none', background: customText.trim() ? 'var(--gold)' : 'rgba(255,255,255,0.07)', color: customText.trim() ? '#131110' : 'rgba(255,255,255,0.3)', borderRadius: '7px', cursor: customText.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 600 }}>
                Add Block
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* ── Habit right-click context menu ─────────────────────────────────────── */}
      {habitMenu && createPortal(
        <div
          id="habit-ctx-menu"
          style={{
            position: 'fixed',
            top:  Math.min(habitMenu.clientY, (typeof window !== 'undefined' ? window.innerHeight : 800) - 160),
            left: Math.min(habitMenu.clientX, (typeof window !== 'undefined' ? window.innerWidth  : 1200) - 200),
            width: '192px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border-md)',
            borderRadius: '8px',
            boxShadow: '0 6px 30px rgba(0,0,0,0.5)',
            zIndex: 9100,
            overflow: 'hidden',
            animation: 'fadeUp 0.12s var(--ease) both',
          }}
        >
          {/* Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>{habitMenu.habit.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habitMenu.habit.name}</span>
          </div>
          <div style={{ padding: '4px' }}>
            <CtxItem
              icon="⏰"
              label="Edit time…"
              onClick={() => openHabitTimeEdit(habitMenu.habit, habitMenu.dateStr, habitMenu.currentTime)}
            />
            {habitMenu.currentTime && (
              <CtxItem
                icon="✕"
                label="Remove time (this day)"
                onClick={() => handleClearHabitTime(habitMenu.habit, habitMenu.dateStr, 'this')}
                danger
              />
            )}
            {(habitMenu.habit.time_of_day || habitMenu.currentTime) && (
              <CtxItem
                icon="✕"
                label="Remove time (all days)"
                onClick={() => handleClearHabitTime(habitMenu.habit, habitMenu.dateStr, 'all')}
                danger
              />
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Habit time-edit dialog ───────────────────────────────────────────── */}
      {habitTimeEdit && createPortal(
        <div
          onClick={e => e.target === e.currentTarget && setHabitTimeEdit(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
        >
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-md)', borderRadius: '12px', padding: '24px', width: '300px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', animation: 'fadeUp 0.15s var(--ease) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '20px' }}>{habitTimeEdit.habit.emoji}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>{habitTimeEdit.habit.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtDate(habitTimeEdit.dateStr)}</div>
              </div>
            </div>

            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Scheduled time</label>
            <input
              autoFocus
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              style={{ ...iStyle, marginBottom: '16px', colorScheme: 'dark' }}
            />

            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Apply to</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
              {(['this', 'all'] as const).map(scope => (
                <label key={scope} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${editScope === scope ? 'rgba(212,168,83,0.4)' : 'var(--border)'}`, background: editScope === scope ? 'rgba(212,168,83,0.07)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="edit-scope"
                    value={scope}
                    checked={editScope === scope}
                    onChange={() => setEditScope(scope)}
                    style={{ marginTop: '2px', accentColor: 'var(--gold)', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-0)' }}>
                      {scope === 'this' ? `This day only` : 'All occurrences'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>
                      {scope === 'this'
                        ? `Only ${fmtDate(habitTimeEdit.dateStr)} gets this time`
                        : 'Updates the habit default — affects every day'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setHabitTimeEdit(null)} style={{ flex: 1, padding: '9px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSaveHabitTime} disabled={savingTime} style={{ flex: 2, padding: '9px', border: 'none', background: savingTime ? 'var(--bg-2)' : 'var(--gold)', color: savingTime ? 'var(--text-3)' : '#131110', borderRadius: '7px', cursor: savingTime ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
                {savingTime ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin   { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-1)',
  color: 'var(--text-1)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
  background: 'var(--bg-0)', color: 'var(--text-0)', borderRadius: '6px',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
}

const popupInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.9)',
  borderRadius: '7px', fontSize: '12px',
  outline: 'none', boxSizing: 'border-box',
  colorScheme: 'dark',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Micro-components ───────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{label}</span>
    </div>
  )
}

function SpinIcon() {
  return <div style={{ width: '12px', height: '12px', border: '2px solid #131110', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
}


function PopupRow({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', borderRadius: '6px' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', flexShrink: 0, width: '16px', textAlign: 'center', fontFamily: 'monospace' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{hint}</span>
    </button>
  )
}

function CtxItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', background: 'none', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: danger ? '#e07060' : 'var(--text-1)', textAlign: 'left' }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(200,80,60,0.1)' : 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ fontSize: '12px', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      {label}
    </button>
  )
}

// All-day event chip
function AllDayChip({ event, onDelete }: { event: CalendarEvent; onDelete?: () => void }) {
  const [hov, setHov] = useState(false)
  const isLocus = event.source === 'locus'
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={event.title}
      style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: isLocus ? 'rgba(212,168,83,0.18)' : 'rgba(96,160,200,0.18)', border: `1px solid ${isLocus ? 'rgba(212,168,83,0.35)' : 'rgba(96,160,200,0.3)'}`, color: isLocus ? 'rgba(220,190,110,0.95)' : 'rgba(140,190,220,0.95)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</span>
      {hov && onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '11px', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
      )}
    </div>
  )
}

// Habit chip in the strip (no scheduled time)
function HabitStripChip({
  entry,
  onContextMenu,
}: {
  entry: HabitOnDay
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  const { habit } = entry
  return (
    <div
      data-event="1"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={onContextMenu}
      title={`${habit.emoji} ${habit.name} · right-click to set time`}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '2px 7px 2px 5px',
        borderRadius: '20px',
        fontSize: '10px', fontWeight: 500,
        background: hov ? 'rgba(100,160,130,0.25)' : 'rgba(100,160,130,0.12)',
        border: '1px solid rgba(100,160,130,0.35)',
        color: 'rgba(150,210,170,0.9)',
        cursor: 'context-menu',
        userSelect: 'none',
        transition: 'background 0.12s',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      <span style={{ fontSize: '11px', lineHeight: 1, flexShrink: 0 }}>{habit.emoji}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.name}</span>
    </div>
  )
}

const HABIT_STRIP_MAX = 3  // chips shown before "+N more"

// Habits strip — shows habits with no time for that day
function HabitsStrip({
  colDates,
  today,
  habitsByDate,
  onContextMenu,
}: {
  colDates: string[]
  today: string
  habitsByDate: Map<string, HabitOnDay[]>
  onContextMenu: (e: React.MouseEvent, habit: HabitWithLogs, dateStr: string, currentTime: string | null) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  // Per-column expanded state (clicking "+N" reveals the rest)
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set())

  const allEntries = [...habitsByDate.values()].flatMap(hs => hs)
  const hasAny = allEntries.some(h => h.effectiveTime === null)
  if (!hasAny) return null

  const totalNoTime = allEntries.filter(h => h.effectiveTime === null).length

  function toggleCol(dateStr: string) {
    setExpandedCols(prev => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Strip header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px 4px 6px', borderBottom: collapsed ? undefined : '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '10px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.07em', fontWeight: 700, textTransform: 'uppercase' }}
        >
          <span style={{ fontSize: '8px', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', opacity: 0.6 }}>▼</span>
          Habits
        </button>
        <span style={{ fontSize: '10px', color: 'rgba(150,210,170,0.5)', fontWeight: 500 }}>
          {totalNoTime} unscheduled · right-click to set time
        </span>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {colDates.map((dateStr, col) => {
            const isToday   = dateStr === today
            const noTime    = (habitsByDate.get(dateStr) ?? []).filter(h => h.effectiveTime === null)
            const expanded  = expandedCols.has(dateStr)
            const visible   = expanded ? noTime : noTime.slice(0, HABIT_STRIP_MAX)
            const overflow  = noTime.length - HABIT_STRIP_MAX

            return (
              <div
                key={col}
                style={{
                  padding: '4px 5px',
                  borderRight: col < 6 ? '1px solid var(--border)' : undefined,
                  background: isToday ? 'rgba(212,168,83,0.025)' : undefined,
                  minHeight: '32px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '3px',
                  alignContent: 'flex-start',
                }}
              >
                {visible.map(entry => (
                  <HabitStripChip
                    key={entry.habit.id}
                    entry={entry}
                    onContextMenu={e => onContextMenu(e, entry.habit, dateStr, entry.effectiveTime)}
                  />
                ))}
                {!expanded && overflow > 0 && (
                  <button
                    onClick={() => toggleCol(dateStr)}
                    style={{
                      padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >+{overflow}</button>
                )}
                {expanded && noTime.length > HABIT_STRIP_MAX && (
                  <button
                    onClick={() => toggleCol(dateStr)}
                    style={{
                      padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                      background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >Show less</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Timed habit block in the grid
function HabitBlock({
  habit,
  top,
  effectiveTime,
  onContextMenu,
}: {
  habit: HabitWithLogs
  top: number
  effectiveTime: string
  onContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <div
      data-event="1"
      onContextMenu={onContextMenu}
      onClick={e => e.stopPropagation()}
      title={`${habit.emoji} ${habit.name} · ${effectiveTime} · right-click to edit`}
      style={{
        position: 'absolute', top: `${top}px`, left: '1%', width: '98%', height: '26px',
        background: 'rgba(100,160,130,0.22)', border: '1px solid rgba(100,160,130,0.45)',
        borderLeft: '3px solid rgba(100,160,130,0.8)',
        borderRadius: '4px', padding: '2px 6px',
        display: 'flex', alignItems: 'center', gap: '4px',
        overflow: 'hidden', zIndex: 3, boxSizing: 'border-box',
        cursor: 'context-menu',
      }}
    >
      <span style={{ fontSize: '11px', flexShrink: 0 }}>{habit.emoji}</span>
      <span style={{ fontSize: '10.5px', color: 'var(--text-1)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
      <span style={{ fontSize: '9px', color: 'rgba(100,180,140,0.7)', flexShrink: 0 }}>{formatHHMM(effectiveTime)}</span>
    </div>
  )
}

// Calendar / Locus event block
function EventBlock({
  ev, top, height, left, width, startTime, isLocus, onDelete,
}: {
  ev: CalendarEvent; top: number; height: number; left: string; width: string
  startTime: string; isLocus: boolean; onDelete?: () => void
}) {
  const [hov, setHov] = useState(false)
  const bg  = isLocus ? 'rgba(212,168,83,0.12)'  : 'rgba(80,130,220,0.12)'
  const bd  = isLocus ? 'rgba(212,168,83,0.3)'   : 'rgba(80,130,220,0.25)'
  const acc = isLocus ? 'rgba(212,168,83,0.75)'  : 'rgba(100,160,240,0.7)'
  const tc  = isLocus ? 'rgba(220,190,110,0.9)'  : 'rgba(150,195,255,0.85)'
  return (
    <div
      data-event="1"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={e => e.stopPropagation()}
      title={`${ev.title}${ev.location ? `\n${ev.location}` : ''}`}
      style={{
        position: 'absolute', top: `${top}px`, height: `${height}px`, left, width,
        background: bg, border: `1px solid ${bd}`, borderLeft: `3px solid ${acc}`,
        borderRadius: '4px', padding: '2px 5px', overflow: 'hidden', zIndex: 2,
        boxSizing: 'border-box', cursor: 'default', outline: 'none',
      }}
    >
      <div style={{ fontSize: '9.5px', color: tc, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{startTime}</span>
        {hov && onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', color: tc, cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
        )}
      </div>
      <div style={{ fontSize: '11px', color: tc, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: height < 38 ? 'nowrap' : 'normal' }}>
        {isLocus && <span style={{ fontSize: '10px', marginRight: '3px', opacity: 0.7 }}>✦</span>}
        {ev.title}
      </div>
      {ev.location && height >= 48 && (
        <div style={{ fontSize: '9.5px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.location}</div>
      )}
    </div>
  )
}

// Plan strip (AI suggestions, goal blocks, custom blocks)
function PlanStrip({
  colDates, weekStart, today, planBlocks,
  onRemove, onAccept, onDismiss, onAddClick,
}: {
  colDates: string[]
  weekStart: string
  today: string
  planBlocks: WeeklyPlanBlock[]
  onRemove: (b: WeeklyPlanBlock) => void
  onAccept: (b: WeeklyPlanBlock) => void
  onDismiss: (b: WeeklyPlanBlock) => void
  onAddClick: (dateStr: string, cx: number, cy: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const hasSomething = planBlocks.length > 0
  if (!hasSomething && collapsed) return null

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px 4px 6px', borderBottom: collapsed ? undefined : '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '10px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.07em', fontWeight: 700, textTransform: 'uppercase' }}>
          <span style={{ fontSize: '8px', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', opacity: 0.6 }}>▼</span>
          Plans
        </button>
        <span style={{ fontSize: '10px', color: 'var(--text-3)', opacity: 0.6 }}>goal blocks &amp; AI suggestions</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div style={{ borderRight: '1px solid var(--border)' }} />
          {colDates.map((dateStr, col) => {
            const dow    = colToDow(col)
            const isToday = dateStr === today
            const blocks = planBlocks.filter(b => b.day_of_week === dow && b.week_start === weekStart)
            return (
              <div key={col} style={{ padding: '4px 4px', borderRight: col < 6 ? '1px solid var(--border)' : undefined, background: isToday ? 'rgba(212,168,83,0.025)' : undefined, minHeight: '36px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {blocks.map(b => (
                  <PlanChip key={b.id} block={b} onRemove={() => onRemove(b)} onAccept={() => onAccept(b)} onDismiss={() => onDismiss(b)} />
                ))}
                <button
                  onClick={e => onAddClick(dateStr, e.clientX, e.clientY)}
                  style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: '4px', color: 'var(--text-3)', cursor: 'pointer', fontSize: '10px', padding: '1px 6px', lineHeight: 1.6 }}
                >+</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlanChip({ block, onRemove, onAccept, onDismiss }: { block: WeeklyPlanBlock; onRemove: () => void; onAccept: () => void; onDismiss: () => void }) {
  const [hov, setHov] = useState(false)
  const isGhost = !block.accepted
  const bg = block.type === 'goal' ? 'rgba(212,168,83,0.15)' : 'rgba(96,144,200,0.15)'
  const br = block.type === 'goal' ? 'rgba(212,168,83,0.4)'  : 'rgba(96,144,200,0.35)'
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: bg, border: `1px ${isGhost ? 'dashed' : 'solid'} ${br}`, borderRadius: '4px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: isGhost ? 0.8 : 1, minWidth: 0, fontSize: '10px' }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)', fontWeight: 500 }}>{block.title}</span>
      {hov && isGhost && (
        <>
          <button onClick={e => { e.stopPropagation(); onAccept() }} style={{ background: 'rgba(122,158,138,0.4)', border: 'none', borderRadius: '2px', color: 'var(--text-0)', cursor: 'pointer', fontSize: '9px', padding: '0 3px', lineHeight: '14px' }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDismiss() }} style={{ background: 'rgba(220,80,60,0.25)', border: 'none', borderRadius: '2px', color: 'var(--text-0)', cursor: 'pointer', fontSize: '10px', padding: '0 3px', lineHeight: '14px' }}>✕</button>
        </>
      )}
      {hov && !isGhost && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}>×</button>
      )}
    </div>
  )
}
