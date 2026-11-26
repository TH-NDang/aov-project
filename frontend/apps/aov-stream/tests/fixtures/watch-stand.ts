import type { YouTubeState } from "@aov/ui/lib/youtube-player"
import { firstOf } from "../../src/lib/watch-follow.ts"
import { createWatch, type WatchFailure, type WatchPorts } from "../../src/lib/watch-store.ts"
import type { WatchLength, WatchMatch, WatchTarget } from "../../src/lib/watch-types.ts"
import { BRU_EA, HKA_LIT, SGP_BME, UNTIMED, UNTIMED_MIDDLE, watchMatch, type TestGame } from "./watch.ts"

/** The video of SGP–BME, and another one. */
export const video = "j8AvYygkzm4"
export const other = "IHQBJayxnLM"

export const sgp = watchMatch(SGP_BME, 7, { seriesId: "sgp" })
export const bru = watchMatch(BRU_EA, 7, { seriesId: "bru" })
export const hka = watchMatch(HKA_LIT, 5, { seriesId: "hka" })
export const plain = watchMatch(UNTIMED, 5, { seriesId: "plain" })
export const middle = watchMatch(UNTIMED_MIDDLE, 5, { seriesId: "middle" })

const inOther = (game: TestGame): TestGame => ({ ...game, link: `https://youtu.be/${other}` })
/** The first two games of SGP–BME with a video each. */
export const apart = watchMatch([SGP_BME[0]!, inOther(SGP_BME[1]!)], 3, { seriesId: "apart" })
/** The same, as if nobody had timed the second: its video is known, and nothing in it. */
export const unknown = watchMatch([SGP_BME[0]!, { ...inOther(SGP_BME[1]!), zero: null }], 3, { seriesId: "unknown" })
/** Three games of SGP–BME, the last of them in a video of its own. */
export const twoVideos = watchMatch([SGP_BME[0]!, SGP_BME[1]!, inOther(SGP_BME[2]!)], 5, { seriesId: "two" })
/** The same, as if nobody had timed the second, which the first video ends with. */
export const heldVideos = watchMatch([UNTIMED_MIDDLE[0]!, UNTIMED_MIDDLE[1]!, inOther(SGP_BME[2]!)], 5, {
  seriesId: "held",
})
/** A stream that is on, with two games recorded and none timed. */
export const onNow = (seriesId: string): WatchMatch => ({
  ...watchMatch(UNTIMED.slice(0, 2), 5, { seriesId }),
  live: true,
  finished: false,
})

export const first = (match: WatchMatch, length: WatchLength): WatchTarget => firstOf(match.story, match.cuts, length)!

/** What a browser keeps, which is the same for all its tabs; one that `refuses` takes nothing more. */
export type Kept = { text: string | null; refuses?: boolean }

type Options = Parameters<WatchPorts["open"]>[1]

/**
 * A tab with a player that keeps time by itself once it plays, and a clock that is moved by hand. Tabs of one browser
 * share what it has `kept`.
 */
export function stand({ kept = { text: null } as Kept, attached = true } = {}) {
  const log: string[] = []
  let now = 0
  let run: (() => void) | null = null
  const player = {
    second: 0,
    playing: false,
    /** Whether it answers a time; a player that has not begun does not. */
    begun: true,
    speed: 1,
    /** How many readings a seek takes to arrive. */
    late: 0,
    next: null as number | null,
    made: 0,
    quiet: false,
    focused: 0,
    /** Whether it says at once that it is paused; the real one does a little later. */
    prompt: true,
    /** What it fails with while it is being made. */
    fails: null as WatchFailure | null,
    options: null as Options | null,
  }
  const wrote: string[] = []
  const ports: WatchPorts = {
    open(_, options) {
      player.made += 1
      player.options = options
      player.second = options.second
      player.playing = true
      log.push(`open ${options.video} ${options.second}`)
      if (player.fails) options.onFailure(player.fails)
      return {
        load(id, second) {
          log.push(`load ${id} ${second}`)
          player.second = second
          player.playing = true
        },
        seek(second) {
          log.push(`seek ${second}`)
          if (player.late) player.next = second
          else player.second = second
        },
        play() {
          player.playing = true
        },
        pause() {
          log.push("pause")
          player.playing = false
          if (player.prompt) options.onState("PAUSED")
        },
        time: () => (player.begun ? player.second : null),
        rate: () => player.speed,
        muted: () => player.quiet,
        mute(on) {
          player.quiet = on
        },
        focus() {
          player.focused += 1
        },
        destroy() {
          log.push("destroy")
          player.playing = false
        },
      }
    },
    read: () => kept.text,
    write(text) {
      wrote.push(text)
      if (!kept.refuses) kept.text = text
    },
    every(_, tick) {
      run = tick
      return () => {
        run = null
      }
    },
    now: () => now,
  }
  const watch = createWatch(ports)
  const host = {} as HTMLElement
  if (attached) watch.attach(host)

  /** Lets so many seconds pass, in readings of 250 ms. */
  function pass(seconds: number) {
    for (let reading = 0; reading < seconds * 4; reading++) {
      now += 250
      if (player.next != null && --player.late === 0) {
        player.second = player.next
        player.next = null
      }
      if (player.playing) player.second += 0.25 * player.speed
      run?.()
    }
  }
  return {
    watch,
    player,
    log,
    host,
    kept,
    wrote,
    pass,
    /** Opens a match at a second of its first video, playing. */
    open(match: WatchMatch, second: number, length: WatchLength = "whole") {
      watch.open(match, { video: match.story.videos[0]!, second }, length)
      player.options!.onState("PLAYING")
    },
    /** One reading of a second the video did not play on to: a hand on YouTube's bar, or a video that stood still. */
    read(second: number) {
      now += 250
      player.second = second
      run?.()
    },
    view: () => watch.view(),
    seeks: () => log.filter((line) => line.startsWith("seek")),
    last: () => log.at(-1),
    ticking: () => run !== null,
    saved: () => JSON.parse(kept.text!),
    reports: (state: YouTubeState) => player.options!.onState(state),
    fails: (failure: WatchFailure) => player.options!.onFailure(failure),
  }
}
