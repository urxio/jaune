'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { Goal, CheckIn, HabitWithLogs, Brief, MemoryNote } from '@/lib/types'

type Props = {
  goals:        Goal[]
  checkin:      CheckIn | null
  habits:       HabitWithLogs[]
  brief?:       Brief | null
  userName?:    string | null
  memoryNotes?: MemoryNote[]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function energyToLabel(level: number | null): string {
  if (!level) return 'Not yet checked in'
  if (level >= 9) return 'Charged, fully present'
  if (level >= 7) return 'Strong, mostly clear'
  if (level >= 5) return 'Steady, mostly clear'
  if (level >= 3) return 'Low, a bit stretched'
  return 'Running on empty'
}

function EnergyDial({ level }: { level: number }) {
  const filled = Math.round((level / 10) * 5)
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(d => (
        <span key={d} style={{
          height: '6px',
          borderRadius: '3px',
          transition: 'all 0.3s',
          background: d <= filled ? 'var(--gold)' : 'oklch(1 0 0 / 0.12)',
          width: d <= filled ? '20px' : '8px',
        }} />
      ))}
    </div>
  )
}

/* ── Pulse cache ── */

function getPulseCacheKey() {
  const now = new Date()
  return `locus_pulse_${now.toISOString().split('T')[0]}_${now.getHours()}`
}

function usePulse(hasCheckin: boolean) {
  const [text, setText] = useState<string>(() => {
    try { return localStorage.getItem(getPulseCacheKey()) ?? '' } catch { return '' }
  })
  const [streaming, setStreaming] = useState(false)
  const abortRef    = useRef<AbortController | null>(null)
  const prevCheckin = useRef(hasCheckin)

  const loadPulse = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(getPulseCacheKey())
        if (cached) { setText(cached); return }
      } catch {}
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStreaming(true)
    setText('')
    try {
      const res = await window.fetch(force ? '/api/pulse?force=1' : '/api/pulse', { cache: 'no-store', signal: ctrl.signal })
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setText(acc)
      }
      if (acc) {
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i)
            if (k?.startsWith('locus_pulse_') && k !== getPulseCacheKey()) localStorage.removeItem(k)
          }
          localStorage.setItem(getPulseCacheKey(), acc)
        } catch {}
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error('[pulse]', e)
    } finally {
      setStreaming(false)
    }
  }, [])

  useEffect(() => {
    loadPulse()
    const onVisible = () => { if (!document.hidden) loadPulse() }
    const onFocus   = () => loadPulse()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      abortRef.current?.abort()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadPulse])

  useEffect(() => {
    const justCheckedIn = hasCheckin && !prevCheckin.current
    prevCheckin.current = hasCheckin
    if (justCheckedIn) loadPulse(true)
  }, [hasCheckin, loadPulse])

  return { text, streaming }
}

/* ── Component ── */

export default function HomeDashboard({ goals, checkin, habits, brief, userName }: Props) {
  const now        = new Date()
  const hour       = now.getHours()
  const today      = todayStr()
  const firstName  = userName?.split(' ')[0] ?? ''
  const hasCheckin = !!checkin

  const { text: aiText, streaming } = usePulse(hasCheckin)

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()

  const energyLevel = checkin?.energy_level ?? brief?.energy_score ?? null
  const insightText = aiText || brief?.insight_text || null

  const priorities = brief?.priorities?.slice(0, 3) ?? []

  const todayHabits = habits
    .filter(h => h.isScheduledToday)
    .map(h => ({
      id:   h.id,
      name: h.name,
      done: h.logs.some(l => l.logged_date === today),
    }))
    .slice(0, 4)

  return (
    <div className="home-shell">

      {/* ── Header ── */}
      <header style={{ marginBottom: '40px', animation: 'fadeUp 0.4s var(--ease) both' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          {dateLabel}
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 4.5vw, 54px)', fontWeight: 400, lineHeight: 1.05, color: 'var(--text-0)' }}>
          {greeting(hour)},<br />
          {firstName && (
            <em style={{ fontStyle: 'italic', color: 'var(--gold)', opacity: 0.9 }}>{firstName}</em>
          )}
          {firstName ? '.' : ''}
        </h1>
      </header>

      {/* ── Two-column body ── */}
      <div className="home-body">

        {/* Left: AI Insight (prominent card) */}
        <section
          className="glass-card"
          style={{
            padding: '32px 36px',
            animation: 'fadeUp 0.4s var(--ease) 0.07s both',
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.85, marginBottom: '18px' }}>
            From Locus
          </p>
          {insightText ? (
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.65, color: 'oklch(0.93 0.012 80 / 0.95)', margin: 0, flex: 1 }}>
              {insightText}
              {streaming && <span style={{ opacity: 0.4 }}> |</span>}
            </p>
          ) : streaming ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {[88, 72, 60].map((w, i) => (
                <div key={i} style={{ height: '14px', borderRadius: '4px', background: 'oklch(1 0 0 / 0.08)', width: `${w}%`, animation: `pulse 1.6s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(16px, 1.8vw, 19px)', lineHeight: 1.65, color: 'var(--text-2)', fontStyle: 'italic', margin: 0, flex: 1 }}>
              {hasCheckin ? 'Your brief is being prepared…' : 'Check in to get your daily insight.'}
            </p>
          )}
        </section>

        {/* Right: stacked metric cards */}
        <div className="home-right">

          {/* Energy */}
          {energyLevel != null && (
            <div className="home-right-section" style={{ animation: 'fadeUp 0.4s var(--ease) 0.12s both' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>
                Energy
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-0)', margin: 0 }}>
                  {energyToLabel(energyLevel)}
                </p>
                <EnergyDial level={energyLevel} />
              </div>
            </div>
          )}

          {/* Today's priorities */}
          {priorities.length > 0 && (
            <div className="home-right-section" style={{ animation: 'fadeUp 0.4s var(--ease) 0.17s both' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px' }}>
                Today
              </p>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {priorities.map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--gold)', opacity: 0.8, fontSize: '13px', width: '12px', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'oklch(0.93 0.012 80 / 0.9)' }}>
                      {p.title}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Habits strip */}
          {todayHabits.length > 0 && (
            <div className="home-right-section" style={{ animation: 'fadeUp 0.4s var(--ease) 0.22s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
                  Habits
                </p>
                <Link
                  href="/habits"
                  style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', transition: 'color 0.15s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  All
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {todayHabits.map((h, i) => (
                  <li key={h.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)',
                  }}>
                    <span style={{ fontSize: '14px', color: h.done ? 'var(--text-3)' : 'oklch(0.93 0.012 80 / 0.9)', transition: 'color 0.2s' }}>
                      {h.name}
                    </span>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: h.done ? 'var(--sage)' : 'transparent',
                      border: h.done ? 'none' : '1.5px solid oklch(1 0 0 / 0.25)',
                      transition: 'all 0.2s',
                    }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Check-in CTA */}
          {!hasCheckin && (
            <Link
              href="/checkin"
              className="glass-card"
              style={{ display: 'block', padding: '20px 24px', textAlign: 'center', textDecoration: 'none', transition: 'border-color 0.2s', animation: 'fadeUp 0.4s var(--ease) 0.27s both', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'oklch(0.78 0.11 78 / 0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
            >
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontStyle: 'italic', color: 'var(--gold)' }}>
                Check in with Locus →
              </span>
            </Link>
          )}

        </div>
      </div>

    </div>
  )
}
