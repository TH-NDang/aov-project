import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clusterEvents,
  clusterKills,
  eventSide,
  inventoryAt,
  killScoreAt,
  leadEvent,
  seatStatsAt,
  type TimelineEvent,
} from "../src/features/esports/model/timeline"
import {
  eventRemoval,
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

  const replayed = withPlayback(full, { url: "https://youtu.be/R5rCsGqDJIg", startSecond: 95, pauses: [] })
  assert.equal(replayed.sourceTimestampSeconds, 95)
  assert.deepEqual(replayed.timeline?.pauses, [])
  assert.equal(replayed.timeline?.events.length, 2, "playback changes keep recorded moments")
})

test("a deleted moment comes back unchanged with its undo", () => {
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    sides: [
      { side: "BLUE" as const, teamId: "a", bans: [], participants: [] },
      { side: "RED" as const, teamId: "b", bans: [], participants: [] },
    ],
    timeline: { pauses: [], events: [] },
  }
  const kill: TimelineEvent = {
    id: "kill-1",
    kind: "KILL",
    at: 312,
    killer: "RED:JUNGLE",
    victim: "BLUE:MID",
    assists: [],
  }
  const note: TimelineEvent = { id: "note-1", kind: "NOTE", at: 200, title: "Gank", side: "RED" }
  const recorded = writeTimeline(content, [kill, note])

  const removal = eventRemoval(kill)
  const removed = removal.apply(recorded)
  const restored = removal.revert(removed)

  assert.equal(removal.text, "Đã xóa hạ gục lúc 5:12")
  assert.deepEqual(
    readTimeline(removed).map((event) => event.id),
    ["note-1"],
  )
  assert.deepEqual(readTimeline(restored), readTimeline(recorded))
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
  assert.equal(leadEvent(groups[0]).kind, "KILL")

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
