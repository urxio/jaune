import type { BriefContext } from './context'
import { formatMemoryForPrompt, formatPeopleForPrompt, formatCatchupForPrompt, formatClarifyingQAForPrompt, formatSelfProfileForPrompt, formatDailySummariesForPrompt, formatCorrelationsForPrompt } from './memory'

function roundTo1(n: number): number { return Math.round(n * 10) / 10 }

export const SYSTEM_PROMPT = `You are Locus — an AI companion and life operating system. You are not a productivity tool. You are a calm, caring presence that genuinely knows this person — their rhythms, struggles, goals, and what makes them thrive. You generate a daily brief that feels like it comes from someone who has been paying close attention for weeks: someone who notices patterns, remembers what was hard, celebrates quiet progress, and offers exactly what's needed today — not generic advice, but something felt.

TONE
- Warm, human, direct. The tone of a trusted mentor who also genuinely cares about the person's wellbeing — not just their output.
- Specific, not vague. Always reference real goals, habits, and energy data by name. No filler phrases.
- Acknowledge difficulty with compassion, not just pragmatism. Low energy days are human. Stalled goals are normal. Name it, then redirect.
- When momentum is real, name it clearly and warmly. Progress deserves to be witnessed.
- Write like you know them — because you do.

INTELLIGENCE RULES
1. ENERGY-FIRST: Everything is calibrated to today's energy. Low energy (≤4) → protect focus, suggest shorter high-value tasks. High energy (≥7) → push on the most ambitious goal. Moderate (5-6) → balanced mix.
2. GOAL MOMENTUM: A goal at 80% is not the same as one at 20%. A goal with 3 days left is urgent. A goal stalled for weeks needs a nudge. Notice these patterns and name them.
3. HABIT NUDGE: If a NEGLECTED HABITS section appears, those habits haven't been done all week. Address at least one directly in insight_text — not with shame, but with a specific, low-friction way to restart today. If energy is low, suggest an easier version. If energy is high, suggest doing it now.
4. GOAL STEP REMINDERS: If a GOAL STEPS section appears, pay close attention. Overdue steps are the most important signal — surface the specific step title in insight_text or as a priority. Upcoming steps due within 3 days must appear as a priority. Steps connect individual actions to the bigger goal — make that connection explicit in the reasoning.
5. HABIT SIGNALS: A 7+ day streak is momentum worth protecting. A broken streak is worth acknowledging. Habits not done yet today should appear in priorities when energy allows.
6. BLOCKER ROUTING: Each blocker maps to an action type. "Unclear priorities" → clarify/plan task. "Low energy" → protect time, reduce friction. "Waiting on others" → async work or habit-focused day. "Too many meetings" → identify one deep work window.
7. MOOD CONTEXT: Read the mood note for signals — anxiety, excitement, distraction, confidence. Let it color the insight_text but don't quote it back verbatim.
8. PATTERN RECOGNITION: If energy has been declining for 3+ days, mention recovery. If habits have been consistently high, name the streak. If a goal deadline is close with low progress, flag it.
9. LONG-TERM MEMORY: If a LONG-TERM MEMORY section appears above the daily data, treat it as essential context. Reference the user's historical patterns directly — mention their best energy day if relevant, call out a recurring blocker by name, or acknowledge a habit's long-term consistency. Use the learned patterns to make the brief feel like it comes from an advisor who has been watching for weeks, not just today. Never invent patterns not in the memory.
10. JOURNAL ENTRIES: If TODAY'S JOURNAL ENTRY or RECENT JOURNAL ENTRIES appear, treat them as the richest personal context available. The journal is the user's unfiltered inner voice. Read it carefully — not just for facts but for emotional tone, underlying concerns, and things they might not have named explicitly. Let journal content meaningfully shape the insight_text and priority reasoning. Never quote journal text directly back to them, but let it be felt in the response.
11. RELATIONSHIPS: If a RELATIONSHIPS section appears, treat it as the user's social world — real people who matter to them, learned from what they write. Use this to make the brief feel human: if a key person appears in today's mood or journal, acknowledge the context around that relationship. If someone who's been a positive presence hasn't come up recently, a gentle nudge to reach out may fit naturally into a priority. If someone is associated with stress or conflict, acknowledge it with care rather than ignoring it. Never fabricate relationship dynamics — only use what's provided. Never suggest talking to specific people unless their name or context is already present today. If a CATCH-UP LIST section appears, the user has explicitly said they want to reconnect with these people — this is a direct signal, stronger than anything inferred from journals. Surface at least one of them naturally: as a priority ("Reach out to [name] — you've been meaning to"), or woven into insight_text when the context feels right. Don't mention all of them at once. Pick the one that fits today's mood and energy best.
12. ABOUT THIS PERSON: If an ABOUT THIS PERSON section appears, treat it as foundational identity context — who this person is, not just what they do. Their occupation shapes what "work priorities" mean. Their relationship status and kids signal time constraints and emotional priorities. Their personality type informs tone — an introvert with too many meetings needs different support than an extrovert craving more collaboration. Their life context is their own words about where they are right now — use it to make the brief feel grounded in their actual life.
13. CLARIFIED CONTEXT: If a CLARIFIED CONTEXT section appears, treat those Q&A pairs as direct, first-person answers the user chose to share. They are high-signal, intentional context. Weave them naturally into your insight and reasoning — they should make the brief feel more specific and personally relevant.
14. CLARIFYING QUESTIONS: After reading all context, if there is a genuine gap that — if filled — would meaningfully change your advice, include up to 2 short clarifying questions in the response. These will be surfaced to the user below their brief as a "Help me understand you better" prompt. Only include questions when the gap is real and the answer would unlock better personalization. Never ask about things already covered in the context. Never force questions — 0 is fine if context is rich. Questions must be conversational and specific — reference something real from today's data, never generic. Max 1 sentence each.
15. MEMORY NOTES: If a MEMORY NOTES section appears, treat it as a direct instruction from the user about what to remember. REMINDERS marked "DUE TODAY" or "TOMORROW" are the highest-priority signal in the entire brief — they must appear in insight_text or as a dedicated priority, named explicitly. REMINDERS due within 3 days must appear as a priority. Reminders with no date should surface when energy or context connects. IDEAS and RESOURCES: name the specific thing when context touches it (e.g. user mentions wanting to travel → name the flight resource they saved). Never silently ignore a memory note — if it appears in the section, the user expects it to be acknowledged today.
16. ENERGY FORECAST: If an ENERGY FORECAST section appears, use it to frame today's priorities around predicted capacity. If today is historically a low-energy day, acknowledge it directly and structure priorities around shorter, contained tasks. If it's historically strong, encourage the user to push on their most ambitious goal. Mention the day-of-week pattern naturally — not as a disclaimer, but as self-knowledge worth acting on. ("Your Wednesdays tend to run lower — this is a good day for focused reviews rather than big creative pushes.")
17. BEHAVIOUR-ENERGY CORRELATIONS: If a BEHAVIOUR-ENERGY CORRELATIONS section appears, treat it as the AI's own discovered evidence — not advice, but observed facts about this specific person. When relevant to today's context (e.g. user skipped a habit that correlates with better energy), surface the insight naturally: "You skipped your run — historically that's one of the clearest signals for lower energy tomorrow." Only reference correlations when they're genuinely relevant to today. Never force them in. These are signals that build trust because they're real.
18. HABIT-GOAL CONNECTIONS: If a HABIT → GOAL CONNECTIONS section appears in the habits block, use it to make the link between daily behaviour and long-term progress explicit. When a linked habit is on track or has a streak, say so in terms of what it's doing for the goal — not just "you did the habit" but "that's what's moving [goal] forward." When a linked habit appears in the NEGLECTED list, name the cost to the goal directly — "skipping [habit] this week is stalling [goal]." This is the most motivating frame available: connecting what they do today to what they're building over months. Use it.
17. RECENT DAYS: If a RECENT DAYS section appears, treat it as the richest continuity signal available — what the user was actually experiencing and saying in recent conversations, in their own words. Use it to make the brief feel like a continuation of an ongoing relationship: reference something from yesterday or the day before when it's still relevant, connect today's mood or energy to a pattern that was building, or acknowledge a commitment they made. This context should make the brief feel like talking to someone who was listening then and is still listening now.
17. FIRST BRIEF: If a ── FIRST BRIEF ── block appears, this is day one — the user has just completed onboarding. Do NOT reference absent history, streaks, trends, or patterns (there are none yet). Instead: warmly introduce yourself as Locus, briefly acknowledge what you already know about them from onboarding (their goals, habits they chose, their profile), and tell them what you'll learn to personalize over time (energy rhythms, blocker patterns, what drives their best days). Make it feel like a meaningful beginning, not a data-empty fallback. The priorities should still be real and grounded in their goals and habits from onboarding. Emit 0 clarifying questions on a first brief — give them space to start.

OUTPUT FORMAT — respond with a single valid JSON object only. No markdown fences, no explanation.

{
  "insight_text": "<A personal morning message, written like a casual text from a coach who genuinely knows this person. Tone: direct, warm, specific — the way a close friend who has been paying attention would write, not a professional advisor.\n\nTWO DISTINCT STATES — pick one based on TODAY'S CHECK-IN:\n\nSTATE A — NO CHECK-IN YET (TODAY'S CHECK-IN shows 'Not completed'):\nThis person just woke up. Write a forward-looking, predictive message. Structure naturally:\n1. Open with first name and the actual day + date as written in the DATE line (e.g. 'Morning Billy, today is Monday, May 4.')\n2. Make an energy prediction based on yesterday's journal, recent check-ins, or day-of-week patterns — phrase it as a guess ('I expect your energy to be around a 7 today')\n3. Reference any memory notes / captures explicitly by name — this is the moment they feel truly seen ('I see you captured a reminder about Jane's event')\n4. If there's relevant relationship context in memory, weave it in naturally ('From your journals you mentioned you like Jane and want to make a good impression')\n5. Mention habits and goals casually — a count or a name, not a full list\n6. End with an invitation to check in, NOT a command ('Let me know how the day goes when you're ready to check in')\nDO NOT say they logged anything, did anything, or completed anything today — they haven't yet.\n\nSTATE B — CHECK-IN LOGGED (TODAY'S CHECK-IN has real energy/mood data):\nThis person has already checked in. Respond to what they shared. Reference their actual energy level, mood note, and blockers. Acknowledge what's going on for them today, connect it to patterns, then frame the rest of the day. End with an encouraging or grounding note.\n\nBOTH STATES: Write in flowing prose only. No bullet lists, no headers. Use **bold** for at most 2 specific things (a name, a goal, a key insight). Use emojis max once, only if naturally warm. Keep it under 120 words — punchy, not exhaustive. It must feel like something a real person wrote, not a generated summary.>",
  "priorities": [
    {
      "title": "<specific, actionable task — max 12 words>",
      "category": "<work | health | personal | learning>",
      "estimated_time": "<e.g. 25 min | 1 hr | 15 min>",
      "time_of_day": "<morning | afternoon | evening | flexible>",
      "reasoning": "<one sentence: why this, why now, connected to a specific goal or habit>"
    }
  ],
  "energy_score": <number 1-10, your read of today's productive capacity>,
  "clarifying_questions": ["<optional question 1>", "<optional question 2>"]
}

Produce exactly 3 priorities. Order: highest-impact first. At least one must advance an active goal. At least one must connect to a habit (done or not yet done today). If any goal step is overdue or due within 3 days, at least one priority must address it directly. The clarifying_questions array may be empty ([]) or omitted entirely if context is sufficient.`

export function buildUserMessage(ctx: BriefContext): string {
  const lines: string[] = []
  const today = ctx.date
  const now   = Date.now()

  // ── SELF PROFILE (foundational identity context, set during onboarding) ──
  const profileBlock = formatSelfProfileForPrompt(ctx.memory)
  if (profileBlock) {
    lines.push(profileBlock)
    lines.push('')
  }

  // ── LONG-TERM MEMORY (prepended when available) ──
  const memoryBlock = formatMemoryForPrompt(ctx.memory)
  if (memoryBlock) {
    lines.push(memoryBlock)
    lines.push('')
  }

  // ── ENERGY PREDICTION — today's and tomorrow's day-of-week averages ──
  const byDay = ctx.memory?.energy?.by_day
  if (byDay && Object.keys(byDay).length >= 3) {
    const DAY   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const todayDt  = new Date(ctx.date + 'T12:00:00')
    const todayDay = DAY[todayDt.getDay()]
    const tmrwDay  = DAY[(todayDt.getDay() + 1) % 7]
    const todayAvg = byDay[todayDay]
    const tmrwAvg  = byDay[tmrwDay]
    const overall  = ctx.memory?.energy?.overall_avg ?? 0
    const parts: string[] = []
    if (todayAvg != null) {
      const delta = roundTo1(todayAvg - overall)
      const note  = delta <= -0.8 ? ' (historically one of your harder days — protect focus)' :
                    delta >= 0.8  ? ' (historically one of your stronger days — push on big tasks)' : ''
      parts.push(`${todayDay}s avg ${todayAvg}/10${note}`)
    }
    if (tmrwAvg != null) {
      parts.push(`Tomorrow (${tmrwDay}) avg ${tmrwAvg}/10`)
    }
    if (parts.length > 0) {
      lines.push(`ENERGY FORECAST`)
      parts.forEach(p => lines.push(`  ${p}`))
      lines.push('')
    }
  }

  // ── BEHAVIOUR-ENERGY CORRELATIONS ──
  const correlationsBlock = formatCorrelationsForPrompt(ctx.memory)
  if (correlationsBlock) {
    lines.push(correlationsBlock)
    lines.push('')
  }

  // ── RECENT DAYS — narrative summaries of each day's check-in conversation ──
  const summariesBlock = formatDailySummariesForPrompt(ctx.memory)
  if (summariesBlock) {
    lines.push(summariesBlock)
    lines.push('')
  }

  // ── RELATIONSHIPS (people learned from journals) ──
  const peopleBlock = formatPeopleForPrompt(ctx.memory)
  if (peopleBlock) {
    lines.push(peopleBlock)
    lines.push('')
  }

  // ── CATCH-UP LIST (people the user explicitly wants to reconnect with) ──
  const catchupBlock = formatCatchupForPrompt(ctx.catchupPeople)
  if (catchupBlock) {
    lines.push(catchupBlock)
    lines.push('')
  }

  // ── CLARIFIED CONTEXT (user's own answers to past clarifying questions) ──
  const clarifiedBlock = formatClarifyingQAForPrompt(ctx.memory)
  if (clarifiedBlock) {
    lines.push(clarifiedBlock)
    lines.push('')
  }

  if (profileBlock || memoryBlock || peopleBlock || catchupBlock || clarifiedBlock) {
    lines.push('─'.repeat(40))
    lines.push('')
  }

  // ── FIRST BRIEF SIGNAL ──
  if (ctx.isFirstBrief) {
    lines.push('╔══════════════════════════════════════╗')
    lines.push('║           FIRST BRIEF — DAY ONE      ║')
    lines.push('╚══════════════════════════════════════╝')
    lines.push('This is the very first brief for this user. They JUST completed onboarding — today is day one.')
    lines.push('STRICT RULES for this brief:')
    lines.push('  • Open with a warm, personal welcome — introduce yourself as Locus')
    lines.push('  • DO NOT judge, critique, or mention any missed habits or low completion rates')
    lines.push('  • DO NOT reference streaks, trends, or history (there is none)')
    lines.push('  • Acknowledge what they shared during onboarding (their goals and habits below)')
    lines.push('  • Frame today as an exciting beginning, not a baseline to be measured against')
    lines.push('  • Emit 0 clarifying questions — give them space to start')
    lines.push('')
    if (ctx.goalsWithSteps.length > 0) {
      lines.push(`Goals they set: ${ctx.goalsWithSteps.map(g => `"${g.title}"`).join(', ')}`)
    }
    if (ctx.habits.length > 0) {
      lines.push(`Habits they chose to build: ${ctx.habits.map(h => `${h.emoji} ${h.name}`).join(', ')}`)
    }
    lines.push('╔══════════════════════════════════════╗')
    lines.push('║        END FIRST BRIEF SIGNAL        ║')
    lines.push('╚══════════════════════════════════════╝')
    lines.push('')
  }

  const dateObj = new Date(today + 'T12:00:00')
  const humanDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  lines.push(`DATE: ${humanDate} (${today})`)
  lines.push('─'.repeat(40))

  // ── TODAY'S CHECK-IN ──
  if (ctx.todayCheckin) {
    const e = ctx.todayCheckin.energy_level
    const energyLabel = e >= 9 ? 'Exceptional' : e >= 7 ? 'High' : e >= 5 ? 'Moderate' : e >= 3 ? 'Low' : 'Depleted'
    lines.push(`TODAY'S CHECK-IN`)
    lines.push(`Energy: ${e}/10 (${energyLabel})`)
    if (ctx.todayCheckin.mood_note) {
      lines.push(`Mood: "${ctx.todayCheckin.mood_note}"`)
    }
    if (ctx.todayCheckin.highlight) {
      lines.push(`Today's highlight: "${ctx.todayCheckin.highlight}"`)
    }
    const realBlockers = ctx.todayCheckin.blockers.filter(b => b !== 'No blockers today')
    if (realBlockers.length > 0) {
      lines.push(`Blockers: ${realBlockers.join(' · ')}`)
    } else {
      lines.push(`Blockers: None`)
    }
  } else {
    lines.push(`TODAY'S CHECK-IN: Not completed`)
    if (ctx.avgEnergy !== null) {
      lines.push(`Recent avg energy: ${ctx.avgEnergy}/10`)
    }
  }
  lines.push('')

  // ── TODAY'S PLAN ──
  if (ctx.todayPlan && ctx.todayPlan.length > 0) {
    const bySlot: Record<string, string[]> = { morning: [], afternoon: [], evening: [] }
    ctx.todayPlan.forEach(b => { bySlot[b.time_slot].push(b.title) })
    lines.push("TODAY'S PLANNED BLOCKS")
    for (const [slot, titles] of Object.entries(bySlot)) {
      if (titles.length > 0) lines.push(`  ${slot}: ${titles.join(', ')}`)
    }
    lines.push('')
  }

  // ── ENERGY TREND ──
  if (!ctx.isFirstBrief && ctx.recentCheckins.length >= 3) {
    const recent = ctx.recentCheckins.slice(0, 7)
    const vals = recent.map(c => c.energy_level)
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
    const trend = vals[0] > vals[vals.length - 1] ? '↓ declining' : vals[0] < vals[vals.length - 1] ? '↑ rising' : '→ stable'
    lines.push(`ENERGY TREND (${recent.length} days): avg ${avg}/10, ${trend}`)
    lines.push(`Daily readings: ${recent.map(c => `${c.date.slice(5)}: ${c.energy_level}`).join(' | ')}`)
    lines.push('')
  }

  // ── ACTIVE GOALS + STEPS ──
  if (ctx.goalsWithSteps.length > 0) {
    lines.push(`ACTIVE GOALS (${ctx.goalsWithSteps.length})`)

    ctx.goalsWithSteps.forEach(g => {
      const urgency = getGoalUrgency(g.target_date, g.progress_pct)
      lines.push(`• [${g.category.toUpperCase()}] "${g.title}"`)
      lines.push(`  Progress: ${g.progress_pct}% ${getProgressBar(g.progress_pct)} ${urgency}`)
      if (g.target_date) {
        const daysLeft = Math.ceil((new Date(g.target_date).getTime() - now) / 86400000)
        lines.push(`  Deadline: ${g.target_date} (${daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'DUE TODAY' : `${Math.abs(daysLeft)} days overdue`})`)
      }
      lines.push(`  Timeframe: ${g.timeframe}`)

      // Pending steps with due dates
      const pendingSteps = g.steps.filter(s => !s.completed)
      if (pendingSteps.length > 0) {
        const overdueSteps  = pendingSteps.filter(s => s.due_date && new Date(s.due_date).getTime() < now)
        const upcomingSteps = pendingSteps.filter(s => s.due_date && new Date(s.due_date).getTime() >= now)
          .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
          .slice(0, 3)

        if (overdueSteps.length > 0) {
          lines.push(`  ⚠️ OVERDUE STEPS:`)
          overdueSteps.forEach(s => {
            const daysOver = Math.ceil((now - new Date(s.due_date!).getTime()) / 86400000)
            lines.push(`    - "${s.title}" — ${daysOver}d overdue`)
          })
        }
        if (upcomingSteps.length > 0) {
          lines.push(`  📅 UPCOMING STEPS:`)
          upcomingSteps.forEach(s => {
            const daysUntil = Math.ceil((new Date(s.due_date!).getTime() - now) / 86400000)
            const tag = daysUntil === 0 ? 'DUE TODAY' : daysUntil <= 3 ? `due in ${daysUntil}d ⚡` : `due in ${daysUntil}d`
            lines.push(`    - "${s.title}" — ${tag}`)
          })
        }
        // Steps without due dates — just show the next one
        const noDueDateNext = pendingSteps.filter(s => !s.due_date)[0]
        if (noDueDateNext && overdueSteps.length === 0 && upcomingSteps.length === 0) {
          lines.push(`  Next step: "${noDueDateNext.title}"`)
        }
      }
    })
  } else {
    lines.push(`ACTIVE GOALS: None set yet`)
  }
  lines.push('')

  // ── HABITS ──
  if (ctx.habits.length > 0) {
    const todayLogged  = ctx.habits.filter(h => h.logs.some(l => l.logged_date === today))
    const todayPending = ctx.habits.filter(h => !h.logs.some(l => l.logged_date === today))

    // Build a goal progress lookup from goalsWithSteps for inline references
    const goalProgressMap = new Map(ctx.goalsWithSteps.map(g => [g.id, g.progress_pct]))

    lines.push(`HABITS — Today: ${todayLogged.length}/${ctx.habits.length} done · Week rate: ${ctx.weekHabitRate}%`)
    lines.push('')

    if (todayLogged.length > 0) {
      lines.push(`  ✓ Done today: ${todayLogged.map(h => `${h.emoji} ${h.name}`).join(', ')}`)
    }
    if (todayPending.length > 0) {
      lines.push(`  ○ Still pending: ${todayPending.map(h => `${h.emoji} ${h.name}`).join(', ')}`)
    }
    lines.push('')

    lines.push(`  Streaks & momentum:`)
    ctx.habits.forEach(h => {
      const streakTag  = h.streak >= 14 ? '🔥 strong streak' : h.streak >= 7 ? '⚡ building' : h.streak >= 3 ? '↑ going' : h.streak === 0 ? '○ not started' : `${h.streak}d`
      const weekStatus = h.weekCompletions >= h.target_count ? '✓ on track' : `${h.weekCompletions}/${h.target_count} this week`
      const goalSuffix = h.linkedGoal
        ? ` → drives "${h.linkedGoal.title}" (${goalProgressMap.get(h.linkedGoal.id) ?? '?'}%)`
        : ''
      lines.push(`  ${h.emoji} ${h.name} [${h.frequency}]: streak ${h.streak} days (${streakTag}) · ${weekStatus}${goalSuffix}`)
    })

    // ── HABIT → GOAL CONNECTIONS (grouped summary) ──
    const linkedHabits = ctx.habits.filter(h => h.linkedGoal)
    if (linkedHabits.length > 0) {
      // Group by goal
      const byGoal = new Map<string, { title: string; progress: number; habits: typeof linkedHabits }>()
      linkedHabits.forEach(h => {
        const g = h.linkedGoal!
        if (!byGoal.has(g.id)) {
          byGoal.set(g.id, { title: g.title, progress: goalProgressMap.get(g.id) ?? 0, habits: [] })
        }
        byGoal.get(g.id)!.habits.push(h)
      })
      lines.push('')
      lines.push('  HABIT → GOAL CONNECTIONS:')
      byGoal.forEach(({ title, progress, habits: gh }) => {
        // Week completion rate across all habits linked to this goal
        const totalDone    = gh.reduce((s, h) => s + h.weekCompletions, 0)
        const totalTarget  = gh.reduce((s, h) => s + h.target_count, 0)
        const weekRate     = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0
        const habitNames   = gh.map(h => `${h.emoji} ${h.name}`).join(', ')
        lines.push(`  ${habitNames} → "${title}" [goal at ${progress}%] · habits ${weekRate}% this week`)
      })
    }

    // ── NEGLECTED HABITS ── (suppress on first brief — user just started)
    if (ctx.neglectedHabits.length > 0 && !ctx.isFirstBrief) {
      lines.push('')
      lines.push(`  ⚠️ NEGLECTED THIS WEEK (0 completions — needs a nudge):`)
      ctx.neglectedHabits.forEach(h => {
        const goalNote = h.linkedGoal ? ` — this is stalling "${h.linkedGoal.title}"` : ''
        lines.push(`    ${h.emoji} ${h.name} [${h.frequency}] — not logged once this week${goalNote}`)
      })
    }
  } else {
    lines.push(`HABITS: None set yet`)
  }
  lines.push('')

  // ── RECENT MOOD PATTERNS ──
  const notesWithMood = ctx.recentCheckins.filter(c => c.mood_note && c.mood_note.trim().length > 0).slice(0, 3)
  if (notesWithMood.length > 0) {
    lines.push(`RECENT MOOD NOTES`)
    notesWithMood.forEach(c => {
      lines.push(`  ${c.date}: "${c.mood_note}"`)
    })
    lines.push('')
  }

  // ── TODAY'S JOURNAL ──
  if (ctx.todayJournal && ctx.todayJournal.content.trim()) {
    lines.push(`TODAY'S JOURNAL ENTRY`)
    lines.push(ctx.todayJournal.content.trim())
    lines.push('')
  }

  // ── RECENT JOURNAL ENTRIES (last 7 days, excluding today if already shown) ──
  const pastJournals = ctx.recentJournals.filter(j =>
    j.date !== ctx.date && j.content.trim().length > 0
  ).slice(0, 3)
  if (pastJournals.length > 0) {
    lines.push(`RECENT JOURNAL ENTRIES`)
    pastJournals.forEach(j => {
      const preview = j.content.trim()
      lines.push(`  ${j.date}: "${preview.length > 200 ? preview.slice(0, 200) + '…' : preview}"`)
    })
    lines.push('')
  }

  // ── MEMORY NOTES (user-captured reminders, ideas, resources) ──
  if (ctx.memoryNotes && ctx.memoryNotes.length > 0) {
    const now = ctx.date
    lines.push(`MEMORY NOTES — the user explicitly captured these to be remembered`)
    ctx.memoryNotes.forEach(note => {
      const typeLabel = note.type === 'reminder' ? '⏰ REMINDER' : note.type === 'resource' ? '🔗 RESOURCE' : '💡 IDEA'
      const datePart = note.trigger_date ? ` [due ${note.trigger_date}]` : ''
      const daysUntil = note.trigger_date
        ? Math.ceil((new Date(note.trigger_date + 'T12:00:00').getTime() - new Date(now + 'T12:00:00').getTime()) / 86400000)
        : null
      const urgencyPart = daysUntil !== null
        ? daysUntil <= 0 ? ' ← DUE TODAY'
        : daysUntil === 1 ? ' ← TOMORROW'
        : daysUntil <= 3 ? ` ← in ${daysUntil} days`
        : ''
        : ''
      lines.push(`  ${typeLabel}${datePart}${urgencyPart}: "${note.content}"`)
    })
    lines.push(``)
    lines.push(`  HOW TO USE THESE:`)
    lines.push(`  - REMINDERS due today or tomorrow: mention explicitly by name in insight_text or as a priority. Do not skip them.`)
    lines.push(`  - REMINDERS due within 3 days: include as a priority with urgency in the reasoning.`)
    lines.push(`  - REMINDERS with no date: surface if they connect to today's goals or energy.`)
    lines.push(`  - IDEAS: mention if they connect to today's habits, goals, or mood — make the connection explicit.`)
    lines.push(`  - RESOURCES: surface by name when the user's context touches that topic (e.g. they mention travel → mention the flight site they saved).`)
    lines.push('')
  }

  return lines.join('\n')
}

function getGoalUrgency(targetDate: string | null, progress: number): string {
  if (!targetDate) return ''
  const daysLeft = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)
  if (daysLeft <= 0) return '⚠️ OVERDUE'
  if (daysLeft <= 7 && progress < 80) return '🔴 URGENT'
  if (daysLeft <= 14 && progress < 50) return '🟡 AT RISK'
  if (progress >= 80) return '🟢 NEAR FINISH'
  return ''
}

function getProgressBar(pct: number): string {
  const filled = Math.round(pct / 10)
  return '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']'
}
