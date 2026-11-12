import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act } from "react"
import { JSDOM } from "jsdom"
import type { GameContent, Participant } from "@aov/community-contracts"
import {
  defaultSpan,
  retimeRange,
  spanLabel,
  timelineSpans,
  type RetimeTarget,
} from "../src/features/esports/model/broadcast-timeline"
import type { GameView } from "../src/features/esports/model/game-view"
import { moveMark, observationMarks } from "../src/features/esports/model/observation-marks"
import type { GameChapter } from "../src/features/esports/model/series-vod"

const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
const player = (lane: Participant["lane"], overrides: Partial<Participant> = {}): Participant => ({
  lane,
  hero: { id: null, name: `Hero ${lane}` },
  spell: { id: null, name: null },
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "UNKNOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  ...overrides,
})
const snapshot = (atSeconds: number) => ({ atSeconds, slots: [] })

test("the moments a broadcast showed loadouts are one mark per team, part and second", () => {
  const blue = lanes.map((lane) =>
    player(lane, {
      spellObservedAtSeconds: 42,
      enchantments: { status: "KNOWN", entries: [], observedAtSeconds: 42 },
      ...(lane === "TOP"
        ? {
            arcana: { status: "PARTIAL", entries: [], observedAtSeconds: 2343 },
            equipmentSnapshots: [snapshot(300), snapshot(600)],
          }
        : {}),
      ...(lane === "JUNGLE"
        ? {
            arcana: { status: "PARTIAL", entries: [], observedAtSeconds: 2350 },
            equipmentSnapshots: [snapshot(300), snapshot(900)],
          }
        : {}),
    }),
  )
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    sides: [
      { side: "BLUE", teamId: "a", bans: [], participants: blue },
      { side: "RED", teamId: "b", bans: [], participants: lanes.map((lane) => player(lane)) },
    ],
  } as GameContent

  const marks = observationMarks(content, 2400)
  assert.deepEqual(
    marks.map((mark) => `${mark.side} ${mark.part} ${mark.at} ${mark.lanes.join("+")} ${mark.min}-${mark.max}`),
    [
      "BLUE spell 42 TOP+JUNGLE+MID+DRAGON+SUPPORT 0-2400",
      "BLUE enchantments 42 TOP+JUNGLE+MID+DRAGON+SUPPORT 0-2400",
      "BLUE equipment 300 TOP+JUNGLE 0-599",
      "BLUE equipment 600 TOP 301-2400",
      "BLUE equipment 900 JUNGLE 301-2400",
      "BLUE arcana 2343 TOP 0-2400",
      "BLUE arcana 2350 JUNGLE 0-2400",
    ],
    "a shared equipment mark stays before the next snapshot of every player it stands for",
  )

  const equipped = moveMark(content, { side: "BLUE", part: "equipment", at: 300 }, 450)!
  assert.deepEqual(
    equipped.sides[0]!.participants.slice(0, 2).map((entry) => entry.equipmentSnapshots.map((item) => item.atSeconds)),
    [
      [450, 600],
      [450, 900],
    ],
  )
  assert.equal(equipped.sides[1], content.sides[1], "the other team is not rebuilt")

  const shown = moveMark(content, { side: "BLUE", part: "enchantments", at: 42 }, 50.4)!
  assert.deepEqual(
    shown.sides[0]!.participants.map((entry) => [entry.enchantments.observedAtSeconds, entry.spellObservedAtSeconds]),
    lanes.map(() => [50, 42]),
    "only the dragged part moves, for the whole group",
  )
  assert.equal(moveMark(content, { side: "RED", part: "arcana", at: 1 }, 5), null)
})

const drafted: GameChapter = {
  gameId: "g1",
  number: 2,
  from: 1000,
  start: 1300,
  end: 2200,
  duration: 900,
  synced: true,
  live: true,
  draft: {
    start: 1000,
    locked: 1250,
    turns: [
      { order: 1, kind: "BAN", side: "BLUE", hero: { name: "A" }, atSecond: 1050 },
      { order: 2, kind: "BAN", side: "RED", hero: { name: "B" }, atSecond: 1200 },
    ],
  },
  sync: { url: "", startSecond: 1300, pauses: [] },
  winner: null,
  events: [],
  marks: [{ side: "BLUE", part: "equipment", at: 300, lanes: ["TOP"], min: 0, max: 599 }],
}

test("the edges of the ban/pick phase and the loadout marks move only where the service accepts them", () => {
  const edge = (kind: "draftStart" | "draftLock" | "gameStart"): RetimeTarget => ({ kind, gameId: "g1" })
  assert.deepEqual(
    retimeRange(drafted, edge("draftStart"), 5000, { previousEnd: 900 }),
    { min: 901, max: 1050 },
    "the phase starts after the previous game and before its first turn",
  )
  assert.deepEqual(retimeRange(drafted, edge("draftStart"), 5000), { min: 0, max: 1050 })
  assert.deepEqual(retimeRange(drafted, edge("draftLock"), 5000), { min: 1200, max: 1300 }, "last turn to game start")
  assert.deepEqual(
    retimeRange(drafted, edge("gameStart"), 5000, { nextFrom: 2500 }),
    { min: 1250, max: 1599 },
    "the game starts after the lock and still ends before the next game",
  )
  assert.deepEqual(
    retimeRange(drafted, edge("gameStart"), 5000, { nextFrom: 2100 }),
    { min: 1250, max: 1300 },
    "a game already running into the next one can only be pulled back",
  )
  const mark: RetimeTarget = { kind: "mark", gameId: "g1", side: "BLUE", part: "equipment", at: 300 }
  assert.deepEqual(retimeRange(drafted, mark, 5000), { min: 1300, max: 1899 }, "game seconds 0 to 599 on the video")
  assert.equal(retimeRange(drafted, { ...mark, at: 301 }, 5000), null)

  const waiting = { ...drafted, live: false }
  assert.equal(retimeRange(waiting, edge("gameStart"), 5000), null, "no game start to move before the game is live")
  assert.equal(retimeRange(waiting, mark, 5000), null)
  assert.deepEqual(retimeRange(waiting, edge("draftLock"), 5000), { min: 1200, max: 5000 })
  const open = { ...drafted, draft: { ...drafted.draft!, locked: null } }
  assert.equal(retimeRange(open, edge("draftLock"), 5000), null)
  assert.deepEqual(retimeRange({ ...drafted, draft: null }, edge("gameStart"), 5000, { previousEnd: 900 }), {
    min: 901,
    max: 4100,
  })
})

async function withDom(run: (document: Document, render: (node: React.ReactNode) => Promise<void>) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments" })
  const window = dom.window
  const values = {
    React,
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
    CSS: { escape: (value: string) => value },
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(window.document.getElementById("root")!)
  try {
    await run(window.document, async (node) => {
      await act(async () => root.render(node))
    })
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
    window.close()
  }
}

const seat = (side: "BLUE" | "RED", lane: "MID" | "JUNGLE", name: string) => ({
  key: `${side}:${lane}` as const,
  side,
  lane,
  playerName: name,
  hero: { name: "Hero" },
  spell: null,
  enchantments: { status: "UNKNOWN" as const, entries: [] },
  arcana: { status: "UNKNOWN" as const, entries: [] },
})
const view = {
  id: "g1",
  number: 1,
  winner: null,
  durationSeconds: 600,
  published: false,
  missingFields: [],
  sides: {
    BLUE: {
      side: "BLUE",
      team: { id: "a", name: "Azure", shortName: "AZU" },
      bans: [],
      seats: [seat("BLUE", "MID", "Mid A"), seat("BLUE", "JUNGLE", "Jg A")],
    },
    RED: {
      side: "RED",
      team: { id: "b", name: "Crimson", shortName: "CRI" },
      bans: [],
      seats: [seat("RED", "MID", "Mid B"), seat("RED", "JUNGLE", "Jg B")],
    },
  },
  snapshots: {},
} as unknown as GameView

test("dragging an edge or a mark makes the video follow, and a cancelled drag puts it back", async () => {
  await withDom(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const window = document.defaultView!
    const moved: [string, number][] = []
    const seeks: number[] = []
    const chapter: GameChapter = {
      gameId: "g1",
      number: 1,
      from: 100,
      start: 300,
      end: 900,
      duration: 600,
      synced: true,
      live: true,
      draft: { start: 100, locked: 250, turns: [] },
      sync: { url: "", startSecond: 300, pauses: [] },
      winner: null,
      events: [],
      marks: [
        { side: "BLUE", part: "enchantments", at: 42, lanes: ["MID", "JUNGLE"], min: 0, max: 600 },
        { side: "BLUE", part: "spell", at: 42, lanes: ["MID"], min: 0, max: 600 },
      ],
    }
    const timeline = (editing: boolean) => (
      <BroadcastTimeline
        duration={1200}
        current={320}
        chapters={[chapter]}
        flags={[{ id: "g1", at: 300, label: "Bắt đầu ván 1" }]}
        events={[]}
        views={{ g1: view }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={{ itemIcon: () => null, itemTier: () => 3 }}
        editing={
          editing
            ? {
                gameId: "g1",
                canCreate: true,
                onCreate: () => {},
                onRetime: (target, second) =>
                  moved.push([target.kind === "mark" ? `mark ${target.part} ${target.at}` : target.kind, second]),
              }
            : undefined
        }
        onSeek={(second) => seeks.push(second)}
        onSelect={() => {}}
        onOpen={() => {}}
      />
    )
    const pointer = (type: string, clientX: number) =>
      new window.MouseEvent(type, { bubbles: true, clientX, clientY: 0, button: 0 })
    const measure = () => {
      const slider = document.querySelector<HTMLElement>('[role="slider"]')!
      slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 158 }) as DOMRect
    }
    const drag = async (selector: string, from: number, to: number, end = "pointerup") => {
      const marker = document.querySelector<HTMLElement>(selector)!
      await act(async () => marker.dispatchEvent(pointer("pointerdown", from)))
      await act(async () => window.dispatchEvent(pointer("pointermove", to)))
      await act(async () => window.dispatchEvent(pointer(end, to)))
    }

    await render(timeline(false))
    measure()
    const shown = document.querySelector<HTMLElement>('[data-mark="enchantments"]')!
    assert.match(shown.getAttribute("aria-label") ?? "", /Ván 1 · Video hiện phù hiệu · AZU · cả đội · 0:42/)
    assert.match(
      document.querySelector('[data-mark="spell"]')!.getAttribute("aria-label") ?? "",
      /Video hiện phụ trợ · AZU · Mid A/,
    )
    assert.equal(
      document.querySelector<HTMLElement>('[data-mark="spell"]')!.style.marginLeft,
      "15px",
      "two marks of one team at the same second sit side by side",
    )
    assert.match(
      document.querySelector('[data-edge="draftStart"]')!.getAttribute("aria-label") ?? "",
      /Bắt đầu cấm chọn ván 1 · 1:40/,
    )
    assert.equal(document.querySelectorAll("[data-movable]").length, 0, "reading moves nothing")
    await act(async () => shown.click())
    assert.deepEqual(seeks, [342], "a mark seeks to the moment it stands for")
    await drag('[data-edge="draftStart"]', 100, 60)
    assert.deepEqual(moved, [])

    await render(timeline(true))
    measure()
    seeks.length = 0
    assert.equal(document.querySelectorAll("[data-movable]").length, 5, "two edges, the game start and two marks")

    const edge = document.querySelector<HTMLElement>('[data-edge="draftStart"]')!
    await act(async () => edge.dispatchEvent(pointer("pointerdown", 100)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 60)))
    assert.deepEqual(seeks, [60], "the video goes where the edge is being dragged")
    assert.match(document.querySelector("[data-moving]")!.textContent ?? "", /1:40 → 1:00/)
    assert.equal(edge.style.left, "5%")
    await act(async () => window.dispatchEvent(pointer("pointerup", 400)))
    assert.deepEqual(moved, [["draftStart", 250]], "the phase cannot start after its lock")
    assert.equal(seeks.at(-1), 250, "and the video stays where the edge landed")

    await drag('[data-edge="draftLock"]', 250, 280)
    await drag('[data-edge="gameStart"]', 300, 500)
    await drag('[data-mark="enchantments"]', 342, 400)
    assert.deepEqual(moved.slice(1), [
      ["draftLock", 280],
      ["gameStart", 500],
      ["mark enchantments 42", 400],
    ])
    assert.equal(seeks.at(-1), 400)

    await drag('[data-mark="spell"]', 342, 380, "pointercancel")
    assert.equal(moved.length, 4, "a cancelled drag saves nothing")
    assert.equal(seeks.at(-1), 320, "and returns the video to where it was")

    await act(async () =>
      document
        .querySelector<HTMLElement>('[data-edge="draftLock"]')!
        .dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
    )
    assert.deepEqual(moved.at(-1), ["draftLock", 249])
    assert.equal(seeks.at(-1), 249)
  })
})

test("the track opens on a span that holds the focused game, whatever the length of the video", () => {
  const broadcast = 11 * 3600 + 54 * 60 + 59
  assert.deepEqual(timelineSpans(broadcast), [300, 600, 900, 1800, 3600, 7200, 14400, 28800, broadcast])
  assert.deepEqual(timelineSpans(1200), [300, 600, 900, 1200], "a short video never offers more than itself")

  // Game 1 of the grand final: 11:37 of play after seven minutes of bans and picks.
  const game = { from: 27154, end: 27574 + 697 }
  assert.equal(defaultSpan(broadcast, game), 1800)
  assert.equal(spanLabel(defaultSpan(broadcast, game), broadcast), "30 phút")
  assert.equal(defaultSpan(broadcast, { from: 0, end: 2700 }), 3600, "a long game takes the next round span")
  assert.equal(defaultSpan(broadcast, { from: 0, end: broadcast }), broadcast)
  assert.equal(defaultSpan(broadcast, null), 14400, "without a game, about a quarter of a long video")
  assert.equal(defaultSpan(1500, null), 1500, "a short video is shown whole")
  assert.equal(defaultSpan(1500, { from: 100, end: 1400 }), 1500)
  assert.deepEqual(
    [300, 3600, 14400, broadcast].map((span) => spanLabel(span, broadcast)),
    ["5 phút", "1 giờ", "4 giờ", "Cả video"],
  )
})
