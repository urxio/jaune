'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

const MEMORY_RE  = /<memory>\s*([\s\S]*?)\s*<\/memory>/
const REFRESH_RE = /<refresh_pulse>/

// Strip Jaune's hidden control tags — the memory block and the refresh signal,
// complete or still mid-stream — before showing a reply.
function visible(text: string): string {
  return text
    .replace(MEMORY_RE, '')
    .replace(/<refresh_pulse>/g, '')
    .replace(/<(?:memory|refresh_pulse)[\s\S]*$/, '')
    .trimEnd()
}

export default function PulseReply({
  pulseText,
  onRefreshPulse,
}: {
  pulseText: string
  onRefreshPulse?: () => void
}) {
  const [open,      setOpen]      = useState(false)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)

  const inputRef  = useRef<HTMLTextAreaElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setStreaming(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    let satisfied = false
    try {
      const res = await fetch('/api/pulse/reply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next, pulseText }),
        signal:  ctrl.signal,
      })
      if (!res.ok || !res.body) throw new Error('reply failed')

      setMessages(m => [...m, { role: 'assistant', content: '' }])
      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        const shown = visible(acc)
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: shown }
          return copy
        })
      }
      satisfied = REFRESH_RE.test(acc)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong — give that another try in a moment.' }])
      }
    } finally {
      setStreaming(false)
    }

    // Only regenerate the pulse once the user has signalled they're satisfied.
    if (satisfied) onRefreshPulse?.()
  }, [input, streaming, messages, pulseText, onRefreshPulse])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          marginTop: '20px', padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', color: 'var(--text-3)',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 7.5a4.5 4.5 0 0 1-4.5 4.5H5l-3 2.5V7.5A4.5 4.5 0 0 1 6.5 3h2A4.5 4.5 0 0 1 13 7.5Z" />
        </svg>
        Reply to Jaune
      </button>
    )
  }

  return (
    <div style={{ marginTop: '22px', animation: 'fadeUp 0.3s var(--ease) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
          Reply to Jaune
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-3)', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          Close
        </button>
      </div>

      {messages.length > 0 && (
        <div
          ref={threadRef}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', marginBottom: '12px' }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '9px 13px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: '14px', lineHeight: 1.55,
                background: m.role === 'user' ? 'oklch(0.78 0.11 78 / 0.14)' : 'oklch(1 0 0 / 0.05)',
                color: m.role === 'user' ? 'oklch(0.93 0.012 80 / 0.95)' : 'var(--text-1)',
                border: m.role === 'user' ? '1px solid oklch(0.78 0.11 78 / 0.2)' : '1px solid oklch(1 0 0 / 0.06)',
              }}>
                {m.content || (streaming && i === messages.length - 1
                  ? <span style={{ opacity: 0.4 }}>…</span>
                  : '')}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          rows={1}
          placeholder="Tell Jaune what to adjust…"
          style={{
            flex: 1, resize: 'none',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'oklch(1 0 0 / 0.04)',
            border: '1px solid oklch(1 0 0 / 0.1)',
            color: 'var(--text-0)',
            fontSize: '14px', lineHeight: 1.5, fontFamily: 'inherit',
            outline: 'none',
            maxHeight: '120px',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          style={{
            flexShrink: 0,
            width: '38px', height: '38px',
            borderRadius: '50%', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: !input.trim() || streaming ? 'oklch(1 0 0 / 0.08)' : 'var(--gold)',
            color: !input.trim() || streaming ? 'var(--text-3)' : 'oklch(0.2 0.05 80)',
            cursor: !input.trim() || streaming ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}
          aria-label="Send reply"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 13V3M4 7l4-4 4 4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
