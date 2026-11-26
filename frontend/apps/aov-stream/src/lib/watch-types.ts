import type { DraftKind, ObjectiveKind, PublishedGame, Selection, Side, VodPause } from "@aov/community-contracts"

/** The first and the second team of a series, whatever side of the map they play. */
export type WatchTeam = "A" | "B"
export type WatchLength = "quick" | "games" | "whole" | "all"
export type KeptLength = Exclude<WatchLength, "quick">
export type MomentKind = ObjectiveKind | "KILL" | "NOTE"

export type WatchMoment = {
  /** Second of the game, and of its video where the clock is known. */
  at: number
  second: number | null
  side: Side | null
  team: WatchTeam | null
  kind: MomentKind
  count: number
  title: string | null
}
export type WatchTurn = {
  order: number
  kind: DraftKind
  side: Side
  team: WatchTeam
  hero: Selection | null
  /** Second of the video; `own` is false where it was taken from the next turn or the lock. */
  second: number | null
  own: boolean
}
/** A stretch of video that tells the match; `at` is where it begins in the story. */
export type StoryPart = {
  kind: "DRAFT" | "PLAY" | "GAME"
  from: number
  to: number
  at: number
  seconds: number
  after: "WAIT" | "PAUSE" | "BREAK" | null
}
export type Chapter = {
  index: number
  number: number
  game: PublishedGame
  video: string | null
  timing: "CLOCK" | "LINK" | "NONE"
  /** The second its link names, 0 without one. */
  link: number
  zero: number | null
  length: number | null
  pauses: VodPause[]
  draftStart: number | null
  lock: number | null
  end: number | null
  parts: StoryPart[]
  from: number | null
  to: number | null
  seconds: number
  /** Where a game without a time stands in its video; open at the end without `to`. */
  span: { from: number; to: number | null } | null
  moments: WatchMoment[]
  turns: WatchTurn[]
  sides: Record<WatchTeam, Side | null>
  winner: WatchTeam | null
}
export type TimedChapter = Chapter & {
  timing: "CLOCK"
  video: string
  zero: number
  length: number
  end: number
  from: number
  to: number
}
export const timed = (chapter: Chapter | null | undefined): chapter is TimedChapter => chapter?.timing === "CLOCK"

export type Story = {
  level: "TIMED" | "LINKED" | "PLAIN" | "NONE"
  chapters: Chapter[]
  seconds: number
  bestOf: number
  teams: [a: string, b: string] | null
  videos: string[]
}

type At<State extends string, C, Clock, Left> = {
  state: State
  chapter: C
  next: Chapter | null
  clock: Clock
  left: Left
  over: boolean
}
export type Place =
  | At<"UNKNOWN", null, null, null>
  | At<"BEFORE", null, null, number>
  | At<"DRAFT" | "WAIT", TimedChapter, null, number>
  | At<"PLAY", TimedChapter, number, null>
  | At<"PAUSE", TimedChapter, number, number>
  | At<"BREAK" | "AFTER", Chapter, number | null, number | null>
  | At<"GAME" | "SPAN", Chapter, null, number | null>
export type Score = Record<WatchTeam, number>

/** A stretch a length plays. `lead` counts down before its end; `hold` goes on into an untimed game instead. */
export type Piece = { chapter: number; video: string; from: number; to: number; lead: number; hold: boolean }
export type Cut = { pieces: Piece[]; seconds: number; offered: boolean }
export type Cuts = { quick: Cut; games: Cut; whole: Cut; missing: number[] }
export type WatchCount = { seconds: number; of: number; until: number; next: Piece }

/** A place of a video; `game` is the number of the game an address named. */
export type WatchTarget = { video: string; second: number; game?: number }

export type WatchSide = {
  id: string | null
  name: string
  shortName: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
}
/** A match that can be watched. */
export type WatchMatch = {
  seriesId: string
  /** The address of its page. */
  href: string
  teams: Record<WatchTeam, WatchSide>
  story: Story
  cuts: Cuts
  /** What each team had won before the first game that is published. */
  before: Score
  /** On now, and whether the recorded result says that it is over. */
  live: boolean
  finished: boolean
}

export type MomentRow = {
  from: number
  to: number
  team: WatchTeam | null
  title: string | null
  taken: { kind: MomentKind; count: number }[]
  second: number | null
}
export type BarCell = {
  chapter: Chapter
  left: number
  width: number
  /** Pixels a mark takes on it. */
  mark: number
  parts: { part: StoryPart; left: number; width: number }[]
  chip: boolean
  blank: boolean
}
export type Bar = { cells: BarCell[]; width: number; unit: number; folded: boolean }
export type BarMark = {
  x: number
  team: WatchTeam | null
  kind: MomentKind | DraftKind
  height: number
  at: number
  second: number
  ahead: boolean
  turn?: WatchTurn
  moment?: WatchMoment
}
export type BarRead = { cell: BarCell; part: StoryPart | null; second: number | null; mark: BarMark | null; x: number }

export type RoomBar = "STORY" | "TABS" | "NONE"
export type RoomShape = {
  shape: "side" | "turned" | "stack" | "bare"
  phone: boolean
  bar: number
  video: { width: number; height: number }
  companion: number
  density: "roomy" | "short" | "mid" | "tight"
}
