'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { saveClarifyingAnswer, skipClarifyingQuestion } from '@/app/actions/clarifying-answer'

export type QAPair = { question: string; answer: string }

type Props = {
  questions: string[]
  briefDate: string
  onComplete?: (answers: QAPair[]) => void
}

export default function ClarifyingQuestions({ questions, briefDate, onComplete }: Props) {
  const [remaining, setRemaining] = useState(questions)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [answeredPairs, setAnsweredPairs] = useState<QAPair[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const current = remaining[0]

  // Auto-focus textarea when question appears
  useEffect(() => {
    if (current) textareaRef.current?.focus()
  }, [current])

  if (!current || submitted) {
    if (submitted) {
      return (
        <div className="glass-card-sm" style={{
          padding: '18px 22px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeUp 0.2s var(--ease) both',
        }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
            Thanks — I'll use that to give you better, more personal briefs going forward.
          </span>
        </div>
      )
    }
    return null
  }

  const handleSubmit = () => {
    if (!answer.trim() || isPending) return
    const q = current
    const a = answer.trim()
    const next = remaining.slice(1)
    const newPairs = [...answeredPairs, { question: q, answer: a }]
    setAnswer('')
    setRemaining(next)
    setAnsweredPairs(newPairs)
    if (next.length === 0) {
      setSubmitted(true)
      onComplete?.(newPairs)
    }
    startTransition(async () => {
      await saveClarifyingAnswer(q, a, briefDate)
    })
  }

  const handleSkip = () => {
    if (isPending) return
    const q = current
    const next = remaining.slice(1)
    setRemaining(next)
    if (next.length === 0) {
      // Pass only answered pairs (skipped questions contribute nothing)
      onComplete?.(answeredPairs)
    }
    startTransition(async () => {
      await skipClarifyingQuestion(q)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  const progress = questions.length - remaining.length
  const total    = questions.length

  return (
    <div className="glass-card-sm" style={{
      overflow: 'hidden',
      marginBottom: '16px',
      animation: 'fadeUp 0.25s var(--ease) both',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Pulsing dot */}
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--gold)', animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            Help me understand you better
          </span>
        </div>
        {total > 1 && (
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 500 }}>
            {progress + 1} of {total}
          </span>
        )}
      </div>

      {/* Question */}
      <div style={{ padding: '16px 18px 0' }}>
        <p style={{
          fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 300,
          color: 'var(--text-0)', lineHeight: 1.55, letterSpacing: '0.01em', margin: 0,
        }}>
          {current}
        </p>
      </div>

      {/* Answer input */}
      <div style={{ padding: '12px 18px 16px' }}>
        <textarea
          ref={textareaRef}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer…"
          rows={2}
          style={{
            width: '100%', background: 'var(--bg-3)',
            border: `1px solid ${answer.trim() ? 'var(--border-md)' : 'var(--border)'}`,
            borderRadius: '8px', padding: '10px 13px',
            fontSize: '14px', color: 'var(--text-0)',
            outline: 'none', resize: 'none', lineHeight: 1.5,
            boxSizing: 'border-box', transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
            ⌘ Return to send
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSkip}
              disabled={isPending}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: '7px', padding: '6px 14px',
                fontSize: '12px', color: 'var(--text-3)',
                cursor: isPending ? 'wait' : 'pointer',
                opacity: isPending ? 0.5 : 1, transition: 'all 0.15s',
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
                borderRadius: '7px', padding: '6px 18px',
                fontSize: '12px', fontWeight: 700,
                color: answer.trim() ? '#131110' : 'var(--text-3)',
                cursor: !answer.trim() || isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.6 : 1, transition: 'all 0.15s',
              }}
            >
              {isPending ? 'Saving…' : 'Answer'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar (multi-question) */}
      {total > 1 && (
        <div style={{ height: '2px', background: 'var(--bg-4)' }}>
          <div style={{
            height: '100%', background: 'var(--gold)',
            width: `${((progress) / total) * 100}%`,
            transition: 'width 0.4s var(--ease)',
          }} />
        </div>
      )}
    </div>
  )
}
