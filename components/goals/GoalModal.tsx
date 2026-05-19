'use client'

import { useState, useTransition } from 'react'
import type { GoalWithSteps } from '@/lib/types'
import { createGoalAction, updateGoalAction, type GoalFormData } from '@/app/actions/goals'
import { inputStyle, labelStyle } from '@/components/ui/FormStyles'
import { CATEGORY_COLORS } from './GoalCard'

const CATEGORIES = ['product', 'health', 'learning', 'financial', 'wellbeing', 'other']
const TIMEFRAMES  = ['quarter', 'year', 'ongoing']
const STATUSES    = ['active', 'paused', 'completed']

export const EMPTY_FORM: GoalFormData = {
  title: '', category: 'product', timeframe: 'quarter',
  progress_pct: 0, target_date: null, status: 'active',
  tracking_mode: 'manual',
}

export default function GoalModal({ mode, goal, hasSteps, onClose, onSaved }: {
  mode: 'add' | 'edit'; goal?: GoalWithSteps; hasSteps: boolean
  onClose: () => void; onSaved: (g: GoalWithSteps, isNew: boolean) => void
}) {
  const [form, setForm] = useState<GoalFormData>(
    goal
      ? { title: goal.title, category: goal.category, timeframe: goal.timeframe, progress_pct: goal.progress_pct, target_date: goal.target_date, status: goal.status, tracking_mode: goal.tracking_mode ?? 'manual' }
      : EMPTY_FORM
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const set = (k: keyof GoalFormData, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setError('')
    startTransition(async () => {
      try {
        if (mode === 'add') {
          const created = await createGoalAction(form)
          onSaved({ ...created, steps: [] } as unknown as GoalWithSteps, true)
        } else if (goal) {
          await updateGoalAction(goal.id, form)
          onSaved({ ...goal, ...form, title: form.title.trim() } as unknown as GoalWithSteps, false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} className="modal-overlay" style={{ backdropFilter: 'blur(4px)', animation: 'fadeUp 0.15s var(--ease) both' }}>
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
                  <button key={opt.value} type="button" onClick={() => set('tracking_mode', opt.value)}
                    style={{ padding: '10px 8px', borderRadius: '8px', border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`, background: active ? 'var(--gold-dim)' : 'var(--bg-3)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '16px', marginBottom: '3px', color: active ? 'var(--gold)' : 'var(--text-2)' }}>{opt.icon}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: active ? 'var(--gold)' : 'var(--text-1)', letterSpacing: '0.04em' }}>{opt.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px', lineHeight: 1.3 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {form.tracking_mode === 'habits' ? (
            <div style={{ background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--sage)', fontSize: '14px' }}>⟳</span>
                <span>Progress updates automatically each time you check a linked habit.</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', paddingLeft: '22px' }}>
                After saving, open each linked habit to set its individual completion target (e.g. "30 runs"). Leave blank to track by schedule instead.
              </div>
            </div>
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
          {mode === 'add' && form.tracking_mode === 'habits' && (
            <div style={{ background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)', borderRadius: '8px', padding: '10px 13px', fontSize: '12.5px', color: 'var(--sage)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>⟳</span>
              After saving, link habits to this goal and every daily check will push progress forward.
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
