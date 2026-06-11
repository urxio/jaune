'use client'

import { useEffect, useState } from 'react'
import type { Retrospective } from '@/lib/ai/retrospective'

type ApiResponse =
  | { available: true; retrospective: Retrospective; month: string; generated_at: string }
  | { available: false; month: string; checkinCount: number; needed: number }
  | { error: string }

function renderBold(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 600, color: 'var(--text-0)' }}>{part.slice(2, -2)}</strong>
      : part
  )
}

/**
 * "What Jaune learned about you this month" — generated once per calendar
 * month, citing real evidence from the user's data.
 */
export default function MonthlyRetrospective() {
  const [state, setState] = useState<'loading' | 'ready' | 'locked' | 'error'>('loading')
  const [retro, setRetro] = useState<Retrospective | null>(null)
  const [needed, setNeeded] = useState(0)
  const [month, setMonth] = useState('')

  useEffect(() => {
    fetch('/api/retrospective')
      .then(r => r.json())
      .then((data: ApiResponse) => {
        if ('error' in data) { setState('error'); return }
        setMonth(data.month)
        if (data.available) { setRetro(data.retrospective); setState('ready') }
        else { setNeeded(data.needed); setState('locked') }
      })
      .catch(() => setState('error'))
  }, [])

  if (state === 'error') return null

  const monthLabel = month
    ? new Date(month + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div style={{ marginBottom: '28px', animation: 'fadeUp 0.35s var(--ease) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.2)',
          borderRadius: '20px', padding: '3px 10px',
          fontSize: '10px', color: 'var(--gold)', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {monthLabel ? `${monthLabel} · Retrospective` : 'Monthly Retrospective'}
        </div>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {state === 'loading' && (
        <div className="glass-card-sm" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[92, 85, 70].map((w, i) => (
              <div key={i} style={{ height: '13px', borderRadius: '6px', background: 'var(--bg-3)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '14px' }}>
            Jaune is looking back over your month…
          </div>
        </div>
      )}

      {state === 'locked' && (
        <div className="glass-card-sm" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '20px', opacity: 0.5, flexShrink: 0 }}>🗓</div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
            Your first monthly retrospective unlocks after <strong style={{ color: 'var(--text-1)' }}>{needed} more check-in{needed !== 1 ? 's' : ''}</strong>.
            The more days Jaune sees, the more it has to reflect back.
          </div>
        </div>
      )}

      {state === 'ready' && retro && (
        <div className="glass-card-sm" style={{ padding: '26px 28px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 300, color: 'var(--text-0)', lineHeight: 1.8 }}>
            {retro.narrative.split(/\n{2,}/).map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? '0 0 10px' : '0 0 10px' }}>{renderBold(para)}</p>
            ))}
          </div>

          {retro.observations.length > 0 && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {retro.observations.map((o, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', marginTop: '8px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-1)', lineHeight: 1.6 }}>{renderBold(o.text)}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>{o.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {retro.looking_ahead && (
            <div style={{
              marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--glass-card-border-subtle)',
              fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65, fontStyle: 'italic',
            }}>
              {renderBold(retro.looking_ahead)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
