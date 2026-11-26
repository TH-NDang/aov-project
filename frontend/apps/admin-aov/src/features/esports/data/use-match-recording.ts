import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { DocumentView, GameContent, Reference, Selection, SeriesContent } from "@aov/community-contracts"
import type { MatchPlayerHandle, VideoProblem } from "../components/game/match-video"
import { useMatchPlayhead, usePlayheadValue } from "../components/game/use-playhead"
import { broadcastChapters } from "../model/broadcast-timeline"
import { buildGameView, referenceIndex } from "../model/game-view"
import { isMajorMoment, itemLookups } from "../model/item-lookups"
import { recordingProgress } from "../model/recording-progress"
import {
  axisLength,
  broadcastEvents,
  chapterAt,
  layoutChapters,
  seriesVideo,
  type GameChapter,
} from "../model/series-vod"
import { timingIssues } from "../model/timing-issues"
import { youtubeLinkTime, youtubeVideoId } from "../model/vod"
import { useGameCatalog, useGamePatches } from "./use-esports-data"

/**
 * Readings far from a requested seek that are ignored, while YouTube still reports the old position. They are counted,
 * not timed: a busy browser reads nothing for seconds, and the first reading after that is still an old one.
 */
const SEEK_SETTLE_READINGS = 10
/** As long as the reading stands still the seek is still loading, on a slow line for longer than that. */
const SEEK_LOADING_READINGS = 48
/** A reading further from the playhead than this is a player that was never started and reports zero. */
const READING_SLACK = 5
/** A video that grows by more than this while it is open is a live stream. */
const LIVE_GROWTH = 3
/** While a video has no known length its axis grows by this much, so the playhead never runs past the end of it. */
const REACH_STEP = 600

/** What is on the desk: a recorded game, or the number of one nobody recorded yet. */
type Chosen = { game: string } | { missing: number }

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

const ownVideo = (entry: DocumentView<GameContent> | undefined) => youtubeVideoId(entry?.content.sourceUrl)
const firstPlaced = (chapters: GameChapter[]) =>
  chapters.filter((chapter) => chapter.synced).sort((a, b) => a.from - b.from)[0]
/** The game a second belongs to, or the one before it where it lies between two. */
const lastBegun = (chapters: GameChapter[], second: number) =>
  chapters
    .filter((chapter) => chapter.synced && chapter.from <= second)
    .sort((a, b) => a.from - b.from)
    .at(-1)

/**
 * The video of a match while it is watched or recorded: which one is on screen, where its games are, where the video
 * stands and which game that makes the one on the desk. `held` tells whether that game stays while something of it is
 * being typed or moved.
 */
export function useMatchRecording({
  series,
  games,
  requestedGame,
  fromLink,
  editable,
  held,
}: {
  series: DocumentView<SeriesContent>
  games: DocumentView<GameContent>[]
  requestedGame: string | null
  fromLink: number | null
  editable: boolean
  held: (gameId: string | null) => boolean
}) {
  const [draftLink, setDraftLink] = useDraftVideo(series.id)
  const main = useMemo(() => {
    const draftId = youtubeVideoId(draftLink)
    return seriesVideo(series.content, games) ?? (draftId ? { videoId: draftId, url: draftLink } : null)
  }, [series.content, games, draftLink])

  const requested = games.find((entry) => entry.id === requestedGame)
  // The match opens on the video of the game it opens with: the one asked for, else, where the video of the match places
  // no game, its first game, which may have a video of its own.
  const [wanted, setWanted] = useState<string | null>(() => {
    const mainId = main?.videoId ?? null
    const placed = layoutChapters(games, mainId).some((chapter) => chapter.synced)
    return ownVideo(requested ?? (placed || fromLink !== null ? undefined : games[0])) ?? mainId
  })
  const video = useMemo(() => {
    // A video no game points to any more gives way to the one of the match.
    const carrier = wanted ? games.find((entry) => ownVideo(entry) === wanted) : undefined
    return carrier ? { videoId: wanted!, url: carrier.content.sourceUrl! } : main
  }, [wanted, games, main])
  const videoId = video?.videoId ?? null
  const chapters = useMemo(() => layoutChapters(games, videoId), [games, videoId])
  const flags = useMemo(
    () => (videoId ? broadcastChapters(videoId, series.content.sourceUrl, games) : []),
    [videoId, series.content.sourceUrl, games],
  )

  const [lengths, setLengths] = useState<Record<string, { first: number; last: number }>>({})
  const length = videoId ? (lengths[videoId] ?? null) : null
  const videoDuration = length?.last ?? null
  const live = !!length && length.last - length.first > LIVE_GROWTH

  const requestedPlace = chapters.find((chapter) => chapter.gameId === requestedGame && chapter.synced)
  const playhead = useMatchPlayhead(
    series.id,
    videoId,
    main?.videoId ?? null,
    fromLink ?? requestedPlace?.from ?? null,
    firstPlaced(chapters)?.from ?? 0,
  )
  // Until the player tells the length of its video, or for ever where it may not play it here, the axis reaches past
  // the playhead: wherever the video was sent stays on the strip and the track.
  const reach = usePlayheadValue(playhead, (second) =>
    videoDuration === null ? Math.ceil((second + 1) / REACH_STEP) * REACH_STEP : 0,
  )
  const duration = Math.max(axisLength(chapters, videoDuration), reach)

  const here = usePlayheadValue(playhead, (second) => chapterAt(chapters, second)?.gameId ?? null)
  const [chosen, setChosen] = useState<Chosen | null>(() => {
    const asked = fromLink === null ? (requested?.id ?? here) : (here ?? requested?.id)
    const opening =
      asked ?? lastBegun(chapters, playhead.get())?.gameId ?? firstPlaced(chapters)?.gameId ?? chapters[0]?.gameId
    return opening ? { game: opening } : null
  })
  // The game follows the video only when the video enters another one, so a game without a place can stay chosen.
  const followed = useRef(here)

  // A number somebody recorded meanwhile is a game now, and only an editor who records has one to record.
  const missing =
    editable && chosen && "missing" in chosen && !chapters.some((chapter) => chapter.number === chosen.missing)
      ? chosen.missing
      : null
  const focused = (() => {
    if (missing !== null) return null
    const named =
      chosen && "missing" in chosen
        ? chapters.find((chapter) => chapter.number === chosen.missing)
        : chapters.find((chapter) => chapter.gameId === chosen?.game)
    return named ?? firstPlaced(chapters) ?? chapters[0] ?? null
  })()
  const entry = games.find((candidate) => candidate.id === focused?.gameId) ?? null
  const holding = held(focused?.gameId ?? null)
  useEffect(() => {
    if (holding || followed.current === here) return
    followed.current = here
    if (here) setChosen({ game: here })
  }, [here, holding])

  const player = useRef<MatchPlayerHandle>(null)
  /** A seek that was asked for and not yet confirmed by a reading near it. */
  const guard = useRef<{ second: number; readings: number; reading: number | null } | null>(null)
  const expect = (second: number) => {
    guard.current = { second, readings: 0, reading: null }
  }
  const [playing, setPlaying] = useState(false)
  const [trouble, setTrouble] = useState<{ videoId: string | null; problem: VideoProblem } | null>(null)
  const problem = trouble && trouble.videoId === videoId ? trouble.problem : null

  const onTime = useCallback(
    (second: number) => {
      const wait = guard.current
      if (wait && Math.abs(second - wait.second) > 2) {
        const still = wait.reading !== null && Math.abs(second - wait.reading) < 0.1
        wait.reading = second
        if (++wait.readings <= (still ? SEEK_LOADING_READINGS : SEEK_SETTLE_READINGS)) return
      }
      guard.current = null
      playhead.set(Math.max(0, second))
    },
    [playhead],
  )
  const onDuration = useCallback(
    (seconds: number) => {
      if (!videoId) return
      setLengths((current) => ({ ...current, [videoId]: { first: current[videoId]?.first ?? seconds, last: seconds } }))
    },
    [videoId],
  )
  const onProblem = useCallback(
    (next: VideoProblem | null) => setTrouble(next ? { videoId, problem: next } : null),
    [videoId],
  )
  const seek = useCallback(
    (second: number, play = false) => {
      // Only a length the player told ends the video; before that every second typed, stepped or dragged to is taken.
      const target = Math.max(0, videoDuration === null ? second : Math.min(videoDuration, second))
      playhead.set(target)
      if (!videoId || !player.current) return
      expect(target)
      player.current.seek(target, play)
    },
    [videoDuration, videoId, playhead],
  )
  const toggle = useCallback(() => {
    if (player.current?.currentTime() == null) seek(playhead.get(), true)
    else player.current.toggle()
  }, [seek, playhead])
  /** The second a mark takes now: read from the player when it can tell, else where the playhead stands. */
  const markNow = useCallback(() => {
    if (!videoId) return null
    const shown = playhead.get()
    const reading = guard.current ? null : (player.current?.currentTime() ?? null)
    return Math.floor(reading !== null && Math.abs(reading - shown) < READING_SLACK ? reading : shown)
  }, [videoId, playhead])

  /** Puts another video into the same player, at a second of it. */
  const switchVideo = (next: string, second: number) => {
    expect(second)
    // In one step: a second of one video must never be read on the games of the other.
    flushSync(() => {
      setWanted(next)
      playhead.set(second)
    })
  }
  /**
   * The game a second of the video belongs to is the one followed there: the desk goes on following the video from
   * there, so landing where the desk sent it, or where a mark of its game was dropped, chooses no other game.
   */
  const keepGame = (second: number, on: GameChapter[] = chapters) => {
    followed.current = chapterAt(on, second)?.gameId ?? null
  }
  /** Chooses a game; true when it was the one on the desk already and the video is in it. */
  const chooseGame = (gameId: string) => {
    const game = games.find((candidate) => candidate.id === gameId)
    if (!game) return false
    if (focused?.gameId === gameId && here === gameId) return true
    setChosen({ game: gameId })
    const own = ownVideo(game)
    if (own && own !== videoId) {
      const [place] = layoutChapters([game], own)
      const second = place?.synced ? place.from : (youtubeLinkTime(game.content.sourceUrl) ?? 0)
      keepGame(second, layoutChapters(games, own))
      switchVideo(own, second)
      return false
    }
    const chapter = chapters.find((candidate) => candidate.gameId === gameId)
    if (chapter?.synced) {
      // Where two games overlap, the start of one lies inside the other.
      keepGame(chapter.from)
      seek(chapter.from)
    }
    return false
  }

  // A game made without a video has no position of its own, so it is brought forward once it is listed.
  const [awaited, setAwaited] = useState<string | null>(null)
  const bringForward = useEffectEvent((gameId: string) => {
    if (!games.some((candidate) => candidate.id === gameId)) return
    setChosen({ game: gameId })
    setAwaited(null)
  })
  useEffect(() => {
    if (awaited) bringForward(awaited)
  }, [awaited, games])

  return {
    video,
    videoId,
    chapters,
    flags,
    videoDuration,
    duration,
    live,
    playhead,
    focused,
    entry,
    missing,
    player,
    playing,
    problem,
    startAt: playhead.get(),
    onTime,
    onDuration,
    onProblem,
    onPlaying: setPlaying,
    seek,
    toggle,
    markNow,
    chooseGame,
    chooseMissing: (number: number) => setChosen({ missing: number }),
    keepGame: (second: number) => keepGame(second),
    switchVideo,
    awaitGame: setAwaited,
    setDraftLink,
  }
}

export type MatchRecording = ReturnType<typeof useMatchRecording>

/** The catalog's items until it loads; one array, so the lookups built from it are not rebuilt on every render. */
const NO_ITEMS: Reference[] = []

/** What the desk reads of every game: its teams and line-ups in the catalog it was played in, and how far it is. */
export function useMatchViews({
  tournamentId,
  games,
  teams,
  players,
  recording,
}: {
  tournamentId: string
  games: DocumentView<GameContent>[]
  teams: Parameters<typeof buildGameView>[1]
  players: Parameters<typeof buildGameView>[2]
  recording: MatchRecording
}) {
  const { chapters, entry, videoDuration } = recording
  const patches = useGamePatches(tournamentId)
  // The faces on the timeline come from a catalog too while the number of a new game is on the desk.
  const shown = entry ?? games.at(-1)
  const catalog = useGameCatalog(shown?.content, patches.data?.get(shown?.id ?? ""))
  const items = catalog.data?.items ?? NO_ITEMS
  const lookups = useMemo(() => itemLookups(items), [items])
  const views = useMemo(
    () => Object.fromEntries(games.map((game) => [game.id, buildGameView(game, teams, players, catalog.data)])),
    [games, teams, players, catalog.data],
  )
  const events = useMemo(() => broadcastEvents(chapters, isMajorMoment(lookups)), [chapters, lookups])
  const heroIcon = useMemo(() => {
    const icons = referenceIndex(catalog.data?.heroes)
    return (hero: Selection) => icons(hero)?.iconUrl
  }, [catalog.data?.heroes])
  const progressOf = useMemo(() => Object.fromEntries(games.map((game) => [game.id, recordingProgress(game)])), [games])
  const issues = useMemo(() => timingIssues(chapters, videoDuration), [chapters, videoDuration])
  return {
    catalog: catalog.data,
    catalogError: catalog.isLoadingError ? catalog.error : undefined,
    reloadCatalog: () => void catalog.refetch(),
    items,
    lookups,
    views,
    events,
    heroIcon,
    progressOf,
    issues,
  }
}
