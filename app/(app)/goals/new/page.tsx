import { createClient } from '@/lib/supabase/server'
import { getUserHabits } from '@/lib/db/habits'
import GoalFormPage from '@/components/goals/GoalFormPage'

export const dynamic = 'force-dynamic'

export default async function NewGoalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const habits = await getUserHabits(user.id)

  return <GoalFormPage habits={habits} />
}
