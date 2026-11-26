import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { useAhead } from "../../../components/on-demand"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { enterRoom } from "../../../components/video-place"
import { watch } from "../../../components/watch-session"
import { matchSeriesId, orderedMatchGames, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides, type MatchSide } from "../../../lib/match-schedule"
import { matchGamesQuery } from "../../../lib/tournament-api"
import { seriesTeams } from "../../../lib/tournament-model"
import { useNow } from "../../../lib/use-now"
import { cutsOf } from "../../../lib/watch-cuts"
import { matchBegun, matchOver, recordedScore, roomNext, scoreBefore } from "../../../lib/watch-match"
import { readWatch, targetOf } from "../../../lib/watch-routes"
import { openingOf } from "../../../lib/watch-start"
import type { WatchView } from "../../../lib/watch-store"
import { storyOf } from "../../../lib/watch-story"
import type { Story, WatchLength, WatchMatch, WatchSide, WatchTarget } from "../../../lib/watch-types"
import { roomInside } from "./room-inside"
import type { Match } from "./use-match"
import type { RoomFacts } from "./watch-facts"

type Named = { name: string; shortName: string; logoUrl?: string; logoDarkUrl?: string | null }

const watchSide = (id: string | null, { name, shortName, logoUrl, logoDarkUrl }: Named): WatchSide => ({
  id,
  name,
  shortName,
  logoUrl: logoUrl ?? null,
  logoDarkUrl: logoDarkUrl ?? null,
})

/** Both teams of a match as its games name them, or as its plan does while no game is recorded. */
function teamsOf([game]: PublishedGame[], entry: CompetitionMatch | undefined, locale: string) {
  if (game) {
    const [a, b] = seriesTeams(game, locale)
    return { A: watchSide(a.teamId, a), B: watchSide(b.teamId, b) }
  }
  if (!entry) return null
  const [a, b] = matchSides(entry, locale)
  const named = (side: MatchSide) => watchSide(side.teamId, { ...side, name: side.fullName, shortName: side.name })
  return { A: named(a), B: named(b) }
}

/** Whether the last game of a match is on, or has ended. */
function nearsEnd({ place }: WatchView, { chapters }: Story) {
  const chapter = place?.chapter ?? place?.next
  return !!chapter && chapter.index === chapters.length - 1
}

/**
 * The match as it can be watched, and what its room says of it. `film` is null while its games load, and for a match
 * that has no video or has not begun; `address` is the place in it that the address of the page names.
 */
export function useMatchWatch(match: Match, { up, mvp }: Pick<RoomFacts, "up" | "mvp">) {
  const { languageTag } = useStreamLocale()
  const { pathname, search } = useLocation()
  const now = useNow()
  const { entry, live, beside, series, games, list, linkedSeriesId, head } = match
  const source = series?.sourceUrl
  const watchable = !!games.data && matchBegun(entry, list, now)
  const finished = matchOver(entry, series)
  const story = useMemo(() => storyOf(list, source), [list, source])
  const cuts = useMemo(() => cutsOf(story), [story])
  const teams = useMemo(() => teamsOf(list, entry, languageTag), [list, entry, languageTag])
  const score = head && recordedScore(head.teams, teams?.A.id)
  const { A, B } = scoreBefore(story, score)
  const before = useMemo(() => ({ A, B }), [A, B])
  const film = useMemo<WatchMatch | null>(
    () =>
      linkedSeriesId && watchable && teams && story.level !== "NONE"
        ? { seriesId: linkedSeriesId, href: pathname, teams, story, cuts, before, live, finished }
        : null,
    [linkedSeriesId, watchable, pathname, teams, story, cuts, before, live, finished],
  )
  // Before anything is drawn, as the room reads this match beside the place of the one the player has.
  useLayoutEffect(() => {
    if (film) watch.update(film)
  }, [film])

  const after = beside?.after
  const afterId = after ? matchSeriesId(after) : undefined
  const ending = useWatch((view) => !!film && view.match?.seriesId === film.seriesId && nearsEnd(view, story))
  const ahead = useQuery({ ...matchGamesQuery(afterId), enabled: !!afterId && ending })
  const nextWatchable = useMemo(() => {
    if (!after || !afterId || !ahead.data) return false
    const list = orderedMatchGames(ahead.data, afterId)
    const link = after.competition.content.series[afterId]?.sourceUrl
    return matchBegun(after, list, now) && storyOf(list, link).level !== "NONE"
  }, [after, afterId, ahead.data, now])

  const played = live || !!head?.teams.every((team) => team.score != null)
  const address = useMemo(() => film && targetOf(film, readWatch(search), watch.kept()), [film, search])
  const facts: RoomFacts | null = head && {
    up,
    round: head.round,
    bestOf: head.bestOf,
    score,
    mvp,
    next: entry && after ? roomNext(entry, after, nextWatchable, languageTag) : null,
  }
  return { film, waiting: !!linkedSeriesId && games.isPending && played, facts, address }
}

/** What a link that leads to the page of a match asks of it. */
type Asked = { play?: boolean; length?: WatchLength; room?: boolean }

/** Plays a match whose page was opened to be watched. */
function play(film: WatchMatch, address: WatchTarget | null, asked: WatchLength | undefined) {
  const stop = watch.remembered(film.seriesId)
  const opening = openingOf(film, { view: watch.view(), stop, address, asked, kept: watch.kept() })
  if (opening) watch.open(film, opening.target, opening.length)
}

/** Whether the reader has come back to this page, which then stands as they left it. */
const returning = () => document.documentElement.hasAttribute("data-returning")

/** Brings the head of the match back into view after its room, and the focus to what it offers. */
function leaveRoom(shrunk: boolean) {
  const foot = document.querySelector("[data-place-head]")?.getBoundingClientRect().bottom ?? 0
  // Ended from the small player, the page stays where it is being read.
  if (foot >= 0) window.scrollTo(0, 0)
  const action = shrunk ? document.querySelector<HTMLElement>(".tn-start-main") : null
  const target = action ?? document.getElementById("main")
  target?.focus({ preventScroll: true })
}

/** A page that was left in its room comes back to where the room began, which cuts the top of its head. */
function showHead() {
  // What bleeds over the margins of the page stands higher than the box it is in.
  const top = document.querySelector("[data-place-head] > *")?.getBoundingClientRect().top
  if (top != null && Math.abs(top) < 2) window.scrollTo(0, 0)
}

/**
 * Whether the room of a match stands in place of its head, and what goes with that: a link that was pressed to watch
 * opens it, the window and the focus go to it and come back, and the address then names no place any more.
 */
export function useRoom(film: WatchMatch | null, address: WatchTarget | null) {
  const { pathname, search, hash, state } = useLocation()
  const navigate = useNavigate()
  const seriesId = film?.seriesId
  const shrunk = useWatch((view) => view.shrunk)
  const room = useWatch((view) => !!seriesId && view.match?.seriesId === seriesId && !view.shrunk)

  const toPlainAddress = () => {
    const query = new URLSearchParams(search)
    for (const key of ["game", "at", "second"]) query.delete(key)
    void navigate({ pathname, search: query.toString(), hash }, { replace: true })
  }

  const asked = state as Asked | null
  // A page that opens its room by itself asks for the inside of it before it knows its video.
  useEffect(() => {
    if (asked?.play || asked?.room) roomInside.ask()
  }, [asked])
  useAhead(roomInside, !!film)
  const answered = useRef<Asked | null>(null)
  const answer = useEffectEvent((to: Asked) => {
    if (!film || answered.current === to) return
    answered.current = to
    if (to.room) watch.expand()
    // Without a press on this visit a browser would not let the video sound, so the head offers it instead.
    else if (to.play && (navigator.userActivation?.hasBeenActive ?? true)) play(film, address, to.length)
    else return
    toPlainAddress()
  })
  useEffect(() => {
    if (seriesId && asked) answer(asked)
  }, [seriesId, asked])

  const was = useRef<{ seriesId: string; room: boolean } | null>(null)
  const turn = useEffectEvent((id: string, now: boolean) => {
    const before = was.current?.seriesId === id ? was.current.room : null
    was.current = { seriesId: id, room: now }
    if (now && (before === false || (before === null && !returning()))) enterRoom()
    if (!now && before) leaveRoom(shrunk)
  })
  useEffect(() => {
    if (seriesId) turn(seriesId, room)
  }, [seriesId, room])

  const arrive = useEffectEvent(() => {
    if (!room) showHead()
  })
  useEffect(() => {
    if (!seriesId) return
    // The page grows back to where it was left within the next frame.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(arrive)
    })
    return () => cancelAnimationFrame(frame)
  }, [seriesId])

  // A video that could not be played is let go of with its page, as there is nothing to go on with elsewhere.
  useEffect(
    () => () => {
      if (watch.view().failure) watch.close()
    },
    [seriesId],
  )

  return {
    room,
    onOpened: () => {
      if (readWatch(search)) toPlainAddress()
    },
  }
}
