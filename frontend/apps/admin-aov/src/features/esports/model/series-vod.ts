import type { DocumentView, DraftTurn, GameContent, SeriesContent, Side } from "@aov/community-contracts"
import { lastRecorded } from "./game-times"
import { observationMarks, type ObservationMark } from "./observation-marks"
import { readTimeline } from "./timeline-io"
import type { TimelineEvent } from "./timeline"
import { gameToVideo, videoToGame, youtubeVideoId, type VodSync } from "./vod"

/** The ban/pick phase of a game in the video: its start, the lock after hero swaps and the turns in order. */
export type ChapterDraft = { start: number; locked: number | null; turns: DraftTurn[] }

/**
 * One game of the match on the video on screen, in video seconds. `synced` says it has a place there: it points to that
 * video and its 0:00 or its draft start is recorded. A game that is not synced has no position at all: its `from`,
 * `start` and `end` are 0 and nothing reads them. `from` is where the game's band begins (its ban/pick phase when
 * recorded), `start` is the game clock's 0:00 and `end` its last second. `live` is false until the game start is known;
 * `start` is then only an estimate after the draft. `end` is an estimate as well until the game has `ended`.
 */
export type GameChapter = {
  gameId: string
  number: number
  /** The video the game itself points to, whichever video is on screen. */
  videoId: string | null
  from: number
  start: number
  end: number
  duration: number
  synced: boolean
  live: boolean
  /** The length of the game is recorded. */
  ended: boolean
  draft: ChapterDraft | null
  sync: VodSync
  winner: Side | null
  events: TimelineEvent[]
  /** The last game second anything is recorded at; read through `recordedUntil`. */
  recordedTo?: number
  /** Moments the broadcast showed spells, emblems, arcana or equipment, in game seconds; absent where not drawn. */
  marks?: ObservationMark[]
}

/** Video time assumed for a ban/pick phase whose game start is not recorded yet. */
const DRAFT_ESTIMATE = 5 * 60

/** Game length used before the real duration is known: the last moment plus a margin, at least 15 minutes. */
export function gameLength(content: GameContent, events: TimelineEvent[]) {
  return content.durationSeconds ?? Math.max(15 * 60, (events.at(-1)?.at ?? 0) + 60)
}

/** The broadcast shared by the match: the video most games point to, otherwise the series source if it is YouTube. */
export function seriesVideo(series: SeriesContent, games: DocumentView<GameContent>[]) {
  const counts = new Map<string, { url: string; count: number }>()
  for (const game of games) {
    const id = youtubeVideoId(game.content.sourceUrl)
    if (!id) continue
    const entry = counts.get(id) ?? { url: game.content.sourceUrl!, count: 0 }
    entry.count++
    counts.set(id, entry)
  }
  const best = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  if (best) return { videoId: best[0], url: best[1].url }
  const fallback = youtubeVideoId(series.sourceUrl)
  return fallback ? { videoId: fallback, url: series.sourceUrl! } : null
}

export function layoutChapters(games: DocumentView<GameContent>[], videoId: string | null): GameChapter[] {
  return [...games]
    .sort((a, b) => a.content.number - b.content.number)
    .map((entry) => {
      const content = entry.content
      const events = readTimeline(content)
      const duration = gameLength(content, events)
      const pauses = content.timeline?.pauses ?? []
      const ownVideo = youtubeVideoId(content.sourceUrl)
      const sameVideo = !!videoId && ownVideo === videoId
      const live = sameVideo && content.sourceTimestampSeconds != null
      const draftStart = sameVideo ? (content.draft?.startSecond ?? null) : null
      const draft =
        draftStart == null
          ? null
          : { start: draftStart, locked: content.draft?.lockedSecond ?? null, turns: content.draft?.turns ?? [] }
      const synced = live || !!draft
      const start = live
        ? content.sourceTimestampSeconds!
        : draft
          ? Math.max(draft.start + DRAFT_ESTIMATE, draft.locked ?? 0, ...draft.turns.map((turn) => turn.atSecond ?? 0))
          : 0
      const sync: VodSync = { url: content.sourceUrl ?? "", startSecond: synced ? start : null, pauses }
      // A game without its end may show loadouts at any second to come.
      const marks = observationMarks(content, content.durationSeconds ?? Number.MAX_SAFE_INTEGER)
      return {
        gameId: entry.id,
        number: content.number,
        videoId: ownVideo,
        from: draft ? Math.min(draft.start, start) : start,
        start,
        end: gameToVideo(sync, duration) ?? 0,
        duration,
        synced,
        live,
        ended: content.durationSeconds != null,
        draft,
        sync,
        winner: content.winner ?? null,
        events,
        recordedTo: lastRecorded(content),
        marks,
      }
    })
}

/**
 * The game being shown at a video second, if any. A game without its end lasts until that is recorded, at most to the
 * next game: the estimated length must never take a long game away from the editor who is recording it.
 */
export function chapterAt(chapters: GameChapter[], videoSecond: number): GameChapter | null {
  const begun = chapters.filter((chapter) => chapter.synced && chapter.from <= videoSecond)
  const ended = begun.find((chapter) => chapter.ended && videoSecond <= chapter.end)
  if (ended) return ended
  const latest = begun.reduce<GameChapter | null>(
    (last, chapter) => (last && last.from > chapter.from ? last : chapter),
    null,
  )
  return latest && !latest.ended ? latest : null
}

/** A second of the game clock kept inside the game; a game without its end has no last second yet. */
const insideGame = (chapter: GameChapter, gameSecond: number) =>
  Math.max(0, chapter.ended ? Math.min(chapter.duration, gameSecond) : gameSecond)

/** Game clock inside a chapter for a video second. */
export const chapterClock = (chapter: GameChapter, videoSecond: number) =>
  insideGame(chapter, videoToGame(chapter.sync, videoSecond) ?? 0)

/** Video second for a game second inside a chapter. */
export const chapterVideo = (chapter: GameChapter, gameSecond: number) =>
  gameToVideo(chapter.sync, insideGame(chapter, gameSecond)) ?? chapter.start

/** The last game second anything of a chapter is recorded at; a chapter drawn by hand has its moments and marks. */
export const recordedUntil = (chapter: GameChapter) =>
  chapter.recordedTo ??
  Math.max(0, ...chapter.events.map((event) => event.at), ...(chapter.marks ?? []).map((mark) => mark.at))

/** The video second a placed game is known to reach: its end, or the last thing recorded of it. */
export function knownEnd(chapter: GameChapter) {
  if (chapter.live) return chapter.ended ? chapter.end : chapterVideo(chapter, recordedUntil(chapter))
  const draft = chapter.draft
  if (!draft) return chapter.from
  return Math.max(draft.start, draft.locked ?? 0, ...draft.turns.map((turn) => turn.atSecond ?? 0))
}

/** Length of the whole axis: the real video when known, otherwise just past the last game. */
export const axisLength = (chapters: GameChapter[], videoDuration: number | null) =>
  Math.max(
    videoDuration ?? 0,
    600,
    ...chapters.filter((chapter) => chapter.synced).map((chapter) => chapter.end + (videoDuration === null ? 120 : 0)),
  )

/** Video kept before and after the match when the strip is cut to it. */
const STRIP_AIR = 15 * 60
/**
 * A match in a video of its own takes up to about four hours of it, and the videos of a whole day begin at nearly five.
 * A shorter one stays whole, or the strip would end behind the last game recorded so far.
 */
const DAY_VIDEO = 4.5 * 3600

/**
 * The part of the video the strip shows: all of it, or the part around the match when the video holds a whole day and
 * every game of the match has its place in it.
 */
export function stripRange(chapters: GameChapter[], duration: number): { from: number; to: number; cut: boolean } {
  const whole = { from: 0, to: duration, cut: false }
  if (duration < DAY_VIDEO || !chapters.length || !chapters.every((chapter) => chapter.synced)) return whole
  const from = Math.max(0, Math.min(...chapters.map((chapter) => chapter.from)) - STRIP_AIR)
  const to = Math.min(duration, Math.max(...chapters.map((chapter) => chapter.end)) + STRIP_AIR)
  return to > from && to - from < duration / 2 ? { from, to, cut: true } : whole
}

/** Separator between game id and event id in timeline copies shown on the shared video axis. */
const SEP = "|"

/**
 * Copies of the moments on the video axis, of every game whose 0:00 is known. Ids are prefixed with the game so equal
 * event ids from different games stay distinct; `sourceOf` maps a copy back to the stored event.
 */
export function broadcastEvents(chapters: GameChapter[], keep: (event: TimelineEvent) => boolean = () => true) {
  return chapters
    .filter((chapter) => chapter.live)
    .flatMap((chapter) =>
      chapter.events
        .filter(keep)
        .map((event) => ({ ...event, id: `${chapter.gameId}${SEP}${event.id}`, at: chapterVideo(chapter, event.at) })),
    )
}

export function sourceOf(id: string) {
  const index = id.indexOf(SEP)
  return index < 0 ? { gameId: "", id } : { gameId: id.slice(0, index), id: id.slice(index + 1) }
}
