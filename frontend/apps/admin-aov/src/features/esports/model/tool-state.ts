import type { GameContent } from "@aov/community-contracts"
import { readDraft } from "./draft"
import type { DeskTool } from "./desk"
import type { Place } from "./playback-place"
import type { RecordingProgress } from "./recording-progress"
import type { GameChapter } from "./series-vod"
import { heroKeys } from "./series-rules"

/** The tool on screen for one game. Until the editor `chose` one it follows what the video shows. */
export type ToolState = { gameId: string | null; tool: DeskTool; chosen: boolean }

/** The tool a phase of the game asks for; null outside the game, where the one that is open stays. */
export function toolOfPlace(place: Place, gameId: string | null): DeskTool | null {
  if (place.kind === "between" || place.chapter.gameId !== gameId) return null
  if (place.kind === "draft") return "draft"
  return place.kind === "wait" ? "lineup" : "moments"
}

/** The tool a game opens with where the video says nothing about it: how far it is recorded decides. */
export function openingTool(content: GameContent, chapter: GameChapter): DeskTool {
  if (chapter.live) return "moments"
  const turns = readDraft(content).turns.length
  const heroes = content.sides.some((side) => side.participants.some(({ hero }) => heroKeys(hero).length > 0))
  return heroes && (turns === 0 || turns >= TURNS) ? "lineup" : "draft"
}

/** Another game, or another phase of the same one, moves the tool unless the editor chose it for this game. */
export function followTool(state: ToolState, gameId: string | null, wanted: DeskTool | null): ToolState {
  if (state.gameId !== gameId) return { gameId, tool: wanted ?? state.tool, chosen: false }
  if (state.chosen || !wanted || wanted === state.tool) return state
  return { ...state, tool: wanted }
}

export const chooseTool = (state: ToolState, tool: DeskTool): ToolState => ({ ...state, tool, chosen: true })

const TURNS = 18

/** What a tool's tab carries beside its name: a count, or a dot for something that should be there by now. */
export type ToolMark = { count: string | null; lacks: string | null }

/**
 * Counts and gaps of one game. Gaps are only told while recording, and only once the game is past the point where they
 * would have been recorded: players and spells after the draft, the end and the winner after the game.
 */
export function toolMarks(
  content: GameContent,
  chapter: GameChapter,
  progress: RecordingProgress,
  moments: number,
  options: { recording: boolean; followed: boolean },
): Record<DeskTool, ToolMark> {
  const done = (id: string) => progress.steps.find((step) => step.id === id)?.status === "done"
  const draft = readDraft(content)
  const turns = draft.turns.length
  const counted = turns > 0 || (options.recording && draft.startSecond != null)
  const drafted = chapter.live || draft.lockedSecond != null || done("heroes")
  const open = [!done("players") && "tuyển thủ", !done("spells") && "phụ trợ"].filter(Boolean)
  // Another game after it says this one is over, also where nobody recorded its end.
  const over = content.winner != null || chapter.ended || (chapter.live && options.followed)
  const result = [!content.winner && "đội thắng", !chapter.ended && "thời lượng"].filter(Boolean)
  const gap = (list: (string | false)[]) => (options.recording && list.length ? `thiếu ${list.join(", ")}` : null)
  return {
    draft: { count: counted ? `${turns}/${TURNS}` : null, lacks: null },
    lineup: { count: null, lacks: drafted ? gap(open) : null },
    moments: { count: moments > 0 ? String(moments) : null, lacks: null },
    game: { count: null, lacks: over ? gap(result) : null },
  }
}
