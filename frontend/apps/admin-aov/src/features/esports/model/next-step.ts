import type { GameContent, Side } from "@aov/community-contracts"
import { toolOf, type DeskTool, type ToolTarget } from "./desk"
import { DRAFT_ORDER, draftSlots, readDraft } from "./draft"
import { timeRefusal, type GameTime } from "./game-times"
import type { GameView } from "./game-view"
import type { Place } from "./playback-place"
import type { ProgressStep, RecordingProgress } from "./recording-progress"
import type { GameChapter } from "./series-vod"
import { heroKeys } from "./series-rules"

export type StepAction =
  /** Makes a game: with its ban/pick phase starting at a second of the video, or an empty one. */
  | { kind: "create"; number: number; second: number | null }
  | { kind: "time"; time: Exclude<GameTime, "end">; second: number }
  | { kind: "end"; second: number; winner: Side | null }
  | { kind: "winner"; winner: Side }
  | { kind: "skip"; second: number }
  | { kind: "tool"; tool: DeskTool; target?: ToolTarget }
  | { kind: "publish" }

type StepButton = {
  label: string
  /** The second of the video it writes or goes to, shown behind the label. */
  second: number | null
  /** Why it can not be pressed here, in words; null when it can. */
  refusal: string | null
  action: StepAction
}

/** `outlined`: each button is an answer of its own, so none of them is the gold one. `lead` is the one G presses. */
export type NextStep = { outlined: boolean; buttons: StepButton[]; lead: number | null }

/** The game on screen, as far as the next step reads it. */
export type StepGame = { content: GameContent; chapter: GameChapter; progress: RecordingProgress; view: GameView }

export type NextStepInput = {
  recording: boolean
  /** A form or a panel is open, or the link of a video stands ready: each has a button of its own. */
  busy: boolean
  /** The tool on screen; null while a panel takes its place. */
  tool: DeskTool | null
  video: boolean
  /** The match has no recorded game at all. */
  empty: boolean
  /** The playhead, floored. */
  at: number
  /** Length of the video, when the player has told it. */
  duration: number | null
  place: Place
  chapters: readonly GameChapter[]
  /** Number of the `+N` that is chosen. */
  missing: number | null
  /** The first number still to be recorded; null when the match has every game it should have. */
  toRecord: number | null
  game: StepGame | null
  /** Games that are complete and wait to be published. */
  waiting: number
  canPublish: boolean
}

/** Breaks between games are longer than this in 97 % of 634 measured ones. */
const BREAK = 6 * 60
/** How long after a game the break is offered to be skipped. */
const BREAK_OFFER = 60

const one = (button: StepButton): NextStep => ({ outlined: false, buttons: [button], lead: 0 })

const hasHeroes = (content: GameContent) =>
  content.sides.some((side) => side.participants.some((participant) => heroKeys(participant.hero).length > 0))

/** Why nothing new can start here: the video is inside another game. */
export function insideOther(place: Place, gameId: string | null) {
  if (place.kind === "between" || place.chapter.gameId === gameId) return null
  const { number } = place.chapter
  return `Đang trong ván ${number}: kết thúc ván ${number} hoặc tua ra ngoài ván.`
}

/** The game placed after this one in the video, which nothing of this one may reach. */
export function chapterAfter(chapters: readonly GameChapter[], chapter: GameChapter, at: number) {
  const from = chapter.synced ? chapter.from : at
  return (
    chapters
      .filter((other) => other.synced && other.gameId !== chapter.gameId && other.from > from)
      .sort((a, b) => a.from - b.from)[0] ?? null
  )
}

/** The steps a game goes through in the video, up to its winner. */
function gameSteps(input: NextStepInput, game: StepGame): NextStep | "none" | null {
  const { content, chapter, view } = game
  const { at, place } = input
  const draft = readDraft(content)
  const started = draft.startSecond != null
  const turns = draft.turns.length
  const heroes = hasHeroes(content)
  const refusal = (time: GameTime) => timeRefusal(content, chapter, time, at, chapterAfter(input.chapters, chapter, at))
  const team = (side: Side) => view.sides[side].team.shortName
  const time = (label: string, kind: Exclude<GameTime, "end">): NextStep =>
    one({
      label,
      second: at,
      refusal: insideOther(place, chapter.gameId) ?? refusal(kind),
      action: { kind: "time", time: kind, second: at },
    })

  if (!chapter.live) {
    if (!started && !heroes) return time("Bắt đầu cấm chọn", "draftStart")
    if (started && turns < DRAFT_ORDER.length) {
      if (input.tool === "draft") return "none"
      const slot = draftSlots(draft).find((candidate) => !candidate.recorded)!
      const turn = `Lượt ${slot.order}, ${team(slot.side)} ${slot.kind === "BAN" ? "cấm" : "chọn"}`
      return one({ label: turn, second: null, refusal: null, action: { kind: "tool", tool: "draft" } })
    }
    if (started && draft.lockedSecond == null) return time("Chốt đội hình", "lock")
    return time(`Vào trận ván ${chapter.number}`, "live")
  }

  const winners = (action: (side: Side) => StepAction, blocked: string | null) =>
    (["BLUE", "RED"] as const).map((side): StepButton => ({
      label: `${team(side)} thắng`,
      second: null,
      refusal: blocked,
      action: action(side),
    }))
  if (!chapter.ended) {
    const blocked = refusal("end")
    const end = (label: string): StepButton => ({
      label,
      second: at,
      refusal: blocked,
      action: { kind: "end", second: at, winner: null },
    })
    if (content.winner) return one(end(`Kết thúc ván ${chapter.number}`))
    const [blue, red] = winners((winner) => ({ kind: "end", second: at, winner }), blocked)
    return { outlined: true, buttons: [blue!, end("Kết thúc"), red!], lead: 1 }
  }
  if (!content.winner)
    return { outlined: true, buttons: winners((winner) => ({ kind: "winner", winner }), null), lead: null }
  return null
}

/** The end of a break the video has just entered; null where there is none worth skipping. */
function breakEnd({ at, chapters, duration }: NextStepInput) {
  const over = chapters.find(
    (chapter) => chapter.live && chapter.ended && at >= Math.floor(chapter.end) && at <= chapter.end + BREAK_OFFER,
  )
  if (!over || duration === null) return null
  const end = Math.floor(over.end) + BREAK
  const reachesGame = chapters.some((other) => other.synced && other.from > over.from && other.from <= end)
  return end < duration && !reachesGame ? end : null
}

/** A gap as the button names it: what lacks, with how much of it is there. */
function gapLabel(step: ProgressStep) {
  const counted = step.detail.match(/^\d+\/\d+/)?.[0]
  return counted ? `${step.label} ${counted}` : (step.gap ?? step.label)
}

/**
 * The one thing to do next, decided by what is recorded and by where the video stands; null when there is nothing, or
 * when the tool on screen is the one that does it.
 */
export function nextStep(input: NextStepInput): NextStep | null {
  const { recording, busy, video, empty, at, place, missing, toRecord, game } = input
  // Without a game and a video, the link of the video is the thing to give.
  if (!recording || busy || (empty && !video)) return null

  const create = (number: number): NextStep =>
    one({
      label: video ? `Cấm chọn ván ${number}` : `Thêm ván ${number}`,
      second: video ? at : null,
      refusal: video ? insideOther(place, null) : null,
      action: { kind: "create", number, second: video ? at : null },
    })
  const number = missing ?? (empty ? toRecord : null)
  if (number !== null) return create(number)

  if (game && video && game.progress.state !== "confirmed") {
    const step = gameSteps(input, game)
    if (step) return step === "none" ? null : step
  }
  if (video && toRecord !== null) {
    const end = breakEnd(input)
    if (end !== null)
      return one({ label: "Bỏ qua 6 phút nghỉ", second: end, refusal: null, action: { kind: "skip", second: end } })
    if (place.kind === "between") return create(toRecord)
  }

  const gap = game?.progress.steps.find((step) => step.required && step.status !== "done")
  if (gap) {
    const { tool, target } = toolOf(gap)
    if (tool === input.tool) return null
    return one({ label: gapLabel(gap), second: null, refusal: null, action: { kind: "tool", tool, target } })
  }
  if (!video && toRecord !== null) return create(toRecord)
  if (input.waiting > 0 && input.canPublish)
    return one({ label: `Xuất bản ${input.waiting} ván`, second: null, refusal: null, action: { kind: "publish" } })
  return null
}
