import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { GameContent, Participant } from "@aov/community-contracts"
import {
  clampSpan,
  defaultSpan,
  neighboursOf,
  phaseSpan,
  retimeRange,
  spanLabel,
  timelineSpans,
  type RetimeTarget,
} from "../src/features/esports/model/broadcast-timeline"
import type { GameView } from "../src/features/esports/model/game-view"
import { moveMark, observationMarks } from "../src/features/esports/model/observation-marks"
import { createPlayhead } from "../src/features/esports/model/playhead"
import { phaseRange, placeAt } from "../src/features/esports/model/playback-place"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import { waitFor } from "./fixtures/dom"
import { inPage, lookups } from "./fixtures/esports-ui"

const NO_EVENTS: TimelineEvent[] = []

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
  const content: GameContent = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    sides: [
      { side: "BLUE", teamId: "a", bans: [], participants: blue },
      { side: "RED", teamId: "b", bans: [], participants: lanes.map((lane) => player(lane)) },
    ],
  }

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
  videoId: "R5rCsGqDJIg",
  from: 1000,
  start: 1300,
  end: 2200,
  duration: 900,
  synced: true,
  live: true,
  ended: true,
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

test("the edges of a game and the loadout marks move only where the service accepts them", () => {
  const edge = (kind: "draftStart" | "draftLock" | "gameStart" | "gameEnd"): RetimeTarget => ({ kind, gameId: "g1" })
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
  assert.deepEqual(
    retimeRange(drafted, edge("gameEnd"), 5000, { nextFrom: 2500 }),
    { min: 1600, max: 2499 },
    "the game ends after the last thing it shows and before the next game",
  )
  assert.deepEqual(retimeRange({ ...drafted, recordedTo: 700 }, edge("gameEnd"), 5000), { min: 2000, max: 5000 })
  assert.deepEqual(
    retimeRange(drafted, edge("gameEnd"), 5000, { nextFrom: 2100 }),
    { min: 1600, max: 2200 },
    "an end inside the next game can only be pulled back",
  )
  const mark: RetimeTarget = { kind: "mark", gameId: "g1", side: "BLUE", part: "equipment", at: 300 }
  assert.deepEqual(retimeRange(drafted, mark, 5000), { min: 1300, max: 1899 }, "game seconds 0 to 599 on the video")
  assert.equal(retimeRange(drafted, { ...mark, at: 301 }, 5000), null)

  const waiting = { ...drafted, live: false }
  assert.equal(retimeRange(waiting, edge("gameStart"), 5000), null, "no game start to move before the game is live")
  assert.equal(retimeRange(waiting, edge("gameEnd"), 5000), null)
  assert.equal(retimeRange(waiting, mark, 5000), null)
  assert.deepEqual(retimeRange(waiting, edge("draftLock"), 5000), { min: 1200, max: 5000 })
  const open = { ...drafted, draft: { ...drafted.draft!, locked: null } }
  assert.equal(retimeRange(open, edge("draftLock"), 5000), null)
  assert.deepEqual(retimeRange({ ...drafted, draft: null }, edge("gameStart"), 5000, { previousEnd: 900 }), {
    min: 901,
    max: 4100,
  })
})

test("in a game without an end a moment may go to the next game, and there is no end to move", () => {
  const moment: TimelineEvent = { id: "n", kind: "NOTE", at: 60, title: "Steal" }
  const open: GameChapter = { ...drafted, ended: false, events: [moment] }
  const target: RetimeTarget = { kind: "event", gameId: "g1", id: "n" }
  assert.deepEqual(retimeRange(open, target, 5000, { nextFrom: 4000 }), { min: 1300, max: 3999 })
  assert.deepEqual(retimeRange(open, target, 5000), { min: 1300, max: 5000 }, "or to the end of the video")
  assert.deepEqual(retimeRange({ ...open, ended: true }, target, 5000), { min: 1300, max: 2200 })
  assert.equal(retimeRange(open, { kind: "gameEnd", gameId: "g1" }, 5000), null)
})

test("the neighbours of a game are placed games, and an estimated end bounds nothing", () => {
  const before: GameChapter = {
    ...drafted,
    gameId: "g0",
    number: 1,
    from: 100,
    start: 100,
    end: 1000,
    ended: false,
    sync: { url: "", startSecond: 100, pauses: [] },
  }
  const elsewhere: GameChapter = { ...drafted, gameId: "g2", number: 3, from: 0, start: 0, end: 0, synced: false }
  const after: GameChapter = { ...drafted, gameId: "g3", number: 4, from: 3000, start: 3300, end: 4200 }
  const chapters = [before, drafted, elsewhere, after]
  assert.deepEqual(neighboursOf(chapters, "g1"), { previousEnd: 400, nextFrom: 3000 }, "game 1 shows something at 5:00")
  assert.deepEqual(neighboursOf(chapters, "g3"), { previousEnd: 2200, nextFrom: null })
})

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
  await inPage(async (document, render) => {
    const { MatchTimeline } = await import("../src/features/esports/components/series/timeline/match-timeline")
    const window = document.defaultView!
    const moved: [string, number][] = []
    const seeks: number[] = []
    const playhead = createPlayhead(320)
    const chapter: GameChapter = {
      gameId: "g1",
      number: 1,
      videoId: "R5rCsGqDJIg",
      from: 100,
      start: 300,
      end: 900,
      duration: 600,
      synced: true,
      live: true,
      ended: true,
      draft: { start: 100, locked: 250, turns: [] },
      sync: { url: "", startSecond: 300, pauses: [] },
      winner: null,
      events: [],
      marks: [
        { side: "BLUE", part: "enchantments", at: 42, lanes: ["MID", "JUNGLE"], min: 0, max: 600 },
        { side: "BLUE", part: "spell", at: 42, lanes: ["MID"], min: 0, max: 600 },
      ],
    }
    const chapters = [chapter]
    const views = { g1: view }
    const flags = [{ id: "g1", at: 300, label: "Vào trận ván 1" }]
    const timeline = (editing: boolean) => (
      <MatchTimeline
        duration={1200}
        playhead={playhead}
        chapters={chapters}
        flags={flags}
        events={NO_EVENTS}
        views={views}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
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
    assert.match(shown.getAttribute("aria-label") ?? "", /Ván 1, video hiện phù hiệu của AZU, cả đội, 0:42/)
    assert.match(
      document.querySelector('[data-mark="spell"]')!.getAttribute("aria-label") ?? "",
      /video hiện phụ trợ của AZU, Mid A/,
    )
    assert.equal(
      document.querySelector<HTMLElement>('[data-mark="spell"]')!.style.marginLeft,
      "15px",
      "two marks of one team at the same second sit side by side",
    )
    assert.match(
      document.querySelector('[data-edge="draftStart"]')!.getAttribute("aria-label") ?? "",
      /Bắt đầu cấm chọn ván 1, ▸1:40/,
    )
    assert.equal(document.querySelectorAll("[data-movable]").length, 0, "reading moves nothing")
    // The hatched ban/pick zone runs from its start (100) to the lock (250); the wait until the game (300) is apart.
    assert.equal(document.querySelector<HTMLElement>('[data-part="draft"]')!.style.width, "12.5%")
    const wait = document.querySelector<HTMLElement>('[data-part="wait"]')!
    assert.match(wait.style.left, /^20\.83/)
    assert.match(wait.style.width, /^4\.16/)
    await act(async () => shown.click())
    assert.deepEqual(seeks, [342], "a mark seeks to the moment it stands for")
    await drag('[data-edge="draftStart"]', 100, 60)
    assert.deepEqual(moved, [])

    await render(timeline(true))
    measure()
    seeks.length = 0
    assert.equal(
      document.querySelectorAll("[data-movable]").length,
      6,
      "two edges of the draft, the start and the end of the game, and two marks",
    )

    const edge = document.querySelector<HTMLElement>('[data-edge="draftStart"]')!
    await act(async () => edge.dispatchEvent(pointer("pointerdown", 100)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 60)))
    assert.deepEqual(seeks, [60], "the video goes where the edge is being dragged")
    assert.match(document.querySelector("[data-moving]")!.textContent ?? "", /Bắt đầu cấm chọn ván 1: ▸1:40 → ▸1:00/)
    assert.equal(edge.style.left, "5%")
    await act(async () => window.dispatchEvent(pointer("pointerup", 400)))
    assert.deepEqual(moved, [["draftStart", 250]], "the phase cannot start after its lock")
    assert.equal(seeks.at(-1), 250, "and the video stays where the edge landed")

    await drag('[data-edge="draftLock"]', 250, 280)
    await drag('[data-edge="gameStart"]', 300, 500)
    await drag('[data-edge="gameEnd"]', 900, 1000)
    await drag('[data-mark="enchantments"]', 342, 400)
    assert.deepEqual(moved.slice(1), [
      ["draftLock", 280],
      ["gameStart", 500],
      ["gameEnd", 1000],
      ["mark enchantments 42", 400],
    ])
    assert.equal(seeks.at(-1), 400)

    await drag('[data-mark="spell"]', 342, 380, "pointercancel")
    assert.equal(moved.length, 5, "a cancelled drag saves nothing")
    assert.equal(seeks.at(-1), 320, "and returns the video to where it was")

    const spell = document.querySelector<HTMLElement>('[data-mark="spell"]')!
    await act(async () => spell.dispatchEvent(pointer("pointerdown", 342)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 400)))
    await act(async () =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    )
    await act(async () => window.dispatchEvent(pointer("pointerup", 400)))
    assert.equal(moved.length, 5, "Esc puts the mark back")
    assert.equal(seeks.at(-1), 320)

    await act(async () =>
      document
        .querySelector<HTMLElement>('[data-edge="draftLock"]')!
        .dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
    )
    assert.equal(seeks.at(-1), 249)
    await waitFor(() => moved.length === 6)
    assert.deepEqual(moved.at(-1), ["draftLock", 249])
  })
})

test("the track opens on a span that holds the phase on screen, whatever the length of the video", () => {
  const broadcast = 11 * 3600 + 54 * 60 + 59
  assert.deepEqual(timelineSpans(broadcast), [
    300,
    600,
    900,
    1200,
    1800,
    2700,
    3600,
    5400,
    7200,
    14400,
    28800,
    broadcast,
  ])
  assert.deepEqual(timelineSpans(1200), [300, 600, 900, 1200], "a short video never offers more than itself")

  // Game 1 of the grand final: 11:37 of play after seven minutes of bans and picks.
  const start = 27574
  const game: GameChapter = {
    ...drafted,
    from: 27154,
    start,
    end: start + 697,
    duration: 697,
    draft: { start: 27154, locked: 27500, turns: [] },
    sync: { url: "", startSecond: start, pauses: [] },
  }
  const spanAt = (second: number, chapter = game) =>
    phaseSpan(phaseRange(placeAt([chapter], second), second, broadcast)!, broadcast)
  assert.equal(Math.round(spanAt(start + 60)), Math.round(697 * 1.08), "the game with a little air around it")
  assert.equal(spanLabel(spanAt(start + 60), broadcast), "13 phút")
  assert.equal(Math.round(spanAt(27200)), Math.round(346 * 1.08), "or its draft")
  assert.equal(spanAt(start + 60, { ...game, end: start + 120, duration: 120 }), 300, "at least five minutes")
  assert.equal(phaseSpan({ from: 100, to: 1400 }, 1200), 1200, "and never more than the video")
  assert.equal(defaultSpan(broadcast), 14400, "without a game, about a quarter of a long video")
  assert.equal(defaultSpan(1500), 1500, "a short video is shown whole")
  assert.deepEqual(
    [300, 2700, 3600, 5400, 14400, broadcast].map((span) => spanLabel(span, broadcast)),
    ["5 phút", "45 phút", "1 giờ", "1,5 giờ", "4 giờ", "Cả video"],
  )
})

test("the track zooms around the pointer with Ctrl + wheel and with a two-finger pinch", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await import("../src/features/esports/components/series/timeline/match-timeline")
    const window = document.defaultView!
    await render(
      <MatchTimeline
        duration={7200}
        playhead={createPlayhead(600)}
        chapters={[]}
        events={NO_EVENTS}
        views={{}}
        focusedGameId={null}
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    const view = document.querySelector<HTMLElement>("[data-timeline-viewport]")!
    view.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 180 }) as DOMRect
    document.querySelector<HTMLElement>('[role="slider"]')!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 4000, height: 158 }) as DOMRect
    const range = () => document.querySelector('[aria-label^="Khoảng đang xem"]')?.textContent
    const gesture = async (type: string, values: Record<string, unknown>) => {
      const event = Object.assign(new window.Event(type, { bubbles: true, cancelable: true }), values)
      await act(async () => void view.dispatchEvent(event))
      return event
    }
    const fingers = (first: number, second: number) => ({
      touches: [
        { clientX: first, clientY: 0 },
        { clientX: second, clientY: 0 },
      ],
    })
    assert.equal(range(), "30 phút")

    const scroll = await gesture("wheel", { deltaY: -300, clientX: 500 })
    assert.equal(scroll.defaultPrevented, false, "a plain wheel still scrolls the page")
    assert.equal(range(), "30 phút")

    const zoomIn = await gesture("wheel", { deltaY: -300, ctrlKey: true, clientX: 500 })
    assert.equal(zoomIn.defaultPrevented, true, "the browser does not zoom the page as well")
    assert.equal(range(), "11 phút", "one long pull of the wheel shows about a third of the span")
    await gesture("wheel", { deltaY: 300, ctrlKey: true, clientX: 500 })
    await gesture("wheel", { deltaY: 300, ctrlKey: true, clientX: 500 })
    assert.equal(range(), "1,4 giờ")
    for (let turn = 0; turn < 3; turn++) await gesture("wheel", { deltaY: 9, deltaMode: 1, ctrlKey: true, clientX: 0 })
    assert.equal(range(), "Cả video", "zooming out stops at the whole video")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng dài hơn"]')!.disabled, true)

    await gesture("touchstart", fingers(400, 600))
    await gesture("touchmove", fingers(300, 700))
    assert.equal(range(), "1 giờ", "fingers twice as far apart show half the span")
    const pinch = await gesture("touchmove", fingers(100, 900))
    assert.equal(pinch.defaultPrevented, true)
    assert.equal(range(), "30 phút")
    await gesture("touchend", { touches: [] })
    await gesture("touchmove", fingers(0, 1000))
    assert.equal(range(), "30 phút", "a pinch ends when the fingers lift")

    for (let turn = 0; turn < 8; turn++) await gesture("wheel", { deltaY: -300, ctrlKey: true, clientX: 500 })
    assert.equal(range(), "1 phút", "zooming in stops at one minute")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng ngắn hơn"]')!.disabled, true)
    assert.equal(clampSpan(7200, 5), 60)
    assert.equal(clampSpan(30, 5), 30, "a video shorter than a minute is its own shortest span")
    assert.equal(clampSpan(7200, 99999), 7200)
  })
})
