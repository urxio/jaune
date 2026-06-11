import { NextResponse, type NextRequest } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const maxDuration = 30

export type HabitSuggestion = {
  name: string
  emoji: string
  rationale: string
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await createClientFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { goalId, existingHabitNames = [] } = await request.json().catch(() => ({}))
  if (!goalId) return NextResponse.json({ error: 'goalId required' }, { status: 400 })

  // Fetch goal server-side (IDOR-safe: enforce user_id match)
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('title, category')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()

  if (goalError || !goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const client = getAnthropicClient()

  const systemPrompt = `You are a habit coach. Given a goal, suggest 2-3 specific, actionable daily or weekly habits that directly support it. Each habit should be concrete (not vague like "exercise more"). Respond ONLY with a valid JSON object — no markdown, no explanation:\n{"suggestions":[{"name":"...","emoji":"...","rationale":"..."}]}`

  const existingList = existingHabitNames.length > 0
    ? `\nExisting habits to avoid duplicating: ${existingHabitNames.join(', ')}`
    : ''

  const userMessage = `Goal: "${goal.title}" (category: ${goal.category})${existingList}\n\nSuggest 2-3 habits that would directly support this goal. Each habit name should be short (2-5 words). Emoji should be a single relevant emoji. Rationale should be one concise sentence.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = response.content.find(b => b.type === 'text')?.text ?? ''
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const parsed = JSON.parse(match[0]) as { suggestions: HabitSuggestion[] }
    const suggestions = (parsed.suggestions ?? [])
      .filter(s => typeof s.name === 'string' && s.name.trim() && typeof s.emoji === 'string')
      .slice(0, 3)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('habit suggest failed:', err)
    return NextResponse.json({ suggestions: [] })
  }
}
