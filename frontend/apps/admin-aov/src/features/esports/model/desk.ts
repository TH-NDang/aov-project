import type { GameContent, Side } from "@aov/community-contracts"
import type { LoadoutPart } from "./loadout"
import type { ProgressStep } from "./recording-progress"
import type { SeatKey, TimelineEvent, TimelineKind } from "./timeline"

export const DESK_TOOLS = ["draft", "lineup", "moments", "game"] as const
export type DeskTool = (typeof DESK_TOOLS)[number]
/** What takes the place of the tool. */
export type DeskPanel = "publish" | "quick" | "match"
export type ContentChange = (content: GameContent) => GameContent
/** A change that says what it did and how to take it back; `revert` is null when nothing can. */
export type RecordedChange = { text: string; apply: ContentChange; revert: ContentChange | null }
/**
 * The form of one moment: a new one, at a video second when one was pointed at, or a stored one. `refused` is what the
 * form held when its save was refused; the form opens with it, as a new moment unless it edits a stored one.
 */
export type MomentForm = {
  kind?: TimelineKind
  at?: number
  side?: Side
  editing?: TimelineEvent
  refused?: TimelineEvent
}
export type GameRow = "result" | "times" | "scope" | "video" | "public"
/** The part of a tool to bring forward. */
export type ToolTarget = { seat?: SeatKey; part?: LoadoutPart; row?: GameRow }

/** The part of a player a step of the line-ups is about; the players themselves are named on the board. */
const LOADOUT_STEPS: Record<string, LoadoutPart | undefined> = {
  spells: "spell",
  enchantments: "enchantments",
  arcana: "arcana",
}

/** The tool that records a step. */
export function toolOf(step: Pick<ProgressStep, "id" | "target">): { tool: DeskTool; target?: ToolTarget } {
  switch (step.target) {
    case "draft":
      return { tool: "draft" }
    case "loadout": {
      const part = LOADOUT_STEPS[step.id]
      return { tool: "lineup", target: part && { part } }
    }
    case "equipment":
      return { tool: "lineup", target: { part: "equipment" } }
    case "composer":
      return { tool: "moments" }
    case "sync":
      return { tool: "game", target: { row: "times" } }
    case "result":
      return { tool: "game", target: { row: "result" } }
    case "data":
      return { tool: "game", target: { row: "scope" } }
  }
}
