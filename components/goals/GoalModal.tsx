'use client'

import { useState, useTransition, useMemo } from 'react'
import { useKeyboardAwareOverlay } from '@/lib/hooks/useKeyboardAwareOverlay'
import type { GoalWithSteps, Habit } from '@/lib/types'
import { createGoalAction, updateGoalAction, type GoalFormData } from '@/app/actions/goals'
import { linkHabitToGoalAction } from '@/app/actions/habits'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'
import { CATEGORY_COLORS } from './GoalCard'

const CATEGORIES = ['product', 'health', 'learning', 'financial', 'wellbeing', 'other']
const TIMEFRAMES  = ['quarter', 'year', 'ongoing']
const STATUSES    = ['active', 'paused', 'completed']

export const EMPTY_FORM: GoalFormData = {
  title: '', category: 'product', timeframe: 'quarter',
  progress_pct: 0, target_date: null, status: 'active',
  tracking_mode: 'steps',
}

export default function GoalModal({ mode, goal, hasSteps, habits = [], onClose, onSaved }: {
  mode: 'add' | 'edit'; goal?: GoalWithSteps; hasSteps: boolean
  habits?: Habit[]
  onClose: () => void
  onSaved: (
    g: GoalWithSteps,
    isNew: boolean,
    linkedHabits?: Array<{ id: string; goal_target_count: number }>,
    unlinkedHabitIds?: string[],
  ) => void
}) {
  const [form, setForm] = useState<GoalFormData>(
    goal
      ? { title: goal.title, category: goal.category, timeframe: goal.timeframe, progress_pct: goal.progress_pct, target_date: goal.target_date, status: goal.status, tracking_mode: goal.tracking_mode ?? 'manual' }
      : EMPTY_FORM
  )
  // habitLinks: Map<habitId, targetCount | null> — prefilled with habits already linked to this goal
  const [habitLinks, setHabitLinks] = useState<Map<string, number | null>>(() => {
    if (!goal) return new Map()
    return new Map(habits.filter(h => h.goal_id === goal.id).map(h => [h.id, h.goal_target_count]))
  })
  // Snapshot of what was linked on open, so submit can diff and unlink removals
  const [originalLinkedIds] = useState<Set<string>>(() =>
    new Set(goal ? habits.filter(h => h.goal_id === goal.id).map(h => h.id) : [])
  )
  const [habitSearch, setHabitSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const overlayRef = useKeyboardAwareOverlay()

  const set = (k: keyof GoalFormData, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

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

  // Habits already linked to another habit-tracked goal (greyed out)
  const alreadyLinkedIds = new Set(
    habits
      .filter(h => h.goal_id && h.goal_id !== goal?.id)
      .map(h => h.id)
  )

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Title is required.'); return }

    if (form.tracking_mode === 'habits' && habitLinks.size > 0) {
      const missingTarget = [...habitLinks.entries()].find(([, t]) => !t || t <= 0)
      if (missingTarget) {
        setError('Set a target count for each linked habit.')
        return
      }
    }

    setError('')
    // Habits the user wants linked once saved — empty unless tracking by habits
    const finalLinks = form.tracking_mode === 'habits' ? habitLinks : new Map<string, number | null>()

    startTransition(async () => {
      try {
        let savedGoal: GoalWithSteps
        let isNew = false

        if (mode === 'add') {
          const created = await createGoalAction(form)
          savedGoal = { ...created, steps: [] } as unknown as GoalWithSteps
          isNew = true
        } else if (goal) {
          await updateGoalAction(goal.id, form)
          savedGoal = { ...goal, ...form, title: form.title.trim() } as unknown as GoalWithSteps
        } else {
          return
        }

        const linked: Array<{ id: string; goal_target_count: number }> = []
        const unlinked: string[] = []

        await Promise.all(
          [...finalLinks.entries()].map(async ([habitId, targetCount]) => {
            await linkHabitToGoalAction(habitId, savedGoal.id, targetCount)
            linked.push({ id: habitId, goal_target_count: targetCount! })
          })
        )
        await Promise.all(
          [...originalLinkedIds].filter(id => !finalLinks.has(id)).map(async habitId => {
            await linkHabitToGoalAction(habitId, null, null)
            unlinked.push(habitId)
          })
        )

        onSaved(savedGoal, isNew, linked.length > 0 ? linked : undefined, unlinked.length > 0 ? unlinked : undefined)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const filteredHabits = useMemo(() => {
    const q = habitSearch.trim().toLowerCase()
    if (!q) {
      // Surface already-linked habits first so they're not pushed out of the top-4 view
      const sorted = [...habits].sort((a, b) => Number(habitLinks.has(b.id)) - Number(habitLinks.has(a.id)))
      return sorted.slice(0, 4)
    }
    return habits.filter(h => h.name.toLowerCase().includes(q) || h.emoji.includes(q))
  }, [habits, habitSearch, habitLinks])

  return (
    <div ref={overlayRef} onClick={e => e.target === e.currentTarget && onClose()} className="modal-overlay" style={{ backdropFilter: 'blur(4px)', animation: 'fadeUp 0.15s var(--ease) both' }}>
      <div className="modal-box" style={{ padding: '32px', boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--text-0)' }}>
            {mode === 'add' ? 'New goal' : 'Edit goal'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="What are you working towards?" autoFocus style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Timeframe</label>
              <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>How is progress tracked?</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {([
                { value: 'manual',  label: 'Manual',  icon: '✎', desc: 'You set it yourself' },
                { value: 'steps',   label: 'Steps',   icon: '✦', desc: 'From step completion' },
                { value: 'habits',  label: 'Habits',  icon: '⟳', desc: 'From daily habit logs' },
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

          {/* Habit tracker info + picker */}
          {form.tracking_mode === 'habits' ? (
            <>
              <div style={{ background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--sage)', fontSize: '14px' }}>⟳</span>
                <span>Progress updates automatically each time you check a linked habit.</span>
              </div>

              {/* Habit picker */}
              {habits.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={labelStyle}>
                    Link habits
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', fontSize: '10px' }}> — pick which ones count toward this goal</span>
                  </label>

                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-3)', pointerEvents: 'none' }}>⌕</span>
                    <input
                      type="text"
                      value={habitSearch}
                      onChange={e => setHabitSearch(e.target.value)}
                      placeholder="Search habits…"
                      style={{ ...inputStyle, paddingLeft: '30px', fontSize: '13px' }}
                    />
                  </div>

                  {/* Habit rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredHabits.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: '8px', textAlign: 'center' }}>
                        No habits match &ldquo;{habitSearch}&rdquo;
                      </div>
                    ) : filteredHabits.map(h => {
                      const isLinkedElsewhere = alreadyLinkedIds.has(h.id)
                      const isSelected = !isLinkedElsewhere && habitLinks.has(h.id)
                      const targetVal = habitLinks.get(h.id)
                      return (
                        <div
                          key={h.id}
                          style={{
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(212,168,83,0.07)' : 'var(--bg-3)',
                            border: `1px solid ${isSelected ? 'rgba(212,168,83,0.35)' : 'var(--border)'}`,
                            transition: 'all 0.15s',
                            overflow: 'hidden',
                            opacity: isLinkedElsewhere ? 0.5 : 1,
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: isLinkedElsewhere ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isLinkedElsewhere}
                              onChange={e => toggleHabit(h.id, e.target.checked)}
                              style={{ accentColor: 'var(--gold)', width: '14px', height: '14px', flexShrink: 0, cursor: isLinkedElsewhere ? 'not-allowed' : 'pointer' }}
                            />
                            <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: isSelected ? 'var(--text-0)' : 'var(--text-1)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {h.name}
                            </span>
                            <span style={{
                              flexShrink: 0, fontSize: '10px', fontWeight: 500,
                              color: isSelected ? 'var(--gold)' : 'var(--text-3)',
                              background: isSelected ? 'rgba(212,168,83,0.12)' : 'var(--bg-4)',
                              borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap',
                            }}>
                              {isLinkedElsewhere ? 'Already linked' : h.frequency}
                            </span>
                          </label>
                          {isSelected && (
                            <div style={{ padding: '0 12px 10px 36px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                min={1}
                                max={9999}
                                value={targetVal ?? ''}
                                onChange={e => setTarget(h.id, e.target.value)}
                                placeholder="Target completions (e.g. 30)"
                                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: 'var(--text-0)', outline: 'none', fontFamily: 'inherit' }}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>/ goal</span>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Show hint when showing top 4 and there are more */}
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
          ) : hasSteps || form.tracking_mode === 'steps' ? (
            <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '10px 13px', fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--gold)', fontSize: '14px' }}>✦</span>
              {hasSteps
                ? `Progress is calculated from step completion (${goal?.progress_pct ?? 0}% — ${(goal?.steps ?? []).filter(s => s.completed).length}/${(goal?.steps ?? []).length} steps done)`
                : 'Progress will be calculated from step completion once steps are added.'}
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Progress — {form.progress_pct}%</label>
              <input type="range" min={0} max={100} value={form.progress_pct} onChange={e => set('progress_pct', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
              <div style={{ height: '3px', background: 'var(--bg-4)', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
                <div style={{ height: '100%', borderRadius: '4px', background: CATEGORY_COLORS[form.category] ?? CATEGORY_COLORS.other, width: `${form.progress_pct}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Target date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input type="date" value={form.target_date ?? ''} onChange={e => set('target_date', e.target.value || null)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {mode === 'add' && form.tracking_mode !== 'habits' && (
            <div style={{ background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '8px', padding: '10px 13px', fontSize: '12.5px', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>✦</span>
              Jaune will automatically break this goal into steps when you save.
            </div>
          )}

          {error && <div style={{ fontSize: '13px', color: '#e07060', background: 'rgba(200,80,60,0.08)', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: '9px', padding: '12px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '9px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Saving…' : mode === 'add' ? 'Add goal' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
