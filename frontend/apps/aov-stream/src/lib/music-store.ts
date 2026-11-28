import type { YouTubeFailure, YouTubeState } from "@aov/ui/lib/youtube-player"
import { tracksOf, type MusicListCode, type MusicTrack } from "./music-catalog.ts"

export type MusicRepeat = "ALL" | "ONE" | "OFF"
export type MusicPlayerState = "CLOSED" | YouTubeState
export type MusicView = {
  /** Whether the player is on the screen at all. */
  open: boolean
  /** Folded into a bar. Only while nothing is heard: a video that plays has to be seen. */
  folded: boolean
  /** Whether the lists to choose from are open beside the player. */
  shelf: boolean
  /** The list that plays, or that will. */
  list: MusicListCode
  track: MusicTrack | null
  player: MusicPlayerState
  failure: YouTubeFailure | null
  /** A track that would not play and was passed over. */
  skipped: MusicTrack | null
  tapNeeded: boolean
  shuffle: boolean
  repeat: MusicRepeat
  /** 0 to 100. */
  volume: number
  muted: boolean
  /** The reader's own links, newest first. */
  mine: readonly MusicTrack[]
}
export type MusicPlayer = {
  load(video: string, second: number): void
  seek(second: number): void
  play(): void
  pause(): void
  time(): number | null
  mute(on: boolean): void
  volume(level: number): void
  destroy(): void
}
export type MusicPorts = {
  open(
    host: HTMLElement,
    options: {
      video: string
      second: number
      onState(state: YouTubeState): void
      onFailure(failure: YouTubeFailure): void
      onAutoplayBlocked(): void
    },
  ): MusicPlayer
  read(): string | null
  write(text: string): void
  every(milliseconds: number, run: () => void): () => void
  /** Silences every other sound of the app, before the music is heard. */
  quiet(): void
  /** A number from 0 up to 1, for shuffling. */
  random(): number
}
export type Music = {
  view(): MusicView
  subscribe(listener: () => void): () => void
  /** The element the frame is made in. */
  attach(host: HTMLElement): void
  /** Plays a track of a list, by its place in the list. */
  play(list: MusicListCode, index: number): void
  toggle(): void
  next(): void
  previous(): void
  /** Pauses for another sound and folds away, as nothing is heard any more. */
  yieldTo(): void
  setShuffle(on: boolean): void
  cycleRepeat(): void
  setVolume(level: number): void
  toggleMute(): void
  show(): void
  setShelf(open: boolean): void
  fold(): void
  close(): void
  /** Keeps a link of the reader's own; false when it was kept already. */
  add(track: MusicTrack): boolean
  remove(video: string): void
  keep(): void
}

/** The most links of the reader's own that are kept. */
export const MINE_MOST = 50
/** Seconds into a track after which "previous" starts it again rather than going back. */
export const RESTART_AFTER = 3
const READING = 1000
/** Seconds of play after which the place is written down again. */
const WRITE = 5
const HEARD: readonly MusicPlayerState[] = ["OPENING", "WAITING", "PLAYING"]
const REPEATS: readonly MusicRepeat[] = ["ALL", "ONE", "OFF"]
const LISTS: readonly MusicListCode[] = ["SONGS", "ARENA", "HEROES", "GAMING", "MINE"]

type MusicMemory = {
  list: MusicListCode
  video: string | null
  second: number
  shuffle: boolean
  repeat: MusicRepeat
  volume: number
  muted: boolean
  open: boolean
  mine: MusicTrack[]
}

const FIRST: MusicMemory = {
  list: "SONGS",
  video: null,
  second: 0,
  shuffle: false,
  repeat: "ALL",
  volume: 80,
  muted: false,
  open: false,
  mine: [],
}

const isTrack = (value: unknown): value is MusicTrack => {
  const track = value as Partial<MusicTrack> | null
  return (
    !!track &&
    typeof track.video === "string" &&
    /^[\w-]{11}$/.test(track.video) &&
    typeof track.title === "string" &&
    typeof track.artist === "string"
  )
}

/** What the browser kept; whatever does not read as it should starts afresh. */
export function readMusicMemory(text: string | null): MusicMemory {
  let kept: Partial<MusicMemory>
  try {
    kept = text ? (JSON.parse(text) as Partial<MusicMemory>) : {}
  } catch {
    return FIRST
  }
  if (!kept || typeof kept !== "object") return FIRST
  const volume = typeof kept.volume === "number" && Number.isFinite(kept.volume) ? kept.volume : FIRST.volume
  return {
    list: LISTS.includes(kept.list as MusicListCode) ? (kept.list as MusicListCode) : FIRST.list,
    video: typeof kept.video === "string" ? kept.video : null,
    second: typeof kept.second === "number" && kept.second > 0 ? Math.floor(kept.second) : 0,
    shuffle: kept.shuffle === true,
    repeat: REPEATS.includes(kept.repeat as MusicRepeat) ? (kept.repeat as MusicRepeat) : FIRST.repeat,
    volume: Math.round(Math.min(100, Math.max(0, volume))),
    muted: kept.muted === true,
    open: kept.open === true,
    mine: Array.isArray(kept.mine) ? kept.mine.filter(isTrack).slice(0, MINE_MOST) : [],
  }
}

/** The order the places of a list play in: as they stand, or shuffled with the one that plays now first. */
export function playOrder(length: number, shuffle: boolean, current: number, random: () => number): number[] {
  const places = Array.from({ length }, (_, index) => index)
  if (!shuffle || length < 2) return places
  const rest = places.filter((index) => index !== current)
  for (let index = rest.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[rest[index], rest[other]] = [rest[other]!, rest[index]!]
  }
  return current >= 0 && current < length ? [current, ...rest] : rest
}

/** The music of the app: one list, one track and one player, which goes on while the pages change. */
export function createMusic(ports: MusicPorts): Music {
  const memory = readMusicMemory(ports.read())
  const firstTracks = tracksOf(memory.list, memory.mine)
  let view: MusicView = {
    open: memory.open,
    folded: memory.open,
    shelf: false,
    list: memory.list,
    track: firstTracks.find(({ video }) => video === memory.video) ?? firstTracks[0] ?? null,
    player: "CLOSED",
    failure: null,
    skipped: null,
    tapNeeded: false,
    shuffle: memory.shuffle,
    repeat: memory.repeat,
    volume: memory.volume,
    muted: memory.muted,
    mine: memory.mine,
  }
  /** Where the track is, for coming back to it: the second the player gave last. */
  let second = view.track?.video === memory.video ? memory.second : 0
  let unwritten = 0
  const listeners = new Set<() => void>()

  let host: HTMLElement | null = null
  let asked: (() => void) | null = null
  let player: MusicPlayer | null = null
  /** Counts the players made, so that a late word of an earlier one is not heard. */
  let made = 0
  let stopTimer: (() => void) | null = null
  /** Tracks in a row that would not play, so that a list where none plays is not gone round for ever. */
  let failures = 0

  let order: number[] = []
  let at = 0

  let changing = 0
  let changed = false

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

  function set(patch: Partial<MusicView>) {
    const next = { ...view, ...patch }
    if ((Object.keys(next) as (keyof MusicView)[]).every((key) => next[key] === view[key])) return
    view = next
    changed = true
  }

  const tracks = () => tracksOf(view.list, view.mine)
  const heard = () => HEARD.includes(view.player)
  const indexOfTrack = () => tracks().findIndex(({ video }) => video === view.track?.video)

  function reorder() {
    const current = indexOfTrack()
    order = playOrder(tracks().length, view.shuffle, current, ports.random)
    at = Math.max(0, order.indexOf(current))
  }

  function save() {
    const { list, track, shuffle, repeat, volume, muted, open, mine } = view
    const memory: MusicMemory = {
      list,
      video: track?.video ?? null,
      second: Math.floor(second),
      shuffle,
      repeat,
      volume,
      muted,
      open,
      mine: [...mine],
    }
    ports.write(JSON.stringify(memory))
    unwritten = 0
  }

  function tick() {
    const time = player?.time()
    if (time == null || !Number.isFinite(time)) return
    if (time > second) unwritten += time - second
    second = time
    if (unwritten >= WRITE) save()
  }

  function discard() {
    made += 1
    player?.destroy()
    player = null
    stopTimer?.()
    stopTimer = null
  }

  function onState(state: YouTubeState) {
    // Played from YouTube's own button, it is heard all the same: the other sounds stop and it is shown.
    if (state === "PLAYING" && !heard()) ports.quiet()
    set(state === "PLAYING" ? { player: state, tapNeeded: false, failure: null, folded: false } : { player: state })
    if (state === "PLAYING") failures = 0
    if (state === "PAUSED") save()
    if (state === "ENDED") ended()
  }

  function onFailure(failure: YouTubeFailure) {
    const failed = view.track
    discard()
    failures += 1
    set({ player: "CLOSED", failure, tapNeeded: false })
    second = 0
    // Without YouTube's script no other track would play either.
    const others = failure !== "BLOCKED" && tracks().length > 1 && view.repeat !== "ONE"
    if (!others || failures >= tracks().length) return save()
    set({ skipped: failed })
    move(1, true)
  }

  /** Makes the player, or loads the track into the one there is. Every other sound of the app is silenced first. */
  function start(track: MusicTrack, from: number) {
    if (!host) {
      asked = () => start(track, from)
      return
    }
    ports.quiet()
    second = from
    set({ track, open: true, folded: false, failure: null, tapNeeded: false, player: "OPENING" })
    if (player) {
      player.load(track.video, from)
      player.play()
    } else {
      discard()
      const own = made
      const fromOwn = <Args extends unknown[]>(hear: (...args: Args) => void) =>
        command((...args: Args) => {
          if (own === made) hear(...args)
        })
      const opened = ports.open(host, {
        video: track.video,
        second: from,
        onState: fromOwn(onState),
        onFailure: fromOwn(onFailure),
        onAutoplayBlocked: fromOwn(() => set({ tapNeeded: true })),
      })
      if (own !== made) return opened.destroy()
      player = opened
      stopTimer = ports.every(READING, command(tick))
    }
    player.volume(view.volume)
    player.mute(view.muted)
    save()
  }

  /** To the next or the previous track in the order; by itself it stops at the end of a list that does not repeat. */
  function move(way: 1 | -1, byItself = false) {
    const all = tracks()
    if (!all.length) return
    if (order.length !== all.length) reorder()
    let next = at + way
    if (next < 0 || next >= order.length) {
      if (byItself && view.repeat === "OFF") {
        second = 0
        return save()
      }
      // Round the list again; shuffled, in a new order.
      if (view.shuffle && way > 0) {
        order = playOrder(all.length, true, -1, ports.random)
        next = 0
      } else next = (next + order.length) % order.length
    }
    at = next
    start(all[order[at]!]!, 0)
  }

  function ended() {
    if (view.repeat === "ONE" && view.track) return start(view.track, 0)
    move(1, true)
  }

  function pause() {
    player?.pause()
    save()
  }

  const music: Music = {
    view: () => view,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    attach: command((element: HTMLElement) => {
      host = element
      asked?.()
      asked = null
    }),
    play: command((list: MusicListCode, index: number) => {
      const track = tracksOf(list, view.mine)[index]
      if (!track) return
      set({ list, track, skipped: null })
      failures = 0
      reorder()
      start(track, 0)
    }),
    toggle: command(() => {
      set({ skipped: null })
      if (heard()) return pause()
      const track = view.track ?? tracks()[0]
      if (!track) return
      if (!player || view.player === "CLOSED") {
        if (order.length !== tracks().length) reorder()
        return start(track, second)
      }
      // A list that stopped at its end begins again.
      if (view.player === "ENDED" && view.repeat === "OFF" && at === order.length - 1) return move(1)
      if (view.player === "ENDED") return start(track, 0)
      ports.quiet()
      set({ folded: false })
      player.play()
    }),
    next: command(() => {
      set({ skipped: null })
      failures = 0
      move(1)
    }),
    previous: command(() => {
      set({ skipped: null })
      failures = 0
      if (player && view.player !== "CLOSED" && second > RESTART_AFTER) {
        second = 0
        player.seek(0)
        return
      }
      move(-1)
    }),
    yieldTo: command(() => {
      if (!view.open) return
      if (heard()) pause()
      set({ folded: true, shelf: false })
    }),
    setShuffle: command((on: boolean) => {
      set({ shuffle: on })
      reorder()
      save()
    }),
    cycleRepeat: command(() => {
      set({ repeat: REPEATS[(REPEATS.indexOf(view.repeat) + 1) % REPEATS.length]! })
      save()
    }),
    setVolume: command((level: number) => {
      const volume = Math.round(Math.min(100, Math.max(0, level)))
      set({ volume, muted: volume === 0 })
      player?.volume(volume)
      player?.mute(volume === 0)
      save()
    }),
    toggleMute: command(() => {
      const muted = !view.muted
      // Sound comes back at a level that can be heard.
      const volume = !muted && view.volume === 0 ? FIRST.volume : view.volume
      set({ muted, volume })
      player?.volume(volume)
      player?.mute(muted)
      save()
    }),
    show: command(() => {
      set({ open: true, folded: false })
      save()
    }),
    setShelf: command((shelf: boolean) => set({ shelf })),
    fold: command(() => {
      if (heard()) pause()
      set({ folded: true, shelf: false })
    }),
    close: command(() => {
      if (player) tick()
      discard()
      set({
        open: false,
        folded: false,
        shelf: false,
        player: "CLOSED",
        tapNeeded: false,
        failure: null,
        skipped: null,
      })
      save()
    }),
    add(track) {
      const known = view.mine.some(({ video }) => video === track.video)
      together(() => {
        set({ mine: [track, ...view.mine.filter(({ video }) => video !== track.video)].slice(0, MINE_MOST) })
        if (view.list === "MINE") reorder()
        save()
      })
      return !known
    },
    remove: command((video: string) => {
      set({ mine: view.mine.filter((track) => track.video !== video) })
      if (view.list === "MINE") reorder()
      save()
    }),
    keep: () => {
      if (player) tick()
      save()
    },
  }
  return music
}
