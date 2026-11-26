import type { GameContent, ObjectiveKind } from "@aov/community-contracts"
import type { GameView } from "./game-view"
import { chapterClock, type GameChapter } from "./series-vod"
import { ITEM_ACTION_LABELS, OBJECTIVE_LABELS, type ItemEvent, type SeatKey, type TimelineEvent } from "./timeline"
import { readTimeline, writeTimeline } from "./timeline-io"

/** The objectives recorded in one press, in the order of their keys. */
export const PAD_OBJECTIVES = ["TURRET", "ABYSSAL_DRAGON", "DARK_SLAYER"] as const satisfies readonly ObjectiveKind[]

/** The short names of the pad and of the list of moments. */
export const OBJECTIVE_NAMES: Record<ObjectiveKind, string> = { ...OBJECTIVE_LABELS, DARK_SLAYER: "Tà thần" }

/** Why no moment of the game can be recorded at a video second; null when one can. */
export function outsideRefusal(chapter: GameChapter, videoSecond: number): string | null {
  const ahead = `Ván ${chapter.number} chưa vào trận.`
  const outside = `Video đang ở ngoài ván ${chapter.number}.`
  if (!chapter.live) return ahead
  if (videoSecond < chapter.start) return videoSecond >= chapter.from ? ahead : outside
  return chapter.ended && videoSecond > chapter.end ? outside : null
}

/** The game second a press records at: a moment belongs to the second that had begun when it was seen. */
export const pressedSecond = (chapter: GameChapter, videoSecond: number) =>
  Math.floor(chapterClock(chapter, videoSecond))

/** A moment as the list calls it; the team of an objective is told by its place there. */
export function momentWords(event: TimelineEvent, game: GameView): string {
  const seats = [...game.sides.BLUE.seats, ...game.sides.RED.seats]
  const seat = (key?: SeatKey) => seats.find((candidate) => candidate.key === key)
  const hero = (key?: SeatKey) => seat(key)?.hero?.name ?? seat(key)?.playerName ?? "Chưa rõ"
  switch (event.kind) {
    case "KILL":
      return `${hero(event.killer)} hạ ${hero(event.victim)}`
    case "OBJECTIVE":
      return OBJECTIVE_NAMES[event.objective]
    case "ITEM": {
      const action = ITEM_ACTION_LABELS[event.action].toLocaleLowerCase("vi")
      return `${seat(event.seat)?.playerName ?? "Chưa rõ"} ${action} ${event.item?.name ?? "trang bị"}`
    }
    case "NOTE":
      return event.title
  }
}

/** The same with the team that took an objective, for a sentence that stands alone. */
export const momentName = (event: TimelineEvent, game: GameView) =>
  event.kind === "OBJECTIVE"
    ? `${OBJECTIVE_NAMES[event.objective]} của ${game.sides[event.side].team.shortName}`
    : momentWords(event, game)

/** Items carry no id of their own, only their place in the player's list; what they say tells them apart. */
const sameItem = (a: ItemEvent, b: ItemEvent) =>
  a.seat === b.seat &&
  a.action === b.action &&
  a.slot === b.slot &&
  Math.round(a.at) === Math.round(b.at) &&
  (a.item?.id ?? a.item?.name) === (b.item?.id ?? b.item?.name)

/**
 * The game with one moment taken out and another put in. An item that comes back is added rather than written over its
 * old id, which the next item of that player took when it left.
 */
export function replaceMoment(
  content: GameContent,
  out: TimelineEvent | null,
  into: TimelineEvent | null,
): GameContent {
  const events = readTimeline(content)
  const index = out
    ? events.findIndex((event) =>
        out.kind === "ITEM" ? event.kind === "ITEM" && sameItem(event, out) : event.id === out.id,
      )
    : -1
  const rest = events.filter((_, position) => position !== index)
  if (!into) return writeTimeline(content, rest)
  const others = into.kind === "ITEM" ? rest : rest.filter((event) => event.kind === "ITEM" || event.id !== into.id)
  return writeTimeline(content, [...others, into])
}
