import assert from "node:assert/strict"
import { test } from "node:test"
import { clock, observationTimes, snapshotAt } from "../src/features/tournaments/tournament-model.ts"
import type { EquipmentSnapshot, GameSide } from "@aov/community-contracts"

const snapshot = (atSeconds: number): EquipmentSnapshot => ({
  atSeconds,
  slots: Array.from({ length: 6 }, (_, index) => ({
    slot: index + 1,
    known: index === 0,
    item: index === 0 ? { name: "Kiếm ngắn" } : null,
  })),
})
test("inventory observation uses the latest known timestamp without borrowing a future snapshot", () => {
  const snapshots = [snapshot(600), snapshot(0), snapshot(120)]
  assert.equal(snapshotAt(snapshots, 119)?.atSeconds, 0)
  assert.equal(snapshotAt(snapshots, 120)?.atSeconds, 120)
  assert.equal(snapshotAt(snapshots, 500)?.atSeconds, 120)
  assert.equal(snapshotAt([snapshot(600)], 599), undefined)
  assert.deepEqual(
    snapshots.map((value) => value.atSeconds),
    [600, 0, 120],
  )
})
test("empty and unknown slots remain distinct and explicit transactions do not reconstruct an inventory", () => {
  const value = snapshot(0)
  value.slots[1] = { slot: 2, known: true, item: null }
  const observed = snapshotAt([value], 300)!
  assert.equal(observed.slots[1]?.known, true)
  assert.equal(observed.slots[1]?.item, null)
  assert.equal(observed.slots[2]?.known, false)
})
test("timeline merges observed timestamps and explicit transactions without adding inferred milestones", () => {
  const sides = [
    {
      side: "BLUE",
      teamId: "a",
      bans: [],
      participants: [
        {
          playerId: "p",
          lane: "TOP",
          hero: { name: "Airi" },
          spell: { name: "Tốc biến" },
          arcana: { status: "UNKNOWN", entries: [] },
          enchantments: { status: "NOT_SHOWN", entries: [] },
          equipmentSnapshots: [snapshot(300), snapshot(0)],
          equipmentEvents: [
            { atSeconds: 60, type: "BUY", item: { name: "Kiếm ngắn" } },
            { atSeconds: 300, type: "SELL", item: { name: "Kiếm ngắn" } },
          ],
        },
      ],
    },
  ] as GameSide[]
  assert.deepEqual(observationTimes(sides), [0, 60, 300])
})
test("match clocks do not wrap at an hour or expose negative times", () => {
  assert.equal(clock(3601), "60:01")
  assert.equal(clock(-20), "0:00")
})
