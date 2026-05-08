'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { saveJournalAction } from '@/app/actions/journal'
import { localDateStr } from '@/lib/utils/date'
import type { JournalEntry } from '@/lib/types'
import { TabToggle, type Tab } from '@/components/checkin/CheckinTabs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function formatDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

function getWeekDays(todayStr: string, weekOffset = 0): Array<{
  label: string; dateStr: string; isToday: boolean; isFuture: boolean
}> {
  const [y, m, d] = todayStr.split('-').map(Number)
  const today = new Date(y, m - 1, d)
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7)

  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dateStr = localDateStr(date)
    return { label, dateStr, isToday: dateStr === todayStr, isFuture: date > today }
  })
}

// ─── Date sidebar ─────────────────────────────────────────────────────────────

function weekLabel(offset: number): string {
  if (offset === 0) return 'This week'
  if (offset === -1) return 'Last week'
  return `${Math.abs(offset)} weeks ago`
}

const WEEKS_BACK = 12

function DateSidebar({
  todayStr, selectedDate, recentJournals, tab, setTab, todayJournalHasContent,
  onSelectDate,
}: {
  todayStr: string
  selectedDate: string
  recentJournals: JournalEntry[]
  tab?: Tab
  setTab?: (t: Tab) => void
  todayJournalHasContent: boolean
  onSelectDate: (date: string) => void
}) {
  const journalDates = new Set(recentJournals.filter(j => j.content.trim()).map(j => j.date))
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayRowRef = useRef<HTMLButtonElement>(null)

  const weeks = Array.from({ length: WEEKS_BACK + 1 }, (_, i) => ({
    offset: -i,
    days: getWeekDays(todayStr, -i),
  }))

  useLayoutEffect(() => {
    todayRowRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  function DayRow({ dateStr, isToday, isFuture }: { dateStr: string; isToday: boolean; isFuture: boolean }) {
    const isSelected = dateStr === selectedDate
    const hasEntry = journalDates.has(dateStr)
    const clickable = !isFuture

    return (
      <button
        ref={isToday ? todayRowRef : undefined}
        onClick={() => clickable && onSelectDate(dateStr)}
        disabled={!clickable}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '7px 12px', borderRadius: '10px', border: 'none',
          cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit',
          background: isSelected ? 'var(--glass-card-bg-strong)' : 'transparent',
          transition: 'background 0.13s',
          opacity: isFuture ? 0.3 : 1,
          boxShadow: isSelected ? 'var(--glass-card-shadow-sm)' : 'none',
        }}
        onMouseEnter={e => { if (clickable && !isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--glass-card-bg)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{
          fontSize: '11px', fontWeight: 600, width: '22px', textAlign: 'center', flexShrink: 0,
          color: isSelected ? 'var(--text-0)' : isToday ? 'var(--gold)' : 'var(--text-3)',
          letterSpacing: '0.04em',
        }}>
          {formatDayName(dateStr)}
        </span>

        <span style={{
          fontSize: '12.5px', flex: 1, textAlign: 'left',
          color: isSelected ? 'var(--text-0)' : 'var(--text-2)',
          fontWeight: isSelected || isToday ? 600 : 400,
        }}>
          {isToday ? 'Today' : formatShortDate(dateStr)}
        </span>

        {hasEntry && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
            background: isSelected ? 'var(--sage)' : 'var(--sage-dim)',
            border: '1px solid var(--sage)',
          }} />
        )}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '22px 16px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--glass-card-border-subtle)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: tab && setTab ? '14px' : '0',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-3)',
          }}>
            Journal
          </span>
          <a href="/checkin/history" style={{
            fontSize: '10px', color: 'var(--text-3)', textDecoration: 'none',
            fontWeight: 600, letterSpacing: '0.04em', opacity: 0.7,
          }}>
            All →
          </a>
        </div>
        {tab && setTab && (
          <TabToggle tab={tab} setTab={setTab} todayJournalHasContent={todayJournalHasContent} />
        )}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 6px', scrollbarWidth: 'none' }}>
        {weeks.map(({ offset, days }) => (
          <div key={offset}>
            <div style={{
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--text-3)',
              padding: offset === 0 ? '4px 12px 6px' : '14px 12px 6px', opacity: 0.6,
            }}>
              {weekLabel(offset)}
            </div>
            {days.map(day => (
              <DayRow key={day.dateStr} dateStr={day.dateStr} isToday={day.isToday} isFuture={day.isFuture} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Locus icon ───────────────────────────────────────────────────────────────

function LocusIcon() {
  return (
    <div style={{
      width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="9" height="9" viewBox="0 0 16 16" fill="#131110">
        <circle cx="8" cy="8" r="3"/>
        <circle cx="8" cy="2" r="1.2"/>
        <circle cx="8" cy="14" r="1.2"/>
        <circle cx="2" cy="8" r="1.2"/>
        <circle cx="14" cy="8" r="1.2"/>
      </svg>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JournalSection({
  existing,
  recentJournals = [],
  tab,
  setTab,
  todayJournalHasContent = false,
}: {
  existing: JournalEntry | null
  recentJournals?: JournalEntry[]
  tab?: Tab
  setTab?: (t: Tab) => void
  todayJournalHasContent?: boolean
}) {
  const todayStr = localDateStr()
  const CARD_H = 'min(680px, calc(100vh - 156px))'

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const isToday = selectedDate === todayStr

  function entryForDate(date: string): string {
    if (date === todayStr) return existing?.content ?? ''
    return recentJournals.find(j => j.date === date)?.content ?? ''
  }

  function commentForDate(date: string): string | null {
    if (date === todayStr) return existing?.locus_comment ?? null
    return recentJournals.find(j => j.date === date)?.locus_comment ?? null
  }

  const [content, setContent] = useState(entryForDate(todayStr))
  const [status, setStatus]   = useState<'idle' | 'saving' | 'saved'>('idle')

  const CACHE_KEY = 'locus_journal_comment_cache_v2'
  const readStorage = (): Record<string, string> => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
      if (!raw || typeof raw !== 'object') return {}
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    } catch { return {} }
  }
  const writeStorage = (store: Record<string, string>) => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(store)) } catch {}
  }
  const getCached = (date: string): string | null => readStorage()[date] ?? null
  const setCached = (date: string, comment: string | null) => {
    const store = readStorage()
    if (comment) store[date] = comment
    else delete store[date]
    writeStorage(store)
  }

  // Init from server-side data only to keep SSR/hydration in sync.
  // sessionStorage is read in useEffect after mount.
  const [locusComment,        setLocusComment]        = useState<string | null>(() => commentForDate(todayStr))
  const [locusCommentLoading, setLocusCommentLoading] = useState(false)
  const [locusCommentError,   setLocusCommentError]   = useState(false)
  const [locusClarification,  setLocusClarification]  = useState<string | null>(null)
  const [clarificationReply,  setClarificationReply]  = useState('')

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setContent(entryForDate(selectedDate))
    setStatus('idle')
    setLocusComment(commentForDate(selectedDate) ?? getCached(selectedDate))
    setLocusCommentLoading(false)
    setLocusCommentError(false)
    setLocusClarification(null)
    setClarificationReply('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0

  const saveToDb = useCallback(async (text: string, date: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setStatus('saving')
    try {
      await saveJournalAction(trimmed, date)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch { setStatus('idle') }
  }, [])

  const handleChange = (val: string) => {
    setContent(val)
    setStatus('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => saveToDb(val, selectedDate), 1800)
  }

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!content.trim()) return
    saveToDb(content, selectedDate)
  }

  const callLocusComment = async (extra?: { clarification: string; clarificationAnswer: string }) => {
    setLocusCommentLoading(true)
    setLocusCommentError(false)
    try {
      const res = await fetch('/api/journal/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          date: selectedDate,
          ...(extra ?? {}),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.comment) {
        setLocusComment(data.comment)
        setCached(selectedDate, data.comment)
        setLocusClarification(null)
        setClarificationReply('')
      } else if (data.clarification) {
        setLocusClarification(data.clarification)
        setClarificationReply('')
      } else {
        setLocusCommentError(true)
        setTimeout(() => setLocusCommentError(false), 4000)
      }
    } catch (err) {
      console.error('[share-with-locus]', err)
      setLocusCommentError(true)
      setTimeout(() => setLocusCommentError(false), 4000)
    } finally {
      setLocusCommentLoading(false)
    }
  }

  const handleShareWithLocus = async () => {
    if (locusCommentLoading || locusComment || locusClarification) return
    if (timerRef.current) clearTimeout(timerRef.current)
    await saveToDb(content, selectedDate)
    await callLocusComment()
  }

  const handleClarificationSubmit = async () => {
    const answer = clarificationReply.trim()
    if (!answer || !locusClarification || locusCommentLoading) return
    await callLocusComment({ clarification: locusClarification, clarificationAnswer: answer })
  }

  const journalsForMap: JournalEntry[] = existing
    ? [existing, ...recentJournals.filter(j => j.date !== todayStr)]
    : recentJournals

  return (
    <div className="page-pad" style={{ maxWidth: '1180px' }}>
      <div className="journal-layout">

        {/* ── LEFT: Date sidebar ── */}
        <div className="glass-card-soft" style={{ height: CARD_H, overflow: 'hidden', position: 'relative' }}>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            background: 'var(--card-overlay)', opacity: 0.25,
          }} />
          <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
            <DateSidebar
              todayStr={todayStr}
              selectedDate={selectedDate}
              recentJournals={journalsForMap}
              tab={tab}
              setTab={setTab}
              todayJournalHasContent={todayJournalHasContent}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>

        {/* ── RIGHT: Writing card ── */}
        <div className="glass-card" style={{
          height: CARD_H, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            background: 'var(--card-overlay)', opacity: 0.28,
          }} />
          <div aria-hidden style={{
            position: 'absolute', top: '-60px', right: '-40px',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, oklch(0.78 0.07 165 / 0.07) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Card top bar ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 28px 16px', flexShrink: 0,
              borderBottom: '1px solid var(--glass-card-border-subtle)',
              gap: '16px',
            }}>
              <div>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--gold)', fontWeight: 700, marginBottom: '3px', opacity: 0.85,
                }}>
                  {isToday ? 'Today' : formatDisplayDate(selectedDate)}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400,
                  color: 'var(--text-0)', lineHeight: 1.2,
                }}>
                  {isToday ? (
                    <>Your <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>journal.</em></>
                  ) : (
                    formatDisplayDate(selectedDate)
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div style={{ fontSize: '12px', minWidth: '52px', textAlign: 'right', transition: 'color 0.2s' }}>
                  {status === 'saving' && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Saving…</span>}
                  {status === 'saved'  && <span style={{ color: 'var(--sage)', fontWeight: 600 }}>✓ Saved</span>}
                </div>
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    style={{
                      fontSize: '11.5px', color: 'var(--text-2)',
                      background: 'var(--glass-card-bg-strong)',
                      border: '1px solid var(--glass-card-border)',
                      borderRadius: '8px', padding: '5px 12px',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    ← Today
                  </button>
                )}
              </div>
            </div>

            {/* ── Writing area ── */}
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={isToday
                  ? 'Write freely — a stream of thought, a few observations, or a detailed account of your day...'
                  : `Write a reflection for ${formatDisplayDate(selectedDate)}…`}
                style={{
                  width: '100%', height: '100%', minHeight: '100%',
                  background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-sans)', fontSize: '15px',
                  color: 'var(--text-0)', resize: 'none', lineHeight: 1.8,
                  padding: '24px 28px', boxSizing: 'border-box',
                  caretColor: 'var(--gold)',
                  display: 'block',
                }}
              />
            </div>

            {/* ── Locus comment — pinned, always visible ── */}
            {(locusCommentLoading || locusComment || locusClarification || locusCommentError) && (
              <div style={{
                flexShrink: 0,
                borderTop: '1px solid var(--glass-card-border-subtle)',
                overflow: 'hidden',
                animation: 'fadeUp 0.3s var(--ease) both',
              }}>
                {locusCommentLoading && !locusComment && !locusClarification && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 28px',
                  }}>
                    <LocusIcon />
                    <span style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>Locus is reading…</span>
                    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 200, 400].map(delay => (
                        <span key={delay} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-3)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${delay}ms` }} />
                      ))}
                    </span>
                  </div>
                )}

                {locusClarification && !locusComment && (
                  <div>
                    <div style={{
                      padding: '10px 28px',
                      borderBottom: '1px solid var(--glass-card-border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LocusIcon />
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.9 }}>
                          Locus is curious
                        </span>
                      </div>
                      <button
                        onClick={() => { setLocusClarification(null); setClarificationReply('') }}
                        aria-label="Dismiss"
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-3)',
                          cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', fontFamily: 'inherit',
                        }}
                      >×</button>
                    </div>
                    <div style={{ padding: '14px 28px 12px' }}>
                      <p style={{
                        margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '15px',
                        fontWeight: 300, color: 'var(--text-0)', lineHeight: 1.65,
                      }}>
                        {locusClarification}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <textarea
                          value={clarificationReply}
                          onChange={e => setClarificationReply(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleClarificationSubmit()
                            }
                          }}
                          placeholder="A short answer…"
                          rows={1}
                          disabled={locusCommentLoading}
                          style={{
                            flex: 1,
                            background: 'var(--glass-card-bg)',
                            border: '1px solid var(--glass-card-border)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontFamily: 'inherit', fontSize: '13.5px',
                            color: 'var(--text-0)', outline: 'none', resize: 'none',
                            lineHeight: 1.5,
                            opacity: locusCommentLoading ? 0.6 : 1,
                          }}
                        />
                        <button
                          onClick={handleClarificationSubmit}
                          disabled={!clarificationReply.trim() || locusCommentLoading}
                          style={{
                            fontSize: '11.5px', padding: '7px 14px',
                            background: !clarificationReply.trim() || locusCommentLoading
                              ? 'var(--glass-card-bg)'
                              : 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 18%, transparent), color-mix(in srgb, var(--gold) 8%, transparent))',
                            border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
                            borderRadius: '8px',
                            color: !clarificationReply.trim() || locusCommentLoading ? 'var(--text-3)' : 'var(--gold)',
                            cursor: !clarificationReply.trim() || locusCommentLoading ? 'default' : 'pointer',
                            fontFamily: 'inherit', fontWeight: 600,
                            backdropFilter: 'blur(12px)',
                            transition: 'opacity 0.2s',
                          }}
                        >
                          {locusCommentLoading ? 'Sending…' : 'Reply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {locusComment && (
                  <div>
                    <div style={{
                      padding: '10px 28px',
                      borderBottom: '1px solid var(--glass-card-border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LocusIcon />
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Locus noticed
                        </span>
                      </div>
                      <button
                        onClick={() => { setLocusComment(null); setCached(selectedDate, null) }}
                        aria-label="Dismiss"
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-3)',
                          cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', fontFamily: 'inherit',
                        }}
                      >×</button>
                    </div>
                    <div style={{ padding: '14px 28px' }}>
                      <p style={{
                        margin: 0, fontFamily: 'var(--font-serif)', fontSize: '15px',
                        fontWeight: 300, color: 'var(--text-0)', lineHeight: 1.65,
                      }}>
                        {locusComment}
                      </p>
                    </div>
                  </div>
                )}

                {locusCommentError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28px' }}>
                    <LocusIcon />
                    <span style={{ fontSize: '13px', color: 'var(--text-2)', fontStyle: 'italic' }}>
                      Couldn't reach Locus — try again in a moment.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Bottom bar ── */}
            <div style={{
              flexShrink: 0, padding: '12px 28px',
              borderTop: '1px solid var(--glass-card-border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', opacity: 0.7 }}>
                {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : 'Auto-saves as you write'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {content.trim() && status !== 'saved' && (
                  <button
                    onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); saveToDb(content, selectedDate) }}
                    style={{
                      fontSize: '11.5px', padding: '5px 12px',
                      background: 'var(--glass-card-bg-strong)',
                      border: '1px solid var(--glass-card-border)',
                      borderRadius: '8px', color: 'var(--text-2)',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    Save now
                  </button>
                )}
                {wordCount >= 10 && !locusComment && !locusClarification && (
                  <button
                    onClick={handleShareWithLocus}
                    disabled={locusCommentLoading}
                    style={{
                      fontSize: '11.5px', padding: '5px 12px',
                      background: locusCommentLoading
                        ? 'var(--glass-card-bg)'
                        : 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 18%, transparent), color-mix(in srgb, var(--gold) 8%, transparent))',
                      border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
                      borderRadius: '8px',
                      color: locusCommentLoading ? 'var(--text-3)' : 'var(--gold)',
                      cursor: locusCommentLoading ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontWeight: 600,
                      backdropFilter: 'blur(12px)',
                      transition: 'opacity 0.2s',
                      opacity: locusCommentLoading ? 0.6 : 1,
                    }}
                  >
                    {locusCommentLoading ? 'Sharing…' : 'Share with Locus'}
                  </button>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-3)', opacity: 0.5 }}>
                  Auto-saves · Shift+Enter for new line
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
