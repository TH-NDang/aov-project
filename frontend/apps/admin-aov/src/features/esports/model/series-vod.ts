import type { DocumentView, DraftTurn, GameContent, SeriesContent, Side } from "@aov/community-contracts"
import { readTimeline } from "./timeline-io"
import type { TimelineEvent } from "./timeline"
import { gameToVideo, videoToGame, youtubeVideoId, type VodSync } from "./vod"

/** The ban/pick phase of a game in the video: its start, the lock after hero swaps and the turns in order. */
export type ChapterDraft = { start: number; locked: number | null; turns: DraftTurn[] }

/**
 * One game placed on the broadcast video of the whole match, in video seconds. `from` is where the game's band
 * begins (its ban/pick phase when recorded), `start` is the game clock's 0:00 and `end` its last second. `live` is
 * false until the game start is known; `start` is then only an estimate after the draft. `synced` is false when the
 * game has no position in this video and was placed after the previous game so the match still reads in order.
 */
export type GameChapter = {
  gameId: string
  number: number
  from: number
  start: number
  end: number
  duration: number
  synced: boolean
  live: boolean
  draft: ChapterDraft | null
  sync: VodSync
  winner: Side | null
  events: TimelineEvent[]
}

/** Video time assumed for a ban/pick phase whose game start is not recorded yet. */
const DRAFT_ESTIMATE = 5 * 60

/** Gap used between unsynced games so they never stack on top of each other. */
const UNSYNCED_GAP = 5 * 60

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
  let cursor = 0
  return [...games]
    .sort((a, b) => a.content.number - b.content.number)
    .map((entry) => {
      const content = entry.content
      const events = readTimeline(content)
      const duration = gameLength(content, events)
      const pauses = content.timeline?.pauses ?? []
      const sameVideo = !!videoId && youtubeVideoId(content.sourceUrl) === videoId
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
          : cursor + (cursor ? UNSYNCED_GAP : 60)
      const sync: VodSync = { url: content.sourceUrl ?? "", startSecond: start, pauses }
      const end = gameToVideo(sync, duration) ?? start + duration
      cursor = Math.max(cursor, end)
      return {
        gameId: entry.id,
        number: content.number,
        from: draft ? Math.min(draft.start, start) : start,
        start,
        end,
        duration,
        synced,
        live,
        draft,
        sync,
        winner: content.winner ?? null,
        events,
      }
    })
}

/** The game being shown at a video second, if any. */
export const chapterAt = (chapters: GameChapter[], videoSecond: number) =>
  chapters.find((chapter) => videoSecond >= chapter.from && videoSecond <= chapter.end) ?? null

/** Game clock inside a chapter for a video second, clamped to the game. */
export function chapterClock(chapter: GameChapter, videoSecond: number) {
  return Math.min(chapter.duration, Math.max(0, videoToGame(chapter.sync, videoSecond) ?? 0))
}

/** Video second for a game second inside a chapter. */
export const chapterVideo = (chapter: GameChapter, gameSecond: number) =>
  gameToVideo(chapter.sync, Math.min(chapter.duration, Math.max(0, gameSecond))) ?? chapter.start

/** Length of the whole axis: the real video when known, otherwise just past the last game. */
export const axisLength = (chapters: GameChapter[], videoDuration: number | null) =>
  Math.max(videoDuration ?? 0, (chapters.at(-1)?.end ?? 0) + 120, 600)

/** Separator between game id and event id in timeline copies shown on the shared video axis. */
const SEP = "|"

/**
 * Copies of every game's moments on the video axis. Ids are prefixed with the game so equal event ids from
 * different games stay distinct; `sourceOf` maps a copy back to the stored event.
 */
export function broadcastEvents(chapters: GameChapter[], keep: (event: TimelineEvent) => boolean = () => true) {
  return chapters.flatMap((chapter) =>
    chapter.events
      .filter(keep)
      .map((event) => ({ ...event, id: `${chapter.gameId}${SEP}${event.id}`, at: chapterVideo(chapter, event.at) })),
  )
}

export function sourceOf(id: string) {
  const index = id.indexOf(SEP)
  return index < 0 ? { gameId: "", id } : { gameId: id.slice(0, index), id: id.slice(index + 1) }
}
