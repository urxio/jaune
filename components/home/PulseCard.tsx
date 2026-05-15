'use client'

import type { Goal, Brief } from '@/lib/types'

export type MessageSegment = { text: string; highlight?: 'sage' | 'gold' | 'muted' }
export type MessageLine    = MessageSegment[]

export function buildPulseMessage(opts: {
  firstName:   string
  hour:        number
  dayName:     string
  day:         number
  month:       string
  habitsTotal: number
  goalsActive: number
  firstGoal:   Goal | null
  energyScore: number | null
  brief:       Brief | null | undefined
}): MessageLine[] {
  const { firstName, hour, dayName, day, month,
          habitsTotal, goalsActive, firstGoal,
          energyScore, brief } = opts

  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Hey' : 'Evening'
  const followUp = hour < 12 ? ', hope you slept well. Today is '
                 : hour < 17 ? '. Today is '
                 : ', hope the day treated you well. Today is '
  const lines: MessageLine[] = []

  lines.push([
    { text: `${greeting} ` },
    { text: firstName, highlight: 'sage' },
    { text: followUp },
    { text: `${dayName}, ${day} ${month}`, highlight: 'muted' },
    { text: '.' },
  ])

  const energy = energyScore ?? brief?.energy_score
  if (energy != null) {
    lines.push([
      { text: 'From your recent journal entries, I\'d expect your energy to be around a ' },
      { text: `${energy}`, highlight: 'gold' },
      { text: ' today — keep that in mind as you plan your morning.' },
    ])
  }

  if (brief?.insight_text) {
    lines.push([{ text: brief.insight_text.split('.').slice(0, 1).join('.') + '.' }])
  }

  if (habitsTotal > 0) {
    lines.push([
      { text: 'Don\'t forget, you have ' },
      { text: `${habitsTotal} habit${habitsTotal !== 1 ? 's' : ''}`, highlight: 'gold' },
      { text: ' to check off today.' },
    ])
  }

  if (goalsActive > 0 && firstGoal) {
    lines.push([
      { text: 'Your goal of ' },
      { text: firstGoal.title, highlight: 'sage' },
      { text: ' is also getting some traction — keep the momentum going.' },
    ])
  } else if (goalsActive > 0) {
    lines.push([
      { text: 'You have ' },
      { text: `${goalsActive} active goal${goalsActive !== 1 ? 's' : ''}`, highlight: 'sage' },
      { text: ' in progress — keep going.' },
    ])
  }

  lines.push([{ text: 'Let me know how the day goes when you\'re ready to check in.' }])

  return lines
}

export function PulseMessage({ lines }: { lines: MessageLine[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
      {lines.map((line, i) => (
        <p key={i} style={{
          margin: 0,
          fontSize: 'clamp(14px, 1.8vw, 16px)',
          lineHeight: 1.75,
          color: 'var(--text-1)',
          fontWeight: i === 0 ? 500 : 400,
        }}>
          {line.map((seg, j) => {
            if (!seg.highlight)               return <span key={j}>{seg.text}</span>
            if (seg.highlight === 'sage')     return <span key={j} style={{ color: 'var(--sage)', fontWeight: 600 }}>{seg.text}</span>
            if (seg.highlight === 'gold')     return <span key={j} style={{ color: 'var(--gold)', fontWeight: 600 }}>{seg.text}</span>
            return                                   <span key={j} style={{ color: 'var(--text-0)', fontWeight: 500 }}>{seg.text}</span>
          })}
        </p>
      ))}
    </div>
  )
}
