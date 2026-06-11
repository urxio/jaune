// Smoke test for the brief system prompt — runs the real SYSTEM_PROMPT against a
// synthetic context and asserts the Tier-1 guarantees hold.
// Usage: node scripts/smoke-test-prompt.mjs
import { readFileSync } from 'node:fs'

// Extract SYSTEM_PROMPT template literal from prompts.ts (no interpolation inside)
const src = readFileSync(new URL('../lib/ai/prompts.ts', import.meta.url), 'utf8')
const match = src.match(/export const SYSTEM_PROMPT = `([\s\S]*?)`\n\nexport function/)
if (!match) { console.error('Could not extract SYSTEM_PROMPT'); process.exit(1) }
const SYSTEM_PROMPT = match[1]

// API key from .env.local
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const key = env.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim()
if (!key) { console.error('No ANTHROPIC_API_KEY in .env.local'); process.exit(1) }

// Synthetic State A context: an overdue goal step + yesterday's outcomes + habits.
// Tier-1 guarantee under test: the overdue step MUST appear as a priority, and
// the insight must not claim anything was completed today.
const userMessage = `DATE: Wednesday, June 10 (2026-06-10)
────────────────────────────────────────
TODAY'S CHECK-IN: Not completed
Recent avg energy: 6.2/10

YESTERDAY'S PLAN (2026-06-09) — outcomes reported by the user
  ✓ done: "Draft the investor update email"
  ✕ skipped: "30-minute run before lunch"
  ◐ partial: "Review onboarding flow designs"

ACTIVE GOALS (2)
• [PRODUCT] "Launch the beta"
  Progress: 60% [██████░░░░]
  Deadline: 2026-06-24 (14 days left)
  Timeframe: quarter
  ⚠️ OVERDUE STEPS:
    - "Send invite emails to first 10 testers" — 2d overdue
• [HEALTH] "Run a 10k in September"
  Progress: 30% [███░░░░░░░]
  Timeframe: year

HABITS — Today: 0/3 done · Week rate: 48%

  ○ Still pending: 🏃 Morning run, ✍️ Journaling, 📚 Read 20 min

  Streaks & momentum:
  🏃 Morning run [Daily]: streak 0 days (○ not started) · 1/5 this week → drives "Run a 10k in September" (30%)
  ✍️ Journaling [Daily]: streak 4 days (↑ going) · 4/7 this week
  📚 Read 20 min [Daily]: streak 2 days (2d) · 3/7 this week

RECENT MOOD NOTES
  2026-06-09: "Good momentum on the launch but I keep postponing exercise"
`

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  }),
})
if (!res.ok) { console.error('API error', res.status, await res.text()); process.exit(1) }
const data = await res.json()
const text = data.content.find(b => b.type === 'text')?.text ?? ''

let brief
try {
  brief = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''))
} catch {
  console.error('FAIL: response is not valid JSON:\n', text.slice(0, 400))
  process.exit(1)
}

const checks = []
const allText = JSON.stringify(brief).toLowerCase()
checks.push(['valid JSON with 3 priorities', Array.isArray(brief.priorities) && brief.priorities.length === 3])
checks.push(['overdue step surfaces (invite/tester mentioned)', /invite|tester/.test(allText)])
checks.push(['insight_text under ~130 words', brief.insight_text.split(/\s+/).length <= 130])
checks.push(['State A: does not claim completion today', !/you (did|completed|logged|finished)[^.]*today/i.test(brief.insight_text)])
checks.push(['energy_score in range', brief.energy_score >= 1 && brief.energy_score <= 10])
checks.push(['no bullet lists in insight', !/\n\s*[-•]/.test(brief.insight_text)])

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}
console.log('\n── insight_text ──\n' + brief.insight_text)
console.log('\n── priorities ──')
brief.priorities.forEach((p, i) => console.log(`${i + 1}. ${p.title} (${p.category}, ${p.estimated_time}) — ${p.reasoning}`))
if (brief.clarifying_questions?.length) console.log('\nclarifying:', brief.clarifying_questions)
process.exit(failed ? 1 : 0)
