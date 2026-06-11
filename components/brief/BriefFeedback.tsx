'use client'

import { useState } from 'react'
import { submitBriefFeedback } from '@/app/actions/brief-feedback'

/**
 * Thumbs up/down on a brief. Thumbs-down reveals a one-line "what missed?"
 * input. Quietly disappears into a thank-you once submitted.
 */
export default function BriefFeedback({ briefId, briefDate }: { briefId: string; briefDate: string }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Brief never persisted (storage failure) — nothing to attach feedback to
  if (briefId === 'temp') return null

  async function send(r: 'up' | 'down', c?: string) {
    setSaving(true)
    try {
      await submitBriefFeedback(briefId, briefDate, r, c)
      if (r === 'up' || c !== undefined) setSubmitted(true)
    } catch (err) {
      console.error('brief feedback failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 0', fontSize: '11.5px', color: 'var(--text-3)', animation: 'fadeUp 0.25s var(--ease) both' }}>
        Thanks — Jaune learns from this.
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 4px 0', animation: 'fadeUp 0.25s var(--ease) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
        <span style={{ fontSize: '11.5px', color: 'var(--text-3)', opacity: 0.8 }}>Was this on point?</span>
        <ThumbButton
          active={rating === 'up'}
          disabled={saving}
          label="Good brief"
          onClick={() => { setRating('up'); void send('up') }}
          path="M7 22V11l5-9 1.5 1.5c.3.3.5.8.5 1.3V9h6c1.1 0 2 .9 2 2l-2.4 9.4c-.2.9-1 1.6-2 1.6H7zm0 0H3V11h4"
        />
        <ThumbButton
          active={rating === 'down'}
          disabled={saving}
          label="Missed the mark"
          onClick={() => { setRating('down'); void send('down') }}
          path="M17 2v11l-5 9-1.5-1.5c-.3-.3-.5-.8-.5-1.3V15H4c-1.1 0-2-.9-2-2l2.4-9.4c.2-.9 1-1.6 2-1.6H17zm0 0h4v11h-4"
        />
      </div>

      {rating === 'down' && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', animation: 'fadeUp 0.2s var(--ease) both' }}>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void send('down', comment) }}
            placeholder="What missed? (optional)"
            autoFocus
            style={{
              flex: 1,
              background: 'var(--bg-1)', border: '1px solid var(--border-md)',
              borderRadius: '8px', padding: '8px 12px',
              fontFamily: 'var(--font-sans)', fontSize: '13px',
              color: 'var(--text-0)', outline: 'none',
              caretColor: 'var(--gold)',
            }}
          />
          <button
            onClick={() => void send('down', comment)}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-3)', color: 'var(--text-1)',
              border: '1px solid var(--border-md)', borderRadius: '8px',
              fontSize: '12.5px', fontWeight: 600,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.65 : 1,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}

function ThumbButton({ active, disabled, label, onClick, path }: {
  active: boolean; disabled: boolean; label: string; onClick: () => void; path: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: '30px', height: '30px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--gold-dim)' : 'transparent',
        border: `1px solid ${active ? 'rgba(212,168,83,0.3)' : 'var(--border-md)'}`,
        borderRadius: '8px',
        color: active ? 'var(--gold)' : 'var(--text-3)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </button>
  )
}
