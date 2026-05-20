'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastContext'
import type { GoalWithSteps, GoalStep, Habit } from '@/lib/types'
import {
  generateAndSaveStepsAction,
  toggleStepAction,
  createStepAction,
  updateStepAction,
  deleteStepAction,
} from '@/app/actions/goal-steps'
import { getMilestoneCrossed } from '@/lib/utils/goal-vitality'
import { updateGoalAction } from '@/app/actions/goals'
import GoalCard, { type GoalCardProps } from './GoalCard'
import GoalModal from './GoalModal'
import MilestoneCelebration from './MilestoneCelebration'

type ModalState      = null | { mode: 'add' } | { mode: 'edit'; goal: GoalWithSteps }
type CelebrationState = null | { goalTitle: string; milestone: 25 | 50 | 75 | 100 }

type SectionHandlers = Omit<GoalCardProps, 'goal'>

export default function GoalsList({
  goals: initial,
  habits: initialHabits = [],
  existingHabitNames: initialHabitNames = [],
  habitCompletions: initialCompletions = {},
}: {
  goals: GoalWithSteps[]
  habits?: Habit[]
  existingHabitNames?: string[]
  habitCompletions?: Record<string, number>
}) {
  const toast  = useToast()
  const router = useRouter()

  const [goals,       setGoals]       = useState<GoalWithSteps[]>(initial)
  const [modal,       setModal]       = useState<ModalState>(null)
  const [celebration, setCelebration] = useState<CelebrationState>(null)
  const [stepsMap,    setStepsMap]    = useState<Map<string, GoalStep[]>>(() => {
    const m = new Map<string, GoalStep[]>()
    initial.forEach(g => m.set(g.id, g.steps ?? []))
    return m
  })
  const [generatingFor,    setGeneratingFor]    = useState<Set<string>>(new Set())
  const [suggestingFor,    setSuggestingFor]    = useState<Set<string>>(new Set())
  const [habits,           setHabits]           = useState<Habit[]>(initialHabits)
  const [habitNames,       setHabitNames]       = useState<string[]>(initialHabitNames)
  const [habitCompletions, setHabitCompletions] = useState<Record<string, number>>(initialCompletions)
  const [expanded,         setExpanded]         = useState<Set<string>>(new Set())

  const closeModal    = () => setModal(null)
  const toggleExpand  = (goalId: string) =>
    setExpanded(s => { const n = new Set(s); n.has(goalId) ? n.delete(goalId) : n.add(goalId); return n })

  const handleGoalSaved = (
    goal: GoalWithSteps,
    isNew: boolean,
    linkedHabits?: Array<{ id: string; goal_target_count: number }>,
  ) => {
    if (isNew) {
      setGoals(gs => [...gs, goal])
      setStepsMap(m => new Map(m).set(goal.id, []))
      // Update local habits state to reflect newly linked goal_id
      if (linkedHabits?.length) {
        const linkedMap = new Map(linkedHabits.map(h => [h.id, h.goal_target_count]))
        setHabits(prev => prev.map(h =>
          linkedMap.has(h.id)
            ? { ...h, goal_id: goal.id, goal_target_count: linkedMap.get(h.id)! }
            : h
        ))
      }
      // Ask Jaune what to suggest — habits, steps, or both
      // Skip if habits were manually linked (suggestion already acted on)
      if (!linkedHabits?.length) {
        const goalId = goal.id
        fetch('/api/goals/suggest-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId }),
        })
          .then(r => r.json())
          .then(({ modes }: { modes: Array<'habits' | 'steps'> }) => {
            if (modes.includes('habits')) setSuggestingFor(s => new Set([...s, goalId]))
            if (modes.includes('steps')) {
              setExpanded(s => new Set([...s, goalId]))
              handleRegenerateSteps(goalId)
            }
          })
          .catch(() => {
            // Fall back to habits suggestion on error
            setSuggestingFor(s => new Set([...s, goal.id]))
          })
      }
    } else {
      setGoals(gs => gs.map(g => g.id === goal.id ? { ...goal, steps: stepsMap.get(goal.id) ?? [] } : g))
    }
    closeModal()
    router.refresh()
  }

  const handleDeleted = (goalId: string) => {
    setGoals(gs => gs.filter(g => g.id !== goalId))
    setStepsMap(m => { const n = new Map(m); n.delete(goalId); return n })
    router.refresh()
  }

  const handleToggleStep = async (goalId: string, stepId: string, completed: boolean) => {
    setStepsMap(m => {
      const n = new Map(m)
      n.set(goalId, (n.get(goalId) ?? []).map(s =>
        s.id === stepId ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null } : s
      ))
      return n
    })
    const currentSteps = stepsMap.get(goalId) ?? []
    const updatedSteps = currentSteps.map(s => s.id === stepId ? { ...s, completed } : s)
    const newPct = updatedSteps.length > 0
      ? Math.round(updatedSteps.filter(s => s.completed).length / updatedSteps.length * 100) : 0
    const prevPct = goals.find(g => g.id === goalId)?.progress_pct ?? 0
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, progress_pct: newPct } : g))

    if (completed) {
      const milestone = getMilestoneCrossed(prevPct, newPct)
      if (milestone !== null) {
        const goalTitle = goals.find(g => g.id === goalId)?.title ?? ''
        setCelebration({ goalTitle, milestone })
      }
    }

    try {
      await toggleStepAction(stepId, completed)
    } catch {
      setStepsMap(m => {
        const n = new Map(m)
        n.set(goalId, (n.get(goalId) ?? []).map(s =>
          s.id === stepId ? { ...s, completed: !completed, completed_at: null } : s
        ))
        return n
      })
      const revertPct = currentSteps.length > 0
        ? Math.round(currentSteps.filter(s => s.completed).length / currentSteps.length * 100) : 0
      setGoals(gs => gs.map(g => g.id === goalId ? { ...g, progress_pct: revertPct } : g))
    }
  }

  const handleAddStep = async (goalId: string, title: string, due_date: string | null) => {
    try {
      const newStep = await createStepAction(goalId, title, due_date)
      setStepsMap(m => new Map(m).set(goalId, [...(m.get(goalId) ?? []), newStep]))
      const steps = [...(stepsMap.get(goalId) ?? []), newStep]
      const pct = steps.length > 0 ? Math.round(steps.filter(s => s.completed).length / steps.length * 100) : 0
      setGoals(gs => gs.map(g => g.id === goalId ? { ...g, progress_pct: pct } : g))
    } catch (err) { console.error('Add step failed:', err); toast.error('Failed to add step') }
  }

  const handleUpdateStep = async (goalId: string, stepId: string, updates: { title?: string; due_date?: string | null }) => {
    setStepsMap(m => {
      const n = new Map(m)
      n.set(goalId, (n.get(goalId) ?? []).map(s => s.id === stepId ? { ...s, ...updates } : s))
      return n
    })
    try { await updateStepAction(stepId, updates) }
    catch (err) { console.error('Update step failed:', err); toast.error('Failed to update step') }
  }

  const handleDeleteStep = async (goalId: string, stepId: string) => {
    setStepsMap(m => {
      const n = new Map(m)
      n.set(goalId, (n.get(goalId) ?? []).filter(s => s.id !== stepId))
      return n
    })
    const steps = (stepsMap.get(goalId) ?? []).filter(s => s.id !== stepId)
    const pct = steps.length > 0 ? Math.round(steps.filter(s => s.completed).length / steps.length * 100) : 0
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, progress_pct: pct } : g))
    try { await deleteStepAction(stepId) }
    catch (err) { console.error('Delete step failed:', err); toast.error('Failed to delete step') }
  }

  const handleRegenerateSteps = async (goalId: string) => {
    setGeneratingFor(s => new Set([...s, goalId]))
    setStepsMap(m => new Map(m).set(goalId, []))
    try {
      const steps = await generateAndSaveStepsAction(goalId)
      setStepsMap(m => new Map(m).set(goalId, steps))
      const pct = steps.length > 0 ? Math.round(steps.filter(s => s.completed).length / steps.length * 100) : 0
      setGoals(gs => gs.map(g => g.id === goalId ? { ...g, progress_pct: pct } : g))
    } catch (err) { console.error('Regenerate failed:', err); toast.error('Failed to generate steps — try again') }
    finally { setGeneratingFor(s => { const n = new Set(s); n.delete(goalId); return n }) }
  }

  const active    = goals.filter(g => g.status === 'active')
  const paused    = goals.filter(g => g.status === 'paused')
  const completed = goals.filter(g => g.status === 'completed')
  const quarter   = active.filter(g => g.timeframe === 'quarter')
  const yearly    = active.filter(g => g.timeframe === 'year')
  const ongoing   = active.filter(g => g.timeframe === 'ongoing')

  const sharedHandlers: SectionHandlers = {
    stepsMap, generatingFor, suggestingFor, habitNames, habits, habitCompletions,
    expanded, onToggleExpand: toggleExpand,
    onEdit:    (g) => window.innerWidth <= 768 ? router.push(`/goals/${g.id}/edit`) : setModal({ mode: 'edit', goal: g }),
    onDelete:  handleDeleted,
    onUpdate:  (g) => setGoals(gs => gs.map(x => x.id === g.id ? g : x)),
    onToggleStep:  handleToggleStep,
    onAddStep:     handleAddStep,
    onUpdateStep:  handleUpdateStep,
    onDeleteStep:  handleDeleteStep,
    onRegenerate:  handleRegenerateSteps,
    onHabitAdded:  (name, habit) => {
      setHabitNames(prev => [...prev, name])
      setHabits(prev => [...prev, habit])
      // Switch the goal to habit-tracked now that the user has linked a habit
      if (habit.goal_id) {
        const goalId = habit.goal_id
        setGoals(gs => gs.map(g =>
          g.id === goalId && g.tracking_mode !== 'habits'
            ? { ...g, tracking_mode: 'habits' }
            : g
        ))
        updateGoalAction(goalId, { tracking_mode: 'habits' }).catch(console.error)
      }
    },
    onDismissSuggestion: (goalId) => setSuggestingFor(s => { const n = new Set(s); n.delete(goalId); return n }),
  }

  return (
    <>
      <div className="page-pad" style={{ maxWidth: '860px', width: '100%', marginLeft: 'auto', marginRight: 'auto', animation: 'fadeUp 0.3s var(--ease) both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: '6px', opacity: 0.85 }}>Your System</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 400, color: 'var(--text-0)', lineHeight: 1.15 }}>
              Goals & <em style={{ fontStyle: 'italic', color: 'var(--text-1)' }}>Direction</em>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '6px' }}>
              {active.length} active · {completed.length} completed
            </div>
          </div>
          <button
            onClick={() => window.innerWidth <= 768 ? router.push('/goals/new') : setModal({ mode: 'add' })}
            style={{ background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '10px', padding: '11px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginTop: '6px', whiteSpace: 'nowrap' }}>
            + Add goal
          </button>
        </div>

        {quarter.length > 0  && <GoalSection title={`This Quarter · Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`} goals={quarter}   {...sharedHandlers} />}
        {yearly.length > 0   && <GoalSection title={`This Year · ${new Date().getFullYear()}`}                                                    goals={yearly}    {...sharedHandlers} />}
        {ongoing.length > 0  && <GoalSection title="Ongoing"                                                                                      goals={ongoing}   {...sharedHandlers} />}
        {paused.length > 0   && <GoalSection title="Paused"     goals={paused}    {...sharedHandlers} dim />}
        {completed.length > 0 && <GoalSection title="Completed" goals={completed} {...sharedHandlers} dim />}

        {goals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid var(--glass-card-border)', boxShadow: 'var(--glass-card-shadow-sm)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎯</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 300, color: 'var(--text-1)', marginBottom: '8px' }}>No goals yet.</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '20px' }}>Add a goal and Jaune will break it into steps automatically.</div>
            <button
              onClick={() => window.innerWidth <= 768 ? router.push('/goals/new') : setModal({ mode: 'add' })}
              style={{ background: 'var(--gold)', color: '#131110', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Add your first goal →
            </button>
          </div>
        )}
      </div>

      {modal && (
        <GoalModal
          mode={modal.mode}
          goal={modal.mode === 'edit' ? modal.goal : undefined}
          hasSteps={modal.mode === 'edit' ? (stepsMap.get(modal.goal.id) ?? []).length > 0 : false}
          habits={habits}
          onClose={closeModal}
          onSaved={handleGoalSaved}
        />
      )}

      {celebration && (
        <MilestoneCelebration
          goalTitle={celebration.goalTitle}
          milestone={celebration.milestone}
          onClose={() => setCelebration(null)}
        />
      )}
    </>
  )
}

/* ── Section ── */
type SectionProps = SectionHandlers & { title: string; goals: GoalWithSteps[]; dim?: boolean }

function GoalSection({ title, goals, dim, ...handlers }: SectionProps) {
  return (
    <div style={{ marginBottom: '32px', opacity: dim ? 0.65 : 1 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 400, color: 'var(--text-1)', marginBottom: '14px', letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {title}
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      {goals.map(g => <GoalCard key={g.id} goal={g} {...handlers} />)}
    </div>
  )
}
