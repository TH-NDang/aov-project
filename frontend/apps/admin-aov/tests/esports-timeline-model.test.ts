import assert from "node:assert/strict"
import { test } from "node:test"
import type { EquipmentEvent, EquipmentSnapshot, GameContent } from "@aov/community-contracts"
import {
  clusterEvents,
  clusterKills,
  eventSide,
  inventoryAt,
  killScoreAt,
  seatStatsAt,
  type ItemEvent,
  type TimelineEvent,
} from "../src/features/esports/model/timeline"
import {
  moveEvent,
  readTimeline,
  upsertEvent,
  withPlayback,
  writeTimeline,
} from "../src/features/esports/model/timeline-io"

test("inventory at a moment starts from the latest snapshot and never invents unseen slots", () => {
  const events: TimelineEvent[] = [
    { id: "1", kind: "ITEM", at: 60, seat: "BLUE:MID", action: "BUY", slot: 1, item: { name: "Sách" } },
    { id: "2", kind: "ITEM", at: 400, seat: "BLUE:MID", action: "SELL", slot: 2 },
    { id: "3", kind: "ITEM", at: 500, seat: "RED:MID", action: "BUY", slot: 1, item: { name: "Khác" } },
  ]
  const snapshots = [
    {
      atSeconds: 300,
      slots: [
        { slot: 1, known: true, item: { id: "a", name: "Trượng" } },
        { slot: 2, known: true, item: { id: "b", name: "Giày" } },
        { slot: 3, known: true, item: null },
        { slot: 4, known: false, item: null },
      ],
    },
  ]
  assert.deepEqual(inventoryAt("BLUE:MID", 100, [], events), [
    { name: "Sách" },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  const later = inventoryAt("BLUE:MID", 450, snapshots, events)
  assert.deepEqual(later.slice(0, 4), [{ id: "a", name: "Trượng" }, null, null, undefined])
  assert.equal(
    inventoryAt("BLUE:MID", 450, snapshots, events)[0]?.name,
    "Trượng",
    "events before the snapshot are superseded",
  )
})

/** The first two slots of one player, seen at 5:00. */
const seenAt300: EquipmentSnapshot[] = [
  {
    atSeconds: 300,
    slots: [
      { slot: 1, known: true, item: { id: "a", name: "Trượng" } },
      { slot: 2, known: true, item: { id: "b", name: "Giày" } },
    ],
  },
]

test("a snapshot taken at the second asked for is the inventory of that second", () => {
  assert.deepEqual(inventoryAt("BLUE:MID", 300, seenAt300, []).slice(0, 2), [
    { id: "a", name: "Trượng" },
    { id: "b", name: "Giày" },
  ])
})

test("an item event at the second of a snapshot is already in it", () => {
  const sold: TimelineEvent[] = [{ id: "s", kind: "ITEM", at: 300, seat: "BLUE:MID", action: "SELL", slot: 2 }]
  assert.deepEqual(inventoryAt("BLUE:MID", 400, seenAt300, sold)[1], { id: "b", name: "Giày" })
})

test("a swap trades the items of its two slots", () => {
  const swapped: TimelineEvent[] = [
    { id: "w", kind: "ITEM", at: 350, seat: "BLUE:MID", action: "SWAP", slot: 1, toSlot: 2 },
  ]
  assert.deepEqual(inventoryAt("BLUE:MID", 400, seenAt300, swapped).slice(0, 2), [
    { id: "b", name: "Giày" },
    { id: "a", name: "Trượng" },
  ])
})

test("kill score and KDA only count events up to the playhead", () => {
  const events: TimelineEvent[] = [
    { id: "1", kind: "KILL", at: 100, killer: "BLUE:JUNGLE", victim: "RED:MID", assists: ["BLUE:MID"] },
    { id: "2", kind: "KILL", at: 200, victim: "BLUE:DRAGON", assists: [] },
    { id: "3", kind: "OBJECTIVE", at: 250, side: "RED", objective: "ABYSSAL_DRAGON" },
  ]
  assert.deepEqual(killScoreAt(events, 150), { BLUE: 1, RED: 0 })
  assert.deepEqual(killScoreAt(events, 300), { BLUE: 1, RED: 1 }, "an unknown killer still scores for the other side")
  assert.deepEqual(seatStatsAt(events, 300).get("BLUE:MID"), { kills: 0, deaths: 0, assists: 1 })
  assert.equal(seatStatsAt(events, 150).get("BLUE:DRAGON"), undefined)
})

test("timeline moments round-trip through the API shape: items on participants, the rest in timeline", () => {
  const participant = (lane: "MID" | "JUNGLE") => ({
    lane,
    hero: { id: null, name: lane },
    spell: {},
    arcana: { status: "UNKNOWN" as const, entries: [] },
    enchantments: { status: "UNKNOWN" as const, entries: [] },
    equipmentSnapshots: [],
    equipmentEvents: [{ atSeconds: 50, type: "BUY" as const, item: { id: null, name: "Old" }, toSlot: 1 }],
  })
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    sides: [
      { side: "BLUE" as const, teamId: "a", bans: [], participants: [participant("MID")] },
      { side: "RED" as const, teamId: "b", bans: [], participants: [participant("JUNGLE")] },
    ],
    timeline: { pauses: [{ atSeconds: 300, durationSeconds: 60 }], events: [] },
  }
  const moments: TimelineEvent[] = [
    { id: "kill-1", kind: "KILL", at: 120, killer: "RED:JUNGLE", victim: "BLUE:MID", assists: [] },
    { id: "sell-1", kind: "ITEM", at: 400, seat: "BLUE:MID", action: "SELL", slot: 1, item: { name: "Old" } },
    {
      id: "buy-1",
      kind: "ITEM",
      at: 30,
      seat: "BLUE:MID",
      action: "BUY",
      slot: 2,
      item: { id: "boots", name: "Boots" },
    },
    { id: "note-1", kind: "NOTE", at: 200, title: "Gank", side: "RED" },
  ]

  const written = writeTimeline(content, upsertEvent(readTimeline(content), moments[0]))
  const full = writeTimeline(written, [...readTimeline(written), ...moments.slice(1)])
  const blue = full.sides[0].participants[0].equipmentEvents
  assert.deepEqual(
    blue.map((event) => [event.atSeconds, event.type, event.toSlot ?? event.fromSlot, event.item?.name]),
    [
      [30, "BUY", 2, "Boots"],
      [50, "BUY", 1, "Old"],
      [400, "SELL", 1, "Old"],
    ],
    "equipment events are stored time-ordered on their participant",
  )
  assert.deepEqual(full.sides[1].participants[0].equipmentEvents.length, 1)
  assert.deepEqual(
    full.timeline?.events.map((event) => [event.id, event.kind, event.atSeconds]),
    [
      ["kill-1", "KILL", 120],
      ["note-1", "NOTE", 200],
    ],
  )
  assert.deepEqual(full.timeline?.events[0].killer, { side: "RED", lane: "JUNGLE" })
  assert.deepEqual(full.timeline?.pauses, [{ atSeconds: 300, durationSeconds: 60 }], "pauses survive event edits")
  assert.equal(readTimeline(full).filter((event) => event.kind === "ITEM").length, 4)

  const replayed = withPlayback(full, { startSecond: 95, pauses: [] })
  assert.equal(replayed.sourceTimestampSeconds, 95)
  assert.deepEqual(replayed.timeline?.pauses, [])
  assert.equal(replayed.timeline?.events.length, 2, "playback changes keep recorded moments")
})

/** Every kind of an item event, with all that the service keeps of it. */
const PURCHASES: EquipmentEvent[] = [
  { atSeconds: 60, type: "BUY", item: { id: "boots", name: "Giày" }, fromSlot: 2, toSlot: 1, note: "Đổi với đồng đội" },
  {
    atSeconds: 200,
    type: "UPGRADE",
    item: { id: "loki", name: "Gươm Loki" },
    replacedItem: { id: "blade", name: "Kiếm ngắn" },
    fromSlot: 3,
    toSlot: 4,
  },
  { atSeconds: 400, type: "SWAP", item: { id: "boots", name: "Giày" }, fromSlot: 1, toSlot: 6 },
  {
    atSeconds: 500,
    type: "SELL",
    item: { id: "boots", name: "Giày" },
    replacedItem: { id: "loki", name: "Gươm Loki" },
    fromSlot: 6,
    toSlot: 2,
  },
]

/** A game whose one player bought, built, moved and sold items. */
const shopping = (): GameContent => ({
  seriesId: "s",
  number: 1,
  region: "VN",
  locale: "vi-VN",
  sides: [
    {
      side: "BLUE",
      teamId: "a",
      bans: [],
      participants: [
        {
          lane: "MID",
          hero: { id: null, name: "Mid" },
          spell: {},
          arcana: { status: "UNKNOWN", entries: [] },
          enchantments: { status: "UNKNOWN", entries: [] },
          equipmentSnapshots: [],
          equipmentEvents: structuredClone(PURCHASES),
        },
      ],
    },
    { side: "RED", teamId: "b", bans: [], participants: [] },
  ],
  timeline: { pauses: [], events: [] },
})
/** The item events of that player as they are sent. */
const purchases = (content: GameContent): EquipmentEvent[] =>
  JSON.parse(JSON.stringify(content.sides[0]!.participants[0]!.equipmentEvents))
const itemAt = (content: GameContent, at: number) =>
  readTimeline(content).find((event): event is ItemEvent => event.kind === "ITEM" && event.at === at)!

test("saving a moment leaves every item event as it was recorded", () => {
  const content = shopping()
  const kill: TimelineEvent = { id: "k", kind: "KILL", at: 90, killer: "RED:MID", victim: "BLUE:MID", assists: [] }
  assert.deepEqual(purchases(writeTimeline(content, upsertEvent(readTimeline(content), kill))), PURCHASES)
})

test("an item event that is corrected keeps what its form does not show", () => {
  const content = shopping()
  const built = itemAt(content, 200)
  const corrected = { ...built, at: 230, slot: 5, item: { id: "spear", name: "Thương Longinus" }, note: "Nhìn nhầm" }
  assert.deepEqual(purchases(writeTimeline(content, upsertEvent(readTimeline(content), corrected)))[1], {
    atSeconds: 230,
    type: "UPGRADE",
    item: { id: "spear", name: "Thương Longinus" },
    replacedItem: { id: "blade", name: "Kiếm ngắn" },
    fromSlot: 3,
    toSlot: 5,
    note: "Nhìn nhầm",
  })
})

test("an item event that turns out to be another action does not keep what only the first one had", () => {
  const content = shopping()
  const sold = { ...itemAt(content, 200), action: "SELL" as const }
  const written = purchases(writeTimeline(content, upsertEvent(readTimeline(content), sold)))[1]!
  assert.equal(written.replacedItem, undefined)
  assert.deepEqual([written.type, written.fromSlot, written.toSlot], ["SELL", 4, undefined])
})

test("moments a few seconds apart form one teamfight, and per-side clustering keeps lanes apart", () => {
  const fight: TimelineEvent[] = [
    { id: "a", kind: "KILL", at: 455, killer: "BLUE:JUNGLE", victim: "RED:SUPPORT", assists: [] },
    { id: "b", kind: "ITEM", at: 456, seat: "RED:DRAGON", action: "SELL", slot: 2, item: { name: "Cung" } },
    { id: "c", kind: "KILL", at: 458, killer: "RED:MID", victim: "BLUE:TOP", assists: [] },
    { id: "d", kind: "KILL", at: 462, killer: "BLUE:DRAGON", victim: "RED:JUNGLE", assists: [] },
    { id: "e", kind: "OBJECTIVE", at: 540, side: "RED", objective: "TURRET" },
  ]
  const groups = clusterEvents(fight, 5)
  assert.deepEqual(
    groups.map((group) => group.events.map((event) => event.id)),
    [["a", "b", "c", "d"], ["e"]],
  )
  assert.deepEqual(clusterKills(groups[0]), { BLUE: 2, RED: 1 })
  assert.equal(groups[0].side, null, "a mixed fight has no single side")

  const lanes = clusterEvents(fight, 5, (event) => (event.kind === "OBJECTIVE" ? "MID" : (eventSide(event) ?? "MID")))
  assert.deepEqual(
    lanes.map((group) => [group.side, group.events.map((event) => event.id).join("")]),
    [
      ["BLUE", "a"],
      ["RED", "bc"],
      ["BLUE", "d"],
      ["RED", "e"],
    ],
  )
  assert.equal(lanes.at(-1)?.lane, "MID", "objectives get their own row")
})

test("pauses are kept in the order they happen, however they were given", () => {
  const given = [
    { atSeconds: 600, durationSeconds: 30 },
    { atSeconds: 200, durationSeconds: 60 },
  ]
  const { pauses } = withPlayback(shopping(), { pauses: given }).timeline!
  assert.deepEqual(
    pauses.map((pause) => pause.atSeconds),
    [200, 600],
  )
})

test("0:00 taken away leaves the game without one, not at the start of the video", () => {
  const live: GameContent = { ...shopping(), sourceTimestampSeconds: 95 }
  assert.equal(withPlayback(live, { startSecond: null }).sourceTimestampSeconds, undefined)
})

test("a moment moved before 0:00 stays at 0:00", () => {
  const content: GameContent = {
    ...shopping(),
    timeline: { pauses: [], events: [{ id: "n", kind: "NOTE", atSeconds: 30, title: "Gank" }] },
  }
  assert.equal(moveEvent(content, "n", -5)!.timeline!.events[0]!.atSeconds, 0)
})

test("the note of a moment is written with it", () => {
  const kill: TimelineEvent = {
    id: "k",
    kind: "KILL",
    at: 90,
    killer: "RED:MID",
    victim: "BLUE:MID",
    assists: [],
    note: "Lật kèo",
  }
  assert.equal(writeTimeline(shopping(), [kill]).timeline!.events[0]!.note, "Lật kèo")
})
