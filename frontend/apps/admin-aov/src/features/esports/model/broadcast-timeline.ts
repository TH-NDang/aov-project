import type { GameContent } from "@aov/community-contracts"
import type { TimelineEvent } from "./timeline"
import { gameToVideo, youtubeLinkTime, youtubeVideoId, type VodSync } from "./vod"

export type BroadcastChapter = { id: string; at: number; label: string }

/** Display copies use video seconds; persisted events continue to use the in-game clock. */
export function videoTimelineEvents(sync: VodSync, events: TimelineEvent[]): TimelineEvent[] {
  if (sync.startSecond === null) return []
  return events.map((event) => ({ ...event, at: gameToVideo(sync, event.at)! }))
}

/** Only chapters with a known position in this video belong on its timeline. */
export function broadcastChapters(
  videoId: string,
  seriesUrl: string | undefined,
  games: { id: string; content: Pick<GameContent, "number" | "sourceUrl" | "sourceTimestampSeconds"> }[],
): BroadcastChapter[] {
  const matching = games.filter(
    ({ content }) => youtubeVideoId(content.sourceUrl) === videoId && content.sourceTimestampSeconds != null,
  )
  const firstGame = matching.find(({ content }) => content.number === 1)
  const matchStart =
    (youtubeVideoId(seriesUrl) === videoId ? youtubeLinkTime(seriesUrl) : null) ??
    firstGame?.content.sourceTimestampSeconds
  const chapters = matching.map(({ id, content }) => ({
    id,
    at: content.sourceTimestampSeconds!,
    label:
      content.number === 1 && content.sourceTimestampSeconds === matchStart
        ? "Bắt đầu trận · Ván 1"
        : `Bắt đầu ván ${content.number}`,
  }))
  if (matchStart != null && matchStart !== firstGame?.content.sourceTimestampSeconds) {
    chapters.push({ id: "match-start", at: matchStart, label: "Bắt đầu trận" })
  }
  return chapters.sort((a, b) => a.at - b.at)
}
