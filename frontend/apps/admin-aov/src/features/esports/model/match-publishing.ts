import type { DocumentView, GameContent } from "@aov/community-contracts"
import { recordingProgress, type ProgressStep, type RecordingProgress } from "./recording-progress"

/** `published`: the public copy is this draft; `ready`: can be published now; `blocked`: something is missing. */
export type PublishState = "published" | "ready" | "blocked"
export type PublishRow = {
  entry: DocumentView<GameContent>
  number: number
  state: PublishState
  progress: RecordingProgress
  /** Required steps still open, each with the panel that records it. */
  steps: ProgressStep[]
  /** What the service reports beyond the steps, such as a hero the patch does not have. */
  issues: string[]
}

/** Fields the recording steps already count: an empty ban, pick, player or spell. */
const COUNTED = /^sides\[\d\]\.(bans\.four|bans\[\d\]|participants\.five|participants\[\d\]\.(hero|playerId|spell))$/

/** Every game of a match in order, with what still keeps it from being published. */
export function publishRows(games: readonly DocumentView<GameContent>[]): PublishRow[] {
  return [...games]
    .sort((a, b) => a.content.number - b.content.number)
    .map((entry) => {
      const progress = recordingProgress(entry)
      const complete = progress.done === progress.total
      return {
        entry,
        number: entry.content.number,
        state: progress.state === "confirmed" ? "published" : complete ? "ready" : "blocked",
        progress,
        steps: progress.steps.filter((step) => step.required && step.status !== "done" && step.id !== "checks"),
        issues: entry.missingFields.filter((field) => !COUNTED.test(field)),
      }
    })
}
