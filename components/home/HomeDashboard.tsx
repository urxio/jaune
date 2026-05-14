'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Goal, CheckIn, HabitWithLogs, Brief, MemoryNote } from '@/lib/types'
import { moodWord } from '@/lib/utils/mood'
import { StatPill, LiveDot } from './StatPills'
import { buildPulseMessage, PulseMessage } from './PulseCard'

/* ── Types ───────────────────────────────────────────── */

type Props = {
  goals:        Goal[]
  checkin:      CheckIn | null
  habits:       HabitWithLogs[]
  brief?:       Brief | null
  userName?:    string | null
  memoryNotes?: MemoryNote[]
}

type LiveData = {
  energy:      number | null
  avgEnergy:   number | null
  habitsDone:  number
  habitsTotal: number
  habitsAll:   number
  goalsActive: number
  avgPct:      number | null
  mood:        string
  hasCheckin:  boolean
}

/* ── Helpers ─────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(date: Date): { dayName: string; month: string; day: number } {
  return {
    dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
    month:   date.toLocaleDateString('en-US', { month: 'long' }),
    day:     date.getDate(),
  }
}

function propsToLive(goals: Goal[], checkin: CheckIn | null, habits: HabitWithLogs[]): LiveData {
  const today          = todayStr()
  const scheduledToday = habits.filter(h => h.isScheduledToday)
  const doneToday      = scheduledToday.filter(h => h.logs.some(l => l.logged_date === today))
  const active         = goals.filter(g => g.status === 'active')
  const avgPct         = active.length
    ? Math.round(active.reduce((s, g) => s + g.progress_pct, 0) / active.length)
    : null
  return {
    energy:      checkin?.energy_level ?? null,
    avgEnergy:   null,
    habitsDone:  doneToday.length,
    habitsTotal: scheduledToday.length,
    habitsAll:   habits.length,
    goalsActive: active.length,
    avgPct,
    mood:        moodWord(checkin?.mood_note ?? null),
    hasCheckin:  !!checkin,
  }
}

const POLL_MS = 60_000

/* ── Pulse cache ─────────────────────────────────────── */

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
      const url = force ? '/api/pulse?force=1' : '/api/pulse'
      const res = await window.fetch(url, { cache: 'no-store', signal: ctrl.signal })
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
          const key = getPulseCacheKey()
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i)
            if (k?.startsWith('locus_pulse_') && k !== key) localStorage.removeItem(k)
          }
          localStorage.setItem(key, acc)
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

/* ── Component ───────────────────────────────────────── */

export default function HomeDashboard({ goals, checkin, habits, brief, userName, memoryNotes }: Props) {
  const now = new Date()
  const hour           = now.getHours()
  const { dayName, month, day } = formatDate(now)

  const [live,       setLive]   = useState<LiveData>(() => propsToLive(goals, checkin, habits))
  const [refreshing, setRefresh] = useState(false)
  const fetchingRef              = useRef(false)
  const router                   = useRouter()

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setRefresh(true)
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      if (res.ok) setLive(await res.json())
      router.refresh()
    } catch { /* keep last known data */ }
    finally { fetchingRef.current = false; setRefresh(false) }
  }, [router])

  useEffect(() => {
    refresh()
    const onVisible = () => { if (!document.hidden) refresh() }
    const onFocus   = () => refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const timer = setInterval(refresh, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
    }
  }, [refresh])

  /* ── Derived stat display values ── */
  const energyVal     = live.energy ?? live.avgEnergy
  const energyDisplay = energyVal != null ? `${energyVal}` : '—'
  const energyUnit    = energyVal != null ? '/10' : undefined
  const energySub     = live.energy ? 'Today' : live.avgEnergy ? '7-day avg' : 'No check-in yet'
  const energyBarPct  = energyVal != null ? (energyVal / 10) * 100 : 0

  const habitsDisplay = live.habitsTotal > 0 ? `${live.habitsDone}` : live.habitsAll > 0 ? `${live.habitsAll}` : '—'
  const habitsUnit    = live.habitsTotal > 0 ? `/${live.habitsTotal}` : live.habitsAll > 0 ? ' total' : undefined
  const habitsSub     = live.habitsTotal > 0 ? 'done today' : 'habits'
  const habitsBarPct  = live.habitsTotal > 0 ? (live.habitsDone / live.habitsTotal) * 100 : 0

  const goalsDisplay  = live.goalsActive > 0 ? `${live.goalsActive}` : '—'
  const goalsSub      = live.goalsActive > 0 ? (live.avgPct != null ? `${live.avgPct}% avg` : 'active') : 'no active goals'
  const goalsBarPct   = live.avgPct ?? 0

  /* ── Pulse message ── */
  const pulseLines = buildPulseMessage({
    firstName:   userName?.split(' ')[0] ?? 'there',
    hour,
    dayName,
    day,
    month,
    habitsTotal: live.habitsTotal > 0 ? live.habitsTotal : live.habitsAll,
    goalsActive: live.goalsActive,
    firstGoal:   goals.find(g => g.status === 'active') ?? null,
    energyScore: checkin?.energy_level ?? brief?.energy_score ?? null,
    topNote:     memoryNotes?.[0] ?? null,
    brief,
  })
  const { text: aiText, streaming } = usePulse(live.hasCheckin)

  const stats = [
    { href: '/checkin', label: 'Energy', mainVal: energyDisplay, unit: energyUnit, sub: energySub, barPct: energyBarPct, warm: true },
    { href: '/habits',  label: 'Habits', mainVal: habitsDisplay, unit: habitsUnit, sub: habitsSub, barPct: habitsBarPct },
    { href: '/goals',   label: 'Goals',  mainVal: goalsDisplay,  sub: goalsSub,   barPct: goalsBarPct },
    { href: '/checkin', label: 'Mood',   mainVal: live.mood,     sub: live.hasCheckin ? 'last check-in' : 'no check-in yet', moodDot: true },
  ]

  return (
    <div className="page-pad home-dashboard" style={{ maxWidth: '900px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>

      {/* ── Pulse card ── */}
      <div
        className="glass-card home-pulse-card"
        style={{ padding: 'clamp(28px, 4vw, 44px)', position: 'relative', overflow: 'hidden', marginBottom: '14px', animation: 'fadeUp 0.4s var(--ease) 0.05s both' }}
      >
        <div aria-hidden style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, oklch(0.78 0.09 75 / 0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle, oklch(0.78 0.07 165 / 0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'var(--card-overlay)', opacity: 0.28 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '5px 13px 5px 9px', marginBottom: '22px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--sage)', animation: 'homePulse 2.4s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.04em' }}>
              Locus AI · Today&apos;s pulse
            </span>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <PulseMessage lines={[pulseLines[0]]} />
            <div style={{ marginTop: '10px' }}>
              {aiText ? (
                <p style={{ margin: 0, fontSize: 'clamp(14px, 1.8vw, 16px)', lineHeight: 1.75, color: 'var(--text-1)', fontWeight: 400 }}>
                  {aiText}
                  {streaming && <span className="pulse-cursor"> |</span>}
                </p>
              ) : streaming ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '2px' }}>
                  <div className="pulse-shimmer" style={{ height: '15px', width: '88%', borderRadius: '6px' }} />
                  <div className="pulse-shimmer" style={{ height: '15px', width: '68%', borderRadius: '6px', animationDelay: '0.15s' }} />
                </div>
              ) : (
                <PulseMessage lines={pulseLines.slice(1)} />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              href="/checkin"
              id="home-checkin-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--text-0)', color: 'var(--bg-0)', borderRadius: '14px', padding: '11px 22px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {live.hasCheckin ? 'View Brief' : 'Start Check-in'}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            {!live.hasCheckin && (
              <Link
                href="/goals"
                id="home-skip-btn"
                style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '11px 20px', fontSize: '14px', fontWeight: 500, textDecoration: 'none', transition: 'background 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-md)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
              >
                Skip today
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Status pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Today&apos;s Status
        </span>
        <LiveDot refreshing={refreshing} />
      </div>

      <div
        className="home-stat-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', animation: 'fadeUp 0.45s var(--ease) 0.10s both' }}
      >
        {stats.map(s => (
          <StatPill key={s.label} {...s} refreshing={refreshing} />
        ))}
      </div>


<style>{`
        @media (max-width: 600px) {
          .home-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .home-pulse-card { padding: 24px !important; }
        }
        @keyframes homePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .pulse-cursor {
          color: var(--text-3);
          font-weight: 300;
          animation: pulseCursorBlink 1s step-end infinite;
        }
        @keyframes pulseCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .pulse-shimmer {
          background: var(--bg-2);
          animation: pulseShimmer 1.4s ease-in-out infinite;
        }
        @keyframes pulseShimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
