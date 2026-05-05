'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Goal, CheckIn, HabitWithLogs } from '@/lib/types'

/* ── server-prop shape (for SSR seed) ────────────────── */

type Props = {
  goals:     Goal[]
  checkin:   CheckIn | null
  avgEnergy: number | null
  habits:    HabitWithLogs[]
}

/* ── live data shape (from /api/status) ──────────────── */

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

/* ── derive display values from live data ────────────── */

function toDisplayStats(d: LiveData) {
  const energyVal     = d.energy ?? d.avgEnergy
  const energyDisplay = energyVal != null ? `${energyVal} / 10` : '—'
  const energySub     = d.energy ? 'Today' : d.avgEnergy ? '7-day avg' : 'No check-in'

  const habitsDisplay = d.habitsTotal > 0
    ? `${d.habitsDone} / ${d.habitsTotal}`
    : d.habitsAll > 0 ? `${d.habitsAll} total` : '—'
  const habitsSub     = d.habitsTotal > 0 ? 'done today' : 'habits'

  const goalsDisplay = d.goalsActive > 0 ? `${d.goalsActive}` : '—'
  const goalsSub     = d.avgPct != null
    ? `active · ${d.avgPct}% avg`
    : d.goalsActive === 1 ? 'active goal' : 'active goals'

  const moodSub = d.hasCheckin ? 'last check-in' : 'no check-in yet'

  return {
    energyVal:    energyVal ?? 0,
    energyDisplay,
    energySub,
    habitsDisplay,
    habitsSub,
    habitsTotal:  d.habitsTotal,
    habitsDone:   d.habitsDone,
    goalsDisplay,
    goalsSub,
    avgPct:       d.avgPct ?? 0,
    mood:         d.mood,
    moodSub,
  }
}

/* ── seed live data from server props (no fetch needed on first paint) */

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function moodWord(note: string | null): string {
  if (!note) return '—'
  const cleaned = note.replace(/^(feeling|i('m| am|feel)\s+)/i, '').trim()
  return cleaned.split(/[\s,;.]+/).filter(Boolean).slice(0, 2).join(' ') || '—'
}

function propsToLive(goals: Goal[], checkin: CheckIn | null, avgEnergy: number | null, habits: HabitWithLogs[]): LiveData {
  const today          = todayStr()
  const scheduledToday = habits.filter(h => h.isScheduledToday)
  const doneToday      = scheduledToday.filter(h => h.logs.some(l => l.logged_date === today))
  const active         = goals.filter(g => g.status === 'active')
  const avgPct         = active.length
    ? Math.round(active.reduce((s, g) => s + g.progress_pct, 0) / active.length)
    : null
  return {
    energy:      checkin?.energy_level ?? null,
    avgEnergy:   avgEnergy,
    habitsDone:  doneToday.length,
    habitsTotal: scheduledToday.length,
    habitsAll:   habits.length,
    goalsActive: active.length,
    avgPct,
    mood:        moodWord(checkin?.mood_note ?? null),
    hasCheckin:  !!checkin,
  }
}

/* ── simple progress bar ─────────────────────────────── */

function ProgressBar({
  pct,
  color   = '#4ade80',
  loading = false,
}: {
  pct:     number
  color?:  string
  loading?: boolean
}) {
  return (
    <div style={{ marginTop: '12px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{
        height:     '100%',
        width:      loading ? '30%' : `${Math.min(Math.max(pct, 0), 100)}%`,
        borderRadius: '2px',
        background: color,
        transition: loading ? 'none' : 'width 0.5s var(--ease)',
        animation:  loading ? 'statusPulse 1.4s ease-in-out infinite' : 'none',
      }} />
    </div>
  )
}

/* ── single stat card ────────────────────────────────── */

type PillConfig = {
  href:      string
  label:     string
  value:     string
  sub:       string
  barPct?:   number
  barColor?: string
  loading?:  boolean
  moodDot?:  boolean
}

function Pill({ href, label, value, sub, barPct, barColor, loading, moodDot }: PillConfig) {
  /* Glow blob color: sun/warm for energy, sea-soft/teal for habits+goals */
  const glowColor = barColor === '#d4a853'
    ? 'rgba(240,223,160,0.18)'
    : 'rgba(200,221,215,0.18)'

  const [mainVal, unitVal] = value.includes('/')
    ? [value.split('/')[0].trim(), '/' + value.split('/')[1].trim()]
    : value.includes(' ')
      ? [value.split(' ')[0], value.split(' ').slice(1).join(' ')]
      : [value, '']

  return (
    <a
      href={href}
      className="status-pill"
      style={{
        display:          'flex',
        flexDirection:    'column',
        gap:              '16px',
        flex:             1,
        minWidth:         0,
        background:       'rgba(0, 0, 0, 0.42)',
        borderRadius:     '24px',
        padding:          '20px',
        textDecoration:   'none',
        cursor:           'pointer',
        position:         'relative',
        overflow:         'hidden',
        backdropFilter:   'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition:       'transform 0.18s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s var(--ease)',
        boxShadow:        'var(--shadow-card)',
        border:           '1px solid var(--border)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}
    >
      {/* Glow blob — visible in light mode only (hidden in dark to avoid corner artifacts) */}
      <div className="status-pill-glow" style={{
        position: 'absolute', top: '-24px', right: '-24px',
        width: '96px', height: '96px', borderRadius: '50%',
        background: glowColor,
        filter: 'blur(24px)',
        pointerEvents: 'none',
        transition: 'background 0.3s',
      }} />

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.20em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {moodDot && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '50%',
            border: '1px solid var(--surface-strong-border)',
            background: 'var(--surface-strong-bg)',
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--sun, #f0dfa0), var(--sea-soft, #c8ddd7))' }} />
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', position: 'relative', flex: 1 }}>
        <span style={{
          fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--text-0)', lineHeight: 1,
          opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s',
        }}>
          {mainVal}
        </span>
        {unitVal && (
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>
            {unitVal}
          </span>
        )}
      </div>

      {/* Sub text */}
      <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.3, position: 'relative' }}>
        {sub}
      </div>

      {/* Progress bar */}
      {barPct != null && barColor && (
        <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--progress-track)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: loading ? '30%' : `${Math.min(Math.max(barPct, 0), 100)}%`,
            borderRadius: '2px',
            background: barColor === '#d4a853'
              ? 'linear-gradient(to right, var(--sun, #f0dfa0), var(--sea-soft, #c8ddd7))'
              : 'linear-gradient(to right, var(--sea-soft, #c8ddd7), var(--sage))',
            transition: loading ? 'none' : 'width 0.5s var(--ease)',
            animation: loading ? 'statusPulse 1.4s ease-in-out infinite' : 'none',
          }} />
        </div>
      )}
    </a>
  )
}

/* ── last-updated dot ────────────────────────────────── */

function LiveDot({ refreshing }: { refreshing: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: refreshing ? 'var(--gold)' : 'var(--sage)',
        boxShadow:  refreshing ? '0 0 6px var(--gold)' : '0 0 5px var(--sage)',
        transition: 'background 0.3s, box-shadow 0.3s',
        animation:  refreshing ? 'statusPulse 0.8s ease-in-out infinite' : 'none',
      }} />
    </div>
  )
}

/* ── main strip ──────────────────────────────────────── */

const POLL_INTERVAL_MS = 60_000 // re-fetch every 60 s while page is open

export default function StatusStrip({ goals, checkin, avgEnergy, habits }: Props) {
  const [live, setLive]           = useState<LiveData>(() => propsToLive(goals, checkin, avgEnergy, habits))
  const [refreshing, setRefresh]  = useState(false)
  const fetchingRef               = useRef(false)

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setRefresh(true)
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      if (res.ok) {
        const data: LiveData = await res.json()
        setLive(data)
      }
    } catch { /* silent — keep showing last known data */ }
    finally {
      fetchingRef.current = false
      setRefresh(false)
    }
  }, [])

  useEffect(() => {
    // Fetch fresh data immediately on mount
    refresh()

    // Re-fetch when the user tabs back or the window regains focus
    const onVisible = () => { if (!document.hidden) refresh() }
    const onFocus   = () => refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    // Poll while the page is open
    const timer = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
    }
  }, [refresh])

  const s = toDisplayStats(live)

  const pills: PillConfig[] = [
    {
      href:     '/checkin',
      label:    'Energy',
      value:    s.energyDisplay,
      sub:      s.energySub,
      barPct:   (s.energyVal / 10) * 100,
      barColor: '#d4a853',
      loading:  refreshing,
    },
    {
      href:     '/habits',
      label:    'Habits',
      value:    s.habitsDisplay,
      sub:      s.habitsSub,
      barPct:   s.habitsTotal > 0 ? (s.habitsDone / s.habitsTotal) * 100 : 0,
      barColor: 'var(--sage)',
      loading:  refreshing,
    },
    {
      href:     '/goals',
      label:    'Goals',
      value:    s.goalsDisplay,
      sub:      s.goalsSub,
      barPct:   s.avgPct,
      barColor: 'var(--sage)',
      loading:  refreshing,
    },
    {
      href:    '/checkin',
      label:   'Mood',
      value:   s.mood,
      sub:     s.moodSub,
      loading: refreshing,
      moodDot: true,
    },
  ]

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <span style={{
          fontSize: '9px', fontWeight: 700, color: 'var(--text-3)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Today&apos;s Status
        </span>
        <LiveDot refreshing={refreshing} />
      </div>

      {/* 4-column grid — collapses to 2×2 on small phones via .status-strip-grid */}
      <div className="status-strip-grid" style={{ display: 'flex', gap: '10px' }}>
        {pills.map(p => <Pill key={p.label} {...p} />)}
      </div>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}
