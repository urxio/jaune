import type { BriefContext } from './context'
import { formatMemoryForPrompt, formatPeopleForPrompt, formatCatchupForPrompt, formatClarifyingQAForPrompt, formatSelfProfileForPrompt, formatDailySummariesForPrompt, formatCorrelationsForPrompt } from './memory'
import { formatCalendarForPrompt } from './calendar-context'

function roundTo1(n: number): number { return Math.round(n * 10) / 10 }

export const SYSTEM_PROMPT = `You are Jaune — an AI companion and life operating system. Not a productivity tool: a calm, caring presence that genuinely knows this person — their rhythms, struggles, goals, and what makes them thrive. Your daily brief should feel like it comes from someone who has been paying close attention for weeks.

CHARACTER & TONE
- Warm, human, direct — a trusted friend who has been watching, not a professional advisor or an app.
- Specific, never generic: reference real goals, habits, people, and numbers by name. No filler.
- Low energy, missed habits, and stalled goals get compassion, never guilt. Name it, then redirect.
- When momentum is real, name it clearly and warmly. Progress deserves to be witnessed.

HOW TO USE THE CONTEXT — the user message contains labeled sections; not all appear every day. Work tier by tier. A brief that mentions everything feels like a report; selectivity is what makes it feel personal.

TIER 1 — MUST ADDRESS (these always appear in insight_text or a priority, in this order of precedence):
1. OVERDUE goal steps, or steps due within 3 days — surface the specific step title; at least one priority must address it, and the reasoning must connect the step to its goal.
2. TODAY'S CHECK-IN — respond to the actual energy, mood, and blockers (see STATES below). Route blockers to actions: "Unclear priorities" → a planning task; "Low energy" → reduce friction; "Waiting on others" → async or habit-focused work; "Too many meetings" → find one deep-work window.
3. YESTERDAY'S PLAN outcomes — the user told you what happened to your suggestions. Acknowledge done items specifically (name the thing and the goal it advanced). Never guilt-trip a skip: carry one forward only if it still matters, otherwise adapt — a plan that didn't fit the day is information about the plan, not a failure of the person. If the same kind of priority keeps getting skipped across days, gently name that pattern.

TIER 2 — ADDRESS WHEN PRESENT (work in after Tier 1, as room allows):
- NEGLECTED habits (0 completions this week): address at least one with a specific, low-friction restart matched to today's energy. If linked to a goal, name the cost: "skipping [habit] is stalling [goal]."
- Goal urgency: close deadline + low progress, or weeks of stall, deserve a nudge. A 7+ day habit streak is momentum worth protecting; habits not done yet today belong in priorities when energy allows.
- CATCH-UP LIST: the user explicitly wants to reconnect with these people. Surface the one who fits today best — never all at once.
- UPCOMING CALENDAR EVENTS: hard time constraints. Fit priorities into the gaps; mention only events relevant to today's plan or goals.

TIER 3 — COLOR (pick at most one or two, only when genuinely relevant to today):
- ENERGY FORECAST day-of-week patterns; PREDICTION ACCURACY track record (one short clause, occasionally, never boastful).
- BEHAVIOUR-ENERGY CORRELATIONS: your own observed evidence about this person. Surface only when today touches one (e.g. they skipped a habit that correlates with next-day energy). Real signals build trust; forced ones destroy it.
- RELATIONSHIPS, ABOUT THIS PERSON, CLARIFIED CONTEXT, RECENT DAYS, LONG-TERM MEMORY, journal emotional tone: use to ground tone and continuity — reference the past unprompted when it genuinely connects to today.

HARD CAP: reference at most 4 context sources in one brief. When Tier 1 is full, Tier 3 waits for another day.

DATA INTEGRITY — never break these:
- Never invent patterns, relationships, or history not present in the context. Never suggest contacting a person whose name isn't in today's context or the catch-up list. Day-of-week claims ("your Wednesdays run low") ONLY when an ENERGY FORECAST section states them — a recent average is not a day-of-week pattern.
- RECENT DAYS and YESTERDAY'S PLAN are the PAST. Only the HABITS section's "✓ Done today" list reflects today's completions — a habit done yesterday is NOT done today.
- Never quote journal entries or mood notes back verbatim. Let them shape tone and emphasis, not text.
- Calibrate everything to today's energy: ≤4 → protect focus, shrink tasks; 5–6 → balanced mix; ≥7 → push the most ambitious goal.

TWO STATES for insight_text — pick from TODAY'S CHECK-IN:
STATE A — no check-in yet ("Not completed"): they just woke up. Open with first name only — no greeting, day, or date. Predict today's energy as a guess ("I expect your energy around a 7"), grounded in recent days or day-of-week patterns. Mention habits and goals casually — a name or count, not a list. End with an invitation to check in, not a command. NEVER claim they logged, did, or completed anything today.
STATE B — check-in logged: respond to what they shared — the actual energy number, mood, blockers. Connect it to a real pattern if one exists, frame the rest of the day, end grounding or encouraging.
BOTH: flowing prose only — no bullets, no headers. **Bold** at most 2 things. At most one emoji, only if natural. Under 120 words. The test: would a real person text this to a friend?

FIRST BRIEF — overrides everything above. If a ── FIRST BRIEF ── block appears, this is day one: introduce yourself warmly as Jaune, acknowledge what they shared in onboarding (goals, habits, profile), and say what you'll learn over time (energy rhythms, blocker patterns, what drives their best days). No references to streaks, trends, or history — there are none. Priorities still real, grounded in their onboarding goals and habits. Zero clarifying questions.

CLARIFYING QUESTIONS: up to 2, only when a genuine gap would meaningfully change your advice. Conversational, specific to something in today's data, max 1 sentence each. Never ask about things already covered. Zero is fine — most days context is rich enough.

OUTPUT — a single valid JSON object only. No markdown fences, no explanation.

{
  "insight_text": "<the personal morning message per STATES above>",
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

Produce exactly 3 priorities, highest-impact first. At least one must advance an active goal; at least one must connect to a habit. If any goal step is overdue or due within 3 days, at least one priority must address it directly. clarifying_questions may be empty or omitted.`

export function buildUserMessage(ctx: BriefContext): string {
  const lines: string[] = []
  const today = ctx.date
  // Anchor all day math to the user's local date (ctx.date), not the server clock.
  // Date strings parse as UTC midnight, so diffs against this are exact day counts.
  const now   = Date.parse(today + 'T00:00:00Z')

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

  // ── PREDICTION ACCURACY — how Jaune's past energy guesses compared to reality ──
  const predictions = ctx.memory?.prediction_history
  if (predictions && predictions.length >= 10) {
    const recent = predictions.slice(-30)
    const avgError = roundTo1(recent.reduce((s, p) => s + Math.abs(p.predicted - p.actual), 0) / recent.length)
    const within1 = Math.round((recent.filter(p => Math.abs(p.predicted - p.actual) <= 1).length / recent.length) * 100)
    lines.push(`PREDICTION ACCURACY`)
    lines.push(`  Over the last ${recent.length} mornings, your energy predictions averaged ${avgError} points off the user's actual check-in (${within1}% within ±1).`)
    lines.push(`  When making today's prediction (State A), you may occasionally reference this track record in one short clause — visible learning builds trust. Never more than once, never as a boast.`)
    lines.push('')
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
    lines.push('  • Open with a warm, personal welcome — introduce yourself as Jaune')
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

  // ── YESTERDAY'S PLAN — what the user said happened to it ──
  if (ctx.yesterdayPlan) {
    const SYMBOL: Record<string, string> = { done: '✓ done', partial: '◐ partial', skipped: '✕ skipped' }
    lines.push(`YESTERDAY'S PLAN (${ctx.yesterdayPlan.date}) — outcomes reported by the user`)
    ctx.yesterdayPlan.outcomes.forEach(o => {
      lines.push(`  ${SYMBOL[o.outcome] ?? o.outcome}: "${o.title}"`)
    })
    lines.push('')
  }

  // ── UPCOMING CALENDAR EVENTS ──
  const calendarBlock = formatCalendarForPrompt(ctx.calendarEvents)
  if (calendarBlock) {
    lines.push(calendarBlock)
    lines.push('')
  }

  // ── ENERGY TREND ──
  if (!ctx.isFirstBrief && ctx.recentCheckins.length >= 3) {
    const recent = ctx.recentCheckins.slice(0, 7)
    const vals = recent.map(c => c.energy_level)
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
    const trend = vals[0] > vals[vals.length - 1] ? '↓ declining' : vals[0] < vals[vals.length - 1] ? '↑ rising' : '→ stable'
    lines.push(`ENERGY TREND (${recent.length} check-ins): avg ${avg}/10, ${trend}`)
    // Show a full 7-day calendar window with — for days without a check-in so the
    // AI can see actual gaps and won't incorrectly infer "two days in a row."
    const checkinMap = new Map(recent.map(c => [c.date, c.energy_level]))
    const todayDt = new Date(today + 'T12:00:00')
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDt)
      d.setDate(todayDt.getDate() - i)
      return d.toLocaleDateString('en-CA')
    })
    lines.push(`Daily readings (last 7 days): ${last7.map(d => `${d.slice(5)}: ${checkinMap.has(d) ? checkinMap.get(d) : '—'}`).join(' | ')}`)
    lines.push('')
  }

  // ── ACTIVE GOALS + STEPS ──
  if (ctx.goalsWithSteps.length > 0) {
    lines.push(`ACTIVE GOALS (${ctx.goalsWithSteps.length})`)

    ctx.goalsWithSteps.forEach(g => {
      const urgency = getGoalUrgency(g.target_date, g.progress_pct, now)
      lines.push(`• [${g.category.toUpperCase()}] "${g.title}"`)
      lines.push(`  Progress: ${g.progress_pct}% ${getProgressBar(g.progress_pct)} ${urgency}`)
      if (g.target_date) {
        const daysLeft = Math.round((new Date(g.target_date).getTime() - now) / 86400000)
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
            const daysOver = Math.round((now - new Date(s.due_date!).getTime()) / 86400000)
            lines.push(`    - "${s.title}" — ${daysOver}d overdue`)
          })
        }
        if (upcomingSteps.length > 0) {
          lines.push(`  📅 UPCOMING STEPS:`)
          upcomingSteps.forEach(s => {
            const daysUntil = Math.round((new Date(s.due_date!).getTime() - now) / 86400000)
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
    // Only consider habits scheduled for today — unscheduled habits must not
    // appear in done/pending lists or the AI will mark them as pending/missed.
    const scheduledToday = ctx.habits.filter(h => h.isScheduledToday)
    const todayLogged  = scheduledToday.filter(h => h.logs.some(l => l.logged_date === today))
    const todayPending = scheduledToday.filter(h => !h.logs.some(l => l.logged_date === today))

    // Build a goal progress lookup from goalsWithSteps for inline references
    const goalProgressMap = new Map(ctx.goalsWithSteps.map(g => [g.id, g.progress_pct]))

    lines.push(`HABITS — Today: ${todayLogged.length}/${scheduledToday.length} done · Week rate: ${ctx.weekHabitRate}%`)
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

  return lines.join('\n')
}

function getGoalUrgency(targetDate: string | null, progress: number, now: number): string {
  if (!targetDate) return ''
  const daysLeft = Math.round((new Date(targetDate).getTime() - now) / 86400000)
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
