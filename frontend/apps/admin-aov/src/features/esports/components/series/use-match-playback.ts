import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { broadcastChapters } from "../../model/broadcast-timeline"
import { axisLength, chapterAt, layoutChapters, seriesVideo } from "../../model/series-vod"
import { youtubeVideoId } from "../../model/vod"
import { useSavedPlayhead } from "../game/use-saved-playhead"
import type { VodPlayerHandle } from "../game/vod-player"

/** Readings far from a requested seek are ignored this long, while YouTube still reports the old position. */
const SEEK_SETTLE_MS = 2500

/** The match video typed before any game exists; once a game is recorded the games carry it. */
function useDraftVideo(seriesId: string) {
  const key = `esports:match-video:${seriesId}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ""
    } catch {
      return ""
    }
  })
  const update = (next: string) => {
    setValue(next)
    try {
      if (next) localStorage.setItem(key, next)
      else localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable; the link then lasts until the page closes.
    }
  }
  return [value, update] as const
}

/**
 * The broadcast of a match and where it is watched: the one video every game is placed on as a chapter, the playhead
 * on it, the game the page is on and the player. A seek moves the playhead at once; the player's own readings take
 * over once it got there.
 */
export function useMatchPlayback(
  series: { id: string; content: SeriesContent },
  games: DocumentView<GameContent>[],
  /** A shared `?t=` second, or a game asked for by the link, to open on. */
  start: { fromLink: number | null; requestedGame: string | null },
) {
  const [draftLink, setDraftLink] = useDraftVideo(series.id)
  const draftId = youtubeVideoId(draftLink)
  const video = seriesVideo(series.content, games) ?? (draftId ? { videoId: draftId, url: draftLink } : null)
  const videoId = video?.videoId ?? null
  const chapters = useMemo(() => layoutChapters(games, videoId), [games, videoId])
  const flags = videoId ? broadcastChapters(videoId, series.content.sourceUrl, games) : []
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const duration = axisLength(chapters, videoDuration)
  const requested = chapters.find((chapter) => chapter.gameId === start.requestedGame)
  const [savedAt, setPlayhead] = useSavedPlayhead(
    `series:${series.id}`,
    start.fromLink ?? requested?.from ?? null,
    chapters[0]?.from ?? 0,
  )
  const at = Math.min(savedAt, duration)
  // The game the page is on: the one the playhead is in, otherwise the one picked or watched last.
  const here = chapterAt(chapters, at)
  const [lastFocus, setLastFocus] = useState<string | null>(here?.gameId ?? chapters[0]?.gameId ?? null)
  useEffect(() => {
    if (here && here.gameId !== lastFocus) setLastFocus(here.gameId)
  }, [here, lastFocus])
  const focused = here ?? chapters.find((chapter) => chapter.gameId === lastFocus) ?? chapters[0]

  const player = useRef<VodPlayerHandle>(null)
  const seekGuard = useRef<{ video: number; until: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [videoNow, setVideoNow] = useState<number | null>(null)
  const onVideoTime = useCallback(
    (second: number) => {
      setVideoNow(second)
      const guard = seekGuard.current
      if (guard && Date.now() < guard.until) {
        if (Math.abs(second - guard.video) > 2) return
      }
      seekGuard.current = null
      setPlayhead(Math.max(0, second))
    },
    [setPlayhead],
  )
  const seek = useCallback(
    (second: number, play = false) => {
      const target = Math.min(duration, Math.max(0, second))
      setPlayhead(target)
      if (!videoId || !player.current) return
      seekGuard.current = { video: target, until: Date.now() + SEEK_SETTLE_MS }
      player.current.seek(target, play)
    },
    [duration, videoId, setPlayhead],
  )
  const togglePlay = () => (player.current?.currentTime() === null ? seek(at, true) : player.current?.toggle())

  return {
    draftLink,
    setDraftLink,
    video,
    videoId,
    chapters,
    flags,
    duration,
    at,
    setPlayhead,
    here,
    focused,
    setLastFocus,
    setVideoDuration,
    player,
    playing,
    setPlaying,
    videoNow,
    onVideoTime,
    seek,
    togglePlay,
  }
}
