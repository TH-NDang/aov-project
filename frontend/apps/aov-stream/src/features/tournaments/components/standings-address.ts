import { useState } from "react"
import { useSearchParams } from "react-router"
import { withParam } from "../../../lib/params"
import { stepAddress, stepAt, type StandingStep } from "../../../lib/standings-steps"

/** What the address of the standings holds: the team followed through them, and the step a table is read at. */
export function useStandingsAddress() {
  const [params, setParams] = useSearchParams()
  const put = (key: string, value: string | null, replace: boolean) =>
    setParams((current) => withParam(current, key, value), { replace })
  return {
    team: params.get("team"),
    at: params.get("at"),
    follow: (team: string | null) => put("team", team, false),
    // A step is not a place to go back to: it takes the place of the one before.
    readAt: (at: string) => put("at", at, true),
  }
}

export type ShownStep = {
  /** Which step is shown. */
  shown: number
  /** Whether the address names it; without it a table is shown as it stands now. */
  named: boolean
  /** Shows a step without writing it down, while the range is dragged. */
  move: (step: number) => void
  /** Shows a step and writes it into the address. */
  read: (step: number) => void
}

/**
 * The step a stage is shown at. Dragging moves it here alone and the address is written once, when the drag ends. The
 * step held here counts until the address has moved on.
 */
export function useShownStep(steps: StandingStep[], stageCode: string, first: boolean): ShownStep {
  const { at, readAt } = useStandingsAddress()
  const [held, setHeld] = useState<{ at: string | null; step: number } | null>(null)
  if (held && held.at !== at) setHeld(null)
  const named = stepAt(steps, stageCode, first, at)
  const move = (step: number) => setHeld({ at, step })
  return {
    shown: held && held.at === at && held.step < steps.length ? held.step : (named ?? steps.length - 1),
    named: named != null,
    move,
    read: (step) => {
      move(step)
      readAt(stepAddress(steps[step]!, stageCode, first))
    },
  }
}
