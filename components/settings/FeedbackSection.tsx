'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useToast } from '@/components/ui/ToastContext'

const CATEGORIES = [
  { id: 'bug',       label: 'Something broke' },
  { id: 'idea',      label: 'Idea' },
  { id: 'confusing', label: 'Confusing' },
  { id: 'praise',    label: 'Praise' },
  { id: 'other',     label: 'Other' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

const MAX_LENGTH = 4000

export default function FeedbackSection() {
  const toast = useToast()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<CategoryId>('idea')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const trimmed = message.trim()
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: trimmed, page: pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send feedback')

      toast.success('Thank you — feedback sent')
      setMessage('')
      setCategory('idea')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send feedback')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>
        Feedback
      </div>
      <div className="glass-card-sm" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: open ? '1px solid var(--glass-card-border-subtle)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-1)', fontWeight: 500 }}>Send feedback</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>
              Bugs, ideas, anything that felt off. It goes straight to the person building Jaune.
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ fontSize: '13px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            {open ? 'Cancel' : 'Write…'}
          </button>
        </div>

        {open && (
          <form onSubmit={handleSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORIES.map(c => {
                const selected = c.id === category
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    aria-pressed={selected}
                    style={{
                      padding: '6px 12px', borderRadius: '999px', fontSize: '12px',
                      fontWeight: selected ? 600 : 400,
                      border: `1px solid ${selected ? 'var(--gold)' : 'var(--glass-card-border)'}`,
                      background: selected ? 'rgba(212,168,83,0.12)' : 'transparent',
                      color: selected ? 'var(--gold)' : 'var(--text-2)',
                      cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
                    }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What happened, or what would make this better?"
              rows={5}
              maxLength={MAX_LENGTH}
              autoFocus
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--glass-card-border)', borderRadius: '8px',
                padding: '10px 12px', fontSize: '14px', color: 'var(--text-0)', outline: 'none',
                width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
                lineHeight: 1.5,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                Sent with your email address so you can get a reply.
              </span>
              <button
                type="submit"
                disabled={!canSend}
                style={{
                  padding: '9px 18px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: 600,
                  background: canSend ? 'var(--gold)' : 'var(--bg-3)',
                  color: canSend ? 'var(--bg-0)' : 'var(--text-3)',
                  cursor: canSend ? 'pointer' : 'not-allowed', flexShrink: 0,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
