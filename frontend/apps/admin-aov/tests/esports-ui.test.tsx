import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import React, { act } from "react"
import { JSDOM } from "jsdom"
import type { GameView } from "../src/features/esports/model/game-view"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import type { VodPlayerHandle } from "../src/features/esports/components/game/vod-player"

const COMPONENTS = join(import.meta.dirname, "../src/features/esports/components")
const MODEL = join(import.meta.dirname, "../src/features/esports/model")

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

test("viewer components and models stay free of admin-only modules so the public site can reuse them", () => {
  for (const file of [...files(COMPONENTS), ...files(MODEL)]) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /from "@\/(app|features\/tournaments|lib\/api)/, `${file} imports an admin module`)
    assert.doesNotMatch(source, /tournamentApi|useSession/, `${file} reaches the admin API`)
  }
})

async function withDom(
  run: (document: Document, render: (node: React.ReactNode) => Promise<void>) => Promise<void>,
  extra: (window: JSDOM["window"]) => Record<string, unknown> = () => ({}),
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments" })
  const values = {
    ...extra(dom.window),
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    CSS: { escape: (value: string) => value },
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run(dom.window.document, async (node) => {
      await act(async () => root.render(node))
    })
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
    dom.window.close()
  }
}

const team = (id: string, name: string) => ({ id, name, shortName: name.slice(0, 3).toUpperCase() })
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
const game: GameView = {
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
const lookups = { itemIcon: () => null, itemTier: () => 3 }
const events: TimelineEvent[] = [
  { id: "k1", kind: "KILL", at: 120, killer: "BLUE:JUNGLE", victim: "RED:MID", assists: ["BLUE:MID"] },
  { id: "o1", kind: "OBJECTIVE", at: 600, side: "RED", objective: "DARK_SLAYER" },
  { id: "i1", kind: "ITEM", at: 300, seat: "BLUE:MID", action: "BUY", slot: 1, item: { name: "Sách thánh" } },
]

const chapter = (start: number, end: number) => ({
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
const onAxis = (list: TimelineEvent[]) => list.map((event) => ({ ...event, id: `g1|${event.id}` }))

test("the timeline places markers by side, describes them for screen readers and seeks on selection", async () => {
  await withDom(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const selected: string[] = []
    await render(
      <BroadcastTimeline
        duration={900}
        current={300}
        chapters={[chapter(0, 900)]}
        events={onAxis(events)}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.id)}
        onOpen={() => {}}
      />,
    )
    const markers = [...document.querySelectorAll<HTMLButtonElement>("[data-marker]")]
    assert.equal(markers.length, 3)
    const kill = markers.find((marker) => marker.dataset.kind === "KILL")!
    assert.equal(kill.dataset.side, "BLUE")
    assert.equal(kill.dataset.at, "120")
    assert.match(
      kill.getAttribute("aria-label") ?? "",
      /2:00 · Hạ gục: Nakroth \(Jg A\) hạ Tulen \(Mid B\) · hỗ trợ: Mid A/,
    )
    assert.equal(markers.find((marker) => marker.dataset.kind === "OBJECTIVE")?.dataset.past, "false")
    await act(async () => kill.click())
    assert.deepEqual(selected, ["g1|k1"])
    assert.equal(document.querySelector('[role="slider"]')?.getAttribute("aria-valuetext"), "5:00")
  })
})

test("a timeline cluster seeks to its displayed start even when a later kill represents it", async () => {
  await withDom(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const selected: number[] = []
    await render(
      <BroadcastTimeline
        duration={900}
        current={0}
        chapters={[chapter(0, 900)]}
        events={onAxis([
          { id: "early-item", kind: "ITEM", at: 110, seat: "BLUE:MID", action: "BUY", slot: 1 },
          events[0],
        ])}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.at)}
        onOpen={() => {}}
      />,
    )
    const marker = document.querySelector<HTMLButtonElement>("[data-marker]")!
    assert.equal(document.querySelectorAll("[data-marker]").length, 1)
    assert.equal(marker.dataset.kind, "KILL")
    assert.match(marker.getAttribute("aria-label")!, /^1:50 ·/)
    await act(async () => marker.click())
    assert.deepEqual(selected, [110], "the marker seeks to 1:50, not the later kill at 2:00")
  })
})

function mockYouTube() {
  type PlayerEvents = { onReady(event: { target: FakePlayer }): void }
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

    getPlayerState() {
      return 2
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

    destroy() {}
  }
  window.YT = { Player: FakePlayer }
  return FakePlayer.instances
}

test("video seeks wait for readiness and apply the latest requested second without starting playback", async () => {
  await withDom(async (_document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    const ref = React.createRef<VodPlayerHandle>()
    const readings: number[] = []
    await render(
      <VodPlayer
        ref={ref}
        videoId="R5rCsGqDJIg"
        startAt={95}
        title="Game"
        onTime={(time) => readings.push(time)}
        onPlayingChange={() => {}}
      />,
    )

    await act(async () => ref.current!.seek(335))
    const player = instances[0]
    assert.equal(player.vars.start, 95)
    assert.equal(player.vars.autoplay, 0)
    assert.equal(ref.current!.currentTime(), null, "an unready player must not report the default zero time")
    await act(async () => ref.current!.seek(830))
    assert.deepEqual(player.seeks, [], "API methods can exist before YouTube accepts commands")

    await act(async () => player.events.onReady({ target: player }))
    assert.deepEqual(player.seeks, [830])
    assert.equal(player.plays, 0)
    assert.equal(player.pauses, 1)
    player.time = 830
    assert.equal(ref.current!.currentTime(), 830)

    await act(async () => ref.current!.seek(550))
    assert.deepEqual(player.seeks, [830, 550])
    assert.equal(player.plays, 0, "seeking a paused player keeps it paused")
    assert.deepEqual(readings, [], "a requested time must not be reported as an observed video position")
  })
})

test("seeking while the video starts keeps the latest time and the pending play request", async () => {
  await withDom(async (_document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    const ref = React.createRef<VodPlayerHandle>()
    await render(
      <VodPlayer
        ref={ref}
        videoId="R5rCsGqDJIg"
        startAt={95}
        title="Game"
        onTime={() => {}}
        onPlayingChange={() => {}}
      />,
    )
    await act(async () => ref.current!.toggle())
    await act(async () => ref.current!.seek(550))
    const player = instances[0]
    await act(async () => player.events.onReady({ target: player }))
    assert.deepEqual(player.seeks, [550])
    assert.equal(player.plays, 1)
    assert.equal(player.pauses, 0)
  })
})

test("the full video timeline exposes its actual duration and seeks chapters in video seconds", async () => {
  await withDom(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const seeks: number[] = []
    await render(
      <BroadcastTimeline
        duration={20144}
        current={640}
        chapters={[]}
        flags={[{ id: "g2", at: 1800, label: "Bắt đầu ván 2" }]}
        events={[]}
        views={{}}
        chapterTitle={() => ""}
        focusedGameId={null}
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={(second) => seeks.push(second)}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    )
    const slider = document.querySelector('[role="slider"]')!
    assert.equal(slider.getAttribute("aria-valuemax"), "20144")
    assert.equal(slider.getAttribute("aria-valuetext"), "10:40")
    assert.equal((slider as HTMLElement).style.width, "calc(400% - 28px)")
    assert.equal(document.querySelector(".esp-track-ticks")?.lastElementChild?.textContent, "5:35:44")
    assert.ok(document.querySelectorAll(".esp-track-ticks > span").length <= 10)
    await act(async () => document.querySelector<HTMLButtonElement>('[data-chapter="g2"]')!.click())
    assert.deepEqual(seeks, [1800])
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Phóng to timeline"]')!.click())
    assert.equal((slider as HTMLElement).style.width, "calc(800% - 28px)")
    assert.equal(slider.getAttribute("aria-valuemax"), "20144", "zoom changes the width, never the video duration")
    const fit = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Toàn video",
    )!
    await act(async () => fit.click())
    assert.equal((slider as HTMLElement).style.width, "calc(100% - 28px)")
    slider.getBoundingClientRect = () => ({ left: -200, width: 4000 }) as DOMRect
    await act(async () => slider.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 800 })))
    assert.deepEqual(seeks, [1800, 5036], "a scrolled timeline uses the track's actual position and width")
  })
})

test("the player reports duration and floats without replacing or seeking the active video", async () => {
  await withDom(async (document, render) => {
    const previous = globalThis.IntersectionObserver
    let visibility: IntersectionObserverCallback
    let disconnected = false
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        visibility = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    } as unknown as typeof IntersectionObserver
    try {
      const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
      const instances = mockYouTube()
      const durations: number[] = []
      await render(
        <VodPlayer
          videoId="R5rCsGqDJIg"
          startAt={95}
          title="Game"
          onTime={() => {}}
          onPlayingChange={() => {}}
          onDuration={(second) => durations.push(second)}
        />,
      )
      const player = instances[0]
      await act(async () => player.events.onReady({ target: player }))
      assert.deepEqual(durations, [20144])
      assert.equal(player.plays, 0)
      const host = document.querySelector('[title="Game"]')!
      const changeVisibility = async (isIntersecting: boolean, bottom: number) =>
        act(async () => {
          visibility!(
            [{ isIntersecting, boundingClientRect: { bottom } } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          )
        })
      await changeVisibility(false, 600)
      assert.equal(document.querySelector("[data-floating]"), null, "a video below the viewport does not float")
      await changeVisibility(false, -1)
      assert.ok(document.querySelector("[data-floating]"))
      assert.equal(document.querySelector('[title="Game"]'), host)
      assert.equal(instances.length, 1)
      assert.deepEqual(player.seeks, [])

      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng video nổi"]')!.click())
      assert.equal(document.querySelector("[data-floating]"), null)
      await changeVisibility(true, 300)
      await changeVisibility(false, -1)
      assert.ok(document.querySelector("[data-floating]"), "floating resumes after returning to the main video")
      let returned = false
      document.querySelector<HTMLElement>("[data-video-placeholder]")!.scrollIntoView = () => {
        returned = true
      }
      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Quay về video lớn"]')!.click())
      assert.equal(returned, true)
      await changeVisibility(true, 300)
      assert.equal(document.querySelector("[data-floating]"), null)
      assert.equal(document.querySelector('[title="Game"]'), host)
      await render(null)
      assert.equal(disconnected, true)
    } finally {
      if (previous) globalThis.IntersectionObserver = previous
      else Reflect.deleteProperty(globalThis, "IntersectionObserver")
    }
  })
})

test("the scoreboard shows score, KDA and items as of the playhead", async () => {
  await withDom(async (document, render) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    await render(
      <Scoreboard game={game} events={events} at={200} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    assert.equal(document.querySelector('[aria-label="1 hạ gục"]')?.textContent, "1")
    assert.equal(document.querySelector('[aria-label="0 hạ gục"]')?.textContent, "0")
    assert.equal(document.querySelectorAll('[aria-label="Sách thánh"]').length, 0, "item bought later is not shown yet")
    await render(
      <Scoreboard game={game} events={events} at={310} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    const item = document.querySelector('[aria-label="Sách thánh"]')
    assert.ok(item)
    assert.equal(item.getAttribute("data-changed"), "true", "a purchase in the last 20 seconds is highlighted")
    await render(
      <Scoreboard game={game} events={events} at={600} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    assert.equal(document.querySelector('[aria-label="Sách thánh"]')?.getAttribute("data-changed"), null)
  })
})

test("the event feed hides edit controls in read-only mode", async () => {
  await withDom(async (document, render) => {
    const { EventFeed } = await import("../src/features/esports/components/game/event-feed")
    const props = {
      game,
      events: [...events, { ...events[2], id: "equipment:BLUE:MID:0" }],
      at: 300,
      activeId: null,
      filter: "ALL" as const,
      onFilter: () => {},
      follow: false,
      lookups,
      onSelect: () => {},
      onOpen: () => {},
      videoLink: () => "https://www.youtube.com/watch?v=R5rCsGqDJIg&t=420s",
    }
    await render(<EventFeed {...props} />)
    assert.equal(document.querySelectorAll('[aria-label="Sửa sự kiện"]').length, 0)
    assert.equal(document.querySelectorAll('[aria-label="Mở trên YouTube"]').length, 4)
    await render(<EventFeed {...props} onEdit={() => {}} onDelete={() => {}} />)
    assert.equal(document.querySelectorAll('[aria-label="Sửa sự kiện"]').length, 4)
    assert.equal(document.querySelectorAll('[aria-label="Xem chi tiết"]').length, 4)
    assert.equal(
      document.querySelector('[data-current="true"]')?.getAttribute("data-group"),
      "equipment:BLUE:MID:0",
      "the two purchases at 5:00 form the current block",
    )
    assert.equal(document.querySelector('[data-current="true"]')?.querySelectorAll("[data-event]").length, 2)
  })
})

test("every moment says which clock it shows: in-game timer and broadcast position", async () => {
  await withDom(async (document, render) => {
    const { EventFeed } = await import("../src/features/esports/components/game/event-feed")
    await render(
      <EventFeed
        game={game}
        events={[events[0]]}
        at={300}
        activeId={null}
        filter="ALL"
        onFilter={() => {}}
        follow={false}
        lookups={lookups}
        onSelect={() => {}}
        onOpen={() => {}}
        videoLink={() => null}
        videoAt={(event) => 3600 + event.at}
      />,
    )
    const row = document.querySelector('[data-event="k1"]')!
    const gameClock = row.querySelector('[data-time="game"]')!
    const videoClock = row.querySelector('[data-time="video"]')!
    assert.equal(gameClock.textContent, "⏱2:00")
    assert.match(gameClock.getAttribute("aria-label")!, /^Giờ trong trận/)
    assert.equal(
      videoClock.textContent,
      `${String.fromCodePoint(0x25b6, 0xfe0e)}1:02:00`,
      "the mark keeps text presentation instead of an emoji tile",
    )
    assert.match(videoClock.getAttribute("aria-label")!, /^Vị trí trên video/)
    assert.match(document.body.textContent ?? "", /giờ trong trận/)
  })
})

/** What radix popovers need from the browser beyond the basic DOM. */
const popoverGlobals = (window: JSDOM["window"]) => ({
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
  Event: window.Event,
  HTMLInputElement: window.HTMLInputElement,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
  cancelAnimationFrame: clearTimeout,
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
function type(input: HTMLInputElement, value: string) {
  const window = input.ownerDocument.defaultView!
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, value)
  input.dispatchEvent(new window.Event("input", { bubbles: true }))
}
const button = (document: Document, text: string) =>
  [...document.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text))!

test("hero cards are the wiki reference card: wiki description and entry link, or a plain card when unknown", async () => {
  await withDom(async (document, render) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    const { ReferenceSourceProvider } = await import("../src/features/esports/components/game/entity-ref")
    const entities = [
      {
        id: "lauriel",
        kind: "hero" as const,
        translations: [{ locale: "vi-VN", name: "Lauriel", aliases: [], description: "Pháp sư lướt liên tục." }],
        destinations: { admin: "/hero/lauriel" },
      },
    ]
    await render(
      <ReferenceSourceProvider source={{ entities, context: "admin" }}>
        <Scoreboard
          game={game}
          events={events}
          at={200}
          focusSeat={null}
          onFocusSeat={() => {}}
          itemIcon={() => null}
        />
      </ReferenceSourceProvider>,
    )
    const known = document.querySelector<HTMLElement>('[aria-label="Tướng: Lauriel"]')!
    await act(async () => known.focus())
    await settle()
    let card = document.querySelector('[role="dialog"]')!
    assert.match(card.textContent ?? "", /Pháp sư lướt liên tục\./)
    assert.equal(card.querySelector("a")?.getAttribute("href"), "/hero/lauriel")
    assert.doesNotMatch(card.textContent ?? "", /Mid A/, "the card describes the hero, not the match")
    const window = document.defaultView!
    await act(async () => known.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    await settle()
    assert.equal(document.querySelector('[role="dialog"]'), null)

    const unknown = document.querySelector<HTMLElement>('[aria-label="Tướng: Nakroth"]')!
    await act(async () => unknown.focus())
    await settle()
    card = document.querySelector('[role="dialog"]')!
    assert.match(card.textContent ?? "", /Nakroth/)
    assert.match(card.textContent ?? "", /Chưa có mô tả/)
    assert.equal(card.querySelector("a"), null, "an entry missing from the wiki has no link")
  }, popoverGlobals)
})

test("recording a moment takes the broadcast position and stores the game clock", async () => {
  await withDom(async (document, render) => {
    const { EventComposer } = await import("../src/features/esports/components/game/event-composer")
    const { gameToVideo, videoToGame } = await import("../src/features/esports/model/vod")
    const sync = { url: "", startSecond: 1800, pauses: [{ atSeconds: 300, durationSeconds: 60 }] }
    const saved: TimelineEvent[] = []
    await render(
      <EventComposer
        game={game}
        at={100}
        video={{
          now: 2000,
          toVideo: (second) => gameToVideo(sync, second)!,
          toGame: (second) => (second < 1800 ? null : videoToGame(sync, second)),
        }}
        knownDuration={900}
        items={[]}
        initialKind="NOTE"
        snapshotsFor={() => []}
        events={[]}
        onSave={(event) => saved.push(event)}
        onCancel={() => {}}
      />,
    )
    const time = document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!
    assert.equal(time.value, "33:20", "a new moment starts at the player position")
    assert.match(document.body.textContent ?? "", /Mốc video/)
    assert.match(document.body.textContent ?? "", /Lưu thành ⏱3:20 trong ván 1/)

    type(time, "37:00")
    type(document.querySelector<HTMLInputElement>('input[placeholder^="Ví dụ"]')!, "Giao tranh Rồng")
    await settle()
    const window = document.defaultView!
    await act(async () =>
      document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
    )
    assert.equal(saved[0]?.at, 360, "37:00 in the video is 6:00 of game time after the one-minute pause")

    type(time, "29:00")
    await settle()
    assert.match(document.body.textContent ?? "", /trước khi ván 1 bắt đầu/)
    assert.equal(button(document, "Lưu sự kiện").disabled, true)
  }, popoverGlobals)
})

test("pauses and the end of a game are entered as broadcast positions", async () => {
  await withDom(async (document, render) => {
    const { VodSyncPanel } = await import("../src/features/esports/components/game/vod-sync-panel")
    const changes: unknown[] = []
    await render(
      <VodSyncPanel
        url=""
        startSecond={1800}
        pauses={[]}
        duration={900}
        gameAt={100}
        videoNow={2100}
        onChange={(change) => changes.push(change)}
      />,
    )
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Mốc video bắt đầu tạm dừng"]')!.value, "35:00")
    type(document.querySelector<HTMLInputElement>('[aria-label="Mốc video tiếp tục ván"]')!, "36:30")
    await settle()
    await act(async () => button(document, "Thêm").click())
    assert.deepEqual(changes.at(-1), { pauses: [{ atSeconds: 300, durationSeconds: 90 }] })
    assert.match(document.body.textContent ?? "", /Thời lượng ván ⏱15:00/)
  }, popoverGlobals)
})

test("ban/pick turns are recorded per team in order and only suggest heroes the rules still allow", async () => {
  await withDom(async (document, render) => {
    const { DraftEditor } = await import("../src/features/esports/components/game/draft-editor")
    const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
    const empty = { id: null, name: null }
    const sideOf = (code: "BLUE" | "RED", teamId: string) => ({
      side: code,
      teamId,
      bans: [empty, empty, empty, empty],
      participants: lanes.map((lane) => ({
        lane,
        hero: empty,
        spell: empty,
        arcana: { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      })),
    })
    const pick = (name: string) => ({ id: name.toLowerCase(), name })
    const content = {
      seriesId: "s",
      number: 2,
      region: "VN",
      locale: "vi-VN",
      sides: [sideOf("BLUE", "a"), sideOf("RED", "b")],
      draft: {
        startSecond: 100,
        lockedSecond: null,
        turns: [
          { order: 1, kind: "BAN" as const, side: "BLUE" as const, hero: pick("Aoi"), atSecond: 110 },
          { order: 2, kind: "BAN" as const, side: "RED" as const, hero: pick("Nakroth"), atSecond: 112 },
          { order: 3, kind: "BAN" as const, side: "BLUE" as const, hero: pick("Capheny"), atSecond: 114 },
          { order: 4, kind: "BAN" as const, side: "RED" as const, hero: pick("Elsu"), atSecond: 116 },
        ],
      },
    }
    const heroes = ["Florentino", "Aoi", "Murad", "Lauriel", "Nakroth", "Capheny", "Elsu", "Omen"].map((name) => ({
      ...pick(name),
      code: name.toLowerCase(),
    }))
    const locks = {
      decider: false,
      byTeam: new Map([["a", [{ gameNumber: 1, hero: { id: "florentino", name: "Florentino" } }]]]),
    }
    const results: (typeof content)[] = []
    await render(
      <DraftEditor
        content={content}
        view={{
          ...game,
          sides: {
            BLUE: { ...game.sides.BLUE, team: team("a", "Azure") },
            RED: { ...game.sides.RED, team: team("b", "Crimson") },
          },
        }}
        heroes={heroes}
        spells={[]}
        roster={() => []}
        locks={locks}
        videoNow={130}
        onChange={(change) => results.push(change(content) as typeof content)}
      />,
    )
    assert.ok(document.querySelector('[aria-label="Tướng Azure đã dùng ở ván trước"]'), "game 2 shows game 1 picks")

    // Turn 5 is Azure's first pick: no hero banned this game and none Azure played in game 1.
    await act(async () => document.querySelector<HTMLElement>('[aria-label^="Lượt 5 · Chọn · Azure"]')!.click())
    await settle()
    const options = [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.lastElementChild?.textContent,
    )
    assert.deepEqual(options, ["Murad", "Lauriel", "Omen"])
    type(document.querySelector<HTMLInputElement>('[aria-label^="Tìm lượt 5"]')!, "florentino")
    await settle()
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Azure đã dùng ở ván 1/)
    type(document.querySelector<HTMLInputElement>('[aria-label^="Tìm lượt 5"]')!, "")
    await settle()
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((option) => option.textContent?.includes("Murad"))!
        .click(),
    )

    const next = results.at(-1)!
    assert.deepEqual(next.draft.turns.at(-1), {
      order: 5,
      kind: "PICK",
      side: "BLUE",
      hero: pick("Murad"),
      atSecond: 130,
    })
    assert.deepEqual(
      next.sides[0]!.bans.map((ban) => ban.name),
      ["Aoi", "Capheny", null, null],
      "bans follow the team's ban turns",
    )
    assert.equal(next.sides[0]!.participants[0]!.hero.name, "Murad", "a new pick takes the first empty lane for now")
    assert.equal(
      (next.sides[0]!.participants[0] as { playerId?: string | null }).playerId,
      undefined,
      "picks are not tied to a player",
    )
  }, popoverGlobals)
})

test("the player uses its own controls below the video instead of YouTube's", async () => {
  await withDom(
    async (document, render) => {
      const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
      const instances = mockYouTube()
      await render(
        <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
      )
      const player = instances[0]
      assert.equal(player.vars.controls, 0, "YouTube's control bar is hidden")
      await act(async () => player.events.onReady({ target: player }))

      const bar = document.querySelector('[aria-label="Điều khiển video"]')!
      assert.equal(bar.closest('[title="Game"]'), null, "controls sit beside the video frame, never over it")
      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Phát"]')!.click())
      assert.equal(player.plays, 1)

      const seek = document.querySelector<HTMLInputElement>('[aria-label="Vị trí video"]')!
      assert.equal(seek.max, "20144", "the seek bar spans the real video")
      type(seek, "600")
      assert.deepEqual(player.seeks, [], "dragging the bar does not seek on every step")
      await act(async () => seek.dispatchEvent(new document.defaultView!.Event("pointerup", { bubbles: true })))
      assert.deepEqual(player.seeks, [600])

      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Tới 10 giây"]')!.click())
      assert.deepEqual(player.seeks, [600, 105], "skips from the shown position")
      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Tắt tiếng"]')!.click())
      assert.equal(player.muted, true)
      const speed = document.querySelector<HTMLSelectElement>('[aria-label="Tốc độ phát"]')!
      await act(async () => {
        Object.getOwnPropertyDescriptor(document.defaultView!.HTMLSelectElement.prototype, "value")!.set!.call(
          speed,
          "1.5",
        )
        speed.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }))
      })
      assert.deepEqual(player.rates, [1.5])
    },
    (window) => ({ HTMLSelectElement: window.HTMLSelectElement, Event: window.Event }),
  )
})

test("the floating player can be dragged anywhere in the window and keeps its place", async () => {
  await withDom(
    async (document, render) => {
      const previous = globalThis.IntersectionObserver
      let visibility: IntersectionObserverCallback
      globalThis.IntersectionObserver = class {
        constructor(callback: IntersectionObserverCallback) {
          visibility = callback
        }
        observe() {}
        disconnect() {}
      } as unknown as typeof IntersectionObserver
      try {
        const window = document.defaultView!
        window.localStorage.removeItem("esports:mini-player-position")
        const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
        mockYouTube()
        await render(
          <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
        )
        await act(async () =>
          visibility!(
            [{ isIntersecting: false, boundingClientRect: { bottom: -1 } } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          ),
        )
        const floating = document.querySelector<HTMLElement>("[data-floating]")!
        const handle = floating.querySelector<HTMLElement>('[role="toolbar"]')!
        const pointer = (type: string, x: number, y: number) =>
          act(async () => {
            handle.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
          })
        await pointer("pointerdown", 10, 10)
        await pointer("pointermove", 300, 200)
        await pointer("pointerup", 300, 200)
        assert.equal(floating.style.left, "290px")
        assert.equal(floating.style.top, "190px")
        assert.deepEqual(JSON.parse(window.localStorage.getItem("esports:mini-player-position")!), { x: 290, y: 190 })

        await act(async () =>
          handle.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })),
        )
        assert.equal(floating.style.left, "290px", "plain arrows stay video shortcuts")
        await act(async () =>
          handle.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
        )
        assert.equal(floating.style.left, "266px", "Alt + arrows move it")
        await pointer("pointerdown", 0, 0)
        await pointer("pointermove", -500, 5000)
        await pointer("pointerup", -500, 5000)
        assert.equal(floating.style.left, "8px", "it never leaves the window")
        assert.equal(floating.style.top, `${window.innerHeight - 8}px`)
      } finally {
        if (previous) globalThis.IntersectionObserver = previous
        else Reflect.deleteProperty(globalThis, "IntersectionObserver")
      }
    },
    (window) => ({ localStorage: window.localStorage }),
  )
})

test("the progress panel opens the step to fix and confirms only after a summary", async () => {
  await withDom(async (document, render) => {
    const { ProgressPanel } = await import("../src/features/esports/pages/progress-panel")
    const opened: string[] = []
    let confirmed = 0
    const progress = {
      done: 5,
      total: 5,
      state: "ready" as const,
      missing: [],
      steps: [
        {
          id: "spells",
          label: "Phụ trợ",
          detail: "10/10",
          status: "done" as const,
          required: true,
          target: "loadout" as const,
        },
        {
          id: "arcana",
          label: "Bảng ngọc",
          detail: "Chưa ghi",
          status: "todo" as const,
          required: false,
          target: "loadout" as const,
        },
      ],
    }
    await render(
      <ProgressPanel
        progress={progress}
        game={game}
        canPublish
        onOpen={(target) => opened.push(target)}
        onConfirm={async () => {
          confirmed++
          return true
        }}
      />,
    )
    await act(async () => document.querySelector<HTMLElement>('[data-step="arcana"]')!.click())
    assert.deepEqual(opened, ["loadout"])
    assert.match(document.body.textContent ?? "", /tùy nguồn/)

    await act(async () => button(document, "Xác nhận hoàn tất ván 1").click())
    await settle()
    assert.equal(confirmed, 0, "confirming first shows what will be published")
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /Azure/)
    await act(async () => button(document, "Xác nhận và xuất bản").click())
    await settle()
    assert.equal(confirmed, 1)
  }, popoverGlobals)
})

test("the loadout panel marks a whole team at the broadcast moment and keeps unknown loadouts apart", async () => {
  await withDom(async (document, render) => {
    const { LoadoutPanel } = await import("../src/features/esports/pages/loadout-panel")
    const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
    const empty = { id: null, name: null }
    const sideOf = (code: "BLUE" | "RED") => ({
      side: code,
      teamId: code,
      bans: [],
      participants: lanes.map((lane, index) => ({
        lane,
        hero: { id: null, name: `Hero ${index}` },
        spell: empty,
        arcana: index === 0 ? { status: "KNOWN" as const, entries: [] } : { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      })),
    })
    const content = { seriesId: "s", number: 1, region: "VN", locale: "vi-VN", sides: [sideOf("BLUE"), sideOf("RED")] }
    const results: (typeof content)[] = []
    const fiveSeats = (side: "BLUE" | "RED") =>
      lanes.map((lane, index) => ({
        ...game.sides[side].seats[0]!,
        key: `${side}:${lane}` as const,
        lane,
        playerName: `P${index}`,
      }))
    await render(
      <LoadoutPanel
        content={content}
        view={{
          ...game,
          sides: {
            BLUE: { ...game.sides.BLUE, seats: fiveSeats("BLUE") },
            RED: { ...game.sides.RED, seats: fiveSeats("RED") },
          },
        }}
        catalog={{ heroes: [], items: [], arcana: [], enchantments: [], spells: [] }}
        clock={{ videoNow: 1827, toGame: (second) => second - 1800, toVideo: (second) => second + 1800 }}
        onSeekGame={() => {}}
        onChange={(change) => results.push(change(content) as typeof content)}
      />,
    )
    await act(async () => button(document, "Mốc bảng ngọc cả đội").click())
    assert.deepEqual(
      results.at(-1)!.sides[0]!.participants.map((participant) => participant.arcana.observedAtSeconds),
      [27, 27, 27, 27, 27],
      "the mark is the game second at the player position",
    )
    assert.equal(
      results.at(-1)!.sides[1]!.participants[0]!.arcana.observedAtSeconds,
      undefined,
      "the other team is untouched",
    )

    await act(async () => button(document, "Bảng ngọc không hiển thị").click())
    assert.deepEqual(
      results.at(-1)!.sides[0]!.participants.map((participant) => participant.arcana.status),
      ["KNOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN"],
      "recorded loadouts are never overwritten as not shown",
    )
  }, popoverGlobals)
})

test("the schedule strip shows each game's progress, games nobody recorded and opens the right game", async () => {
  await withDom(async (document, render) => {
    const { MatchRecordingStrip } = await import("../src/features/esports/components/match-recording-strip")
    const progress = (state: "recording" | "confirmed", done: number) => ({
      steps: [],
      done,
      total: 6,
      state,
      missing: [],
    })
    const opened: (string | undefined)[] = []
    await render(
      <MatchRecordingStrip
        recording={{
          state: "missing",
          expected: 4,
          confirmed: 1,
          games: [
            { id: "g1", number: 1, progress: progress("confirmed", 6) },
            { id: "g3", number: 3, progress: progress("recording", 4) },
          ],
          gaps: [
            { text: "Thiếu 2/4 ván", kind: "missing" },
            { text: "Ván 3: thiếu kết quả", kind: "missing", gameId: "g3" },
          ],
        }}
        onOpen={(gameId) => opened.push(gameId)}
      />,
    )
    const text = document.body.textContent ?? ""
    assert.match(text, /Cần bổ sung/)
    assert.match(text, /V1Đã xác nhận/)
    assert.match(text, /V34\/6/)
    assert.match(text, /V2 chưa ghi/, "the first unrecorded number is game 2")
    assert.match(text, /V4 chưa ghi/)
    await act(async () => button(document, "Ván 3: thiếu kết quả").click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Mở ván 1"]')!.click())
    assert.deepEqual(opened, ["g3", "g1"])
  })
})

test("clicking into the video hands keyboard focus back so page shortcuts keep working", async () => {
  await withDom(async (document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    mockYouTube()
    await render(
      <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
    )
    const window = document.defaultView!
    const frame = document.createElement("iframe")
    document.querySelector('[title="Game"]')!.append(frame)
    frame.focus()
    assert.equal(document.activeElement, frame)
    await act(async () => {
      window.dispatchEvent(new window.Event("blur"))
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    assert.notEqual(document.activeElement, frame)
  })
})
