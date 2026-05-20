'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { HabitWithLogs } from '@/lib/types'
import { logHabitAction, unlogHabitAction } from '@/app/actions/habits'
import { HABIT_COLORS } from '@/lib/habits/colors'
import HabitCard, { computeStreak } from './HabitCard'
import HabitModal from './HabitModal'
import HabitCalendar from './HabitCalendar'

type LogMap = Map<string, Set<string>>
type ModalState = null | { mode: 'add' } | { mode: 'edit'; habit: HabitWithLogs }
type ViewMode = 'list' | 'calendar'

function getLast28Days(today: string): string[] {
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - (27 - i))
    return d.toISOString().split('T')[0]
  })
}

/* ── MAIN COMPONENT ── */
export default function HabitTracker({
  habits: initial, today, activeGoals = [],
}: {
  habits: HabitWithLogs[]
  today: string
  activeGoals?: import('@/lib/types').Goal[]
}) {
  const [habits, setHabits] = useState<HabitWithLogs[]>(initial)
  const [modal, setModal]   = useState<ModalState>(null)
  const [view,  setView]    = useState<ViewMode>('list')
  const [showAll, setShowAll] = useState(false)
  const router = useRouter()

  const [logMap, setLogMap] = useState<LogMap>(() => {
    const m = new Map<string, Set<string>>()
    initial.forEach(h => m.set(h.id, new Set(h.logs.map(l => l.logged_date))))
    return m
  })

  const [pendingSet, setPendingSet] = useState<Set<string>>(new Set())

  const last28 = getLast28Days(today)

  const toggleLog = async (habitId: string, date: string) => {
    const key = `${habitId}:${date}`
    if (pendingSet.has(key)) return
    const dates   = logMap.get(habitId) ?? new Set<string>()
    const wasDone = dates.has(date)
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
      else await logHabitAction(habitId, date)
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

  const handleDeleted = (habitId: string) => {
    setHabits(hs => hs.filter(h => h.id !== habitId))
    setLogMap(prev => { const n = new Map(prev); n.delete(habitId); return n })
    router.refresh()
  }

  const handleSaved = (updated: HabitWithLogs) => {
    setHabits(hs => {
      const exists = hs.find(h => h.id === updated.id)
      return exists ? hs.map(h => h.id === updated.id ? updated : h) : [...hs, updated]
    })
    setLogMap(prev => {
      const n = new Map(prev)
      if (!n.has(updated.id)) n.set(updated.id, new Set())
      return n
    })
    setModal(null)
    router.refresh()
  }

  const scheduledToday   = habits.filter(h => h.isScheduledToday)
  const unscheduledToday = habits.filter(h => !h.isScheduledToday)

  const doneToday   = scheduledToday.filter(h => (logMap.get(h.id) ?? new Set()).has(today)).length
  const totalToday  = scheduledToday.length
  const progressPct = totalToday > 0 ? (doneToday / totalToday) * 100 : 0

  const displayedHabits = showAll ? habits : scheduledToday
  const now = new Date()

  // Stable color index per habit based on full list order
  const habitColorIndex = (id: string) => habits.findIndex(h => h.id === id) % HABIT_COLORS.length

  return (
    <>
      <div className="page-pad" style={{ maxWidth: '760px', width: '100%', marginLeft: 'auto', marginRight: 'auto', animation: 'fadeUp 0.3s var(--ease) both' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: '6px', opacity: 0.85 }}>
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.15 }}>
              {view === 'list'
                ? <>Today's <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>habits.</em></>
                : <>Monthly <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>progress.</em></>
              }
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '6px' }}>
              {view === 'list'
                ? 'Tap the icon to log today. Tap any square to edit history.'
                : 'Click any past dot to toggle a habit log for that day.'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0, marginTop: '6px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '9px', padding: '3px', gap: '2px' }}>
              <button onClick={() => setView('list')} className="icon-btn"
                style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s', background: view === 'list' ? 'var(--bg-0)' : 'transparent', color: view === 'list' ? 'var(--text-0)' : 'var(--text-3)', boxShadow: view === 'list' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none' }}>
                List
              </button>
              <button onClick={() => setView('calendar')} className="icon-btn"
                style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s', background: view === 'calendar' ? 'var(--bg-0)' : 'transparent', color: view === 'calendar' ? 'var(--text-0)' : 'var(--text-3)', boxShadow: view === 'calendar' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none' }}>
                Calendar
              </button>
            </div>
            <button
              onClick={() => window.innerWidth <= 768 ? router.push('/habits/new') : setModal({ mode: 'add' })}
              style={{ background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add habit
            </button>
          </div>
        </div>

        {/* Daily progress bar — list view only */}
        {view === 'list' && totalToday > 0 && (
          <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's progress</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: doneToday === totalToday ? 'var(--sage)' : 'var(--text-0)' }}>
                {doneToday}<span style={{ fontSize: '14px', color: 'var(--text-2)' }}>/{totalToday}</span>
              </span>
            </div>
            <div style={{ height: '5px', background: 'var(--bg-4)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '5px', width: `${progressPct}%`, transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)', background: doneToday === totalToday ? 'linear-gradient(90deg, var(--sage), #a0c8a8)' : 'linear-gradient(90deg, var(--gold), #e8b86d)' }} />
            </div>
            {doneToday === totalToday && totalToday > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--sage)', marginTop: '8px', fontWeight: 600 }}>✓ All habits complete for today</div>
            )}
          </div>
        )}

        {/* Empty state */}
        {habits.length === 0 && (
          <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🌱</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 300, color: 'var(--text-1)', marginBottom: '8px' }}>No habits yet.</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '20px' }}>Build habits that compound. Start with one.</div>
            <button
              onClick={() => window.innerWidth <= 768 ? router.push('/habits/new') : setModal({ mode: 'add' })}
              style={{ background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Add your first habit →
            </button>
          </div>
        )}

        {/* Calendar view */}
        {view === 'calendar' && (
          <HabitCalendar habits={habits} today={today} />
        )}

        {/* List view */}
        {view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {scheduledToday.length === 0 && habits.length > 0 && !showAll && (
              <div style={{ background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: '14px', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✌️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>No habits scheduled for today.</div>
                <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Enjoy the break — you've earned it.</div>
              </div>
            )}

            {displayedHabits.map(habit => {
              const loggedDates = logMap.get(habit.id) ?? new Set<string>()
              const streak = computeStreak(loggedDates, today, habit.days_of_week ?? null)
              return (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  loggedDates={loggedDates}
                  streak={streak}
                  colorIndex={habitColorIndex(habit.id)}
                  last28={last28}
                  today={today}
                  pendingSet={pendingSet}
                  onToggle={(date) => toggleLog(habit.id, date)}
                  onEdit={() => setModal({ mode: 'edit', habit })}
                  onDelete={() => handleDeleted(habit.id)}
                />
              )
            })}

            {view === 'list' && habits.length > 0 && (
              <button onClick={() => setShowAll(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer', padding: '8px 0', textAlign: 'center', letterSpacing: '0.04em' }}>
                {showAll
                  ? '↑ Show today only'
                  : unscheduledToday.length > 0
                    ? `↓ Show all habits (${unscheduledToday.length} not scheduled today)`
                    : null
                }
              </button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <HabitModal
          mode={modal.mode}
          habit={modal.mode === 'edit' ? modal.habit : undefined}
          today={today}
          activeGoals={activeGoals}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
