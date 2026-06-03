'use client'

import { useState } from 'react'
import type { Brief } from '@/lib/types'

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  work:     { bg: 'rgba(122,158,138,0.12)', color: 'var(--sage)' },
  health:   { bg: 'rgba(180,130,100,0.12)', color: '#c89060' },
  personal: { bg: 'rgba(212,168,83,0.1)',   color: 'var(--gold)' },
  learning: { bg: 'rgba(100,130,180,0.12)', color: '#6090c8' },
}

function energyLabel(score: number | null) {
  if (!score) return null
  if (score >= 8) return { label: 'High', color: 'var(--sage)' }
  if (score >= 6) return { label: 'Good', color: '#a0b890' }
  if (score >= 4) return { label: 'Moderate', color: 'var(--gold)' }
  return { label: 'Low', color: '#c07060' }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const today   = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function BriefHistoryCard({ brief }: { brief: Brief }) {
  const [expanded, setExpanded] = useState(false)
  const energy = energyLabel(brief.energy_score)

  return (
    <div className="glass-card-sm" style={{ overflow: 'hidden', transition: 'border-color 0.2s' }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Date + energy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em' }}>
              {formatDate(brief.brief_date)}
            </span>
            {energy && (
              <span style={{
                fontSize: '9.5px', fontWeight: 700, color: energy.color,
                background: `${energy.color}18`, borderRadius: '10px',
                padding: '1px 6px', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {energy.label} · {brief.energy_score}
              </span>
            )}
          </div>
          {/* Insight preview */}
          <div style={{
            fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.45,
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
          }}>
            {brief.insight_text}
          </div>
        </div>
        {/* Chevron */}
        <span style={{
          fontSize: '11px', color: 'var(--text-3)', flexShrink: 0,
          transition: 'transform 0.2s', display: 'inline-block',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>

      {/* Expanded: full insight + priorities */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 18px',
          animation: 'fadeUp 0.18s var(--ease) both',
        }}>
          {/* Full insight if it was truncated */}
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '14.5px', fontWeight: 300,
            color: 'var(--text-1)', lineHeight: 1.65, marginBottom: '16px', letterSpacing: '0.01em',
          }}>
            {brief.insight_text}
          </div>

          {/* Priorities */}
          {brief.priorities?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                Priorities that day
              </div>
              {brief.priorities.map((p, i) => {
                const c = CATEGORY_COLORS[p.category] ?? { bg: 'var(--bg-3)', color: 'var(--text-3)' }
                const accent = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--sage)' : 'var(--border-md)'
                return (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    background: 'var(--bg-2)', borderRadius: '8px',
                    padding: '10px 12px', position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: accent }} />
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 300,
                      color: accent, lineHeight: 1, flexShrink: 0, width: '18px',
                      textAlign: 'right', opacity: 0.6, paddingLeft: '4px',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)', lineHeight: 1.3, marginBottom: '3px' }}>
                        {p.title}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: c.bg, color: c.color }}>
                          {p.category}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{p.estimated_time}</span>
                        {p.time_of_day && p.time_of_day !== 'flexible' && (
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>· {p.time_of_day}</span>
                        )}
                      </div>
                      {p.reasoning && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.45, fontStyle: 'italic' }}>
                          {p.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BriefHistory({ briefs }: { briefs: Brief[] }) {
  const [visible, setVisible] = useState(false)

  if (briefs.length === 0) return null

  return (
    <div style={{ marginTop: '28px' }}>
      {/* Section toggle */}
      <button
        onClick={() => setVisible(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px',
          width: '100%', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {visible ? '↑ Hide history' : `↓ Brief history · ${briefs.length} day${briefs.length !== 1 ? 's' : ''}`}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </button>

      {visible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeUp 0.22s var(--ease) both' }}>
          {briefs.map(b => (
            <BriefHistoryCard key={b.id} brief={b} />
          ))}
        </div>
      )}
    </div>
  )
}
