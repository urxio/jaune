'use client'

import { useEffect, useState } from 'react'

/* ─── Locus logo — amber petals ─── */
function LocusLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Locus">
      <g fill="#c9a84c" opacity="0.65">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(45,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(135,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(225,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(315,50,50)" />
      </g>
      <g fill="#c9a84c">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(90,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(180,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(270,50,50)" />
      </g>
    </svg>
  )
}

/* ─── Energy dial — matches app exactly ─── */
function EnergyDial({ level }: { level: number }) {
  const filled = Math.round((level / 10) * 5)
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(d => (
        <span key={d} style={{
          height: '6px',
          borderRadius: '3px',
          transition: 'all 0.3s',
          background: d <= filled ? 'oklch(0.74 0.06 150)' : 'rgba(255,255,255,0.12)',
          width: d <= filled ? '20px' : '8px',
        }} />
      ))}
    </div>
  )
}

/* ─── Energy curve chart (matches WeeklyReview) ─── */
function smoothCurvePath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = i === 0 ? pts[0] : pts[i - 1]
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const [x3, y3] = i + 2 < pts.length ? pts[i + 2] : pts[i + 1]
    const cp1x = x1 + (x2 - x0) / 6
    const cp1y = y1 + (y2 - y0) / 6
    const cp2x = x2 - (x3 - x1) / 6
    const cp2y = y2 - (y3 - y1) / 6
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`)
  }
  return d.join(' ')
}

function EnergyCurveMock() {
  const W = 560, H = 220
  const padL = 28, padR = 12, padT = 24, padB = 36
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // Mon, Tue: no data. Wed=7, Thu=5, Fri=2, Sat=6, Sun=8
  const data: { i: number; v: number }[] = [
    { i: 2, v: 7 }, { i: 3, v: 5 }, { i: 4, v: 2 }, { i: 5, v: 6 }, { i: 6, v: 8 },
  ]
  const xOf = (i: number) => padL + (i / (days.length - 1)) * chartW
  const yOf = (v: number) => padT + (1 - (v - 1) / 9) * chartH
  const pts: [number, number][] = data.map(p => [xOf(p.i), yOf(p.v)])
  const linePath = smoothCurvePath(pts)
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1][0]} ${padT + chartH} L ${pts[0][0]} ${padT + chartH} Z`
    : ''
  const gridLines = [2, 4, 6, 8, 10]
  const peak = data.reduce((b, p) => (!b || p.v > b.v ? p : b), data[0])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} aria-label="Energy this week">
      <defs>
        <linearGradient id="lc-energyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7eb89a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7eb89a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lc-lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c8a96e" />
          <stop offset="100%" stopColor="#7eb89a" />
        </linearGradient>
        <filter id="lc-dotGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {gridLines.map(v => (
        <g key={v}>
          <line x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)}
            stroke="oklch(1 0 0 / 0.07)" strokeWidth="1" strokeDasharray={v === 10 || v === 2 ? '0' : '4 4'} />
          <text x={padL - 6} y={yOf(v) + 4} textAnchor="end" fontSize="9"
            fill="oklch(1 0 0 / 0.28)" fontFamily="var(--font-sans, sans-serif)">{v}</text>
        </g>
      ))}

      <path d={areaPath} fill="url(#lc-energyGrad)" />
      <path d={linePath} fill="none" stroke="url(#lc-lineGrad)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* empty-day ticks for Mon/Tue */}
      {[0, 1].map(i => (
        <circle key={i} cx={xOf(i)} cy={padT + chartH + 2} r="2" fill="oklch(1 0 0 / 0.1)" />
      ))}

      {data.map(p => {
        const x = xOf(p.i), y = yOf(p.v)
        const color = p.v >= 7 ? '#7eb89a' : p.v >= 5 ? '#c8a96e' : '#c08060'
        const isPeak = p.i === peak.i
        return (
          <g key={p.i}>
            {isPeak && <circle cx={x} cy={y} r="9" fill={color} opacity="0.15" filter="url(#lc-dotGlow)" />}
            <circle cx={x} cy={y} r={isPeak ? 5.5 : 4} fill={color} stroke="oklch(0.13 0 0)" strokeWidth="1.5" />
            <text x={x} y={y - 12} textAnchor="middle" fontSize="11"
              fontFamily="var(--font-serif, Georgia, serif)" fill={isPeak ? color : 'oklch(1 0 0 / 0.65)'}
              fontWeight={isPeak ? '600' : '400'}>{p.v}</text>
          </g>
        )
      })}

      {days.map((d, i) => {
        const has = data.some(p => p.i === i)
        return (
          <text key={d} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="10"
            fill={has ? 'oklch(1 0 0 / 0.5)' : 'oklch(1 0 0 / 0.22)'}
            fontFamily="var(--font-sans, sans-serif)" fontWeight="500" letterSpacing="0.06em">
            {d}
          </text>
        )
      })}
    </svg>
  )
}

/* ─── Weekly Review mock (matches /review page exactly) ─── */
function WeeklyReviewMock() {
  const SAGE = 'oklch(0.74 0.06 150)'
  const GOLD = 'oklch(0.78 0.11 78)'
  const TEXT_0 = 'oklch(0.96 0.01 85)'
  const TEXT_1 = 'oklch(0.78 0.012 75)'
  const TEXT_3 = 'oklch(0.64 0.015 70)'

  const stats = [
    { label: 'Check-ins', value: '5', sub: 'of 7 days', color: SAGE },
    { label: 'Avg energy', value: '5.6', sub: 'Steady', color: TEXT_0 },
    { label: 'Habits done', value: '19%', sub: '8 of 42', color: TEXT_0 },
    { label: 'Active goals', value: '3', sub: '22% avg', color: TEXT_0 },
  ]
  const habits = [
    { emoji: '💪', name: 'Workout', done: 0, target: 3 },
    { emoji: '🧘', name: 'Spiritual Time', done: 2, target: 7 },
    { emoji: '📚', name: 'Read 30 min', done: 0, target: 4 },
    { emoji: '✍️', name: 'Schedule Day', done: 1, target: 7 },
    { emoji: '🌿', name: 'Self-control', done: 2, target: 7 },
    { emoji: '📚', name: 'Daily Text (read paper Bible)', done: 0, target: 7 },
    { emoji: '😴', name: 'Good sleep', done: 3, target: 7 },
  ]
  const goals = [
    { title: 'Prepeare for Associate Engineering Position', next: 'Study SQL and database fundamentals', pct: 0 },
    { title: 'Love Jehovah More', next: '21 Days of PN Diet', pct: 0 },
    { title: 'Be more disciplined', next: null, pct: 65 },
  ]
  const worked = [
    'You logged 5 highlights — moments worth building on.',
    '"Be more disciplined" is past the halfway mark — you’re in motion.',
  ]
  const adjust = [
    'Blockers showed up on 2 days — identifying their root cause could unlock your next gear.',
    'Workout, Spiritual Time, Read 30 min, Schedule Day, Self-control, Daily Text (read paper Bible), Good sleep fell short of halfway — consider reducing friction or resetting the target.',
  ]

  const sectionLabel: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: TEXT_3, margin: 0,
  }

  return (
    <div>
      {/* ── Header — label above title, nav buttons right ── */}
      <header style={{ marginBottom: '32px' }}>
        <p style={{ ...sectionLabel, marginBottom: '8px' }}>Weekly Review</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h3 className="lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 400, lineHeight: 1.1, color: TEXT_0, margin: 0 }}>
            This <em style={{ fontStyle: 'italic', color: GOLD }}>week.</em>
          </h3>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {[0, 1].map(i => (
              <span key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.12)', background: 'transparent', color: TEXT_3, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: i === 1 ? 0.3 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {i === 0 ? <path d="M10 4L6 8l4 4" /> : <path d="M6 4l4 4-4 4" />}
                </svg>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Stats — 4 across (matches .review-stats-4) ── */}
      <div className="lc-review-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...G.cardSm, padding: '20px 22px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEXT_3, marginBottom: '8px' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 400, color: s.color, lineHeight: 1, marginBottom: '5px' }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: TEXT_3, margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mid: Energy + Habits (matches .review-mid wrapped in glass-card) ── */}
      <div style={{ ...G.cardSm, padding: '24px 26px', marginBottom: '20px' }}>
        <div className="lc-review-mid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Energy curve */}
          <section>
            <p style={{ ...sectionLabel, marginBottom: '16px' }}>Energy this week</p>
            <EnergyCurveMock />
            <div style={{ display: 'flex', marginTop: '16px', borderTop: '1px solid oklch(1 0 0 / 0.07)', paddingTop: '16px' }}>
              {[{ label: 'Avg energy', value: '5.6' }, { label: 'Peak day', value: 'Sun' }, { label: 'Logged', value: '5/7' }].map((s, i) => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid oklch(1 0 0 / 0.07)' : 'none', padding: '0 12px' }}>
                  <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '20px', color: TEXT_0, margin: '0 0 3px', fontWeight: 400 }}>{s.value}</p>
                  <p style={{ fontSize: '10px', color: TEXT_3, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Habits */}
          <section>
            <p style={{ ...sectionLabel, marginBottom: '16px' }}>Habits</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {habits.map((h, i) => {
                const pct = Math.round((h.done / h.target) * 100)
                const onTrack = pct >= 100
                const barColor = onTrack ? SAGE : pct >= 50 ? GOLD : 'oklch(1 0 0 / 0.2)'
                const valueColor = onTrack ? SAGE : pct >= 50 ? GOLD : TEXT_3
                return (
                  <li key={i} style={{ padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
                      <p style={{ flex: 1, fontSize: '14px', color: TEXT_1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</p>
                      <span style={{ fontSize: '11px', fontWeight: 600, flexShrink: 0, minWidth: '36px', textAlign: 'right', color: valueColor }}>
                        {h.done}/{h.target}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'oklch(1 0 0 / 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: barColor, borderRadius: '4px' }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>

      {/* ── Goals — full width ── */}
      <div style={{ ...G.cardSm, padding: '24px 26px', marginBottom: '32px' }}>
        <p style={{ ...sectionLabel, marginBottom: '16px' }}>Goals</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {goals.map((g, i) => (
            <li key={i}>
              <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '17px', color: TEXT_0, margin: '0 0 8px', lineHeight: 1.3 }}>{g.title}</p>
              <div style={{ height: '2px', background: 'oklch(1 0 0 / 0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ height: '100%', width: `${g.pct}%`, background: g.pct > 0 ? GOLD : 'oklch(1 0 0 / 0.25)', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: TEXT_3, fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.next ? `Next — ${g.next}` : ''}
                </p>
                <span style={{ fontSize: '11px', color: g.pct > 0 ? GOLD : TEXT_3, opacity: g.pct > 0 ? 0.9 : 0.5, flexShrink: 0 }}>
                  {g.pct}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Weekly Reflection from Locus ── */}
      <section>
        <p style={{ ...sectionLabel, marginBottom: '20px' }}>Weekly Reflection from Locus</p>
        <div className="lc-review-reflect" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            { items: worked, color: SAGE, icon: '↑', title: 'What worked' },
            { items: adjust, color: GOLD, icon: '↻', title: 'What to adjust' },
          ].map((col, i) => (
            <div key={i} style={{ ...G.cardSm, padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: col.color, opacity: 0.9 }}>{col.icon}</span>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: col.color, margin: 0, opacity: 0.9 }}>
                  {col.title}
                </p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {col.items.map((item, j) => (
                  <li key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: col.color, opacity: 0.6, marginTop: '3px', flexShrink: 0 }}>—</span>
                    <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '17px', fontWeight: 300, lineHeight: 1.75, color: TEXT_0, margin: 0 }}>{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ─── Home-style Daily Brief mock ─── */
function BriefMock({ compact = false }: { compact?: boolean }) {
  const priorities = [
    { num: '1', title: 'Draft the Series A deck intro' },
    { num: '2', title: '30-minute run — day 14' },
    { num: '3', title: "Reply to Maya's intro email" },
  ]
  const habits = [
    { name: 'Spiritual Time', done: true },
    { name: 'Writing', done: true },
    { name: 'Movement', done: false },
    { name: 'Deep work block', done: false },
  ]

  if (compact) {
    return (
      <div style={{ ...G.card, padding: '28px 32px' }}>
        <p style={G.label}>From Jaune</p>
        <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '17px', lineHeight: 1.65, color: 'rgba(240,237,232,0.95)', margin: '0 0 20px' }}>
          Three low-energy days in a row — not a slump, just a pattern. Your writing habit is holding (day 14), but the investor outreach has been quiet since Tuesday. Today at 7/10 you have enough for one deep thing.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,232,0.35)' }}>Energy</span>
          <span style={{ fontSize: '12px', color: 'oklch(0.74 0.06 150)', fontWeight: 500 }}>7 / 10</span>
        </div>
        <EnergyDial level={7} />
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {priorities.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontStyle: 'italic', color: 'rgba(201,168,76,0.8)', fontSize: '13px', width: '12px', flexShrink: 0 }}>{p.num}</span>
              <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(240,237,232,0.9)' }}>{p.title}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>
      {/* Left — insight */}
      <div style={{ ...G.card, padding: '32px 36px', minHeight: '260px', display: 'flex', flexDirection: 'column' }}>
        <p style={G.label}>From Jaune</p>
        <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.65, color: 'rgba(240,237,232,0.95)', margin: 0, flex: 1 }}>
          Three low-energy days in a row — not a slump, just a pattern. Your writing habit is holding strong (day 14), but the investor outreach has been quiet since Tuesday. Today at 7/10 you have enough for one deep thing. Here&apos;s what actually matters.
        </p>
      </div>

      {/* Right — metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Energy */}
        <div style={G.cardSm}>
          <p style={{ ...G.subLabel, marginBottom: '10px' }}>Energy</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '18px', color: 'rgba(240,237,232,0.95)', margin: '0 0 4px' }}>Strong, mostly clear</p>
              <p style={{ fontSize: '12px', color: 'oklch(0.74 0.06 150)', margin: 0, fontWeight: 500 }}>7/10</p>
            </div>
            <EnergyDial level={7} />
          </div>
        </div>

        {/* Today */}
        <div style={G.cardSm}>
          <p style={{ ...G.subLabel, marginBottom: '14px' }}>Today</p>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {priorities.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontStyle: 'italic', color: 'rgba(201,168,76,0.8)', fontSize: '13px', width: '12px', flexShrink: 0 }}>{p.num}</span>
                <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(240,237,232,0.9)' }}>{p.title}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Habits */}
        <div style={G.cardSm}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ ...G.subLabel, margin: 0 }}>Habits</p>
            <span style={{ fontSize: '12px', color: 'rgba(240,237,232,0.3)' }}>All →</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {habits.map((h, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '14px', color: h.done ? 'rgba(240,237,232,0.35)' : 'rgba(240,237,232,0.9)', textDecoration: h.done ? 'line-through' : 'none' }}>{h.name}</span>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, background: h.done ? 'oklch(0.74 0.06 150)' : 'transparent', border: h.done ? 'none' : '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {h.done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="oklch(0.2 0.05 150)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ─── Shared glass style objects ─── */
const G = {
  card: {
    background: 'rgba(28, 32, 35, 0.78)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.13)',
    boxShadow: '0 30px 60px -20px rgba(0,0,0,0.55), 0 8px 24px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
    borderRadius: '28px',
  } as React.CSSProperties,

  cardSm: {
    background: 'rgba(28, 32, 35, 0.78)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.13)',
    boxShadow: '0 12px 32px -10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
    borderRadius: '20px',
    padding: '20px 24px',
  } as React.CSSProperties,

  cardSoft: {
    background: 'rgba(50, 75, 65, 0.25)',
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 12px 32px -10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '14px 18px',
  } as React.CSSProperties,

  label: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: '#c9a84c',
    opacity: 0.85,
    marginBottom: '18px',
  } as React.CSSProperties,

  subLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: 'rgba(240,237,232,0.35)',
  } as React.CSSProperties,
}

/* ─── Scroll reveal ─── */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.l-reveal')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('l-visible'); observer.unobserve(e.target) } }),
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

/* ─── Page ─── */
export default function LandingPage() {
  useScrollReveal()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <>
      <style>{`
        /* Background lives on body so glass can blur through it */
        body { background: #0d0c0b !important; }

        .lc-root {
          background: transparent;
          color: #f0ede8;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
          z-index: 1;
        }

        /* Scroll reveal */
        .l-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1); }
        .l-reveal.l-visible { opacity: 1; transform: translateY(0); }
        .l-reveal.l-d1 { transition-delay: 0.08s; }
        .l-reveal.l-d2 { transition-delay: 0.16s; }
        .l-reveal.l-d3 { transition-delay: 0.24s; }
        .l-reveal.l-d4 { transition-delay: 0.32s; }
        .l-reveal.l-d5 { transition-delay: 0.40s; }
        @media (prefers-reduced-motion: reduce) { .l-reveal { opacity:1; transform:none; transition:none; } }

        /* Orb animations */
        @keyframes lc-orb1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.25} 50%{transform:translate(-40px,30px) scale(1.1);opacity:.45} }
        @keyframes lc-orb2 { 0%,100%{transform:translate(0,0) scale(1.05);opacity:.15} 50%{transform:translate(30px,-20px) scale(0.95);opacity:.3} }
        @keyframes lc-orb3 { 0%,100%{transform:translate(0,0);opacity:.1} 50%{transform:translate(-20px,-30px);opacity:.2} }
        .lc-orb1{animation:lc-orb1 14s ease-in-out infinite}
        .lc-orb2{animation:lc-orb2 18s ease-in-out infinite}
        .lc-orb3{animation:lc-orb3 22s ease-in-out infinite}

        /* Nav glass */
        .lc-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          padding: 20px 40px;
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(180deg, rgba(13,12,11,0.85) 0%, transparent 100%);
          backdrop-filter: blur(8px);
        }

        /* Buttons */
        .lc-btn-primary {
          background: #c9a84c; border: none; border-radius: 10px;
          color: #0d0c0b; cursor: pointer; font-family: inherit;
          font-size: 15px; font-weight: 600; padding: 14px 28px;
          transition: filter .2s, transform .15s; white-space: nowrap;
        }
        .lc-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .lc-btn-primary:active { transform: translateY(0); }

        .lc-btn-outline {
          background: rgba(201,168,76,0.06);
          border: 1px solid rgba(201,168,76,0.3); border-radius: 10px;
          color: #c9a84c; cursor: pointer; font-family: inherit;
          font-size: 14px; font-weight: 500; padding: 9px 20px;
          transition: background .2s, border-color .2s;
        }
        .lc-btn-outline:hover { background: rgba(201,168,76,0.12); border-color: rgba(201,168,76,0.55); }

        /* Email input */
        .lc-input {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; color: #f0ede8; font-family: inherit;
          font-size: 15px; padding: 14px 18px; outline: none; width: 100%; max-width: 320px;
          transition: border-color .2s;
        }
        .lc-input::placeholder { color: #8a8580; }
        .lc-input:focus { border-color: rgba(201,168,76,0.4); }

        /* Responsive */
        @media (max-width: 900px) {
          .lc-nav { padding: 16px 24px; }
          .lc-hero-grid { flex-direction: column !important; }
          .lc-brief-full { grid-template-columns: 1fr !important; }
          .lc-problem-grid { flex-direction: column !important; }
          .lc-steps-grid { flex-direction: column !important; }
          .lc-arc-grid { flex-direction: column !important; }
          .lc-quote-grid { flex-direction: column !important; }
          .lc-cta-row { flex-direction: column !important; align-items: stretch !important; }
          .lc-input { max-width: 100% !important; }
          .lc-review-mid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .lc-review-reflect { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .lc-h1 { font-size: clamp(36px, 10vw, 60px) !important; }
          .lc-h2 { font-size: clamp(26px, 7vw, 40px) !important; }
          .lc-review-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Fixed orb background — all within 0-100% so none are clipped */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Top-left amber — large, primary warmth */}
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '65vw', height: '65vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.28) 0%, transparent 60%)', filter: 'blur(70px)' }} />
        {/* Top-right cool */}
        <div style={{ position: 'absolute', top: '5%', right: '-12%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,120,160,0.15) 0%, transparent 60%)', filter: 'blur(90px)' }} />
        {/* Center-left amber */}
        <div style={{ position: 'absolute', top: '30%', left: '-8%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 60%)', filter: 'blur(80px)' }} />
        {/* Center-right warm */}
        <div style={{ position: 'absolute', top: '40%', right: '-5%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 60%)', filter: 'blur(90px)' }} />
        {/* Bottom-center amber glow */}
        <div style={{ position: 'absolute', top: '60%', left: '25%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.20) 0%, transparent 60%)', filter: 'blur(75px)' }} />
        {/* Bottom-left subtle green */}
        <div style={{ position: 'absolute', top: '70%', left: '-5%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,158,122,0.12) 0%, transparent 60%)', filter: 'blur(90px)' }} />
        {/* Bottom-right amber */}
        <div style={{ position: 'absolute', top: '75%', right: '0%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.16) 0%, transparent 60%)', filter: 'blur(80px)' }} />
      </div>

      <div className="lc-root">

        {/* ── NAV ── */}
        <nav className="lc-nav" style={{ zIndex: 50 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <LocusLogo size={26} />
            <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '18px', color: '#f0ede8' }}>Locus</span>
          </a>
          <a href="#cta" style={{ textDecoration: 'none' }}>
            <button className="lc-btn-outline">Start for free</button>
          </a>
        </nav>

        {/* ══════════════════════════════════════
            HERO
        ══════════════════════════════════════ */}
        <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', padding: '120px 40px 80px' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="lc-hero-grid" style={{ display: 'flex', alignItems: 'center', gap: '80px', justifyContent: 'space-between' }}>

              {/* Left: headline + CTA */}
              <div style={{ flex: '1 1 460px', maxWidth: '520px' }}>
                <div className="l-reveal" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '100px', padding: '6px 14px', marginBottom: '28px' }}>
                  <LocusLogo size={13} />
                  <span style={{ fontSize: '11px', color: '#c9a84c', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Your AI life companion</span>
                </div>

                <h1 className="l-reveal l-d1 lc-h1" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(42px, 4.5vw, 68px)', fontWeight: 400, color: '#f0ede8', lineHeight: 1.08, marginBottom: '22px', letterSpacing: '-0.01em' }}>
                  The companion that actually knows you.
                </h1>

                <p className="l-reveal l-d2" style={{ fontSize: '17px', color: '#8a8580', lineHeight: 1.65, marginBottom: '36px', maxWidth: '420px' }}>
                  Most apps track your habits. Locus understands what they mean.
                  Every check-in, every pattern — remembered, and put to work for you.
                </p>

                <div className="l-reveal l-d3">
                  <a href="#cta" style={{ textDecoration: 'none' }}>
                    <button className="lc-btn-primary" style={{ fontSize: '16px', padding: '15px 34px' }}>Start for free</button>
                  </a>
                  <p style={{ marginTop: '14px', fontSize: '13px', color: 'rgba(138,133,128,0.6)' }}>No credit card. Just clarity.</p>
                </div>
              </div>

              {/* Right: Brief mock card (compact) */}
              <div className="l-reveal l-d4" style={{ flex: '1 1 380px', maxWidth: '440px', width: '100%' }}>
                <BriefMock compact={true} />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            THE PROBLEM
        ══════════════════════════════════════ */}
        <section style={{ padding: '80px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto' }}>
            <div className="lc-problem-grid" style={{ display: 'flex', gap: '16px' }}>
              {[
                { setup: 'You set goals.', punchline: 'They sit untouched after week 2.', sub: 'Not because you forgot. Because nothing connected them to today.' },
                { setup: 'You track habits.', punchline: "But you don't know what they actually mean.", sub: 'The streak number tells you nothing about how you feel.' },
                { setup: 'You journal.', punchline: 'It never talks back.', sub: 'You write into the void. The patterns are there. No one sees them.' },
              ].map((item, i) => (
                <div key={i} className={`l-reveal l-d${i + 1}`} style={{ ...G.card, flex: 1, padding: '32px 28px' }}>
                  <p style={{ fontSize: '12px', color: '#8a8580', marginBottom: '14px', letterSpacing: '0.04em' }}>{item.setup}</p>
                  <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '21px', color: '#f0ede8', fontWeight: 400, lineHeight: 1.3, marginBottom: '14px' }}>{item.punchline}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(138,133,128,0.7)', lineHeight: 1.65 }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════ */}
        <section style={{ padding: '60px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="l-reveal lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: '#f0ede8', marginBottom: '56px', lineHeight: 1.2, maxWidth: '560px' }}>
              A brief that knows today is different from yesterday.
            </h2>

            <div className="lc-steps-grid" style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
              {[
                {
                  num: '01',
                  title: 'Check in',
                  body: "Rate your energy (1–10). Note what's in the way. 30 seconds.",
                  detail: '"Low energy. Investor email is weighing on me."',
                },
                {
                  num: '02',
                  title: 'Locus connects the dots',
                  body: 'Your goals × your habits × your energy pattern. Claude generates a brief specific to this exact day.',
                  detail: '"Your fundraising goal. Your 14-day streak. What you said yesterday."',
                },
                {
                  num: '03',
                  title: 'Three priorities',
                  body: 'Ranked by urgency × goal alignment × how much energy you actually have right now.',
                  detail: '"Not a to-do list. A sequence."',
                },
              ].map((step, i) => (
                <div key={i} className={`l-reveal l-d${i + 1}`} style={{ ...G.card, flex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '13px', color: '#c9a84c', opacity: 0.7, letterSpacing: '0.06em' }}>{step.num}</span>
                    <div style={{ height: '1px', flex: 1, background: 'rgba(201,168,76,0.2)' }} />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '20px', fontWeight: 400, color: '#f0ede8', marginBottom: '10px', lineHeight: 1.25 }}>{step.title}</h3>
                  <p style={{ fontSize: '14px', color: '#8a8580', lineHeight: 1.65, marginBottom: '16px', flex: 1 }}>{step.body}</p>
                  <div style={{ ...G.cardSoft }}>
                    <p style={{ fontSize: '13px', color: 'rgba(201,168,76,0.75)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            RELATIONSHIP ARC + TESTIMONIALS
        ══════════════════════════════════════ */}
        <section style={{ padding: '60px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="l-reveal lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: '#f0ede8', marginBottom: '48px', lineHeight: 1.2 }}>
              It gets more valuable the longer you use it.
            </h2>

            {/* Arc cards */}
            <div className="lc-arc-grid" style={{ display: 'flex', gap: '16px', marginBottom: '56px' }}>
              {[
                { era: 'Day 1', title: 'Locus knows what you shared.', body: "It doesn't know you yet — and it says so. No false confidence. Just a first brief built on what you told it.", accentBorder: 'rgba(138,133,128,0.2)' },
                { era: 'Week 2', title: 'Locus starts noticing.', body: 'Energy dips on Thursdays. The writing habit holds, but the workout streak is softening. It starts to say so.', accentBorder: 'rgba(201,168,76,0.25)' },
                { era: 'Month 1+', title: 'Locus knows this person.', body: "It catches when something's off before you name it. It references what you said three weeks ago. It remembers.", accentBorder: 'rgba(201,168,76,0.4)' },
              ].map((arc, i) => (
                <div key={i} className={`l-reveal l-d${i + 1}`} style={{ ...G.card, flex: 1, padding: '28px 24px', borderTop: `2px solid ${arc.accentBorder}`, borderRadius: '0 0 28px 28px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9a84c', opacity: 0.6 + i * 0.15, marginBottom: '14px' }}>{arc.era}</p>
                  <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '19px', fontWeight: 400, color: '#f0ede8', marginBottom: '10px', lineHeight: 1.3 }}>{arc.title}</h3>
                  <p style={{ fontSize: '14px', color: '#8a8580', lineHeight: 1.65 }}>{arc.body}</p>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="lc-quote-grid" style={{ display: 'flex', gap: '16px' }}>
              {[
                { quote: "It told me I'd been avoiding the investor email for 11 days. I hadn't noticed.", author: 'Boris', role: 'Founder' },
                { quote: "I said I was fine in the check-in. Locus said: 'Energy lower than usual three days running — what's actually in the way?' It was right.", author: 'Sarah', role: 'Product designer' },
                { quote: "It remembered I had a hard month in March. In April, it adjusted what it asked of me. That felt like being known.", author: 'Marcus', role: 'Writer' },
              ].map((q, i) => (
                <div key={i} className={`l-reveal l-d${i + 1}`} style={{ ...G.card, flex: 1, padding: '28px 24px', borderLeft: '2px solid rgba(201,168,76,0.3)' }}>
                  <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '17px', color: 'rgba(240,237,232,0.85)', fontStyle: 'italic', lineHeight: 1.65, marginBottom: '16px' }}>
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  <p style={{ fontSize: '13px', color: '#8a8580' }}>
                    — {q.author} <span style={{ color: 'rgba(138,133,128,0.45)', marginLeft: '4px' }}>{q.role}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            THE BRIEF (full dashboard preview)
        ══════════════════════════════════════ */}
        <section style={{ padding: '60px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ marginBottom: '48px' }}>
              <p className="l-reveal" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a84c', opacity: 0.85, marginBottom: '12px' }}>SATURDAY, MAY 17</p>
              <h2 className="l-reveal l-d1 lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#f0ede8', lineHeight: 1.05, marginBottom: '0' }}>
                Here&apos;s what Monday could look like.{' '}
                <em style={{ fontStyle: 'italic', color: '#c9a84c', opacity: 0.9 }}>Yours.</em>
              </h2>
            </div>

            <div className="l-reveal l-d2 lc-brief-full" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>
              <div style={{ ...G.card, padding: '32px 36px', minHeight: '280px', display: 'flex', flexDirection: 'column' }}>
                <p style={G.label}>From Jaune</p>
                <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.7, color: 'rgba(240,237,232,0.95)', margin: 0, flex: 1 }}>
                  Three low-energy days in a row — not a slump, just a pattern. Your writing habit is holding strong (day 14), but the investor outreach has been quiet since Tuesday. Today at 7/10 you have enough for one deep thing. Here&apos;s what actually matters today, in order.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={G.cardSm}>
                  <p style={{ ...G.subLabel, marginBottom: '10px' }}>Energy</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '18px', color: 'rgba(240,237,232,0.95)', margin: '0 0 4px' }}>Strong, mostly clear</p>
                      <p style={{ fontSize: '12px', color: 'oklch(0.74 0.06 150)', margin: 0, fontWeight: 500 }}>7/10</p>
                    </div>
                    <EnergyDial level={7} />
                  </div>
                </div>

                <div style={G.cardSm}>
                  <p style={{ ...G.subLabel, marginBottom: '14px' }}>Today</p>
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      'Draft the Series A deck intro',
                      '30-minute run — day 14',
                      "Reply to Maya's intro email",
                    ].map((t, i) => (
                      <li key={i} style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontStyle: 'italic', color: 'rgba(201,168,76,0.8)', fontSize: '13px', width: '12px', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(240,237,232,0.9)' }}>{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div style={G.cardSm}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p style={{ ...G.subLabel, margin: 0 }}>Habits</p>
                    <span style={{ fontSize: '12px', color: 'rgba(240,237,232,0.3)' }}>All →</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {[
                      { name: 'Spiritual Time', done: true },
                      { name: 'Writing', done: true },
                      { name: 'Movement', done: false },
                      { name: 'Deep work block', done: false },
                    ].map((h, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '14px', color: h.done ? 'rgba(240,237,232,0.35)' : 'rgba(240,237,232,0.9)', textDecoration: h.done ? 'line-through' : 'none' }}>{h.name}</span>
                        <span style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, background: h.done ? 'oklch(0.74 0.06 150)' : 'transparent', border: h.done ? 'none' : '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {h.done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="oklch(0.2 0.05 150)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            THE WEEKLY REVIEW (preview)
        ══════════════════════════════════════ */}
        <section style={{ padding: '60px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ marginBottom: '48px' }}>
              <p className="l-reveal" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a84c', opacity: 0.85, marginBottom: '12px' }}>The weekly review</p>
              <h2 className="l-reveal l-d1 lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#f0ede8', lineHeight: 1.05, marginBottom: '0' }}>
                Every Sunday, a portrait of{' '}
                <em style={{ fontStyle: 'italic', color: '#c9a84c', opacity: 0.9 }}>your week.</em>
              </h2>
            </div>

            <div className="l-reveal l-d2">
              <WeeklyReviewMock />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            CTA FOOTER
        ══════════════════════════════════════ */}
        <section id="cta" style={{ padding: '80px 40px 120px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '400px', background: 'radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '580px', margin: '0 auto' }}>
            <div style={{ ...G.card, padding: '60px 48px' }}>
              <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
                <LocusLogo size={36} />
              </div>

              <h2 className="l-reveal lc-h2" style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 400, color: '#f0ede8', lineHeight: 1.15, marginBottom: '14px' }}>
                Know yourself better.
                <br /><span style={{ color: '#c9a84c' }}>Start today.</span>
              </h2>

              <p className="l-reveal l-d1" style={{ fontSize: '16px', color: '#8a8580', marginBottom: '40px', lineHeight: 1.6 }}>
                The only place that knows this version of your life.
              </p>

              {submitted ? (
                <div style={{ padding: '20px 0' }}>
                  <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '20px', color: '#c9a84c', marginBottom: '8px' }}>You&apos;re on the list.</p>
                  <p style={{ fontSize: '14px', color: '#8a8580' }}>We&apos;ll reach out when your spot opens.</p>
                </div>
              ) : (
                <div className="l-reveal l-d2 lc-cta-row" style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                  <input
                    className="lc-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && email) setSubmitted(true) }}
                    aria-label="Email address"
                  />
                  <button className="lc-btn-primary" onClick={() => { if (email) setSubmitted(true) }}>
                    Get early access
                  </button>
                </div>
              )}

              <p className="l-reveal l-d3" style={{ marginTop: '18px', fontSize: '13px', color: 'rgba(138,133,128,0.5)' }}>
                No credit card. No noise. Just clarity.
              </p>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LocusLogo size={16} />
            <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', color: 'rgba(240,237,232,0.3)' }}>Locus</span>
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(138,133,128,0.35)' }}>© 2025 Locus. All rights reserved.</p>
          <a href="/privacy" style={{ fontSize: '13px', color: 'rgba(138,133,128,0.35)', textDecoration: 'none' }}>Privacy</a>
        </footer>

      </div>
    </>
  )
}
