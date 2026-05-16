import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import TimezoneSync from '@/components/layout/TimezoneSync'
import ToastShell from '@/components/ui/ToastShell'
import { dateInTz } from '@/lib/utils/date'

const DEFAULT_BG = '/wallpapers/locus-5.jpg'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile first so we can use the user's timezone for all date comparisons
  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_url, onboarded_at, cover_url, timezone')
    .eq('id', user.id)
    .single()

  if (profile && !profile.onboarded_at) redirect('/onboarding')

  const tz = (profile as { timezone?: string | null } | null)?.timezone ?? 'UTC'
  const today = dateInTz(tz)
  const todayDow = new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) + 'T00:00:00'
  ).getDay()

  const [
    { count: overdueStepCount },
    { data: checkinRow },
    { data: habits },
    { data: habitLogsToday },
  ] = await Promise.all([
    supabase
      .from('goal_steps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false)
      .not('due_date', 'is', null)
      .lt('due_date', today),
    supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, days_of_week')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('date', today),
  ])

  const checkinDoneToday = !!checkinRow
  const loggedHabitIds = new Set((habitLogsToday ?? []).map((l: { habit_id: string }) => l.habit_id))
  const habitsRemainingToday = (habits ?? []).filter((h: { id: string; days_of_week: number[] }) =>
    h.days_of_week.includes(todayDow) && !loggedHabitIds.has(h.id)
  ).length

  const overdueCount = overdueStepCount ?? 0
  const bgUrl = (profile as { cover_url?: string | null } | null)?.cover_url || DEFAULT_BG

  return (
    <ToastShell>
      {/* OS Landscape Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden
        src={bgUrl}
        alt=""
        fetchPriority="high"
        decoding="async"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: -1,
        }}
      />
      {/* Light mode gradient overlay */}
      <style>{`
        html[data-theme="light"] .os-overlay {
          background: linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.08) 100%);
        }
      `}</style>
      <div
        aria-hidden
        className="os-overlay"
        style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}
      />

      <div className="app-shell">
        <main className="app-main">
          {children}
        </main>
        <Sidebar
          userName={profile?.name ?? user.email?.split('@')[0] ?? 'You'}
          avatarUrl={profile?.avatar_url ?? null}
          overdueStepCount={overdueCount}
          checkinDoneToday={checkinDoneToday}
          habitsRemainingToday={habitsRemainingToday}
        />
        <BottomNav overdueStepCount={overdueCount} />
        <TimezoneSync />
      </div>
    </ToastShell>
  )
}
