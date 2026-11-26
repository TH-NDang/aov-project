import { LoaderCircle } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { atVideo } from "../../model/game-times"
import type { NextStep as Step, StepAction } from "../../model/next-step"
import type { Playhead } from "../../model/playhead"
import { usePlayhead } from "../game/use-playhead"

/**
 * The one thing to do next, always in the same place. It is read again with every reading of the video, because the
 * second it would write is part of its name.
 */
export function NextStep({
  playhead,
  read,
  pending,
  keycap,
  onRun,
  onRefuse,
}: {
  playhead: Playhead
  read: () => Step | null
  /** A step is being written; pressing again waits for it. */
  pending: boolean
  keycap: boolean
  onRun: (action: StepAction) => void
  onRefuse: (why: string) => void
}) {
  usePlayhead(playhead)
  const step = read()
  if (!step) return null
  return (
    <div className="esp-next" data-outlined={step.outlined || undefined}>
      {step.buttons.map((button, index) => {
        const lead = index === step.lead
        return (
          <Button
            key={button.label}
            type="button"
            variant={step.outlined ? "outline" : "default"}
            className={
              step.outlined
                ? "h-11 min-w-0 flex-auto gap-1.5 px-2"
                : "h-11 min-w-0 flex-1 justify-start px-3.5 font-semibold"
            }
            aria-disabled={pending || !!button.refusal || undefined}
            aria-keyshortcuts={lead ? "G" : undefined}
            title={button.refusal ?? undefined}
            onClick={() => {
              if (pending) return
              if (button.refusal) onRefuse(button.refusal)
              else onRun(button.action)
            }}
          >
            {pending && lead && <LoaderCircle className="animate-spin" aria-hidden />}
            <span className="truncate">{button.label}</span>
            {button.second !== null && <span className="esp-next-at esp-num">{atVideo(button.second)}</span>}
            {keycap && lead && !step.outlined && (
              <Kbd className="ml-auto border border-current/40 bg-transparent text-inherit">G</Kbd>
            )}
          </Button>
        )
      })}
    </div>
  )
}
