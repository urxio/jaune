'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitPriorityOutcomes } from '@/app/actions/brief-outcomes'
import type { Brief, PriorityOutcomeStatus } from '@/lib/types'

const OPTIONS: Array<{ value: PriorityOutcomeStatus; label: string; symbol: string }> = [
  { value: 'done',    label: 'Done',    symbol: '✓' },
  { value: 'partial', label: 'Partial', symbol: '◐' },
  { value: 'skipped', label: 'Skipped', symbol: '—' },
]

function optionColor(value: PriorityOutcomeStatus): string {
  if (value === 'done') return 'var(--sage)'
  if (value === 'partial') return 'var(--gold)'
  return 'var(--text-3)'
}

/**
 * Asks how yesterday's brief priorities actually went — done / partial / skipped.
 * Shown above the check-in flow until answered or dismissed. The recorded
 * outcomes feed the next brief, so Jaune can acknowledge follow-through.
 */
export default function YesterdayPlanReview({ brief }: { brief: Brief }) {
  const [choices, setChoices] = useState<Record<number, PriorityOutcomeStatus>>({})
  const [saving, setSaving] = useState(false)
  const [hidden, setHidden] = useState(false)
  const router = useRouter()

  if (hidden || brief.priorities.length === 0) return null

  const allAnswered = brief.priorities.every((_, i) => choices[i])

  async function save(dismiss: boolean) {
    setSaving(true)
    try {
      const outcomes = dismiss
        ? []
        : brief.priorities.map((p, i) => ({ title: p.title, outcome: choices[i] }))
      await submitPriorityOutcomes(brief.brief_date, outcomes)
      setHidden(true)
      router.refresh()
    } catch (err) {
      console.error('save outcomes failed:', err)
      setSaving(false)
    }
  }

  return (
    <div className="glass-card-sm" style={{ padding: '22px 24px', marginBottom: '24px', animation: 'fadeUp 0.3s var(--ease) both' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 400, color: 'var(--text-0)' }}>
          How did yesterday&apos;s plan go?
        </div>
        <button
          onClick={() => save(true)}
          disabled={saving}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer',
            fontFamily: 'inherit', opacity: 0.7, flexShrink: 0,
          }}
        >
          Skip
        </button>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '18px', lineHeight: 1.5 }}>
        No judgment — this is how Jaune learns which plans actually fit your days.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
        {brief.priorities.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexWrap: 'wrap',
            padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '10px',
          }}>
            <div style={{ fontSize: '13.5px', color: 'var(--text-1)', lineHeight: 1.4, flex: '1 1 200px', minWidth: 0 }}>
              {p.title}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {OPTIONS.map(opt => {
                const active = choices[i] === opt.value
                const color = optionColor(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => setChoices(prev => ({ ...prev, [i]: opt.value }))}
                    style={{
                      padding: '7px 12px', minHeight: '34px',
                      borderRadius: '17px',
                      border: `1px solid ${active ? color : 'var(--border-md)'}`,
                      background: active ? 'color-mix(in srgb, ' + color + ' 14%, transparent)' : 'transparent',
                      color: active ? color : 'var(--text-2)',
                      fontSize: '12px', fontWeight: active ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                  >
                    <span>{opt.symbol}</span>{opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => save(false)}
          disabled={!allAnswered || saving}
          style={{
            padding: '10px 26px',
            background: allAnswered ? 'var(--gold)' : 'var(--bg-3)',
            color: allAnswered ? '#131110' : 'var(--text-3)',
            border: 'none', borderRadius: '9999px',
            fontSize: '13px', fontWeight: 700,
            cursor: allAnswered && !saving ? 'pointer' : 'default',
            fontFamily: 'inherit',
            opacity: saving ? 0.65 : 1,
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
