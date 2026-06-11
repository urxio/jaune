'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveWheelSnapshot } from '@/app/actions/wheel'
import { WHEEL_AREAS, type WheelScores } from '@/lib/types'

/**
 * Quarterly life check — seven 1-10 sliders, one per life area.
 * Rendered only when the latest wheel snapshot is 90+ days old (or absent).
 * Snapshots feed the monthly retrospective's "what moved" comparison.
 */
export default function LifeCheckCard({ previousScores }: { previousScores: WheelScores | null }) {
  const [scores, setScores] = useState<WheelScores>(() =>
    Object.fromEntries(WHEEL_AREAS.map(a => [a.key, previousScores?.[a.key] ?? 5]))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError(null)
    startSaving(async () => {
      try {
        await saveWheelSnapshot(scores)
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  if (saved) {
    return (
      <div className="glass-card-sm" style={{ padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeUp 0.3s var(--ease) both' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--sage)" strokeWidth="2.2" style={{ flexShrink: 0 }}>
          <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
          Logged. Jaune will compare this against your next life check in the monthly retrospective.
        </span>
      </div>
    )
  }

  return (
    <div className="glass-card-sm" style={{ padding: '24px 26px', marginBottom: '28px', animation: 'fadeUp 0.3s var(--ease) both' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--text-0)', marginBottom: '4px' }}>
        Life check
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '22px', lineHeight: 1.5 }}>
        Once a quarter: where does each area honestly feel right now? Ten seconds — your gut answer is the right one.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        {WHEEL_AREAS.map(area => {
          const value = scores[area.key]
          return (
            <div key={area.key} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-1)', width: '150px', flexShrink: 0 }}>
                {area.label}
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={value}
                onChange={e => setScores(prev => ({ ...prev, [area.key]: Number(e.target.value) }))}
                aria-label={`${area.label}: ${value} out of 10`}
                style={{ flex: 1, accentColor: 'var(--gold)', cursor: 'pointer' }}
              />
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '16px', width: '28px', textAlign: 'right',
                color: value >= 7 ? 'var(--sage)' : value <= 4 ? '#c08060' : 'var(--text-1)',
                transition: 'color 0.2s',
              }}>
                {value}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-3)', opacity: 0.7 }}>
          {error ?? 'Asked roughly every 3 months'}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 26px', background: 'var(--gold)', color: '#131110',
            border: 'none', borderRadius: '9999px', fontSize: '13px', fontWeight: 700,
            cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: saving ? 0.65 : 1, transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save life check'}
        </button>
      </div>
    </div>
  )
}
