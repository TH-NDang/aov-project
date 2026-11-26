import type { YouTubeFailure, YouTubePlayer, YouTubeState } from "@aov/ui/lib/youtube-player"
import { nextPiece } from "./watch-cuts.ts"
import { countAt, firstOf, played, startOf, stepOf, stopFrom, stopsOf } from "./watch-follow.ts"
import { BEGUN, readMemory, remember, stopIn, type WatchMemory, type WatchStop } from "./watch-memory.ts"
import { placeAt, toStory } from "./watch-place.ts"
import { lastOf, leadIn, WATCH } from "./watch-story.ts"
import type { Chapter, KeptLength, Place, WatchCount, WatchLength, WatchMatch, WatchTarget } from "./watch-types.ts"

export type WatchFailure = YouTubeFailure
export type WatchPlayerState = "CLOSED" | YouTubeState
export type WatchPanel = "LENGTH" | "KEYS"
export type WatchView = {
  /** The match whose video is open; null while none is. A failure leaves it open with the player CLOSED. */
  match: WatchMatch | null
  length: WatchLength
  video: string | null
  /** Whole second of the video. */
  second: number
  player: WatchPlayerState
  failure: WatchFailure | null
  tapNeeded: boolean
  /** Null without a clock and without link seconds. */
  place: Place | null
  count: WatchCount | null
  reached: number
  done: boolean
  shrunk: boolean
  /** Index of the chapter whose line-ups stand in the companion while there is no place. */
  chosen: number
  panel: WatchPanel | null
  keys: boolean
}
export type Watch = {
  view(): WatchView
  subscribe(listener: () => void): () => void
  /** Every reading of the time, four a second, for what moves without a render. */
  onTime(listener: (second: number) => void): () => void
  remembered(seriesId: string): WatchStop | null
  /** The length chosen last that is not quick. */
  kept(): KeptLength
  /** The element the frame is made in. */
  attach(host: HTMLElement): void
  open(match: WatchMatch, target: WatchTarget, length: WatchLength): void
  update(match: WatchMatch): void
  go(target: WatchTarget): void
  step(way: 1 | -1): void
  game(way: 1 | -1): void
  skip(): void
  stay(): void
  setLength(length: WatchLength): void
  toggle(): void
  seekBy(seconds: number): void
  mute(): void
  choose(index: number): void
  show(panel: WatchPanel | null): void
  setKeys(on: boolean): void
  shrink(): void
  expand(): void
  pause(): void
  close(): void
  retry(): void
  keep(): void
  focus(): void
}
export type WatchPorts = {
  open(
    host: HTMLElement,
    options: {
      match: WatchMatch
      video: string
      second: number
      onState(state: YouTubeState): void
      onFailure(failure: WatchFailure): void
      onAutoplayBlocked(): void
    },
  ): YouTubePlayer
  read(): string | null
  write(text: string): void
  every(milliseconds: number, run: () => void): () => void
  now(): number
}

/**
 * A seek shows its target until the video has come near it, or has run so many readings elsewhere: a hand on YouTube's
 * own bar. An advertisement runs from its own 0 in the meantime.
 */
export const AIM = { back: 8, ahead: 5, readings: 8, advert: 90 } as const

const READING = 250
/** Seconds of play after which a place counts as seen, and after which it is written down. */
const SEEN = 3
const WRITE = 5
/** Milliseconds a player that is ready may take to start. */
const SLOW = 4000
/** Seconds from the start of a game within which going back means the game before it. */
const JUST_BEGUN = 10
/** Seconds the time of the player may fall back by itself: YouTube's API guesses on from the last one it was told. */
const GUESSED = 1

export const CLOSED: WatchView = {
  match: null,
  length: "whole",
  video: null,
  second: 0,
  player: "CLOSED",
  failure: null,
  tapNeeded: false,
  place: null,
  count: null,
  reached: 0,
  done: false,
  shrunk: false,
  chosen: 0,
  panel: null,
  keys: true,
}

/** Two places that read alike are one, so what is drawn from a place changes at most once a second. */
const samePlace = (a: Place | null, b: Place | null) =>
  !!a &&
  !!b &&
  a.state === b.state &&
  a.chapter === b.chapter &&
  a.next === b.next &&
  a.over === b.over &&
  Math.floor(a.clock ?? -1) === Math.floor(b.clock ?? -1) &&
  Math.ceil(a.left ?? -1) === Math.ceil(b.left ?? -1)
const sameCount = (a: WatchCount | null, b: WatchCount | null) =>
  !!a && !!b && a.seconds === b.seconds && a.until === b.until

/** Whether a second of the video says where the match is; a stream that is on now does not count as its recording. */
const hasPlaces = ({ story, live }: WatchMatch) => story.level === "TIMED" || (story.level === "LINKED" && !live)

/** Whether a match is joined where it is now: a stream that is on has no second to begin at. */
const joinsLive = (match: WatchMatch, second: number) => match.live && !hasPlaces(match) && second === 0

/** The chapter a target leads into: the one it names, or that of its place. */
function chapterAt(match: WatchMatch, { video, second, game }: WatchTarget) {
  const { chapters } = match.story
  const named = game == null ? -1 : chapters.findIndex(({ number }) => number === game)
  if (named >= 0) return named
  const place = hasPlaces(match) ? placeAt(match.story, video, second) : null
  const own = place?.chapter ?? place?.next ?? chapters.find((chapter) => chapter.video === video)
  return own?.index ?? 0
}

/** The one video of the app: which match is open, where it stands, and what it does by itself. */
export function createWatch(ports: WatchPorts): Watch {
  /** The text of the storage that `memory` goes on from. */
  let known = ports.read()
  let memory = readMemory(known)
  let view: WatchView = { ...CLOSED, length: memory.length, keys: memory.keys }
  const listeners = new Set<() => void>()
  const timers = new Set<(second: number) => void>()

  let host: HTMLElement | null = null
  let player: YouTubePlayer | null = null
  /** Counts the players made, so that a late word of an earlier one is not heard. */
  let made = 0
  let stopTimer: (() => void) | null = null
  let readyAt = Infinity
  /** What was asked for before there was an element to make the frame in. */
  let asked: (() => void) | null = null

  /** The exact second shown, the last reading since a seek, and where a seek goes until the video is there. */
  let now = 0
  let last: number | null = null
  let aim: { second: number; readings: number; last: number | null } | null = null
  /** The last second the player has answered, wherever it was sent since. */
  let answered: number | null = null
  /** Seconds played without a jump, and those of them nobody has written down. */
  let run = 0
  let unwritten = 0
  /** The end of the piece the viewer chose to watch past. */
  let stay: number | null = null
  /** Whether the match has been played to its end and nobody has gone back since. */
  let ended = false

  let changing = 0
  let changed = false

  /** Runs a change as one: listeners hear of it once, when it is whole. */
  function together(change: () => void) {
    changing += 1
    try {
      change()
    } finally {
      changing -= 1
      if (!changing && changed) {
        changed = false
        for (const listener of listeners) listener()
      }
    }
  }
  const command =
    <Args extends unknown[]>(change: (...args: Args) => void) =>
    (...args: Args) =>
      together(() => change(...args))

  function set(patch: Partial<WatchView>) {
    const next = { ...view, ...patch }
    if (samePlace(view.place, next.place)) next.place = view.place
    if (sameCount(view.count, next.count)) next.count = view.count
    if ((Object.keys(next) as (keyof WatchView)[]).every((key) => next[key] === view[key])) return
    view = next
    changed = true
  }

  const cut = () => (view.match && view.length !== "all" ? view.match.cuts[view.length] : null)

  /** What is remembered, which another tab may have written since. */
  function recall() {
    const text = ports.read()
    if (text && text !== known) {
      known = text
      memory = readMemory(text)
    }
    return memory
  }

  function save(next: WatchMemory) {
    memory = next
    ports.write(JSON.stringify(memory))
    // A storage that takes nothing keeps its text, and what this tab remembers is then not read over.
    known = ports.read()
  }

  function keep() {
    const { match, video, second, length, reached } = view
    if (!match || !video || view.player === "CLOSED") return
    // What is on now has no place to come back to.
    if (match.live && !hasPlaces(match)) return
    save(remember(recall(), match.seriesId, { video, second, length, reached, done: ended }))
    unwritten = 0
  }

  function end() {
    ended = true
    set({ done: true })
  }

  /** Another place by a press or a hand: what was played until here does not lead there. */
  function jump() {
    run = 0
    stay = null
    ended = false
  }

  /** Shows a second of the video; `moved` are the seconds it has played to come there. */
  function showSecond(second: number, moved = 0) {
    const { match, video, length } = view
    if (!match || !video) return
    const place = hasPlaces(match) ? placeAt(match.story, video, second) : null
    let { reached } = view
    now = second
    run += moved
    const seen = moved > 0 && run >= SEEN
    const over = seen && !ended && place?.state === "AFTER"
    if (seen) {
      // Without places it only says that the match was begun: its games may be timed later, and it counts their story.
      const at = !place
        ? Math.min(second, BEGUN)
        : place.state === "UNKNOWN"
          ? 0
          : toStory(match.story, video, second).at
      reached = Math.max(reached, Math.floor(at))
    }
    if (over) end()
    const count = view.failure ? null : countAt(cut(), length, video, second, player?.rate() || 1, stay)
    set({ second: Math.floor(second), place, count, reached })
    for (const listener of timers) listener(second)
    unwritten += moved
    if (over || unwritten >= WRITE) keep()
  }

  /** Whether the video is where it was sent, or where a hand has taken it instead. */
  function arrived(second: number, rate: number) {
    if (!aim) return true
    const { last: before } = aim
    const runs = before != null && played(before, second, rate)
    // For a moment the player answers on from before the seek, which is near the aim when the seek was a short one.
    const still = (runs || second === before) && second - before! < Math.abs(second - aim.second)
    const near = !still && second >= aim.second - AIM.back && second <= aim.second + AIM.ahead
    const advert = second < AIM.advert && aim.second > AIM.advert + AIM.ahead
    const elsewhere = !near && !advert && runs
    aim.readings = elsewhere ? aim.readings + 1 : 0
    aim.last = second
    if (!near && aim.readings < AIM.readings) return false
    aim = null
    return true
  }

  function tick() {
    if (!player || !view.match || !view.video) return
    if (view.player === "OPENING" && !view.tapNeeded && ports.now() - readyAt > SLOW) set({ tapNeeded: true })
    const second = player.time()
    if (second == null || !Number.isFinite(second)) return
    const rate = player.rate() || 1
    answered = second
    if (!arrived(second, rate)) return
    const before = last
    last = second
    if (before == null) return showSecond(second)
    if (!played(before, second, rate)) {
      if (second > before || before - second > GUESSED) jump()
      return showSecond(second)
    }
    const step = stepOf(cut(), view.length, view.video, before, second, rate, stay)
    showSecond(second, second - before)
    if (step?.kind === "GO") to(step)
    if (step?.kind === "PAUSE") {
      player.pause()
      end()
      keep()
    }
  }

  /** Goes to a place of the open match; without `play` the video stays as it is, playing or not. */
  function to(target: WatchTarget, play = true) {
    if (!player || !view.match) return
    const { video, second } = target
    // It is loaded, as a seek would lead to its beginning and one that was paused would play on behind it.
    const joins = play && joinsLive(view.match, second)
    jump()
    last = null
    aim = joins ? null : { second, readings: 0, last: answered }
    if (target.game != null || video !== view.video) set({ chosen: chapterAt(view.match, target) })
    if (video === view.video && !joins) player.seek(second)
    else {
      player.load(video, second)
      readyAt = ports.now()
      set({ video, player: "OPENING" })
    }
    if (play) player.play()
    showSecond(second)
  }

  /** A video may end before the last piece of its game does; the next game then has a video of its own. */
  function goOnAfterEnd({ story }: WatchMatch) {
    const pieces = cut()?.pieces ?? []
    const piece = lastOf(pieces, ({ video, from }) => video === view.video && from <= now)
    const next = piece && pieces[pieces.indexOf(piece) + 1]
    const final = lastOf(story.chapters, ({ video }) => !!video)?.video ?? view.video
    if (piece && next && next.video !== view.video && !piece.hold && piece.to !== stay)
      to({ video: next.video, second: next.from })
    else if (view.video === final) end()
  }

  function onState(state: YouTubeState) {
    // The time a player may take to start is counted from where it is ready, not from a slow script.
    if (state === "OPENING") readyAt = ports.now()
    set(state === "PLAYING" ? { player: state, tapNeeded: false } : { player: state })
    if (state === "PAUSED") keep()
    if (state !== "ENDED") return
    // An end without having come near the aim: an address named a second the video does not have.
    if (aim) aim = null
    else if (view.match) goOnAfterEnd(view.match)
    keep()
  }

  function discard() {
    made += 1
    player?.destroy()
    player = null
    stopTimer?.()
    stopTimer = null
    readyAt = Infinity
    aim = null
    last = null
    answered = null
    jump()
  }

  /** The room then shows the game the video stood in, or the one that a break was to lead to. */
  function onFailure(failure: WatchFailure) {
    const { place, chosen } = view
    const coming = place?.state === "BREAK" ? place.next : null
    const game = coming ?? place?.chapter ?? place?.next
    discard()
    set({ failure, player: "CLOSED", tapNeeded: false, count: null, chosen: game?.index ?? chosen })
  }

  function start(match: WatchMatch, { video, second }: WatchTarget, into: HTMLElement) {
    discard()
    const own = made
    const heard = <Args extends unknown[]>(hear: (...args: Args) => void) =>
      command((...args: Args) => {
        if (own === made) hear(...args)
      })
    aim = joinsLive(match, second) ? null : { second, readings: 0, last: null }
    const opened = ports.open(into, {
      match,
      video,
      second,
      onState: heard(onState),
      onFailure: heard(onFailure),
      onAutoplayBlocked: heard(() => set({ tapNeeded: true })),
    })
    if (own !== made) return opened.destroy()
    player = opened
    stopTimer = ports.every(READING, command(tick))
  }

  function open(match: WatchMatch, target: WatchTarget, length: WatchLength) {
    if (!host) {
      asked = () => open(match, target, length)
      return
    }
    const same = view.match?.seriesId === match.seriesId
    const stop = stopIn(recall(), match.seriesId)
    if (!same) {
      keep()
      unwritten = 0
    }
    set({
      match,
      length,
      failure: null,
      tapNeeded: false,
      reached: same ? view.reached : (stop?.reached ?? 0),
      done: same ? view.done : (stop?.done ?? false),
      shrunk: false,
      chosen: chapterAt(match, target),
      panel: null,
    })
    if (player) return to(target)
    set({ player: "OPENING", video: target.video })
    showSecond(target.second)
    start(match, target, host)
  }

  function close() {
    keep()
    discard()
    asked = null
    now = 0
    const { length, keys } = recall()
    set({ ...CLOSED, length, keys })
  }

  function update(match: WatchMatch) {
    if (view.match?.seriesId !== match.seriesId || view.match === match) return
    set({ match })
    showSecond(now)
  }

  function step(way: 1 | -1) {
    const { match, video, length, second } = view
    if (!match || !video) return
    const stop = stopFrom(stopsOf(match.story, match.cuts, length), match.story, video, second, way)
    if (stop) to({ video: stop.video, second: stop.second })
  }

  /** Back goes to the start of the game first, and to the one before it only from just after that. */
  function game(way: 1 | -1) {
    const { match, place, length } = view
    if (!match) return
    if (!place || place.state === "UNKNOWN") return choose(view.chosen + way)
    const starts = match.story.chapters.flatMap((chapter) => {
      const { index, video } = chapter
      const second = startOf(chapter, match.cuts, length)
      return video && second != null ? [{ index, video, second }] : []
    })
    const here = place.chapter?.index ?? (place.next?.index ?? 0) - 1
    const own = starts.find(({ index }) => index === here)
    // Games without a time that stand in one stretch of the video begin together.
    const elsewhere = starts.filter(({ video, second }) => video !== own?.video || second !== own.second)
    const next = elsewhere.find(({ index }) => index > here)
    const before = lastOf(elsewhere, ({ index }) => index < here)
    const back = own && now > own.second + JUST_BEGUN ? own : before
    const start = way > 0 ? next : back
    if (start) to({ video: start.video, second: start.second })
  }

  function toGame(chapter: Chapter | null) {
    const second = chapter && view.match && startOf(chapter, view.match.cuts, view.length)
    if (chapter?.video && second != null) to({ video: chapter.video, second })
  }

  function skip() {
    const { match, video } = view
    if (!match || !video || !view.place) return
    // What the view shows may be a second old; a jump to the end of a pause is counted from where the video is.
    const place = placeAt(match.story, video, now)
    switch (place.state) {
      case "DRAFT":
      case "WAIT":
        return to({ video, second: leadIn(place.chapter.zero) })
      case "PAUSE":
        return to({ video, second: now + place.left - WATCH.pauseTail })
      case "GAME":
        return place.over ? toGame(place.next) : undefined
      case "BEFORE":
      case "BREAK":
      case "SPAN":
        return toGame(place.next)
    }
  }

  function setLength(length: WatchLength) {
    if (length !== "quick") save({ ...recall(), length })
    set({ length, panel: null })
    const { match, video } = view
    const wanted = cut()
    if (!match || !video || !player || !wanted?.offered) return showSecond(now)
    const inside = wanted.pieces.some((piece) => piece.video === video && now >= piece.from && now < piece.to)
    const next = inside ? null : nextPiece(wanted, match.story, video, now)
    if (next) to({ video: next.video, second: next.from })
    else showSecond(now)
  }

  function toggle() {
    if (!player || !view.match) return
    if (view.player === "PLAYING" || view.player === "WAITING") return player.pause()
    // Pressing play after the end would begin at second 0 of the video, which may be another match.
    const first = view.player === "ENDED" ? firstOf(view.match.story, view.match.cuts, view.length) : null
    if (first) to(first)
    else player.play()
  }

  function choose(index: number) {
    const { match, length } = view
    const chapter = match?.story.chapters[index]
    if (!match || !chapter) return
    set({ chosen: index })
    const { video, number, link } = chapter
    if (!video || video === view.video) return
    const target = { video, second: startOf(chapter, match.cuts, length) ?? link, game: number }
    if (player) to(target)
    else open(match, target, length)
  }

  return {
    view: () => view,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    onTime(listener) {
      timers.add(listener)
      return () => {
        timers.delete(listener)
      }
    },
    remembered: (seriesId) => stopIn(recall(), seriesId),
    kept: () => recall().length,
    attach: command((element: HTMLElement) => {
      host = element
      asked?.()
      asked = null
    }),
    open: command(open),
    update: command(update),
    go: command((target: WatchTarget) => to(target)),
    step: command(step),
    game: command(game),
    skip: command(skip),
    stay: command(() => {
      if (!view.count) return
      stay = view.count.until
      set({ count: null })
    }),
    setLength: command(setLength),
    toggle: command(toggle),
    seekBy: command((seconds: number) => {
      if (view.video) to({ video: view.video, second: Math.max(0, now + seconds) }, false)
    }),
    mute: () => player?.mute(!player.muted()),
    choose: command(choose),
    show: command((panel: WatchPanel | null) => set({ panel: view.panel === panel ? null : panel })),
    setKeys: command((keys: boolean) => {
      save({ ...recall(), keys })
      set({ keys })
    }),
    shrink: command(() => set({ shrunk: true, panel: null })),
    expand: command(() => set({ shrunk: false })),
    pause: command(() => {
      if (!player) return
      player.pause()
      keep()
    }),
    close: command(close),
    retry: command(() => {
      if (view.match && view.video) open(view.match, { video: view.video, second: view.second }, view.length)
    }),
    keep,
    focus: () => player?.focus(),
  }
}
