import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserHabits } from '@/lib/db/habits'
import GoalFormPage from '@/components/goals/GoalFormPage'

export const dynamic = 'force-dynamic'

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: goal }, habits] = await Promise.all([
    supabase.from('goals').select('*').eq('id', id).eq('user_id', user.id).single(),
    getUserHabits(user.id),
  ])

  if (!goal) notFound()

  return <GoalFormPage habits={habits} goal={goal} />
}
