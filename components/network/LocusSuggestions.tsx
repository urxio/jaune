'use client'

import { useState, useTransition } from 'react'
import type { Person, PersonGroup, PersonSuggestion } from '@/lib/types'
import { createPersonAction } from '@/app/actions/people'

const RELATIONSHIP_TO_GROUP: Record<string, PersonGroup> = {
  friend:    'friends',
  family:    'family',
  partner:   'family',
  colleague: 'work',
  manager:   'work',
  other:     'acquaintances',
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--sage)',
  negative: '#e05c4a',
  mixed:    'var(--gold)',
  neutral:  'var(--text-3)',
}

function guessGroup(relationship: string): PersonGroup {
  return RELATIONSHIP_TO_GROUP[relationship.toLowerCase()] ?? 'acquaintances'
}

export default function LocusSuggestions({
  suggestions,
  onAdded,
  onDismiss,
}: {
  suggestions: PersonSuggestion[]
  onAdded: (p: Person) => void
  onDismiss: () => void
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Record<string, PersonGroup>>(() =>
    Object.fromEntries(suggestions.map(s => [s.name, guessGroup(s.relationship)]))
  )
  const [adding, startTransition] = useTransition()
  const [pendingName, setPendingName] = useState<string | null>(null)

  const visible = suggestions.filter(s => !dismissed.has(s.name))

  const handleAdd = (s: PersonSuggestion) => {
    setPendingName(s.name)
    startTransition(async () => {
      try {
        const created = await createPersonAction({
          name: s.name,
          group: groups[s.name],
          notes: s.context,
        })
        onAdded(created as Person)
        setDismissed(prev => new Set(prev).add(s.name))
      } finally {
        setPendingName(null)
      }
    })
  }

  const handleDismiss = (name: string) =>
    setDismissed(prev => new Set(prev).add(name))

  if (visible.length === 0) {
    return (
      <div style={{
        background: 'var(--glass-card-bg)',
        border: '1px solid var(--glass-card-border)',
        borderRadius: '14px',
        padding: '20px 22px',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          All suggestions reviewed.
        </span>
        <button onClick={onDismiss} style={{ fontSize: '12px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--glass-card-bg)',
      border: '1px solid var(--sage)',
      borderRadius: '16px',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--sage)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--sage)' }}>
            Locus knows {visible.length} {visible.length === 1 ? 'person' : 'people'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>from your journals & check-ins</span>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>

      {/* Suggestion rows */}
      <div>
        {visible.map((s, i) => {
          const isPending = adding && pendingName === s.name
          const sentimentColor = SENTIMENT_COLOR[s.sentiment] ?? 'var(--text-3)'

          return (
            <div
              key={s.name}
              style={{
                padding: '14px 18px',
                borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(122,158,138,0.12)',
                border: '1.5px solid rgba(122,158,138,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: 'var(--sage)',
              }}>
                {s.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>{s.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: sentimentColor, background: `${sentimentColor}18`, padding: '2px 7px', borderRadius: '20px' }}>
                    {s.sentiment}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    mentioned {s.mentions}×
                  </span>
                </div>
                <p style={{ margin: '4px 0 8px', fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.5, fontStyle: 'italic' }}>
                  {s.context}
                </p>
                {/* Group picker */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(['friends', 'acquaintances', 'work', 'family'] as PersonGroup[]).map(g => {
                    const active = groups[s.name] === g
                    return (
                      <button
                        key={g}
                        onClick={() => setGroups(prev => ({ ...prev, [s.name]: g }))}
                        style={{
                          fontSize: '11px', fontWeight: 600,
                          padding: '3px 9px', borderRadius: '20px',
                          border: `1px solid ${active ? 'var(--sage)' : 'var(--border)'}`,
                          background: active ? 'rgba(122,158,138,0.12)' : 'transparent',
                          color: active ? 'var(--sage)' : 'var(--text-3)',
                          cursor: 'pointer', transition: 'all 0.12s',
                          textTransform: 'capitalize',
                        }}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                <button
                  onClick={() => handleAdd(s)}
                  disabled={isPending}
                  style={{
                    background: 'var(--sage)', color: '#fff', border: 'none',
                    borderRadius: '8px', padding: '7px 14px',
                    fontSize: '12px', fontWeight: 600, cursor: isPending ? 'wait' : 'pointer',
                    opacity: isPending ? 0.7 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {isPending ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => handleDismiss(s.name)}
                  disabled={isPending}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text-3)', fontSize: '11px',
                    cursor: 'pointer', padding: '2px 0', textAlign: 'center',
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
