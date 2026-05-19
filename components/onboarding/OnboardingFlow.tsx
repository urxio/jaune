'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding, type GoalInput, type HabitInput, type ProfileInput } from '@/app/actions/onboarding'

type Message = { role: 'user' | 'assistant'; content: string }

type OnboardingData = {
  profile: ProfileInput
  goals: GoalInput[]
  habits: HabitInput[]        // still uses goal_index from AI
  checkin: { energy_level: number; mood_note: string | null }
}

// In the review phase we track a stable goalDraftId instead of a fragile goal_index,
// so removing a goal doesn't silently re-link habits to the wrong goal.
type GoalDraft  = GoalInput & { id: string }
type HabitDraft = Omit<HabitInput, 'goal_index'> & { id: string; goalDraftId: string | null }

type Phase = 'chat' | 'review'

const ONBOARDING_DATA_RE         = /<onboarding_data>\s*([\s\S]*?)\s*<\/onboarding_data>/
const ONBOARDING_DATA_PARTIAL_RE = /<onboarding_data>[\s\S]*$/

const GOAL_CATEGORIES = [
  { value: 'product',   label: 'Product / Work' },
  { value: 'health',    label: 'Health' },
  { value: 'learning',  label: 'Learning' },
  { value: 'financial', label: 'Financial' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'other',     label: 'Other' },
]
const TIMEFRAMES = [
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year',    label: 'This Year' },
  { value: 'ongoing', label: 'Ongoing' },
]
const FREQ_PRESETS = [
  { label: 'Daily',     days: [] as number[] },
  { label: '3× / week', days: [1, 3, 5] },
  { label: 'Weekdays',  days: [1, 2, 3, 4, 5] },
]

/* ── Shared styles ── */
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '9px 12px', fontSize: '13.5px',
  color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px', display: 'block',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

/* ── Locus petal SVG (matches favicon) ── */
const PetalSvg = ({ size, fill = '#131110' }: { size: number; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <g fill={fill} opacity="0.65">
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(45,50,50)"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(135,50,50)"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(225,50,50)"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(315,50,50)"/>
    </g>
    <g fill={fill}>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(90,50,50)"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(180,50,50)"/>
      <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(270,50,50)"/>
    </g>
  </svg>
)

/* ── Locus avatar ── */
const LocusIcon = () => (
  <div style={{
    width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 10px rgba(212,168,83,0.25)', marginTop: '1px',
  }}>
    <PetalSvg size={18} />
  </div>
)

/* ═══════════════════════════════════════════════════════ */
export default function OnboardingFlow({ userName, isRedo }: { userName: string; isRedo: boolean }) {

  const [phase, setPhase] = useState<Phase>('chat')

  /* ── Chat ── */
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatDone,  setChatDone]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  /* ── Review data ── */
  const [profile,  setProfile]  = useState<ProfileInput | null>(null)
  const [checkin,  setCheckin]  = useState<{ energy_level: number; mood_note: string | null } | null>(null)
  const [goals,    setGoals]    = useState<GoalDraft[]>([])
  const [habits,   setHabits]   = useState<HabitDraft[]>([])

  /* ── Add-goal form ── */
  const [addingGoal, setAddingGoal] = useState(false)
  const [gTitle, setGTitle] = useState('')
  const [gCat,   setGCat]   = useState('product')
  const [gTime,  setGTime]  = useState('quarter')

  /* ── Add-habit form ── */
  const [addingHabit, setAddingHabit] = useState(false)
  const [hEmoji,       setHEmoji]       = useState('✨')
  const [hName,        setHName]        = useState('')
  const [hDays,        setHDays]        = useState<number[]>([])
  const [hGoalDraftId, setHGoalDraftId] = useState<string | null>(null)

  /* ── Save ── */
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  const router = useRouter()
  const messagesBoxRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const initFetched    = useRef(false)
  const dataRef        = useRef(false)

  /* ── Scroll to bottom ── */
  useEffect(() => {
    const box = messagesBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages])

  /* ── Keep input focused throughout the chat ── */
  useEffect(() => {
    if (!chatDone) inputRef.current?.focus()
  }, [streaming, chatDone])

  /* ── Transition chat → review ── */
  const [readyToReview, setReadyToReview] = useState(false)

  const enterReview = useCallback((data: OnboardingData) => {
    setProfile(data.profile)
    setCheckin(data.checkin)
    const goalDrafts: GoalDraft[] = data.goals.map(g => ({ ...g, id: crypto.randomUUID() }))
    setGoals(goalDrafts)
    setHabits(data.habits.map(h => ({
      id: crypto.randomUUID(),
      emoji: h.emoji,
      name: h.name,
      days_of_week: h.days_of_week,
      goalDraftId: (h.goal_index != null && goalDrafts[h.goal_index]) ? goalDrafts[h.goal_index].id : null,
    })))
    setChatDone(true)
    setReadyToReview(true)
  }, [])

  /* ── Stream ── */
  const fetchReply = useCallback(async (msgs: Message[]) => {
    setStreaming(true)
    setError(null)
    let fullText = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/onboarding/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, userName }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        const display = fullText.replace(ONBOARDING_DATA_RE, '').replace(ONBOARDING_DATA_PARTIAL_RE, '').trim()
        setMessages(prev => { const next = [...prev]; next[next.length - 1] = { role: 'assistant', content: display }; return next })
      }
      const dataMatch = fullText.match(ONBOARDING_DATA_RE)
      if (dataMatch && !dataRef.current) {
        dataRef.current = true
        try { enterReview(JSON.parse(dataMatch[1])) }
        catch (pe) { console.error('[OnboardingFlow] parse error', pe); setError('Couldn\'t read the summary — please try again.') }
      }
    } catch (err) {
      console.error('[OnboardingFlow] fetch error', err)
      setError('Something went wrong — please try again.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
      if (!chatDone) inputRef.current?.focus()
    }
  }, [userName, enterReview, chatDone])

  /* ── Opener ── */
  useEffect(() => {
    if (initFetched.current) return
    initFetched.current = true
    fetchReply([])
  }, [fetchReply])

  /* ── Send ── */
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || chatDone) return
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
    await fetchReply(next)
  }, [input, messages, streaming, chatDone, fetchReply])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value); e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }
  const canSend = !!input.trim() && !streaming && !chatDone

  /* ── Remove goal: also unlink habits that referenced it ── */
  const removeGoal = (goalId: string) => {
    setGoals(gs => gs.filter(g => g.id !== goalId))
    setHabits(hs => hs.map(h => h.goalDraftId === goalId ? { ...h, goalDraftId: null } : h))
  }

  /* ── Add goal ── */
  const addGoal = () => {
    if (!gTitle.trim()) return
    setGoals(gs => [...gs, { id: crypto.randomUUID(), title: gTitle.trim(), category: gCat, timeframe: gTime }])
    setGTitle(''); setGCat('product'); setGTime('quarter'); setAddingGoal(false)
  }

  /* ── Add habit ── */
  const addHabit = () => {
    if (!hName.trim()) return
    setHabits(hs => [...hs, { id: crypto.randomUUID(), emoji: hEmoji, name: hName.trim(), days_of_week: hDays, goalDraftId: hGoalDraftId }])
    setHEmoji('✨'); setHName(''); setHDays([]); setHGoalDraftId(null); setAddingHabit(false)
  }

  /* ── Final save ── */
  const handleLaunch = () => {
    if (!profile || !checkin) return
    setSaveError(null)
    startTransition(async () => {
      try {
        // Resolve goalDraftId → goal_index (position in the goals array)
        const goalIdxMap = new Map(goals.map((g, i) => [g.id, i]))
        const habitInputs: HabitInput[] = habits.map(h => ({
          emoji: h.emoji, name: h.name, days_of_week: h.days_of_week,
          goal_index: (h.goalDraftId != null && goalIdxMap.has(h.goalDraftId))
            ? goalIdxMap.get(h.goalDraftId)!
            : null,
        }))
        await completeOnboarding(
          goals.map(({ id: _id, ...g }) => g),
          habitInputs,
          profile,
          { energy_level: checkin.energy_level, mood_note: checkin.mood_note },
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )
        router.push('/checkin')
        router.refresh()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const energyLabel =
    !checkin ? '' :
    checkin.energy_level >= 9 ? 'Exceptional' :
    checkin.energy_level >= 7 ? 'High' :
    checkin.energy_level >= 5 ? 'Moderate' :
    checkin.energy_level >= 3 ? 'Low' : 'Depleted'

  /* ══════════════════════════════════════════════════════ */
  /*  CHAT PHASE                                            */
  /* ══════════════════════════════════════════════════════ */
  if (phase === 'chat') return (
    <div style={{ width: '100%', maxWidth: '540px', animation: 'fadeUp 0.4s var(--ease) both' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(212,168,83,0.3)' }}>
          <PetalSvg size={28} />
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.2 }}>
          {isRedo ? 'Update your profile' : 'Meet Jaune'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '6px' }}>
          {isRedo ? 'Tell Jaune what\'s changed — takes about 2 minutes.' : 'A quick chat to get you set up. About 2 minutes.'}
        </div>
      </div>

      <div style={{ background: 'var(--glass-card-bg)', border: '1px solid var(--glass-card-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--glass-card-shadow)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

        {/* Identity bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '13px 16px', flexShrink: 0,
          borderBottom: '1px solid var(--glass-card-border-subtle)',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(212,168,83,0.25)',
          }}>
            <PetalSvg size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-0)', lineHeight: 1 }}>Jaune</div>
            <div style={{ fontSize: '11px', color: 'var(--sage)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--sage)', display: 'inline-block', flexShrink: 0 }} />
              {chatDone ? 'preparing your summary' : 'listening'}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesBoxRef} style={{ height: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarWidth: 'none' }}>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 16px 12px' }}>
            {messages.map((msg, i) => {
              const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
              const showCursor = isLastAssistant && streaming && !msg.content
              if (msg.role === 'assistant') return (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '88%' }}>
                  {showCursor
                    ? <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '6px 0' }}>
                        {[0, 150, 300].map(delay => (
                          <span key={delay} style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-3)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                    : <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', lineHeight: 1.55, color: 'oklch(0.93 0.012 80 / 0.95)', margin: 0 }}>
                        {msg.content}
                      </p>
                  }
                </div>
              )
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '78%', padding: '11px 16px',
                    borderRadius: '18px 4px 18px 18px',
                    background: 'oklch(0.26 0.012 60 / 0.70)',
                    border: '1px solid oklch(1 0 0 / 0.10)',
                    fontSize: '15px', color: 'var(--text-0)', lineHeight: 1.55,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              )
            })}
            <div style={{ height: '1px' }} />
          </div>
        </div>

        {/* Input bar */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--glass-card-border-subtle)' }}>
          {error && (
            <div style={{ fontSize: '13px', color: '#c08060', margin: '10px 16px 0', padding: '10px 14px', background: 'rgba(192,128,96,0.08)', border: '1px solid rgba(192,128,96,0.2)', borderRadius: '10px' }}>
              {error}
            </div>
          )}
          {!chatDone ? (
            <>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', margin: '12px 16px', padding: '12px 16px', borderRadius: '9999px' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={streaming ? '' : 'Type your reply…'}
                  readOnly={streaming}
                  rows={1}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-0)', resize: 'none', lineHeight: 1.5, overflow: 'hidden', padding: '4px 0' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: canSend ? 'var(--gold)' : 'oklch(1 0 0 / 0.08)', border: 'none', color: canSend ? '#131110' : 'var(--text-3)', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s, opacity 0.2s', alignSelf: 'flex-end', opacity: canSend ? 1 : 0.35 }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 13V3M3 8l5-5 5 5"/>
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', padding: '0 16px 10px', opacity: 0.55 }}>
                Enter to send · Shift+Enter for new line
              </div>
            </>
          ) : readyToReview ? (
            <div style={{ padding: '12px 16px 14px' }}>
              <button
                onClick={() => setPhase('review')}
                style={{
                  width: '100%', padding: '13px', background: 'var(--gold)',
                  border: 'none', borderRadius: '12px', fontSize: '14px',
                  fontWeight: 700, color: '#131110', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.01em',
                  transition: 'filter 0.15s',
                }}
              >
                See my setup →
              </button>
            </div>
          ) : (
            <div style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold)', display: 'inline-block' }} />
              Wrapping up…
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <a href="/checkin" style={{ fontSize: '13px', color: 'var(--text-3)', textDecoration: 'none' }}>{isRedo ? '← Back to brief' : 'Skip for now →'}</a>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════ */
  /*  REVIEW PHASE                                          */
  /* ══════════════════════════════════════════════════════ */
  return (
    <div style={{ width: '100%', maxWidth: '580px', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.35s var(--ease) both' }}>

      {/* Header — pinned */}
      <div style={{ textAlign: 'center', marginBottom: '28px', flexShrink: 0 }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--gold) 0%, #a07830 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(212,168,83,0.3)' }}>
          <PetalSvg size={28} />
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400, color: 'var(--text-0)' }}>Here&apos;s what I&apos;ve got</div>
        <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '6px' }}>Review and edit before launching. You can always change this later.</div>
      </div>

      {/* Cards — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>

        {/* ── GOALS ── */}
        <ReviewCard title="Goals" count={goals.length}>
          {goals.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0', borderBottom: i < goals.length - 1 ? '1px solid var(--glass-card-border-subtle)' : 'none' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--gold)', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '3px' }}>{g.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                  {GOAL_CATEGORIES.find(c => c.value === g.category)?.label ?? g.category}
                  {' · '}
                  {TIMEFRAMES.find(t => t.value === g.timeframe)?.label ?? g.timeframe}
                </div>
              </div>
              <button onClick={() => removeGoal(g.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '16px', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '2px 4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                aria-label="Remove goal">×</button>
            </div>
          ))}

          {addingGoal ? (
            <div style={{ marginTop: goals.length > 0 ? '12px' : '0', padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-card-border-subtle)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Goal title</label>
                <input value={gTitle} onChange={e => setGTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGoal()}
                  placeholder="e.g. Launch my product by Q2" autoFocus style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={gCat} onChange={e => setGCat(e.target.value)} style={selectStyle}>
                    {GOAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Timeframe</label>
                  <select value={gTime} onChange={e => setGTime(e.target.value)} style={selectStyle}>
                    {TIMEFRAMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addGoal} disabled={!gTitle.trim()} style={{ flex: 1, padding: '10px', background: gTitle.trim() ? 'var(--gold)' : 'rgba(255,255,255,0.06)', color: gTitle.trim() ? '#131110' : 'var(--text-3)', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: gTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  Add goal
                </button>
                <button onClick={() => { setAddingGoal(false); setGTitle('') }} style={{ padding: '10px 16px', background: 'none', border: '1px solid var(--glass-card-border)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          ) : goals.length < 5 ? (
            <button onClick={() => setAddingGoal(true)}
              style={{ marginTop: goals.length > 0 ? '12px' : '0', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed var(--glass-card-border)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'border-color 0.15s, color 0.15s' }}>
              <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Add a goal
            </button>
          ) : null}
        </ReviewCard>

        {/* ── HABITS ── */}
        <ReviewCard title="Habits" count={habits.length}>
          {habits.map((h, i) => {
            const freq = FREQ_PRESETS.find(p =>
              JSON.stringify([...p.days].sort()) === JSON.stringify([...h.days_of_week].sort())
            )?.label ?? 'Custom'
            const linkedGoal = goals.find(g => g.id === h.goalDraftId) ?? null

            return (
              <div key={h.id} style={{ padding: '14px 0', borderBottom: i < habits.length - 1 ? '1px solid var(--glass-card-border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)' }}>{h.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{freq}</div>
                  </div>
                  <button onClick={() => setHabits(hs => hs.filter(x => x.id !== h.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '16px', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '2px 4px', opacity: 0.5, transition: 'opacity 0.15s' }}
                    aria-label="Remove habit">×</button>
                </div>

                {/* Goal link row */}
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>Linked goal:</span>
                  <select
                    value={h.goalDraftId ?? ''}
                    onChange={e => {
                      const val = e.target.value
                      setHabits(hs => hs.map(x => x.id === h.id ? { ...x, goalDraftId: val || null } : x))
                    }}
                    style={{
                      flex: 1,
                      background: linkedGoal ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${linkedGoal ? 'rgba(212,168,83,0.35)' : 'var(--glass-card-border)'}`,
                      borderRadius: '8px', padding: '5px 10px', fontSize: '12.5px',
                      color: linkedGoal ? 'var(--gold)' : 'var(--text-3)',
                      cursor: 'pointer', fontFamily: 'inherit', outline: 'none', appearance: 'none',
                    }}
                  >
                    <option value="">None</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}

          {addingHabit ? (
            <div style={{ marginTop: habits.length > 0 ? '12px' : '0', padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-card-border-subtle)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Emoji</label>
                  <input value={hEmoji} onChange={e => setHEmoji(e.target.value)} maxLength={4}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', padding: '7px 4px' }} />
                </div>
                <div>
                  <label style={labelStyle}>Habit name</label>
                  <input value={hName} onChange={e => setHName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHabit()}
                    placeholder="e.g. Morning walk" autoFocus style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {FREQ_PRESETS.map(p => {
                    const active = JSON.stringify([...p.days].sort()) === JSON.stringify([...hDays].sort())
                    return (
                      <button key={p.label} onClick={() => setHDays(p.days)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? 'rgba(212,168,83,0.4)' : 'var(--glass-card-border)'}`, background: active ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--gold)' : 'var(--text-2)', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {goals.length > 0 && (
                <div>
                  <label style={labelStyle}>Linked goal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <select value={hGoalDraftId ?? ''} onChange={e => setHGoalDraftId(e.target.value || null)} style={selectStyle}>
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addHabit} disabled={!hName.trim()}
                  style={{ flex: 1, padding: '10px', background: hName.trim() ? 'var(--gold)' : 'rgba(255,255,255,0.06)', color: hName.trim() ? '#131110' : 'var(--text-3)', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: hName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  Add habit
                </button>
                <button onClick={() => { setAddingHabit(false); setHName(''); setHEmoji('✨'); setHDays([]); setHGoalDraftId(null) }}
                  style={{ padding: '10px 16px', background: 'none', border: '1px solid var(--glass-card-border)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          ) : habits.length < 5 ? (
            <button onClick={() => setAddingHabit(true)}
              style={{ marginTop: habits.length > 0 ? '12px' : '0', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed var(--glass-card-border)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'border-color 0.15s, color 0.15s' }}>
              <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Add a habit
            </button>
          ) : null}
        </ReviewCard>

        {/* ── CHECK-IN ── */}
        {checkin && (
          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Today&apos;s Check-in</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-card-border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px' }}>Energy</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-0)', lineHeight: 1 }}>{checkin.energy_level}<span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'inherit' }}>/10</span></div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>{energyLabel}</div>
              </div>
              {checkin.mood_note && (
                <div style={{ flex: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-card-border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px' }}>Mood</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.55 }}>{checkin.mood_note}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {saveError && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(200,80,60,0.08)', border: '1px solid rgba(200,80,60,0.18)', fontSize: '13px', color: '#e07060' }}>{saveError}</div>
        )}

        {/* ── ACTIONS ── */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
          <button
            onClick={() => { setPhase('chat'); setChatDone(false); dataRef.current = false; setMessages([]); initFetched.current = false }}
            style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-card-border)', color: 'var(--text-2)', borderRadius: '12px', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', transition: 'background 0.15s' }}>
            ← Start over
          </button>
          <button onClick={handleLaunch}
            disabled={isPending || goals.length === 0 || habits.length === 0}
            style={{ flex: 1, padding: '13px', background: (goals.length > 0 && habits.length > 0) ? 'var(--gold)' : 'rgba(255,255,255,0.06)', color: (goals.length > 0 && habits.length > 0) ? '#131110' : 'var(--text-3)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: (isPending || goals.length === 0 || habits.length === 0) ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1, fontFamily: 'inherit', transition: 'all 0.2s', letterSpacing: '0.01em' }}>
            {isPending ? 'Setting up your OS…' : 'Launch my Jaune →'}
          </button>
        </div>

        {goals.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', marginTop: '-8px' }}>Add at least one goal to continue.</div>}
        {goals.length > 0 && habits.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', marginTop: '-8px' }}>Add at least one habit to continue.</div>}

        <div style={{ textAlign: 'center' }}>
          <a href="/checkin" style={{ fontSize: '13px', color: 'var(--text-3)', textDecoration: 'none' }}>{isRedo ? '← Back to brief' : 'Skip setup →'}</a>
        </div>
      </div>
    </div>
  )
}

/* ── Section card ── */
function ReviewCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: count > 0 ? '8px' : '0' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-card-border-subtle)', padding: '2px 9px', borderRadius: '10px', fontWeight: 600 }}>{count}</div>
      </div>
      {children}
    </div>
  )
}
