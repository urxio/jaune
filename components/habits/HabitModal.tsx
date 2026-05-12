'use client'

import { useState, useTransition } from 'react'
import type { HabitWithLogs } from '@/lib/types'
import {
  createHabitAction, updateHabitAction,
  type HabitFormData,
} from '@/app/actions/habits'
import { deriveFrequencyMeta } from '@/lib/habits/utils'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'
import { daysUntilEnd } from './HabitCard'

const DOW_LABELS       = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOW_NAMES        = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMOJI_SUGGESTIONS = ['🏃', '📚', '🧘', '💪', '✍️', '💧', '🥗', '😴', '🎸', '🧹', '🌿', '🏊']

export default function HabitModal({ mode, habit, today, activeGoals, onClose, onSaved }: {
  mode: 'add' | 'edit'
  habit?: HabitWithLogs
  today: string
  activeGoals: import('@/lib/types').Goal[]
  onClose: () => void
  onSaved: (h: HabitWithLogs) => void
}) {
  const [name,           setName]           = useState(habit?.name ?? '')
  const [emoji,          setEmoji]          = useState(habit?.emoji ?? '✨')
  const [motivation,     setMotivation]     = useState(habit?.motivation ?? '')
  const [daysOfWeek,     setDaysOfWeek]     = useState<number[]>(
    habit?.days_of_week && habit.days_of_week.length > 0 ? habit.days_of_week : []
  )
  const [endsAt,         setEndsAt]         = useState<string>(habit?.ends_at ?? '')
  const [goalId,         setGoalId]         = useState<string>(habit?.goal_id ?? '')
  const [goalTargetCount, setGoalTargetCount] = useState<number | null>(habit?.goal_target_count ?? null)
  const [scheduledTime,  setScheduledTime]  = useState<string>(habit?.time_of_day ?? '')
  const [error,          setError]          = useState('')
  const [isPending, startTransition]        = useTransition()

  const toggleDay = (d: number) => {
    setDaysOfWeek(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  const applyPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all')      setDaysOfWeek([])
    if (preset === 'weekdays') setDaysOfWeek([1, 2, 3, 4, 5])
    if (preset === 'weekends') setDaysOfWeek([0, 6])
  }

  const isPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    const sorted = [...daysOfWeek].sort((a, b) => a - b)
    if (preset === 'all')      return daysOfWeek.length === 0 || daysOfWeek.length === 7
    if (preset === 'weekdays') return JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])
    if (preset === 'weekends') return JSON.stringify(sorted) === JSON.stringify([0, 6])
    return false
  }

  const handleSubmit = () => {
    if (!name.trim()) { setError('Give your habit a name.'); return }
    setError('')
    const linkedGoalObj = activeGoals.find(g => g.id === goalId) ?? null
    const data: HabitFormData = {
      name: name.trim(), emoji, days_of_week: daysOfWeek,
      ends_at: endsAt || null,
      goal_id: goalId || null,
      goal_target_count: goalId ? goalTargetCount : null,
      motivation: motivation.trim() || null,
      time_of_day: scheduledTime || null,
    }
    const { target_count } = deriveFrequencyMeta(daysOfWeek)
    const todayDow = new Date(today + 'T12:00:00').getDay()
    const isScheduledToday = daysOfWeek.length === 0 || daysOfWeek.includes(todayDow)

    startTransition(async () => {
      try {
        if (mode === 'add') {
          const created = await createHabitAction(data)
          onSaved({
            ...created,
            days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
            ends_at: endsAt || null,
            time_of_day: scheduledTime || null,
            goal_id: goalId || null,
            goal_target_count: goalId ? goalTargetCount : null,
            motivation: motivation.trim() || null,
            target_count,
            logs: [],
            streak: 0,
            weekCompletions: 0,
            isScheduledToday,
            linkedGoal: linkedGoalObj ? { id: linkedGoalObj.id, title: linkedGoalObj.title, category: linkedGoalObj.category } : null,
          } as HabitWithLogs)
        } else if (habit) {
          await updateHabitAction(habit.id, data)
          onSaved({
            ...habit,
            name: name.trim(),
            emoji,
            days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
            ends_at: endsAt || null,
            goal_id: goalId || null,
            goal_target_count: goalId ? goalTargetCount : null,
            motivation: motivation.trim() || null,
            target_count,
            isScheduledToday,
            linkedGoal: linkedGoalObj ? { id: linkedGoalObj.id, title: linkedGoalObj.title, category: linkedGoalObj.category } : null,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const presetBtn = (label: string, preset: 'all' | 'weekdays' | 'weekends') => (
    <button
      key={preset}
      onClick={() => applyPreset(preset)}
      style={{
        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${isPreset(preset) ? 'rgba(212,168,83,0.4)' : 'var(--border)'}`,
        background: isPreset(preset) ? 'var(--gold-dim)' : 'var(--bg-3)',
        color: isPreset(preset) ? 'var(--gold)' : 'var(--text-2)',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  )

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className="modal-overlay"
      style={{ backdropFilter: 'blur(4px)', animation: 'fadeUp 0.15s var(--ease) both' }}
    >
      <div className="modal-box" style={{ padding: '32px', boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--text-0)' }}>
            {mode === 'add' ? 'New habit' : 'Edit habit'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '22px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Emoji</label>
              <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', padding: '8px 4px' }} />
            </div>
            <div>
              <label style={labelStyle}>Habit name</label>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="e.g. Morning run" autoFocus style={inputStyle} />
            </div>
          </div>

          {/* ── Why field ── */}
          <div>
            <label style={labelStyle}>
              Why do you want this habit?
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional — helps the AI coach you)</span>
            </label>
            <textarea
              value={motivation}
              onChange={e => setMotivation(e.target.value)}
              placeholder="e.g. To have more energy in the mornings and feel less sluggish"
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Quick pick</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EMOJI_SUGGESTIONS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', background: emoji === e ? 'var(--gold-dim)' : 'var(--bg-3)', border: `1px solid ${emoji === e ? 'rgba(212,168,83,0.4)' : 'var(--border)'}`, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Schedule</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {DOW_LABELS.map((lbl, d) => {
                const active = daysOfWeek.includes(d)
                const isAll  = daysOfWeek.length === 0
                return (
                  <button key={d} onClick={() => toggleDay(d)} title={DOW_NAMES[d]}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: active ? 'var(--gold)' : isAll ? 'rgba(212,168,83,0.12)' : 'var(--bg-3)', color: active ? '#131110' : isAll ? 'var(--gold)' : 'var(--text-2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', outline: isAll && !active ? '1px dashed rgba(212,168,83,0.3)' : 'none' }}>
                    {lbl}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {presetBtn('Every day', 'all')}
              {presetBtn('Weekdays', 'weekdays')}
              {presetBtn('Weekends', 'weekends')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '8px' }}>
              {daysOfWeek.length === 0
                ? 'Repeats every day'
                : `Repeats on: ${[...daysOfWeek].sort((a, b) => a - b).map(d => DOW_NAMES[d]).join(', ')}`
              }
              {' · '}
              <span style={{ color: 'var(--text-2)' }}>
                {daysOfWeek.length === 0 ? '7' : daysOfWeek.length}× per week
              </span>
            </div>
          </div>

          {/* ── Scheduled time ── */}
          <div>
            <label style={labelStyle}>
              Scheduled time
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional — shows in your planner at this time)</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }}
              />
              {scheduledTime && (
                <button
                  onClick={() => setScheduledTime('')}
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}
                >Clear</button>
              )}
            </div>
            {scheduledTime && (
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>
                Habit will appear at {scheduledTime} in the weekly planner
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Until <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}>(optional — leave blank for ongoing)</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={endsAt} min={today} onChange={e => setEndsAt(e.target.value)} style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
              {endsAt && (
                <button onClick={() => setEndsAt('')} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}>Clear</button>
              )}
            </div>
            {endsAt && (
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>
                {(() => {
                  const d = daysUntilEnd(endsAt)
                  return d !== null && d > 0 ? `${d} day${d === 1 ? '' : 's'} from today` : d === 0 ? 'Ends today' : 'Date is in the past'
                })()}
              </div>
            )}
          </div>

          {activeGoals.length > 0 && (() => {
            const selectedGoal = activeGoals.find(g => g.id === goalId) ?? null
            const isHabitTracked = selectedGoal?.tracking_mode === 'habits'
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Linked goal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}>(optional)</span></label>
                  <select
                    value={goalId}
                    onChange={e => { setGoalId(e.target.value); setGoalTargetCount(null) }}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— No linked goal —</option>
                    {activeGoals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.tracking_mode === 'habits' ? '⟳ ' : ''}{g.title}
                      </option>
                    ))}
                  </select>
                </div>

                {isHabitTracked && (
                  <div>
                    <label style={labelStyle}>
                      Target completions
                      <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={goalTargetCount ?? ''}
                      onChange={e => setGoalTargetCount(e.target.value ? Number(e.target.value) : null)}
                      placeholder="e.g. 30  —  leave blank to track by schedule"
                      style={inputStyle}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '5px' }}>
                      {goalTargetCount
                        ? `Progress = completions ÷ ${goalTargetCount} × 100%`
                        : 'Progress tracks how often you complete this vs. your schedule.'}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {error && (
            <div style={{ fontSize: '13px', color: '#e07060', background: 'rgba(200,80,60,0.08)', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: '9px', padding: '12px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '9px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Saving…' : mode === 'add' ? 'Add habit' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
