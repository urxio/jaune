'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Goal } from '@/lib/types'
import { createHabitAction, type HabitFormData } from '@/app/actions/habits'
import { deriveFrequencyMeta } from '@/lib/habits/utils'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'

const DOW_LABELS        = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOW_NAMES         = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMOJI_SUGGESTIONS = ['🏃', '📚', '🧘', '💪', '✍️', '💧', '🥗', '😴', '🎸', '🧹', '🌿', '🏊']

export default function HabitFormPage({ today, activeGoals }: { today: string; activeGoals: Goal[] }) {
  const router = useRouter()

  const [name,           setName]           = useState('')
  const [emoji,          setEmoji]          = useState('✨')
  const [motivation,     setMotivation]     = useState('')
  const [daysOfWeek,     setDaysOfWeek]     = useState<number[]>([])
  const [endsAt,         setEndsAt]         = useState('')
  const [goalId,         setGoalId]         = useState('')
  const [goalTargetCount, setGoalTargetCount] = useState<number | null>(null)
  const [scheduledTime,  setScheduledTime]  = useState('')
  const [error,          setError]          = useState('')
  const [isPending, startTransition]        = useTransition()

  const toggleDay = (d: number) =>
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const applyPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all')      setDaysOfWeek([])
    if (preset === 'weekdays') setDaysOfWeek([1, 2, 3, 4, 5])
    if (preset === 'weekends') setDaysOfWeek([0, 6])
  }

  const isPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    const s = [...daysOfWeek].sort((a, b) => a - b)
    if (preset === 'all')      return daysOfWeek.length === 0 || daysOfWeek.length === 7
    if (preset === 'weekdays') return JSON.stringify(s) === JSON.stringify([1, 2, 3, 4, 5])
    if (preset === 'weekends') return JSON.stringify(s) === JSON.stringify([0, 6])
    return false
  }

  const handleSubmit = () => {
    if (!name.trim()) { setError('Give your habit a name.'); return }
    const linkedGoal = activeGoals.find(g => g.id === goalId) ?? null
    if (linkedGoal?.tracking_mode === 'habits' && (!goalTargetCount || goalTargetCount <= 0)) {
      setError('Set a target count so your check-ins can drive progress on this goal.')
      return
    }
    setError('')
    const data: HabitFormData = {
      name: name.trim(), emoji, days_of_week: daysOfWeek,
      ends_at: endsAt || null,
      goal_id: goalId || null,
      goal_target_count: goalId ? goalTargetCount : null,
      motivation: motivation.trim() || null,
      time_of_day: scheduledTime || null,
    }
    startTransition(async () => {
      try {
        await createHabitAction(data)
        router.push('/habits')
        router.refresh()
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
    <div className="page-pad" style={{ maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 14px', fontSize: '14px', color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }}
        >
          ← Back
        </button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400, color: 'var(--text-0)' }}>
          New habit
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Emoji + Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Emoji</label>
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4}
              style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', padding: '8px 4px' }} />
          </div>
          <div>
            <label style={labelStyle}>Habit name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Morning run" autoFocus style={inputStyle} />
          </div>
        </div>

        {/* Why */}
        <div>
          <label style={labelStyle}>
            Why do you want this habit?
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional)</span>
          </label>
          <textarea
            value={motivation} onChange={e => setMotivation(e.target.value)}
            placeholder="e.g. To have more energy in the mornings"
            rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }} />
        </div>

        {/* Quick pick */}
        <div>
          <label style={labelStyle}>Quick pick</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {EMOJI_SUGGESTIONS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                style={{ width: '40px', height: '40px', borderRadius: '8px', background: emoji === e ? 'var(--gold-dim)' : 'var(--bg-3)', border: `1px solid ${emoji === e ? 'rgba(212,168,83,0.4)' : 'var(--border)'}`, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label style={labelStyle}>Schedule</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {DOW_LABELS.map((lbl, d) => {
              const active = daysOfWeek.includes(d)
              const isAll  = daysOfWeek.length === 0
              return (
                <button key={d} onClick={() => toggleDay(d)} title={DOW_NAMES[d]}
                  style={{ flex: 1, aspectRatio: '1', borderRadius: '50%', border: 'none', background: active ? 'var(--gold)' : isAll ? 'rgba(212,168,83,0.12)' : 'var(--bg-3)', color: active ? '#131110' : isAll ? 'var(--gold)' : 'var(--text-2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', outline: isAll && !active ? '1px dashed rgba(212,168,83,0.3)' : 'none' }}>
                  {lbl}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {presetBtn('Every day', 'all')}
            {presetBtn('Weekdays', 'weekdays')}
            {presetBtn('Weekends', 'weekends')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
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

        {/* Scheduled time */}
        <div>
          <label style={labelStyle}>
            Scheduled time
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional)</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
              style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
            {scheduledTime && (
              <button onClick={() => setScheduledTime('')}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Until */}
        <div>
          <label style={labelStyle}>
            Until
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> (optional — leave blank for ongoing)</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={endsAt} min={today} onChange={e => setEndsAt(e.target.value)}
              style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
            {endsAt && (
              <button onClick={() => setEndsAt('')}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Linked goal */}
        {activeGoals.length > 0 && (() => {
          const selectedGoal = activeGoals.find(g => g.id === goalId) ?? null
          const isHabitTracked = selectedGoal?.tracking_mode === 'habits'
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Linked goal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}>(optional)</span></label>
                <select value={goalId} onChange={e => { setGoalId(e.target.value); setGoalTargetCount(null) }}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
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
                  <label style={labelStyle}>Target completions</label>
                  <input type="number" min={1} max={9999}
                    value={goalTargetCount ?? ''}
                    onChange={e => setGoalTargetCount(e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 30 runs, 20 sessions…" style={inputStyle} />
                </div>
              )}
            </div>
          )
        })()}

        {error && (
          <div style={{ fontSize: '13px', color: '#e07060', background: 'rgba(200,80,60,0.08)', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>
        )}

        <button
          onClick={handleSubmit} disabled={isPending}
          style={{ width: '100%', background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1, marginBottom: '32px' }}
        >
          {isPending ? 'Saving…' : 'Add habit'}
        </button>
      </div>
    </div>
  )
}
