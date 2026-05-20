import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const maxDuration = 15

export type SuggestionMode = 'habits' | 'steps'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { goalId } = await request.json().catch(() => ({}))
  if (!goalId) return NextResponse.json({ error: 'goalId required' }, { status: 400 })

  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('title, category, tracking_mode')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()

  if (goalError || !goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  // Habit-tracked goals always get habit suggestions — steps panel is hidden for them
  if (goal.tracking_mode === 'habits') {
    return NextResponse.json({ modes: ['habits'] satisfies SuggestionMode[] })
  }

  const client = getAnthropicClient()

  const systemPrompt = `You are a productivity coach. Given a goal, decide what would help the user most right now: breaking it into actionable steps, building supporting habits, or both.

- "steps": milestone-oriented goals with clear sub-tasks (e.g. launch a product, write a book, learn a skill, pass an exam, plan a trip)
- "habits": behavior-change goals that are sustained over time (e.g. eat better, exercise more, sleep well, meditate, reduce screen time)
- ["steps","habits"]: goals that benefit from both structure and routine

Respond ONLY with valid JSON, no markdown: {"modes":["steps"]}, {"modes":["habits"]}, or {"modes":["steps","habits"]}`

  const userMessage = `Goal: "${goal.title}" (category: ${goal.category})`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = response.content.find(b => b.type === 'text')?.text ?? ''
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const parsed = JSON.parse(match[0]) as { modes: SuggestionMode[] }
    const modes = (parsed.modes ?? []).filter((m): m is SuggestionMode =>
      m === 'habits' || m === 'steps'
    )

    return NextResponse.json({ modes: modes.length > 0 ? modes : ['habits'] })
  } catch (err) {
    console.error('suggest-mode failed:', err)
    return NextResponse.json({ modes: ['habits'] satisfies SuggestionMode[] })
  }
}
