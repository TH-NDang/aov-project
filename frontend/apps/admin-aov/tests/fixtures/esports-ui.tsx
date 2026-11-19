/**
 * Shared set-up of the esports screen tests: a page per test, one recorded game between two teams, its moments, and
 * stand-ins for what the browser or YouTube would provide.
 */
import type { ReactNode } from "react"
import type { DOMWindow } from "jsdom"
import type { GameView } from "../../src/features/esports/model/game-view"
import type { TimelineEvent } from "../../src/features/esports/model/timeline"
import { flush, inDom, QuietResizeObserver, renderer } from "./dom"

/** Runs one test in its own page; `render` draws into one root, so a later call changes the props of the first tree. */
export async function inPage(
  run: (document: Document, render: (node: ReactNode) => Promise<unknown>) => Promise<void>,
  extra: (window: DOMWindow) => Record<string, unknown> = () => ({}),
) {
  const globals = (window: DOMWindow) => ({ CSS: { escape: (value: string) => value }, ...extra(window) })
  await inDom({ url: "http://localhost:5175/tournaments", globals }, ({ document }) => run(document, renderer()))
}

/** What radix popovers need from the browser beyond the basic DOM: frames that a flush lets through, and a quiet observer. */
export const popoverGlobals = () => ({
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
  cancelAnimationFrame: clearTimeout,
  ResizeObserver: QuietResizeObserver,
})

export const settle = () => flush()

/** Types into a field without act; the caller settles afterwards. */
export function type(input: HTMLInputElement, value: string) {
  const window = input.ownerDocument.defaultView!
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, value)
  input.dispatchEvent(new window.Event("input", { bubbles: true }))
}

/** The first button whose text contains `text`. */
export const button = (document: Document, text: string) =>
  [...document.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text))!

export const team = (id: string, name: string) => ({ id, name, shortName: name.slice(0, 3).toUpperCase() })

const seat = (side: "BLUE" | "RED", lane: "MID" | "JUNGLE", player: string, hero: string) => ({
  key: `${side}:${lane}` as const,
  side,
  lane,
  playerName: player,
  hero: { name: hero },
  spell: null,
  enchantments: { status: "UNKNOWN" as const, entries: [] },
  arcana: { status: "UNKNOWN" as const, entries: [] },
})

/** Game 1 of Azure against Crimson, two players a side; Azure won after fifteen minutes. */
export const game: GameView = {
  id: "g1",
  number: 1,
  winner: "BLUE",
  durationSeconds: 900,
  published: false,
  missingFields: [],
  sourceUrl: "https://youtu.be/R5rCsGqDJIg",
  sourceStartSecond: 120,
  sides: {
    BLUE: {
      side: "BLUE",
      team: team("a", "Azure"),
      bans: [],
      seats: [seat("BLUE", "MID", "Mid A", "Lauriel"), seat("BLUE", "JUNGLE", "Jg A", "Nakroth")],
    },
    RED: {
      side: "RED",
      team: team("b", "Crimson"),
      bans: [],
      seats: [seat("RED", "MID", "Mid B", "Tulen"), seat("RED", "JUNGLE", "Jg B", "Murad")],
    },
  },
  snapshots: {},
}

export const lookups = { itemIcon: () => null, itemTier: () => 3 }

/** A kill at 2:00, a purchase at 5:00 and a Dark Slayer at 10:00. */
export const events: TimelineEvent[] = [
  { id: "k1", kind: "KILL", at: 120, killer: "BLUE:JUNGLE", victim: "RED:MID", assists: ["BLUE:MID"] },
  { id: "o1", kind: "OBJECTIVE", at: 600, side: "RED", objective: "DARK_SLAYER" },
  { id: "i1", kind: "ITEM", at: 300, seat: "BLUE:MID", action: "BUY", slot: 1, item: { name: "Sách thánh" } },
]

/** Game 1 on the video axis between two seconds of the broadcast. */
export const chapter = (start: number, end: number) => ({
  gameId: "g1",
  number: 1,
  from: start,
  start,
  end,
  duration: end - start,
  synced: true,
  live: true,
  draft: null,
  sync: { url: "", startSecond: start, pauses: [] },
  winner: "BLUE" as const,
  events: [],
})

/** Moments of game 1 as the broadcast axis names them. */
export const onAxis = (list: TimelineEvent[]) => list.map((event) => ({ ...event, id: `g1|${event.id}` }))

/** Installs a YouTube player API that records what the page asks of it; returns every player made so far. */
export function mockYouTube() {
  type PlayerEvents = { onReady(event: { target: FakePlayer }): void; onStateChange(event: { data: number }): void }
  class FakePlayer {
    static instances: FakePlayer[] = []
    readonly events: PlayerEvents
    readonly vars: { start: number; autoplay: number; controls?: number }
    readonly seeks: number[] = []
    plays = 0
    pauses = 0
    time = 0

    constructor(_element: HTMLElement, options: Record<string, unknown>) {
      this.events = options.events as PlayerEvents
      this.vars = options.playerVars as FakePlayer["vars"]
      FakePlayer.instances.push(this)
    }

    seekTo(second: number) {
      this.seeks.push(second)
    }

    playVideo() {
      this.plays++
    }

    pauseVideo() {
      this.pauses++
    }

    getCurrentTime() {
      return this.time
    }

    getDuration() {
      return 20144
    }

    state = 2
    getPlayerState() {
      return this.state
    }

    rates: number[] = []
    setPlaybackRate(rate: number) {
      this.rates.push(rate)
    }

    muted = false
    mute() {
      this.muted = true
    }

    unMute() {
      this.muted = false
    }

    destroyed = false
    destroy() {
      this.destroyed = true
    }
  }
  window.YT = { Player: FakePlayer }
  return FakePlayer.instances
}
