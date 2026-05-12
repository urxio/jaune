'use client'

import { useEffect, useState, useTransition } from 'react'
import { createHabitAction } from '@/app/actions/habits'
import type { HabitSuggestion } from '@/app/api/habits/suggest/route'
import type { Habit } from '@/lib/types'

type Props = {
  goalId: string
  existingHabitNames: string[]
  onHabitAdded: (name: string, habit: Habit) => void
  onDismiss: () => void
}

export default function HabitSuggestionPanel({ goalId, existingHabitNames, onHabitAdded, onDismiss }: Props) {
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    fetch('/api/habits/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, existingHabitNames }),
    })
      .then(r => r.json())
      .then(({ suggestions: s }) => { if (!cancelled) setSuggestions(s ?? []) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId])

  function handleAdd(idx: number, s: HabitSuggestion) {
    if (addedIds.has(idx)) return
    setAddedIds(prev => new Set(prev).add(idx))
    startTransition(async () => {
      try {
        const habit = await createHabitAction({
          name: s.name,
          emoji: s.emoji,
          days_of_week: [],
          ends_at: null,
          goal_id: goalId,
          goal_target_count: null,
          motivation: null,
          time_of_day: null,
        })
        onHabitAdded(s.name, habit as Habit)
      } catch (err) {
        console.error('createHabitAction from suggestion:', err)
        setAddedIds(prev => { const n = new Set(prev); n.delete(idx); return n })
      }
    })
  }

  // Auto-dismiss once all suggestions are added
  const allAdded = suggestions.length > 0 && addedIds.size >= suggestions.length

  if (!loading && suggestions.length === 0) return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>No habit suggestions available.</span>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
        >×</button>
      </div>
    </div>
  )

  return (
    <div style={{
      marginTop: '12px',
      borderTop: '1px solid var(--border)',
      paddingTop: '14px',
      animation: 'fadeUp 0.2s var(--ease) both',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Suggested habits
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
        >×</button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* All added state */}
      {!loading && allAdded && (
        <div style={{ fontSize: '13px', color: 'var(--text-2)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--sage)' }}>✓</span> Habits added — visible in your Habits page.
        </div>
      )}

      {/* Suggestions */}
      {!loading && !allAdded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {suggestions.map((s, idx) => {
            const added = addedIds.has(idx)
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: added ? 'rgba(122,158,138,0.08)' : 'var(--bg-2)',
                  border: `1px solid ${added ? 'rgba(122,158,138,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '1px' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.rationale}</div>
                </div>
                <button
                  onClick={() => handleAdd(idx, s)}
                  disabled={added || isPending}
                  style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    background: added ? 'rgba(122,158,138,0.25)' : 'var(--gold)',
                    color: added ? 'var(--sage)' : '#131110',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: added || isPending ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {added ? '✓ Added' : '+ Add'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
