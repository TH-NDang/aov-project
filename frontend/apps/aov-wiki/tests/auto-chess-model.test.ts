import assert from "node:assert/strict"
import { test } from "node:test"
import {
  costSummary,
  decodeLineup,
  encodeLineup,
  ruleBlocks,
  suggestUnits,
  traitCounts,
  type Trait,
  type Unit,
} from "../src/features/modes/auto-chess-model.ts"

const trait = (code: string, name: string, counts: number[]): Trait => ({
  code,
  kind: "FACTION",
  name,
  tiers: counts.map((count) => ({ count, effect: `${count} ${name}` })),
})
const unit = (code: string, cost: number, ...traitCodes: string[]): Unit => ({
  code,
  name: code,
  cost,
  traitCodes,
  complete: true,
})

const guide = {
  traits: [
    trait("dau-si", "Đấu sĩ", [2, 4]),
    trait("hoc-duong", "Giai Điệu Học Đường", [3, 6]),
    trait("phao-thu", "Pháo thủ", [2]),
  ],
  units: [
    unit("violet", 1, "phao-thu", "hoc-duong"),
    unit("arduin", 1, "dau-si"),
    unit("florentino", 2, "dau-si", "hoc-duong"),
    unit("amily", 1, "hoc-duong"),
    unit("valhein", 2, "phao-thu"),
  ],
}

test("each distinct unit counts once and the highest reached threshold wins", () => {
  const counts = traitCounts(guide, ["violet", "violet", "florentino", "amily", "arduin"])
  const byCode = Object.fromEntries(counts.map((count) => [count.trait.code, count]))

  assert.equal(byCode["hoc-duong"].count, 3)
  assert.equal(byCode["hoc-duong"].reachedTier, 0)
  assert.equal(byCode["hoc-duong"].missing, 3)
  assert.equal(byCode["dau-si"].reachedTier, 0)
  assert.equal(byCode["phao-thu"].reachedTier, -1)
  assert.equal(byCode["phao-thu"].missing, 1)
  assert.deepEqual(
    counts.map((count) => count.trait.code),
    ["dau-si", "hoc-duong", "phao-thu"],
    "active traits come first",
  )
})

test("emblems add one and unknown units are ignored", () => {
  const [phaoThu] = traitCounts(guide, ["violet", "ghost"], ["phao-thu"]).filter((c) => c.trait.code === "phao-thu")
  assert.equal(phaoThu!.count, 2)
  assert.equal(phaoThu!.reachedTier, 0)
  assert.equal(phaoThu!.missing, null)
})

test("the cost summary and suggestions follow the chosen units", () => {
  assert.deepEqual(costSummary(guide, ["violet", "florentino", "violet"]), {
    total: 3,
    byCost: [
      [1, 1],
      [2, 1],
    ],
  })
  const [first] = suggestUnits(guide, ["violet"])
  assert.equal(first!.unit.code, "valhein", "Valhein completes Pháo thủ 2")
  assert.deepEqual(first!.gains, ["phao-thu"])
})

test("a shared link keeps known units once, carries, ten board units plus the extra slot and three emblems", () => {
  const query = encodeLineup(
    [
      { unitCode: "violet", carry: true },
      { unitCode: "arduin", carry: false },
    ],
    ["dau-si"],
  )
  assert.equal(decodeURIComponent(query), "u=violet*,arduin&e=dau-si")
  assert.deepEqual(decodeLineup(query, guide), {
    units: [
      { unitCode: "violet", carry: true },
      { unitCode: "arduin", carry: false },
    ],
    emblems: ["dau-si"],
  })
  const messy = decodeLineup("u=violet,violet*,ghost,Bad Code,arduin&e=dau-si,nope,dau-si,phao-thu,hoc-duong", guide)
  assert.deepEqual(
    messy.units.map((u) => u.unitCode),
    ["violet", "arduin"],
  )
  assert.deepEqual(messy.emblems, ["dau-si", "dau-si", "phao-thu"])
  const many = Array.from({ length: 14 }, (_, at) => `u${at}`).join(",")
  assert.equal(decodeLineup(`u=${many}`).units.length, 11)
})

test("a shared link keeps each unit's cell, one unit per cell, and still reads links without cells", () => {
  const query = encodeLineup(
    [
      { unitCode: "violet", carry: true, row: "BACK", column: 4 },
      { unitCode: "arduin", carry: false, row: "FRONT", column: 4 },
    ],
    [],
  )
  assert.equal(decodeURIComponent(query), "u=violet*@b4,arduin@f4")
  assert.deepEqual(decodeLineup(query, guide).units, [
    { unitCode: "violet", carry: true, row: "BACK", column: 4 },
    { unitCode: "arduin", carry: false, row: "FRONT", column: 4 },
  ])
  assert.deepEqual(decodeLineup("u=violet@m2,arduin*@m2,ghost@f9", guide).units, [
    { unitCode: "violet", carry: false, row: "MIDDLE", column: 2 },
    { unitCode: "arduin", carry: true },
  ])
  assert.deepEqual(decodeLineup("u=violet@f8", guide).units, [])
})

test("rule bodies turn dash lines into lists and search ignores Vietnamese marks", () => {
  assert.deepEqual(ruleBlocks("Trận đấu gồm:\n- Vòng đối kháng\n- Vòng quái\nHết."), [
    { kind: "text", text: "Trận đấu gồm:" },
    { kind: "list", items: ["Vòng đối kháng", "Vòng quái"] },
    { kind: "text", text: "Hết." },
  ])
})
