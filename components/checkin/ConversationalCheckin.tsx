'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from '@/app/actions/checkin'
import { localDateStr } from '@/lib/utils/date'
import type { CheckIn } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'
import { TabToggle, type Tab } from '@/components/checkin/CheckinTabs'

type Message = { role: 'user' | 'assistant'; content: string }

type CheckinData = {
  energy_level: number
  mood_note: string | null
  blockers: string[]
  highlight: string | null
}

const CHECKIN_DATA_RE = /<checkin_data>\s*([\s\S]*?)\s*<\/checkin_data>/
const SHOW_BRIEF_RE   = /<show_brief>/

function briefKey() {
  return `locus_showBrief_${new Date().toISOString().split('T')[0]}`
}
function readStoredBrief(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(briefKey()) === 'true'
}
function storeShowBrief(val: boolean) {
  if (typeof window === 'undefined') return
  if (val) sessionStorage.setItem(briefKey(), 'true')
  else sessionStorage.removeItem(briefKey())
}

const CHAT_STORAGE_KEY = 'locus_chat_messages'
type StoredChat = { date: string; messages: Message[] }

function readStoredChat(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const stored: StoredChat = JSON.parse(raw)
    const today = new Date().toISOString().split('T')[0]
    return stored.date === today ? stored.messages : []
  } catch { return [] }
}

function saveChat(messages: Message[]) {
  if (typeof window === 'undefined') return
  try {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ date: today, messages }))
  } catch {}
}

function clearChat() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(CHAT_STORAGE_KEY) } catch {}
}

export default function ConversationalCheckin({
  existingCheckin,
  memory,
  hasBrief = false,
  tab,
  setTab,
  todayJournalHasContent = false,
  onCheckinSaved,
}: {
  existingCheckin: CheckIn | null
  memory?: UserMemory | null
  hasBrief?: boolean
  tab?: Tab
  setTab?: (t: Tab) => void
  todayJournalHasContent?: boolean
  onCheckinSaved?: () => void
}) {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [streaming,    setStreaming]    = useState(false)
  const [isSaving,     setIsSaving]    = useState(false)
  const [checkinSaved, setCheckinSaved] = useState(!!existingCheckin)
  const restoredRef = useRef(false)
  const [isRedo,       setIsRedo]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const [checkinData, setCheckinData] = useState<CheckinData | null>(
    existingCheckin
      ? {
          energy_level: existingCheckin.energy_level,
          mood_note:    existingCheckin.mood_note ?? null,
          blockers:     existingCheckin.blockers ?? [],
          highlight:    existingCheckin.highlight ?? null,
        }
      : null
  )
  const [previousCheckin, setPreviousCheckin] = useState<CheckinData | null>(null)

  const chatActive = !existingCheckin || isRedo

  const router            = useRouter()
  const messagesEndRef    = useRef<HTMLDivElement>(null)
  const messagesBoxRef    = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLTextAreaElement>(null)
  const initFetched       = useRef(false)
  const savedRef          = useRef(false)

  useEffect(() => {
    if (!chatActive) return
    const stored = readStoredChat()
    if (stored.length > 0) {
      setMessages(stored)
      restoredRef.current  = true
      initFetched.current  = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chatActive || messages.length === 0) return
    saveChat(messages)
  }, [messages, chatActive])

  useEffect(() => {
    if (checkinSaved) clearChat()
  }, [checkinSaved])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  const saveCheckin = useCallback(async (data: CheckinData, conversationMessages: Message[]) => {
    if (savedRef.current) return
    savedRef.current = true
    setIsSaving(true)
    try {
      await submitCheckin({
        energy_level: data.energy_level,
        mood_note:    data.mood_note,
        blockers:     data.blockers,
        highlight:    data.highlight,
        localDate:    localDateStr(),
      })
      setCheckinSaved(true)
      onCheckinSaved?.()
      router.refresh()

      fetch('/api/checkin/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: conversationMessages, date: localDateStr() }),
      }).catch(err => console.error('[summarize]', err))

    } catch (err) {
      console.error('[saveCheckin]', err)
      savedRef.current = false
    } finally {
      setIsSaving(false)
    }
  }, [router, onCheckinSaved])

  const fetchReply = useCallback(
    async (msgs: Message[], prevCheckin: CheckinData | null = null) => {
      setStreaming(true)
      setError(null)
      let fullText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      try {
        const res = await fetch('/api/checkin/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ messages: msgs, previousCheckin: prevCheckin }),
        })
        if (!res.ok || !res.body) throw new Error('Request failed')

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          const display = fullText
            .replace(CHECKIN_DATA_RE, '')
            .replace(SHOW_BRIEF_RE, '')
            .trim()

          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: display }
            return next
          })
        }

        const dataMatch = fullText.match(CHECKIN_DATA_RE)
        if (dataMatch && !savedRef.current) {
          const data: CheckinData = JSON.parse(dataMatch[1])
          setCheckinData(data)
          await saveCheckin(data, msgs)
        }
      } catch (err) {
        console.error('[ConversationalCheckin]', err)
        setError('Something went wrong — please try again.')
        setMessages(prev => prev.slice(0, -1))
      } finally {
        setStreaming(false)
        inputRef.current?.focus()
      }
    },
    [saveCheckin]
  )

  useEffect(() => {
    if (!chatActive || initFetched.current) return
    initFetched.current = true
    fetchReply([], previousCheckin)
  }, [chatActive, fetchReply, previousCheckin])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || isSaving) return
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
    await fetchReply(next, previousCheckin)
  }, [input, messages, streaming, isSaving, fetchReply, previousCheckin])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const handleRedo = () => {
    setPreviousCheckin(checkinData)
    setIsRedo(true)
    setMessages([])
    setCheckinData(null)
    setCheckinSaved(false)
    storeShowBrief(false)
    clearChat()
    setError(null)
    savedRef.current     = false
    initFetched.current  = false
    restoredRef.current  = false
  }

  const canSend = !!input.trim() && !streaming && !isSaving

  const energyLabel = !checkinData ? '' :
    checkinData.energy_level >= 9 ? 'Exceptional' :
    checkinData.energy_level >= 7 ? 'High' :
    checkinData.energy_level >= 5 ? 'Moderate' :
    checkinData.energy_level >= 3 ? 'Low' : 'Depleted'

  const showSummary = checkinSaved && !!checkinData && !isRedo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px', padding: '26px 28px 20px', flexShrink: 0,
        borderBottom: '1px solid var(--glass-card-border-subtle)',
      }}>
        <div>
          <div style={{
            fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--gold)', fontWeight: 700, marginBottom: '5px', opacity: 0.85,
          }}>
            {isRedo ? 'Updating Check-in' : existingCheckin && !isRedo ? 'Today\'s Check-in' : 'Daily Check-in'}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400,
            color: 'var(--text-0)', lineHeight: 1.2,
          }}>
            How are you{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>showing up</em>{' '}
            today?
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '5px' }}>
            {existingCheckin && !isRedo
              ? 'Your check-in is logged for today.'
              : 'Takes about 90 seconds · Helps Locus understand you better'}
          </div>
        </div>
        {tab && setTab && (
          <div style={{ marginTop: '4px', flexShrink: 0 }}>
            <TabToggle tab={tab} setTab={setTab} todayJournalHasContent={todayJournalHasContent} />
          </div>
        )}
      </div>

      {/* ── Body — flex-grows to fill the panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

        {/* ── EXISTING CHECK-IN (non-redo) ── */}
        {existingCheckin && !isRedo && checkinData && (
          <div style={{ padding: '24px 28px', animation: 'fadeUp 0.25s var(--ease) both' }}>
            <CheckinSummaryCard checkinData={checkinData} isRedo={false} energyLabel={energyLabel} />
            <button
              onClick={handleRedo}
              style={{
                marginTop: '12px', background: 'none', border: '1px solid var(--border-md)',
                color: 'var(--text-2)', borderRadius: '10px', padding: '10px 16px',
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↺ Update check-in
            </button>
          </div>
        )}

        {/* ── CHAT (new or redo) ── */}
        {chatActive && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

            {/* Chat → Summary crossfade container */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

              {/* Chat panel */}
              <div style={{
                position: 'absolute',
                inset: 0,
                opacity: showSummary ? 0 : 1,
                transform: showSummary ? 'translateY(-8px)' : 'translateY(0)',
                pointerEvents: showSummary ? 'none' : 'auto',
                transition: 'opacity 0.35s var(--ease), transform 0.35s var(--ease)',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Saved badge */}
                {checkinSaved && !showSummary && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    margin: '14px 28px 0',
                    padding: '8px 14px',
                    background: 'rgba(122,158,138,0.08)', border: '1px solid rgba(122,158,138,0.2)',
                    borderRadius: '10px', fontSize: '12px', color: 'var(--sage)', fontWeight: 600,
                    animation: 'fadeUp 0.25s var(--ease) both', flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Check-in saved
                  </div>
                )}

                {/* Messages */}
                <div ref={messagesBoxRef} style={{
                  flex: 1, overflowY: 'auto', minHeight: 0,
                  display: 'flex', flexDirection: 'column',
                  scrollbarWidth: 'none',
                }}>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 16px 12px' }}>
                    {messages.map((msg, i) => {
                      const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
                      const showCursor = isLastAssistant && streaming && !msg.content

                      if (msg.role === 'assistant') {
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '88%' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                              background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 10px rgba(212,168,83,0.3)', marginTop: '1px',
                            }}>
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="#131110">
                                <circle cx="8" cy="8" r="3"/>
                                <circle cx="8" cy="2" r="1.2"/>
                                <circle cx="8" cy="14" r="1.2"/>
                                <circle cx="2" cy="8" r="1.2"/>
                                <circle cx="14" cy="8" r="1.2"/>
                              </svg>
                            </div>
                            <div style={{
                              padding: '10px 13px',
                              borderRadius: '4px 16px 16px 16px',
                              background: 'var(--glass-card-bg-strong)',
                              border: '1px solid var(--glass-card-border)',
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                              fontSize: '14px', color: 'var(--text-0)', lineHeight: 1.65,
                              flex: 1,
                            }}>
                              {showCursor ? (
                                <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', paddingTop: '2px' }}>
                                  {[0, 180, 360].map(delay => (
                                    <span key={delay} style={{
                                      width: '5px', height: '5px', borderRadius: '50%',
                                      background: 'var(--text-3)',
                                      animation: 'pulse 1.4s ease-in-out infinite',
                                      animationDelay: `${delay}ms`,
                                    }} />
                                  ))}
                                </span>
                              ) : msg.content}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div style={{
                            maxWidth: '78%', padding: '10px 14px',
                            borderRadius: '16px 4px 16px 16px',
                            background: 'var(--gold-dim)',
                            border: '1px solid rgba(212,168,83,0.28)',
                            fontSize: '14px', color: 'var(--text-0)', lineHeight: 1.6,
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                          }}>
                            {msg.content}
                          </div>
                        </div>
                      )
                    })}

                    {isSaving && (
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', padding: '2px 0' }}>
                        Saving check-in…
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

              {/* Summary card (crossfade in) */}
              {checkinData && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: showSummary ? 1 : 0,
                  transform: showSummary ? 'translateY(0)' : 'translateY(14px)',
                  pointerEvents: showSummary ? 'auto' : 'none',
                  transition: 'opacity 0.4s var(--ease), transform 0.4s var(--ease)',
                  padding: '24px 28px',
                  overflowY: 'auto',
                }}>
                  <CheckinSummaryCard checkinData={checkinData} isRedo={isRedo} energyLabel={energyLabel} />
                  <button
                    onClick={handleRedo}
                    style={{
                      marginTop: '12px', background: 'none', border: 'none',
                      color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer',
                      padding: '4px 0', fontFamily: 'inherit', letterSpacing: '0.02em',
                    }}
                  >
                    ↺ Update check-in
                  </button>
                </div>
              )}
            </div>

            {/* ── Input bar ── */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--glass-card-border-subtle)' }}>
              {error && (
                <div style={{
                  fontSize: '13px', color: '#c08060', margin: '10px 16px 0',
                  padding: '10px 14px', background: 'rgba(192,128,96,0.08)',
                  border: '1px solid rgba(192,128,96,0.2)', borderRadius: '10px',
                }}>
                  {error}
                </div>
              )}
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: '8px',
                padding: '12px 16px',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    streaming    ? '' :
                    checkinSaved ? 'Reply to Locus…' :
                    'Share how you\'re doing…'
                  }
                  readOnly={streaming || isSaving}
                  rows={1}
                  style={{
                    flex: 1,
                    background: 'var(--glass-card-bg-strong)',
                    border: '1px solid var(--glass-card-border)',
                    borderRadius: '14px', outline: 'none',
                    fontFamily: 'var(--font-sans)', fontSize: '15px',
                    color: 'var(--text-0)', resize: 'none', lineHeight: 1.5,
                    overflow: 'hidden', padding: '11px 14px',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send"
                  style={{
                    width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                    background: canSend ? 'var(--gold)' : 'var(--bg-4)', border: 'none',
                    color: canSend ? '#131110' : 'var(--text-3)',
                    cursor: canSend ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, color 0.2s, transform 0.1s',
                    fontSize: '16px', fontWeight: 700, fontFamily: 'inherit',
                    alignSelf: 'flex-end',
                    transform: canSend ? 'scale(1)' : 'scale(0.95)',
                  }}
                >↑</button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', padding: '0 16px 10px', opacity: 0.55 }}>
                Enter to send · Shift+Enter for new line
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Check-in summary card ───────────────────────────────────────────────── */
function CheckinSummaryCard({
  checkinData, isRedo, energyLabel,
}: {
  checkinData: { energy_level: number; mood_note: string | null; blockers: string[]; highlight: string | null }
  isRedo: boolean
  energyLabel: string
}) {
  const blockerCount = checkinData.blockers.filter(b => b !== 'No blockers today').length

  return (
    <div style={{
      background: 'var(--glass-card-bg-strong)',
      border: '1px solid var(--glass-card-border)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '18px', padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(122,158,138,0.28), rgba(122,158,138,0.08))',
          border: '1px solid rgba(122,158,138,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--sage)" strokeWidth="2.2">
            <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.2 }}>
            {isRedo ? 'Check-in updated.' : 'Check-in complete.'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
            {isRedo ? 'Your brief will regenerate with the new data.' : 'Locus has noted everything for today.'}
          </div>
        </div>
      </div>

      <div className="stats-grid-3">
        <SummaryTile label="Energy"    value={`${checkinData.energy_level}/10`} sub={energyLabel} />
        <SummaryTile label="Mood note" value={checkinData.mood_note ? '✓ logged' : '—'}
          sub={checkinData.mood_note
            ? checkinData.mood_note.slice(0, 24) + (checkinData.mood_note.length > 24 ? '…' : '')
            : 'skipped'} />
        <SummaryTile label="Blockers"  value={`${blockerCount}`}
          sub={blockerCount === 0
            ? 'none today'
            : checkinData.blockers.filter(b => b !== 'No blockers today')[0]?.slice(0, 20)} />
      </div>

      {checkinData.highlight && (
        <div style={{
          marginTop: '12px', padding: '9px 13px',
          background: 'rgba(122,158,138,0.07)', border: '1px solid rgba(122,158,138,0.18)',
          borderRadius: '9px', fontSize: '13px', color: 'var(--text-1)',
          display: 'flex', alignItems: 'flex-start', gap: '7px',
        }}>
          <span style={{ color: 'var(--sage)', flexShrink: 0 }}>★</span>
          <span>{checkinData.highlight}</span>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--glass-card-bg)',
      border: '1px solid var(--glass-card-border-subtle)',
      borderRadius: '12px', padding: '12px 14px',
    }}>
      <div style={{
        fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase',
        letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400,
        color: 'var(--text-0)', lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: '11px', color: 'var(--text-3)', marginTop: '3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub}</div>
      )}
    </div>
  )
}
