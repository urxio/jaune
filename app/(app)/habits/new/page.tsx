import { createClient } from '@/lib/supabase/server'
import { getUserLocalDate } from '@/lib/db/users'
import { getActiveGoals } from '@/lib/db/goals'
import HabitFormPage from '@/components/habits/HabitFormPage'

export const dynamic = 'force-dynamic'

export default async function NewHabitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [today, activeGoals] = await Promise.all([
    getUserLocalDate(user.id),
    getActiveGoals(user.id),
  ])

  return <HabitFormPage today={today} activeGoals={activeGoals} />
}
