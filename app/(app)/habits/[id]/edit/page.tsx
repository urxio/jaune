import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserLocalDate } from '@/lib/db/users'
import { getActiveGoals } from '@/lib/db/goals'
import HabitFormPage from '@/components/habits/HabitFormPage'

export const dynamic = 'force-dynamic'

export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: habit }, today, activeGoals] = await Promise.all([
    supabase.from('habits').select('*').eq('id', id).eq('user_id', user.id).single(),
    getUserLocalDate(user.id),
    getActiveGoals(user.id),
  ])

  if (!habit) notFound()

  return <HabitFormPage today={today} activeGoals={activeGoals} habit={habit} />
}
