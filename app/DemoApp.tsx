'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Tab = 'home' | 'checkin' | 'habits' | 'goals' | 'review'

/* ── Multilingual greetings ── */

const GREETINGS = {
  morning: [
    { text: 'Good morning',        lang: 'en' },
    { text: 'おはようございます',    lang: 'ja' },
    { text: 'Bonjour',             lang: 'fr' },
    { text: '早上好',               lang: 'zh' },
    { text: 'Buenos días',         lang: 'es' },
    { text: 'こんにちは',           lang: 'ja' },  // casual morning
    { text: 'Guten Morgen',        lang: 'de' },
    { text: 'Bom dia',             lang: 'pt' },
    { text: '좋은 아침이에요',        lang: 'ko' },
    { text: 'Buongiorno',          lang: 'it' },
  ],
  afternoon: [
    { text: 'Good afternoon',      lang: 'en' },
    { text: 'こんにちは',           lang: 'ja' },
    { text: 'Bon après-midi',      lang: 'fr' },
    { text: '下午好',               lang: 'zh' },
    { text: 'Buenas tardes',       lang: 'es' },
    { text: 'おつかれさまです',      lang: 'ja' },  // "good work so far"
    { text: 'Guten Tag',           lang: 'de' },
    { text: 'Boa tarde',           lang: 'pt' },
    { text: '안녕하세요',            lang: 'ko' },
    { text: 'Buon pomeriggio',     lang: 'it' },
  ],
  evening: [
    { text: 'Good evening',        lang: 'en' },
    { text: 'こんばんは',           lang: 'ja' },
    { text: 'Bonsoir',             lang: 'fr' },
    { text: '晚上好',               lang: 'zh' },
    { text: 'Buenas noches',       lang: 'es' },
    { text: 'おやすみなさい',        lang: 'ja' },  // "good night" / wind down
    { text: 'Guten Abend',         lang: 'de' },
    { text: 'Boa noite',           lang: 'pt' },
    { text: '좋은 저녁이에요',        lang: 'ko' },
    { text: 'Buonasera',           lang: 'it' },
  ],
}

/* ── Demo Data ── */

const DEMO_HABITS = [
  { id: '1', name: 'Deep work block',     streak: 11, done: true  },
  { id: '2', name: 'Read 20 pages',       streak: 6,  done: true  },
  { id: '3', name: 'Move 30 min',         streak: 3,  done: false },
  { id: '4', name: 'No phone before 9am', streak: 9,  done: false },
  { id: '5', name: 'Journal entry',       streak: 4,  done: false },
  { id: '6', name: 'Cold shower',         streak: 2,  done: false },
]

const DEMO_GOALS = [
  { id: '1', title: 'Ship Hartwell v1',        category: 'Product',  progress: 68, steps: 14, total: 21, timeframe: 'Q2 2026',  onPace: true  },
  { id: '2', title: 'Run a 10K',               category: 'Health',   progress: 45, steps:  9, total: 20, timeframe: 'Jun 2026', onPace: false },
  { id: '3', title: 'Read 24 books this year', category: 'Learning', progress: 33, steps:  8, total: 24, timeframe: 'Dec 2026', onPace: true  },
]

const DEMO_PRIORITIES = [
  'Draft the Hartwell proposal — 90 min, no Slack',
  'Walk 30 minutes after lunch',
  'Call Mom before 6pm',
]

const WEEK_ENERGY = [5, 6, 6, 7, 7, 6, 7]
const DAYS_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const HABIT_GRID: Record<string, boolean[]> = {
  '1': [true,  true,  true,  true,  true,  true,  false],
  '2': [true,  false, true,  true,  true,  true,  false],
  '3': [true,  true,  false, true,  false, false, false],
  '4': [true,  true,  true,  true,  true,  false, false],
  '5': [true,  false, true,  true,  false, true,  false],
  '6': [false, true,  false, true,  true,  false, false],
}

/* ── Icons ── */

function HomeIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M3 9.5L10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 8v8a1 1 0 0 0 1 1h3v-4h2v4h3a1 1 0 0 0 1-1V8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function CheckinIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M17 11.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /><path d="M10 8.5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function HabitsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><circle cx="10" cy="10" r="7" /><path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function GoalsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M4 15l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function ReviewIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><rect x="4" y="3" width="12" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" /></svg>
}
function FlameIcon() {
  return <svg viewBox="0 0 16 16" fill="none" width="12" height="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 14c-2.5 0-5-1.8-5-5 0-2.2 1.8-4 3-5.5.6 1 1.2 1.8 2 2.5.8-1.2.8-2.8.8-4 1.2 1 3.2 3.2 3.2 7 0 2.8-2 5-4 5Z" /></svg>
}
function LocusLogo({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="oklch(0.82 0.15 75)" opacity="0.65">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(45,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(135,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(225,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(315,50,50)" />
      </g>
      <g fill="oklch(0.96 0.005 250)">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(90,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(180,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(270,50,50)" />
      </g>
    </svg>
  )
}

/* ── Helpers ── */

function energyColor(level: number) {
  if (level >= 7) return 'var(--sage)'
  if (level >= 5) return 'var(--gold)'
  return 'oklch(0.68 0.10 45)'
}

function EnergyDial({ level }: { level: number }) {
  const filled = Math.round((level / 10) * 5)
  const color = energyColor(level)
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(d => (
        <span key={d} style={{
          height: '6px', borderRadius: '3px', transition: 'all 0.3s',
          background: d <= filled ? color : 'oklch(1 0 0 / 0.12)',
          width: d <= filled ? '20px' : '8px',
        }} />
      ))}
    </div>
  )
}

function CategoryBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    Product:  'oklch(0.72 0.10 250 / 0.25)',
    Health:   'oklch(0.72 0.10 145 / 0.25)',
    Learning: 'oklch(0.78 0.11 78 / 0.20)',
  }
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: '99px',
      background: colors[label] ?? 'oklch(1 0 0 / 0.10)',
      color: 'var(--text-2)',
    }}>
      {label}
    </span>
  )
}

function SignInCTA({ label = 'Sign in to get started →' }: { label?: string }) {
  return (
    <div style={{ marginTop: '28px', textAlign: 'center' }}>
      <Link
        href="/login"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '14px', fontWeight: 500,
          color: 'oklch(0.18 0.02 60)',
          background: 'oklch(0.78 0.13 70)',
          borderRadius: '99px', padding: '10px 22px',
          textDecoration: 'none',
          boxShadow: '0 8px 24px -8px oklch(0.78 0.13 70 / 0.5)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {label}
      </Link>
    </div>
  )
}

/* ── HOME VIEW ── */

function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const LOCUS_MESSAGES = [
  "Welcome to Locus. I’m your daily intelligence — I learn your rhythm from check-ins, " +
  "hold the shape of your goals and habits, and each morning I write you a brief: what " +
  "deserves your attention, what the pattern in your week is telling you, and what can safely wait.",

  "The habits you just saw are small on purpose. Eleven days of deep work, nine without " +
  "the phone before 9am — those streaks don’t happen by accident. They happen because " +
  "someone decided to notice. That’s what I help you do, every single morning.",

  "Most tools ask you to do more. Locus asks you to do the right thing — which is usually " +
  "a shorter list. The goals here aren’t aspirations. They’re commitments with steps, " +
  "timelines, and a pace. I track whether they’re on track so you don’t carry that weight alone.",

  "Your energy levels tell a story most people never read. A 7 on Monday, a 4 on Thursday — " +
  "that’s not random, it’s a pattern. I learn it, name it, and fold it into your brief. " +
  "That’s what makes the advice feel like it actually knows you.",

  "The brief isn’t a to-do list. It’s a judgment — made with everything I know about your " +
  "energy, your habits, your goals, and what you’ve been quietly avoiding. " +
  "When you sign in, it’s built from your actual life, not example data.",

  "Clarity is a habit. The people who use Locus don’t become more productive — they become " +
  "more deliberate. There’s a real difference. " +
  "Sign in and find out what your week actually looks like when someone’s paying attention.",
]

function useTypewriter(text: string, speed = 16) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { setDone(true); clearInterval(id) }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return { displayed, done }
}

function getTimeKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function useCyclingGreeting(hour: number | null) {
  const timeKey = hour != null ? getTimeKey(hour) : 'morning'
  const list = GREETINGS[timeKey]

  const [index, setIndex]     = useState(0)
  const [visible, setVisible] = useState(true)
  const prevTimeKey = useRef(timeKey)

  // Smoothly transition when time period first becomes known (clock tick)
  useEffect(() => {
    if (prevTimeKey.current !== timeKey) {
      prevTimeKey.current = timeKey
      setVisible(false)
      setTimeout(() => { setIndex(0); setVisible(true) }, 380)
    }
  }, [timeKey])

  // Cycle through greetings every 4.8 s
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % list.length)
        setVisible(true)
      }, 380)
    }, 4800)
    return () => clearInterval(id)
  }, [list.length])

  return { text: list[index].text, lang: list[index].lang, visible }
}

function HomeView({
  habitDone, setHabitDone, messageIndex,
}: {
  habitDone: Record<string, boolean>
  setHabitDone: (id: string) => void
  messageIndex: number
}) {
  const now  = useLiveClock()
  const hour = now?.getHours() ?? null
  const { text: greetingText, lang: greetingLang, visible: greetingVisible } = useCyclingGreeting(hour)
  const locusMessage = LOCUS_MESSAGES[messageIndex % LOCUS_MESSAGES.length]
  const { displayed: locusText, done: locusDone } = useTypewriter(locusMessage)
  const todayHabits = DEMO_HABITS.slice(0, 4).map(h => ({ ...h, done: habitDone[h.id] ?? h.done }))

  const dateLabel = now
    ? (() => {
        const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
        const hh   = String(now.getHours()).padStart(2, '0')
        const mm   = String(now.getMinutes()).padStart(2, '0')
        return `${date} · ${hh}:${mm}`
      })()
    : ' '

  return (
    <div className="home-shell" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          {dateLabel}
        </p>
        <h1
          suppressHydrationWarning
          style={{
            fontFamily: greetingLang === 'ja'
              ? '"Hiragino Mincho ProN", "Yu Mincho", var(--font-serif), serif'
              : 'var(--font-serif)',
            fontSize: ['ja','zh','ko'].includes(greetingLang) ? 'clamp(30px, 3.8vw, 48px)' : 'clamp(34px, 4.5vw, 54px)',
            fontWeight: ['ja','zh','ko'].includes(greetingLang) ? 300 : 400,
            lineHeight: 1.1,
            color: 'var(--text-0)',
            opacity:   greetingVisible ? 1 : 0,
            transform: greetingVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.36s var(--ease), transform 0.36s var(--ease)',
            willChange: 'opacity, transform',
            minHeight: 'clamp(42px, 5.5vw, 66px)',
          }}
        >
          {greetingText}.
        </h1>
      </header>

      <div className="home-body">
        {/* Left: From Jaune welcome */}
        <section
          className="glass-card"
          style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}
        >
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.85, marginBottom: '18px' }}>
            From Jaune
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.7, color: 'oklch(0.93 0.012 80 / 0.95)', flex: 1, minHeight: '6em' }}>
            {locusText}
            {!locusDone && <span style={{ opacity: 0.35, animation: 'pulse 1s ease-in-out infinite' }}> |</span>}
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(14px, 1.6vw, 17px)', lineHeight: 1.65, color: 'var(--text-3)', marginTop: '20px', opacity: locusDone ? 1 : 0, transition: 'opacity 0.7s ease 0.2s' }}>
            You&apos;re exploring a preview with template data. Explore the tabs to see what your Locus looks like — then{' '}
            <Link href="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              sign in or create an account
            </Link>
            {' '}to get your own personalized brief.
          </p>
        </section>

        {/* Right: metrics */}
        <div className="home-right">
          {/* Energy */}
          <div className="home-right-section">
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>
              Energy
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-0)', margin: '0 0 4px' }}>
                  Strong, mostly clear
                </p>
                <p style={{ fontSize: '12px', color: energyColor(7), margin: 0, fontWeight: 500 }}>7/10</p>
              </div>
              <EnergyDial level={7} />
            </div>
          </div>

          {/* Priorities */}
          <div className="home-right-section">
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px' }}>
              Today
            </p>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {DEMO_PRIORITIES.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--gold)', opacity: 0.8, fontSize: '13px', width: '12px', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'oklch(0.93 0.012 80 / 0.9)' }}>{p}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Habits */}
          <div className="home-right-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
                Habits
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                {todayHabits.filter(h => h.done).length} of {todayHabits.length} today
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {todayHabits.map((h, i) => (
                <li
                  key={h.id}
                  onClick={() => setHabitDone(h.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '14px', color: h.done ? 'var(--text-3)' : 'oklch(0.93 0.012 80 / 0.9)', transition: 'color 0.2s', textDecoration: h.done ? 'line-through' : 'none' }}>
                    {h.name}
                  </span>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                    background: h.done ? 'var(--sage)' : 'transparent',
                    border: h.done ? 'none' : '1.5px solid oklch(1 0 0 / 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {h.done && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="oklch(0.2 0.05 150)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 5l2.5 2.5L8 3" />
                      </svg>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ── CHECK-IN VIEW ── */

function CheckinView() {
  const now = useLiveClock()
  const [energy, setEnergy] = useState(7)
  const [submitted, setSubmitted] = useState(false)
  const dateLabel = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
    : ' '

  return (
    <div className="page-pad inner-shell-sm" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <header style={{ marginBottom: '40px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          {dateLabel}
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text-0)' }}>
          How are you today?
        </h1>
        <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Two minutes. Honest. This is where your brief begins.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Energy */}
        <div className="glass-card" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Energy level
            </p>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: energyColor(energy) }}>
              {energy}
            </span>
          </div>
          <input
            type="range" min={1} max={10} value={energy}
            onChange={e => setEnergy(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Empty</span>
            <p style={{ fontSize: '13px', color: energyColor(energy), fontWeight: 500, textAlign: 'center' }}>
              {energy >= 9 ? 'Charged, fully present' : energy >= 7 ? 'Strong, mostly clear' : energy >= 5 ? 'Getting by, some friction' : energy >= 3 ? 'Low, a bit stretched' : 'Running on empty'}
            </p>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Full</span>
          </div>
        </div>

        {/* Mood */}
        <div className="glass-card" style={{ padding: '28px 32px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px' }}>
            What&apos;s on your mind?
          </p>
          <textarea
            readOnly
            defaultValue="Feeling focused but a little scattered after a busy week. Proposal is the priority."
            style={{
              width: '100%', background: 'transparent', border: 'none', resize: 'none', outline: 'none',
              fontFamily: 'var(--font-serif)', fontSize: '17px', lineHeight: 1.65,
              color: 'var(--text-1)', minHeight: '72px',
            }}
          />
        </div>

        {/* Highlight */}
        <div className="glass-card" style={{ padding: '28px 32px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px' }}>
            What went well yesterday?
          </p>
          <textarea
            readOnly
            defaultValue="Got 3 hours of uninterrupted deep work. Slept before midnight."
            style={{
              width: '100%', background: 'transparent', border: 'none', resize: 'none', outline: 'none',
              fontFamily: 'var(--font-serif)', fontSize: '17px', lineHeight: 1.65,
              color: 'var(--text-1)', minHeight: '60px',
            }}
          />
        </div>

        {/* Submit */}
        {submitted ? (
          <div className="glass-card" style={{ padding: '28px 32px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontStyle: 'italic', color: 'var(--gold)', marginBottom: '16px' }}>
              Sign in to save your check-in and get your brief.
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 500,
                color: 'oklch(0.18 0.02 60)', background: 'oklch(0.78 0.13 70)',
                borderRadius: '99px', padding: '10px 22px', textDecoration: 'none',
              }}
            >
              Create your account →
            </Link>
          </div>
        ) : (
          <button
            onClick={() => setSubmitted(true)}
            style={{
              width: '100%', padding: '16px', border: 'none', cursor: 'pointer',
              background: 'oklch(0.78 0.13 70)', color: 'oklch(0.18 0.02 60)',
              borderRadius: '16px', fontSize: '15px', fontWeight: 600,
              boxShadow: '0 8px 24px -8px oklch(0.78 0.13 70 / 0.5)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Log check-in
          </button>
        )}
      </div>
    </div>
  )
}

/* ── HABITS VIEW ── */

function HabitsView({
  habitDone, setHabitDone,
}: {
  habitDone: Record<string, boolean>
  setHabitDone: (id: string) => void
}) {
  const now = useLiveClock()
  const habits = DEMO_HABITS.map(h => ({ ...h, done: habitDone[h.id] ?? h.done }))
  const doneCount = habits.filter(h => h.done).length
  const dateLabel = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
    : ' '

  return (
    <div className="page-pad inner-shell-sm" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
            {dateLabel}
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text-0)' }}>
            Habits
          </h1>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '99px',
          background: doneCount === habits.length ? 'var(--sage-dim)' : 'var(--gold-dim)',
          color: doneCount === habits.length ? 'var(--sage)' : 'var(--gold)',
          fontSize: '13px', fontWeight: 500,
        }}>
          {doneCount} of {habits.length} today
        </div>
      </header>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {habits.map((h, i) => (
          <div
            key={h.id}
            onClick={() => setHabitDone(h.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '18px 24px',
              borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'oklch(1 0 0 / 0.03)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Check */}
            <span style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
              background: h.done ? 'var(--sage)' : 'transparent',
              border: h.done ? 'none' : '1.5px solid oklch(1 0 0 / 0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              {h.done && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="oklch(0.2 0.05 150)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5l2.5 2.5L8 3" />
                </svg>
              )}
            </span>

            {/* Name */}
            <span style={{
              fontSize: '15px', flex: 1, lineHeight: 1.3,
              color: h.done ? 'var(--text-3)' : 'var(--text-0)',
              textDecoration: h.done ? 'line-through' : 'none',
              transition: 'color 0.2s',
            }}>
              {h.name}
            </span>

            {/* Streak */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'oklch(0.78 0.13 70)', fontSize: '13px', flexShrink: 0 }}>
              <FlameIcon />
              {h.streak}
            </span>
          </div>
        ))}
      </div>

      <SignInCTA label="Track your own habits in Locus →" />
    </div>
  )
}

/* ── GOALS VIEW ── */

function GoalRing({ progress, size = 80 }: { progress: number; size?: number }) {
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="5" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="oklch(0.82 0.15 75)" strokeWidth="5" fill="none"
        strokeDasharray={`${circ * (progress / 100)} ${circ}`}
        strokeLinecap="round"
        style={{ transform: `rotate(-90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill="var(--text-0)" fontFamily="var(--font-serif)" fontSize="14">
        {progress}%
      </text>
    </svg>
  )
}

function GoalsView() {
  return (
    <div className="page-pad inner-shell-md" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>
      <header style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          ACTIVE GOALS
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text-0)' }}>
          Goals
        </h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {DEMO_GOALS.map(g => (
          <div key={g.id} className="glass-card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <GoalRing progress={g.progress} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <CategoryBadge label={g.category} />
                <span style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: '99px',
                  background: g.onPace ? 'oklch(0.72 0.10 145 / 0.18)' : 'oklch(0.72 0.10 30 / 0.18)',
                  color: g.onPace ? 'var(--sage)' : 'oklch(0.72 0.10 30)',
                }}>
                  {g.onPace ? 'On pace' : 'Needs push'}
                </span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px, 2vw, 22px)', fontWeight: 500, color: 'var(--text-0)', margin: '0 0 6px', lineHeight: 1.2 }}>
                {g.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 12px' }}>
                {g.timeframe} · {g.steps} of {g.total} steps
              </p>
              <div style={{ height: '4px', borderRadius: '99px', background: 'oklch(1 0 0 / 0.10)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${g.progress}%`, background: 'oklch(0.78 0.13 70)', borderRadius: '99px', transition: 'width 0.6s var(--ease)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <SignInCTA label="Start tracking your goals →" />
    </div>
  )
}

/* ── REVIEW VIEW ── */

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

function DemoEnergyCurveChart() {
  const W = 560, H = 220
  const padL = 28, padR = 12, padT = 24, padB = 36
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const xOf = (i: number) => padL + (i / (DAYS_SHORT.length - 1)) * chartW
  const yOf = (v: number) => padT + (1 - (v - 1) / 9) * chartH

  const pts: [number, number][] = WEEK_ENERGY.map((v, i) => [xOf(i), yOf(v)])
  const linePath = smoothCurvePath(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${padT + chartH} L ${pts[0][0]} ${padT + chartH} Z`
  const gridLines = [2, 4, 6, 8, 10]
  let peakIdx = 0
  WEEK_ENERGY.forEach((v, i) => { if (v > WEEK_ENERGY[peakIdx]) peakIdx = i })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} aria-label="Energy this week">
      <defs>
        <linearGradient id="dv-energyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7eb89a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7eb89a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dv-lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c8a96e" />
          <stop offset="100%" stopColor="#7eb89a" />
        </linearGradient>
        <filter id="dv-dotGlow">
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

      <path d={areaPath} fill="url(#dv-energyGrad)" />
      <path d={linePath} fill="none" stroke="url(#dv-lineGrad)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {WEEK_ENERGY.map((v, i) => {
        const x = xOf(i), y = yOf(v)
        const color = v >= 7 ? '#7eb89a' : v >= 5 ? '#c8a96e' : '#c08060'
        const isPeak = i === peakIdx
        return (
          <g key={i}>
            {isPeak && <circle cx={x} cy={y} r="9" fill={color} opacity="0.15" filter="url(#dv-dotGlow)" />}
            <circle cx={x} cy={y} r={isPeak ? 5.5 : 4} fill={color} stroke="oklch(0.13 0 0)" strokeWidth="1.5" />
            <text x={x} y={y - 12} textAnchor="middle" fontSize="11"
              fontFamily="var(--font-serif)" fill={isPeak ? color : 'oklch(1 0 0 / 0.65)'}
              fontWeight={isPeak ? '600' : '400'}>{v}</text>
          </g>
        )
      })}

      {DAYS_SHORT.map((d, i) => (
        <text key={d} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="10"
          fill="oklch(1 0 0 / 0.5)" fontFamily="var(--font-sans, sans-serif)"
          fontWeight="500" letterSpacing="0.06em">{d}</text>
      ))}
    </svg>
  )
}

const HABIT_EMOJI: Record<string, string> = {
  '1': '🎯', '2': '📚', '3': '🏃', '4': '📵', '5': '✍️', '6': '🚿',
}

function ReviewView() {
  const avgEnergy = WEEK_ENERGY.reduce((a, b) => a + b, 0) / WEEK_ENERGY.length
  const peakIdx = WEEK_ENERGY.reduce((bi, v, i) => v > WEEK_ENERGY[bi] ? i : bi, 0)
  const checkInsThisWeek = WEEK_ENERGY.length

  const habitStats = DEMO_HABITS.map(h => ({
    id: h.id,
    name: h.name,
    emoji: HABIT_EMOJI[h.id] || '•',
    done: HABIT_GRID[h.id].filter(Boolean).length,
    target: 7,
  }))
  const totalHabitsDone   = habitStats.reduce((s, h) => s + h.done, 0)
  const totalHabitsTarget = habitStats.reduce((s, h) => s + h.target, 0)
  const habitRate = Math.round((totalHabitsDone / totalHabitsTarget) * 100)

  const avgGoalProgress = Math.round(DEMO_GOALS.reduce((s, g) => s + g.progress, 0) / DEMO_GOALS.length)

  const stats = [
    { label: 'Check-ins',   value: String(checkInsThisWeek),          sub: 'of 7 days',  color: checkInsThisWeek >= 5 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Avg energy',  value: avgEnergy.toFixed(1),              sub: 'Steady',     color: avgEnergy >= 6 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Habits done', value: `${habitRate}%`,                   sub: `${totalHabitsDone} of ${totalHabitsTarget}`, color: habitRate >= 70 ? 'var(--sage)' : 'var(--text-0)' },
    { label: 'Active goals',value: String(DEMO_GOALS.length),         sub: `${avgGoalProgress}% avg`,                    color: 'var(--text-0)' },
  ]

  const worked = [
    `Strong energy across ${WEEK_ENERGY.filter(v => v >= 7).length} days — you were consistently at 7 or above.`,
    `${DEMO_HABITS[0].name} hit a ${DEMO_HABITS[0].streak}-day streak — consistency is compounding.`,
    `"${DEMO_GOALS[0].title}" is past the halfway mark — you're in motion.`,
  ]
  const adjust = [
    `${DEMO_HABITS[2].name} came in at ${habitStats[2].done}/7 — consider a smaller daily target.`,
    `${DEMO_HABITS[5].name} fell short of halfway — reduce friction or reset the target.`,
  ]

  return (
    <div className="review-shell" style={{ animation: 'fadeUp 0.35s var(--ease) both' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
          Weekly Review
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text-0)', margin: 0 }}>
            This <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>week.</em>
          </h1>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {[0, 1].map(i => (
              <span key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.12)', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: i === 1 ? 0.3 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {i === 0 ? <path d="M10 4L6 8l4 4" /> : <path d="M6 4l4 4-4 4" />}
                </svg>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Stats — 4 across ── */}
      <div className="review-stats-4">
        {stats.map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 400, color: s.color, lineHeight: 1, marginBottom: '5px' }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mid: Energy + Habits ── */}
      <div className="glass-card" style={{ padding: '24px 26px', marginBottom: '20px' }}>
        <div className="review-mid" style={{ marginBottom: 0 }}>
          <section>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
              Energy this week
            </p>
            <DemoEnergyCurveChart />
            <div style={{ display: 'flex', marginTop: '16px', borderTop: '1px solid oklch(1 0 0 / 0.07)', paddingTop: '16px' }}>
              {[
                { label: 'Avg energy', value: avgEnergy.toFixed(1) },
                { label: 'Peak day',   value: DAYS_SHORT[peakIdx] },
                { label: 'Logged',     value: `${WEEK_ENERGY.length}/7` },
              ].map((c, i) => (
                <div key={c.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid oklch(1 0 0 / 0.07)' : 'none', padding: '0 12px' }}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text-0)', margin: '0 0 3px', fontWeight: 400 }}>{c.value}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{c.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
              Habits
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {habitStats.map((h, i) => {
                const pct = Math.round((h.done / h.target) * 100)
                const onTrack = pct >= 100
                const barColor = onTrack ? 'var(--sage)' : pct >= 50 ? 'var(--gold)' : 'oklch(1 0 0 / 0.2)'
                const valueColor = onTrack ? 'var(--sage)' : pct >= 50 ? 'var(--gold)' : 'var(--text-3)'
                return (
                  <li key={h.id} style={{ padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid oklch(1 0 0 / 0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
                      <p style={{ flex: 1, fontSize: '14px', color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</p>
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

      {/* ── Goals ── */}
      <div className="glass-card" style={{ padding: '24px 26px', marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px' }}>
          Goals
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {DEMO_GOALS.map(g => {
            const barColor = g.progress > 0 ? 'var(--gold)' : 'oklch(1 0 0 / 0.25)'
            return (
              <li key={g.id}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text-0)', margin: '0 0 8px', lineHeight: 1.3 }}>{g.title}</p>
                <div style={{ height: '2px', background: 'oklch(1 0 0 / 0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${g.progress}%`, background: barColor, borderRadius: '2px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.steps} of {g.total} steps · {g.timeframe}
                  </p>
                  <span style={{ fontSize: '11px', color: g.progress > 0 ? 'var(--gold)' : 'var(--text-3)', opacity: g.progress > 0 ? 0.9 : 0.5, flexShrink: 0 }}>
                    {g.progress}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Weekly Reflection from Locus ── */}
      <section style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '20px' }}>
          Weekly Reflection from Locus
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            { items: worked, color: 'var(--sage)', icon: '↑', title: 'What worked' },
            { items: adjust, color: 'var(--gold)', icon: '↻', title: 'What to adjust' },
          ].map((col, i) => (
            <div key={i} className="glass-card" style={{ padding: '22px 24px' }}>
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
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 300, lineHeight: 1.75, color: 'var(--ai-card-text)', margin: 0 }}>{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SignInCTA label="Start your own review →" />
    </div>
  )
}

/* ── DEMO SIDEBAR (bottom dock) ── */

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',    label: 'Home',     icon: <HomeIcon /> },
  { id: 'checkin', label: 'Check-in', icon: <CheckinIcon /> },
  { id: 'habits',  label: 'Habits',   icon: <HabitsIcon /> },
  { id: 'goals',   label: 'Goals',    icon: <GoalsIcon /> },
  { id: 'review',  label: 'Review',   icon: <ReviewIcon /> },
]

function DemoSidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <aside className="app-sidebar">
      {/* Centered glass pill nav */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          background: 'var(--glass-card-bg)',
          border: '1px solid var(--glass-card-border)',
          borderRadius: 'var(--radius-card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          boxShadow: 'var(--glass-card-shadow)',
          padding: '6px 8px',
          height: '52px',
        }}>
          {/* Locus logo dot */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'var(--glass-card-bg-tint)',
            border: '1px solid var(--glass-card-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginRight: '4px',
          }}>
            <LocusLogo size={18} />
          </div>

          {/* Tab buttons */}
          <nav style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2px' }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  title={t.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '0 14px', height: '40px', borderRadius: '12px',
                    background: active ? 'var(--nav-active-bg)' : 'transparent',
                    border: active ? '1px solid var(--nav-active-border)' : '1px solid transparent',
                    color: active ? 'var(--gold)' : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover-bg)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--text-1)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
                    }
                  }}
                >
                  <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {t.icon}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: active ? 500 : 400, letterSpacing: '0.01em', lineHeight: 1 }}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

    </aside>
  )
}

/* ── DEMO BOTTOM NAV ── */

function DemoBottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          aria-label={t.label}
          className={`bottom-nav-item${tab === t.id ? ' active' : ''}`}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {t.icon}
          </span>
        </button>
      ))}
    </nav>
  )
}

/* ── SIGN-IN BANNER (mobile) ── */

function MobileSignInBanner() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px',
      background: 'oklch(0.12 0.015 75 / 0.88)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid oklch(1 0 0 / 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <LocusLogo size={16} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>
          Locus<em style={{ fontStyle: 'italic', color: 'oklch(0.82 0.15 75)' }}>AI</em>
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: '99px',
          background: 'oklch(0.78 0.13 70 / 0.18)', color: 'oklch(0.82 0.15 75)',
        }}>
          Preview
        </span>
      </div>
      <Link
        href="/login"
        style={{
          fontSize: '12px', fontWeight: 600, color: 'oklch(0.18 0.02 60)',
          background: 'oklch(0.78 0.13 70)', borderRadius: '99px',
          padding: '6px 14px', textDecoration: 'none',
        }}
      >
        Sign in
      </Link>
    </div>
  )
}

/* ── MAIN EXPORT ── */

export default function DemoApp() {
  const [tab, setTab]           = useState<Tab>('home')
  const [homeVisits, setHomeVisits] = useState(0)
  const prevTabRef = useRef<Tab>('home')
  const bgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (tab === 'home' && prevTabRef.current !== 'home') {
      setHomeVisits(v => v + 1)
    }
    prevTabRef.current = tab
  }, [tab])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!bgRef.current) return
      const x = (e.clientX / window.innerWidth  - 0.5) * 16
      const y = (e.clientY / window.innerHeight - 0.5) * 10
      bgRef.current.style.transform = `translate(${x}px, ${y}px) scale(1.06)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  const [habitDone, setHabitDoneMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEMO_HABITS.map(h => [h.id, h.done]))
  )

  function toggleHabit(id: string) {
    setHabitDoneMap(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {/* Background wallpaper */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={bgRef}
        aria-hidden
        src="/wallpapers/locus-5.jpg"
        alt=""
        fetchPriority="high"
        decoding="async"
        style={{
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center', zIndex: -1,
          transform: 'scale(1.06)',
          transition: 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}
      />
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />

      {/* Top banner — home only */}
      {tab === 'home' && <MobileSignInBanner />}

      {/* App shell — exact same as real app */}
      <div className="app-shell">
        <main className="app-main" style={{ paddingTop: '0' }}>
          {tab === 'home'    && <HomeView    habitDone={habitDone} setHabitDone={toggleHabit} messageIndex={homeVisits} />}
          {tab === 'checkin' && <CheckinView />}
          {tab === 'habits'  && <HabitsView  habitDone={habitDone} setHabitDone={toggleHabit} />}
          {tab === 'goals'   && <GoalsView />}
          {tab === 'review'  && <ReviewView />}
        </main>
        <DemoSidebar tab={tab} setTab={setTab} />
        <DemoBottomNav tab={tab} setTab={setTab} />
      </div>

      <style>{`
        .mobile-only-banner { display: none; }
        @media (max-width: 768px) {
          .mobile-only-banner { display: flex; }
          .app-main { padding-top: 56px !important; }
        }
      `}</style>
    </>
  )
}
