import type { RecordingProgress, StepStatus } from "./recording-progress"

/** The recording panels in the order a game is recorded; `progress` is the last look before publishing. */
export const RECORDING_TOOLS = ["draft", "loadout", "sync", "progress"] as const
export type RecordingTool = (typeof RECORDING_TOOLS)[number]

/** The required steps each panel records. */
const TOOL_STEPS: Record<RecordingTool, string[]> = {
  draft: ["bans", "heroes"],
  loadout: ["players", "spells"],
  sync: ["result"],
  progress: ["checks"],
}

/** How far each panel's required data is, and the panel to open next; none once the game is published unchanged. */
export function recordingTools(progress: RecordingProgress) {
  const statusOf = (tool: RecordingTool): StepStatus => {
    const steps = progress.steps.filter((step) => TOOL_STEPS[tool].includes(step.id))
    if (steps.every((step) => step.status === "done")) return "done"
    return steps.some((step) => step.status !== "todo") ? "partial" : "todo"
  }
  const status: Record<RecordingTool, StepStatus> = {
    draft: statusOf("draft"),
    loadout: statusOf("loadout"),
    sync: statusOf("sync"),
    progress: statusOf("progress"),
  }
  const open = RECORDING_TOOLS.find((tool) => status[tool] !== "done")
  return { status, next: open ?? (progress.state === "confirmed" ? null : "progress") }
}
