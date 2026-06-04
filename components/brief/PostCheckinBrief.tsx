'use client'

import { useState, useCallback, useRef } from 'react'
import type { Brief } from '@/lib/types'
import type { UserMemory } from '@/lib/ai/memory'
import BriefLoader from './BriefLoader'
import AIInsightCard from './AIInsightCard'
import PriorityCard from './PriorityCard'
import ClarifyingQuestions, { type QAPair } from './ClarifyingQuestions'
import MemoryCard from './MemoryCard'

type Props = {
  memory?: UserMemory | null
  sidebar?: boolean
}

export default function PostCheckinBrief({ memory, sidebar = false }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [generating, setGenerating] = useState(true)
  const [genError, setGenError] = useState<string | null>(null)
  const [liveQuestions, setLiveQuestions] = useState<string[] | null>(null)
  const [questionsAnswered, setQuestionsAnswered] = useState(false)
  const [clarificationNote, setClarificationNote] = useState<string | null>(null)
  const [noteLoading, setNoteLoading] = useState(false)
  const suppressNextQuestions = useRef(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const pendingClarifications = memory?.pending_clarifications
  const persistedQuestions =
    !questionsAnswered &&
    pendingClarifications?.brief_date === todayStr &&
    pendingClarifications.questions.length > 0
      ? pendingClarifications.questions
      : null
  const clarifyingQuestions = liveQuestions ?? persistedQuestions

  const handleBriefReady = useCallback((b: Brief, questions: string[]) => {
    setBrief(b)
    setGenerating(false)
    if (questions.length > 0 && !suppressNextQuestions.current) {
      setLiveQuestions(questions)
    }
    suppressNextQuestions.current = false
  }, [])

  const handleGenError = useCallback((detail: string) => {
    setGenerating(false)
    setGenError(detail)
  }, [])

  const generateClarificationNote = async (answers: QAPair[], currentBrief: Brief) => {
    if (!answers.length) return
    setNoteLoading(true)
    try {
      const res = await fetch('/api/brief/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, briefInsight: currentBrief.insight_text }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.note) setClarificationNote(json.note)
    } catch {
      // silent fail
    } finally {
      setNoteLoading(false)
    }
  }

  const wrapStyle: React.CSSProperties = sidebar
    ? { padding: '20px 22px 28px', animation: 'fadeUp 0.4s var(--ease) both', animationDelay: '0.15s' }
    : { marginTop: '32px', animation: 'fadeUp 0.4s var(--ease) both', animationDelay: '0.15s' }

  return (
    <div style={wrapStyle}>

      {/* ── Section divider (standalone mode only) ── */}
      {!sidebar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.2)',
            borderRadius: '20px', padding: '3px 10px 3px 7px',
            fontSize: '10px', color: 'var(--gold)', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', animation: generating ? 'pulse 1s ease-in-out infinite' : 'none' }} />
            Daily Brief
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
      )}

      {/* ── Brief loader / insight card ── */}
      {generating ? (
        <div className={sidebar ? undefined : 'glass-card'} style={{ overflow: 'hidden', marginBottom: sidebar ? '0' : '20px', ...(sidebar ? {} : {}) }}>
          <BriefLoader onBriefReady={handleBriefReady} onError={handleGenError} />
        </div>
      ) : genError ? (
        <div className="glass-card-sm" style={{ border: '1px solid rgba(200,80,80,0.2)', padding: '22px 26px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '12px' }}>
            Brief generation hit an issue: {genError}
          </div>
          <a href="/checkin" style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
            Open brief page →
          </a>
        </div>
      ) : brief ? (
        <AIInsightCard text={brief.insight_text} sidebar={sidebar} />
      ) : null}

      {/* ── Clarification note ── */}
      {(clarificationNote || noteLoading) && !generating && (
        <div className="glass-card-sm" style={{ padding: '16px 20px', marginTop: '-8px', marginBottom: '16px', animation: 'fadeUp 0.25s var(--ease) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', opacity: noteLoading ? 0 : 1, animation: noteLoading ? 'pulse 1s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              {noteLoading ? 'Jaune is reflecting on your answers…' : 'Jaune · Clarification'}
            </span>
          </div>
          {noteLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-3)', width: '90%', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-3)', width: '70%', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.1s' }} />
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 300, color: 'var(--text-1)', lineHeight: 1.6, margin: 0 }}>
              {clarificationNote}
            </p>
          )}
        </div>
      )}

      {/* ── Clarifying questions ── */}
      {clarifyingQuestions && !generating && (
        <ClarifyingQuestions
          questions={clarifyingQuestions}
          briefDate={todayStr}
          onComplete={(answers) => {
            suppressNextQuestions.current = true
            setLiveQuestions(null)
            setQuestionsAnswered(true)
            if (brief && answers.length > 0) {
              generateClarificationNote(answers, brief)
            }
          }}
        />
      )}

      {/* ── Today's priorities ── */}
      {brief?.priorities && brief.priorities.length > 0 && (
        <div style={{ marginBottom: '24px', marginTop: sidebar ? '20px' : '0' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            marginBottom: sidebar ? '0' : '10px',
            padding: sidebar ? '0 0 10px' : '0',
            borderBottom: sidebar ? '1px solid var(--border)' : 'none',
          }}>
            Today&apos;s priorities
          </div>
          <div className={sidebar ? undefined : 'glass-card-sm'} style={sidebar ? {} : { padding: '0 24px', overflow: 'hidden' }}>
            {brief.priorities.map((p, i) => (
              <PriorityCard
                key={i}
                num={i + 1}
                title={p.title}
                category={p.category}
                time={p.estimated_time}
                timeOfDay={p.time_of_day}
                reasoning={p.reasoning}
                last={i === brief.priorities!.length - 1}
                compact={sidebar}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Memory card ── */}
      {memory && memory.checkin_count >= 5 && (
        <MemoryCard memory={memory} />
      )}

    </div>
  )
}
