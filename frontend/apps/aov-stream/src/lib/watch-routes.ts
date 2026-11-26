import { gameToVideo } from "@aov/ui/lib/game-video"
import { startOf } from "./watch-follow.ts"
import type { WatchView } from "./watch-store.ts"
import { timed, type WatchLength, type WatchMatch, type WatchTarget } from "./watch-types.ts"

/** A place an address names: a game, a second of that game (negative in its draft), or a second of its video. */
export type WatchAddress = { game: number | null; at: number | null; second: number | null }

/** The address of a match that plays from a game, a second of it, or a second of its video. */
export function watchHref(
  seriesId: string,
  { game, at, second }: { game?: number | null; at?: number | null; second?: number | null } = {},
): string {
  const query = new URLSearchParams()
  if (game != null) query.set("game", String(game))
  if (at != null) query.set("at", String(Math.round(at)))
  else if (second != null) query.set("second", String(Math.max(0, Math.floor(second))))
  const search = query.toString()
  return `/matches/${encodeURIComponent(seriesId)}${search && `?${search}`}`
}

/** Reads what `watchHref` wrote; null for an address that names nothing that can be read. */
export function readWatch(search: string): WatchAddress | null {
  const query = new URLSearchParams(search)
  const number = (name: string, pattern: RegExp) => {
    const value = query.get(name) ?? ""
    return pattern.test(value) ? Number(value) : null
  }
  const game = number("game", /^[1-9]\d?$/)
  const at = game == null ? null : number("at", /^-?\d{1,5}$/)
  const second = at == null ? number("second", /^\d{1,6}$/) : null
  return game == null && second == null ? null : { game, at, second }
}

/** Where an address points in a match, or null where the match has no such place. */
export function targetOf(match: WatchMatch, address: WatchAddress | null, length: WatchLength): WatchTarget | null {
  if (!address) return null
  const { story, cuts } = match
  const { game, at, second } = address
  if (game == null) return second != null && story.videos.length ? { video: story.videos[0], second } : null

  const chapter = story.chapters.find(({ number }) => number === game)
  if (!chapter?.video) return null
  const { video } = chapter
  if (at != null && timed(chapter)) {
    const { zero, pauses, from } = chapter
    const named = at < 0 ? zero + at : gameToVideo(zero, pauses, Math.min(at, chapter.length))
    return { video, second: Math.max(from, named), game }
  }
  return { video, second: second ?? startOf(chapter, cuts, length) ?? chapter.link, game }
}

/** What a copied link says of the place the video stands at: seconds of the game, which a corrected 0:00 leaves true. */
export function shareOf({ place, match, chosen, video, second }: WatchView): {
  game?: number | null
  at?: number
  second?: number
} {
  if (!match) return {}
  if (!place || place.state === "UNKNOWN") {
    const { chapters } = match.story
    const shown = chapters[chosen]?.video === video ? chapters[chosen] : chapters.find((other) => other.video === video)
    return { game: shown?.number ?? null, second }
  }
  switch (place.state) {
    case "PLAY":
    case "PAUSE":
      return { game: place.chapter.number, at: Math.floor(place.clock) }
    case "DRAFT":
    case "WAIT":
      return { game: place.chapter.number, at: Math.floor(second - place.chapter.zero) }
    case "GAME":
    case "SPAN":
      return { game: place.chapter.number, second }
    default:
      return place.next ? { game: place.next.number } : {}
  }
}
