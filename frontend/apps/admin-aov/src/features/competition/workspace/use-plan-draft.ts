import { useCallback, useState } from "react"
import type { CompetitionPlan } from "@aov/community-contracts"
import { changedDraft, planDraft, redoneDraft, undoneDraft } from "../model/plan-draft"

/** The plan an editor works on, with undo and redo over the edits since it was last loaded or saved. */
export function usePlanDraft(initial: CompetitionPlan) {
  const [draft, setDraft] = useState(() => planDraft(initial))
  const change = useCallback(
    <K extends keyof CompetitionPlan>(key: K, value: CompetitionPlan[K]) =>
      setDraft((current) => changedDraft(current, { ...current.plan, [key]: value }, key, Date.now())),
    [],
  )
  /** Several fields as one step, such as a stage taken out together with its venue. */
  const changeAll = useCallback(
    (patch: Partial<CompetitionPlan>) =>
      setDraft((current) => changedDraft(current, { ...current.plan, ...patch }, `all:${Date.now()}`, Date.now())),
    [],
  )
  const reset = useCallback((plan: CompetitionPlan) => setDraft(planDraft(plan)), [])
  const undo = useCallback(() => setDraft(undoneDraft), [])
  const redo = useCallback(() => setDraft(redoneDraft), [])
  return {
    plan: draft.plan,
    change,
    changeAll,
    reset,
    undo,
    redo,
    canUndo: draft.past.length > 0,
    canRedo: draft.future.length > 0,
  }
}
