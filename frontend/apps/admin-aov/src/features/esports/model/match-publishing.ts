import type { DocumentView, GameContent } from "@aov/community-contracts"
import { recordingProgress, type ProgressStep, type RecordingProgress } from "./recording-progress"

/**
 * `published`: the public copy is this draft; `ready`: complete, can be published; `partial`: can be published, with
 * something a reader will find unknown; `blocked`: cannot be published yet.
 */
export type PublishState = "published" | "ready" | "partial" | "blocked"
export type PublishRow = {
  entry: DocumentView<GameContent>
  number: number
  state: PublishState
  progress: RecordingProgress
  /** Steps of a complete record still open, each with the panel that records it. */
  steps: ProgressStep[]
  /** What the service reports beyond the steps, such as a hero the patch does not have. */
  issues: string[]
}

/** Fields the recording steps already count: an empty pick. */
const COUNTED = /^sides\[\d\]\.(participants\.five|participants\[\d\]\.hero)$/

/** The reasons several games share, the one most games have first. */
function common(rows: readonly PublishRow[], reasons: (row: PublishRow) => string[]) {
  const counts = new Map<string, number>()
  for (const row of rows) for (const label of new Set(reasons(row))) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([label, games]) => ({ label, games }))
}

/** What most games of a list still miss. */
export const commonGaps = (rows: readonly PublishRow[]) =>
  common(rows, (row) => row.steps.map((step) => step.gap ?? step.label))

/**
 * What keeps the games of a list from being published: the steps a publication needs, or what the service reports where
 * every one of them is done.
 */
export const commonBlocks = (rows: readonly PublishRow[], issueLabel: (field: string, game: GameContent) => string) =>
  common(rows, (row) => {
    const steps = row.steps.filter((step) => step.blocks).map((step) => step.gap ?? step.label)
    return steps.length ? steps : row.issues.map((field) => issueLabel(field, row.entry.content))
  })

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
        state:
          progress.state === "confirmed"
            ? "published"
            : complete
              ? "ready"
              : progress.publishable
                ? "partial"
                : "blocked",
        progress,
        steps: progress.steps.filter((step) => step.required && step.status !== "done" && step.id !== "checks"),
        issues: entry.missingFields.filter((field) => !COUNTED.test(field)),
      }
    })
}
