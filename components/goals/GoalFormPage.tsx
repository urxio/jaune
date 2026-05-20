'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Habit } from '@/lib/types'
import { createGoalAction, type GoalFormData } from '@/app/actions/goals'
import { linkHabitToGoalAction } from '@/app/actions/habits'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'
import { CATEGORY_COLORS } from './GoalCard'

const CATEGORIES = ['product', 'health', 'learning', 'financial', 'wellbeing', 'other']
const TIMEFRAMES  = ['quarter', 'year', 'ongoing']

const EMPTY_FORM: GoalFormData = {
  title: '', category: 'product', timeframe: 'quarter',
  progress_pct: 0, target_date: null, status: 'active',
  tracking_mode: 'steps',
}

export default function GoalFormPage({ habits = [] }: { habits?: Habit[] }) {
  const router = useRouter()

  const [form, setForm]       = useState<GoalFormData>(EMPTY_FORM)
  const [habitLinks, setHabitLinks] = useState<Map<string, number | null>>(new Map())
  const [habitSearch, setHabitSearch] = useState('')
  const [isPending, startTransition]  = useTransition()
  const [error, setError]     = useState('')

  const set = (k: keyof GoalFormData, v: string | number | null) =>
    setForm(f => ({ ...f, [k]: v }))

  const toggleHabit = (habitId: string, checked: boolean) => {
    setHabitLinks(prev => {
      const next = new Map(prev)
      if (checked) next.set(habitId, null)
      else next.delete(habitId)
      return next
    })
  }

  const setTarget = (habitId: string, value: string) => {
    setHabitLinks(prev => new Map(prev).set(habitId, value ? Number(value) : null))
  }

  const filteredHabits = useMemo(() => {
    const q = habitSearch.trim().toLowerCase()
    if (!q) return habits.slice(0, 4)
    return habits.filter(h => h.name.toLowerCase().includes(q) || h.emoji.includes(q))
  }, [habits, habitSearch])

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (form.tracking_mode === 'habits' && habitLinks.size > 0) {
      const missing = [...habitLinks.entries()].find(([, t]) => !t || t <= 0)
      if (missing) { setError('Set a target count for each linked habit.'); return }
    }
    setError('')
    startTransition(async () => {
      try {
        const created = await createGoalAction(form)
        if (form.tracking_mode === 'habits' && habitLinks.size > 0) {
          await Promise.all(
            [...habitLinks.entries()].map(([habitId, targetCount]) =>
              linkHabitToGoalAction(habitId, created.id, targetCount)
            )
          )
        }
        router.push('/goals')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

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
          New goal
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Title */}
        <div>
          <label style={labelStyle}>Title</label>
          <input
            value={form.title} onChange={e => set('title', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="What are you working towards?" autoFocus style={inputStyle} />
        </div>

        {/* Category + Timeframe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Timeframe</label>
            <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Tracking mode */}
        <div>
          <label style={labelStyle}>How is progress tracked?</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {([
              { value: 'manual', label: 'Manual', icon: '✎', desc: 'You set it yourself' },
              { value: 'steps',  label: 'Steps',  icon: '✦', desc: 'From step completion' },
              { value: 'habits', label: 'Habits', icon: '⟳', desc: 'From daily habit logs' },
            ] as const).map(opt => {
              const active = form.tracking_mode === opt.value
              return (
                <button key={opt.value} type="button"
                  onClick={() => { set('tracking_mode', opt.value); setHabitLinks(new Map()) }}
                  style={{ padding: '10px 8px', borderRadius: '8px', border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`, background: active ? 'var(--gold-dim)' : 'var(--bg-3)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '16px', marginBottom: '3px', color: active ? 'var(--gold)' : 'var(--text-2)' }}>{opt.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: active ? 'var(--gold)' : 'var(--text-1)', letterSpacing: '0.04em' }}>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px', lineHeight: 1.3 }}>{opt.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Habits tracking UI */}
        {form.tracking_mode === 'habits' && (
          <>
            <div style={{ background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--sage)', fontSize: '14px' }}>⟳</span>
              <span>Progress updates automatically each time you check a linked habit.</span>
            </div>

            {habits.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={labelStyle}>
                  Link habits
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> — pick which ones count</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-3)', pointerEvents: 'none' }}>⌕</span>
                  <input type="text" value={habitSearch} onChange={e => setHabitSearch(e.target.value)}
                    placeholder="Search habits…"
                    style={{ ...inputStyle, paddingLeft: '30px', fontSize: '13px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredHabits.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: '8px', textAlign: 'center' }}>
                      No habits match &ldquo;{habitSearch}&rdquo;
                    </div>
                  ) : filteredHabits.map(h => {
                    const isSelected = habitLinks.has(h.id)
                    const targetVal  = habitLinks.get(h.id)
                    return (
                      <div key={h.id} style={{ borderRadius: '8px', background: isSelected ? 'rgba(212,168,83,0.07)' : 'var(--bg-3)', border: `1px solid ${isSelected ? 'rgba(212,168,83,0.35)' : 'var(--border)'}`, transition: 'all 0.15s', overflow: 'hidden' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={isSelected} onChange={e => toggleHabit(h.id, e.target.checked)}
                            style={{ accentColor: 'var(--gold)', width: '14px', height: '14px', flexShrink: 0, cursor: 'pointer' }} />
                          <span style={{ fontSize: '15px', flexShrink: 0 }}>{h.emoji}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: isSelected ? 'var(--text-0)' : 'var(--text-1)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                        </label>
                        {isSelected && (
                          <div style={{ padding: '0 12px 10px 36px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="number" min={1} max={9999} value={targetVal ?? ''}
                              onChange={e => setTarget(h.id, e.target.value)}
                              placeholder="Target completions (e.g. 30)"
                              style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: 'var(--text-0)', outline: 'none', fontFamily: 'inherit' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>/ goal</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {!habitSearch && habits.length > 4 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', padding: '4px 0' }}>
                      {habits.length - 4} more — search to find them
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                No habits yet — you can create and link habits after saving this goal.
              </div>
            )}
          </>
        )}

        {form.tracking_mode === 'steps' && (
          <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '10px 13px', fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--gold)', fontSize: '14px' }}>✦</span>
            Progress will be calculated from step completion once steps are added.
          </div>
        )}

        {form.tracking_mode === 'manual' && (
          <div>
            <label style={labelStyle}>Progress — {form.progress_pct}%</label>
            <input type="range" min={0} max={100} value={form.progress_pct}
              onChange={e => set('progress_pct', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
            <div style={{ height: '3px', background: 'var(--bg-4)', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ height: '100%', borderRadius: '4px', background: CATEGORY_COLORS[form.category] ?? CATEGORY_COLORS.other, width: `${form.progress_pct}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* Target date */}
        <div>
          <label style={labelStyle}>Target date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <input type="date" value={form.target_date ?? ''} onChange={e => set('target_date', e.target.value || null)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        {form.tracking_mode !== 'habits' && (
          <div style={{ background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '8px', padding: '10px 13px', fontSize: '12.5px', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>✦</span>
            Jaune will automatically break this goal into steps when you save.
          </div>
        )}

        {error && (
          <div style={{ fontSize: '13px', color: '#e07060', background: 'rgba(200,80,60,0.08)', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>
        )}

        <button
          onClick={handleSubmit} disabled={isPending}
          style={{ width: '100%', background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1, marginBottom: '32px' }}
        >
          {isPending ? 'Saving…' : 'Add goal'}
        </button>
      </div>
    </div>
  )
}
