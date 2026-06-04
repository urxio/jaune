'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { saveClarifyingAnswer, dismissCheckinFollowup } from '@/app/actions/clarifying-answer'
import { localDateStr } from '@/lib/utils/date'

type Props = {
  question: string
  /** Short snippet of what the user just wrote — shown as "You logged:" */
  context: string
  onDone: () => void
}

export default function FollowupQuestion({ question, context, onDone }: Props) {
  const [answer, setAnswer]     = useState('')
  const [phase, setPhase]       = useState<'question' | 'thanks'>('question')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the input when the card appears
  useEffect(() => { inputRef.current?.focus() }, [])

  const snippet = context.length > 60 ? context.slice(0, 60).trimEnd() + '…' : context

  const handleSubmit = () => {
    if (!answer.trim() || isPending) return
    const q = question
    const a = answer.trim()
    setPhase('thanks')
    startTransition(async () => {
      await saveClarifyingAnswer(q, a, localDateStr())
    })
    // Dismiss after a moment
    setTimeout(onDone, 2200)
  }

  const handleSkip = () => {
    dismissCheckinFollowup(localDateStr()).catch(() => {})
    onDone()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') handleSkip()
  }

  if (phase === 'thanks') {
    return (
      <div className="glass-card-sm" style={{
        marginTop: '16px',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: '10px',
        animation: 'fadeUp 0.2s var(--ease) both',
      }}>
        <span style={{ fontSize: '15px' }}>✦</span>
        <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
          Got it — I'll keep that in mind for your brief.
        </span>
      </div>
    )
  }

  return (
    <div className="glass-card-sm" style={{
      marginTop: '16px',
      overflow: 'hidden',
      animation: 'fadeUp 0.25s var(--ease) both',
    }}>

      {/* "You logged" header */}
      <div style={{
        padding: '11px 16px',
        background: 'var(--bg-2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          You logged
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          &ldquo;{snippet}&rdquo;
        </span>
      </div>

      {/* Locus question */}
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
          {/* Locus avatar dot */}
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '1px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)' }} />
          </div>
          <p style={{
            margin: 0,
            fontSize: '14px', lineHeight: 1.55,
            color: 'var(--text-0)',
            fontFamily: 'var(--font-serif)',
            fontWeight: 300,
          }}>
            {question}
          </p>
        </div>

        {/* Inline answer input */}
        <div style={{ paddingLeft: '34px' }}>
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer…"
            style={{
              width: '100%',
              background: 'var(--bg-3)',
              border: `1px solid ${answer.trim() ? 'var(--border-md)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '13px',
              color: 'var(--text-0)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Enter to send · Esc to skip</span>
            <div style={{ display: 'flex', gap: '7px' }}>
              <button
                onClick={handleSkip}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: '7px', padding: '5px 13px',
                  fontSize: '12px', color: 'var(--text-3)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || isPending}
                style={{
                  background: answer.trim() ? 'var(--gold)' : 'var(--bg-3)',
                  border: `1px solid ${answer.trim() ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: '7px', padding: '5px 16px',
                  fontSize: '12px', fontWeight: 700,
                  color: answer.trim() ? '#131110' : 'var(--text-3)',
                  cursor: !answer.trim() || isPending ? 'default' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                Answer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
