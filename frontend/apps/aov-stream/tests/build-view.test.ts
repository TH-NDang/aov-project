import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  BuildStep,
  EnchantmentAllocation,
  EquipmentSnapshot,
  GameSide,
  Participant,
  PublishedGame,
} from "@aov/community-contracts"
import {
  banPlaces,
  buildOf,
  enchantmentBranches,
  inventoryAt,
  inventoryTimes,
  isRecorded,
  lineupRecord,
  mainEnchantment,
  pathChart,
  shownBuild,
  type BuiltItem,
} from "../src/lib/build-view.ts"
import { catalogOf, inventory, participant as seat, reference } from "./fixtures/loadout.ts"

const catalog = catalogOf({
  items: [
    reference("ring", 1),
    reference("dagger", 1),
    reference("sword", 2),
    reference("boots", 2),
    reference("spear", 3),
    reference("armor", 3),
    reference("revive", 3),
  ],
})

const step = (id: string, extra: Partial<BuildStep> = {}): BuildStep => ({ item: { id }, role: "CORE", ...extra })
const ids = (items: BuiltItem[]) => items.map((built) => built.item.id)
const pathOf = (...steps: BuildStep[]) => buildOf(seat({ build: steps }), catalog)!

test("items written down keep their order, and the end holds the build before what was bought for protection", () => {
  const build = pathOf(
    step("boots", { atSeconds: 190 }),
    step("armor", { sold: true }),
    step("spear", { atSeconds: 430 }),
    step("revive", { role: "PROTECTIVE", atSeconds: 900 }),
    step("sword", { atSeconds: 1000 }),
  )

  assert.equal(build.source, "STEPS")
  assert.deepEqual(ids(build.path), ["boots", "armor", "spear", "revive", "sword"])
  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["HELD", "SOLD", "HELD", "HELD", "HELD"],
  )
  assert.deepEqual(ids(build.end), ["boots", "spear", "sword", "revive"])
  assert.deepEqual(
    build.end.map((built) => built.protective),
    [false, false, false, true],
  )
})

test("an item a later one grew from went into it, and is told by it with the time it was bought", () => {
  const build = pathOf(step("sword", { atSeconds: 180 }), step("spear", { from: [{ id: "sword" }], atSeconds: 420 }))

  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["UPGRADED", "HELD"],
  )
  assert.deepEqual(build.path[0]!.next, { item: { id: "spear" }, atSeconds: 420, at: 1 })
  assert.deepEqual(ids(build.end), ["spear"])
  assert.deepEqual(build.end[0]!.from, [{ item: { id: "sword" }, atSeconds: 180 }])
})

test("an item a later one replaces was sold for it", () => {
  const build = pathOf(
    step("boots", { atSeconds: 190 }),
    step("spear", { atSeconds: 430 }),
    step("revive", { role: "PROTECTIVE", replaces: [{ id: "boots" }], atSeconds: 1300 }),
  )

  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["SOLD", "HELD", "HELD"],
  )
  assert.equal(build.path[0]!.next?.at, 2)
  assert.deepEqual(build.path[2]!.replaces, [{ item: { id: "boots" }, atSeconds: 190 }])
  assert.deepEqual(ids(build.end), ["spear", "revive"])
})

test("only an earlier step goes into a later one, and a part nobody wrote down has no time", () => {
  const build = pathOf(step("spear", { from: [{ id: "sword" }, { name: "Kiếm lạ" }] }), step("sword"))

  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["HELD", "HELD"],
  )
  assert.deepEqual(build.path[0]!.from, [
    { item: { id: "sword" }, atSeconds: null },
    { item: { name: "Kiếm lạ" }, atSeconds: null },
  ])
})

test("an item bought again after it went into another is held on its own", () => {
  const build = pathOf(
    step("sword", { atSeconds: 180 }),
    step("spear", { from: [{ id: "sword" }], atSeconds: 420 }),
    step("sword", { atSeconds: 600 }),
  )

  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["UPGRADED", "HELD", "HELD"],
  )
  assert.deepEqual(ids(build.end), ["spear", "sword"])
})

test("items known by name alone are the same in any case", () => {
  const build = pathOf(
    { item: { name: "Kiếm dài" }, role: "CORE" },
    { item: { name: "Thương" }, from: [{ name: "kiếm DÀI " }], role: "CORE" },
  )

  assert.deepEqual(
    build.path.map((built) => built.fate),
    ["UPGRADED", "HELD"],
  )
})

test("a path is drawn over the minutes of a game only where its length and every time are known", () => {
  const { path } = pathOf(
    step("sword", { atSeconds: 120 }),
    step("boots", { atSeconds: 240 }),
    step("spear", { from: [{ id: "sword" }], atSeconds: 600 }),
    step("armor", { sold: true, atSeconds: 900 }),
  )

  assert.deepEqual(pathChart(path, 1200), {
    bars: [
      { from: 0.1, to: 0.5, open: false },
      { from: 0.2, to: 1, open: false },
      { from: 0.5, to: 1, open: false },
      { from: 0.75, to: 1, open: true },
    ],
    ticks: [0, 300, 600, 900],
  })
  assert.deepEqual(pathChart(path, 1351)?.ticks, [0, 300, 600, 900], "the last mark keeps clear of the end")
  assert.deepEqual(pathChart(path, 1000)?.ticks, [0, 300, 600], "a mark close to the end gives way to it")
  assert.equal(pathChart(path, null), null)
  assert.equal(pathChart(path, 800), null, "an item bought after the end of the game")
  assert.equal(pathChart([...path, { ...path[0]!, atSeconds: null }], 1200), null)
})

test("the last inventory stands in for a build nobody wrote down", () => {
  const build = buildOf(
    seat({ equipmentSnapshots: [inventory(800, "boots", "spear"), inventory(300, "sword")] }),
    catalog,
  )!

  assert.deepEqual([build.source, build.atSeconds, build.unread], ["INVENTORY", 800, 4])
  assert.deepEqual(ids(build.end), ["boots", "spear"])
})

test("items written down speak instead of any inventory", () => {
  const build = buildOf(seat({ build: [step("spear")], equipmentSnapshots: [inventory(800, "boots")] }), catalog)!

  assert.deepEqual(ids(build.end), ["spear"])
})

test("items of the lowest tier are left out of an inventory that holds others", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "ring", "boots", "dagger")] }), catalog)!

  assert.deepEqual(ids(build.end), ["boots"])
  assert.equal(build.unread, 3, "a slot that was read is not unread")
})

test("items of the lowest tier stay where an inventory holds nothing else", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(60, "ring", null, "dagger")] }), catalog)!

  assert.deepEqual(ids(build.end), ["ring", "dagger"])
})

test("an item whose tier nobody knows is kept", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "unheard", "boots", "ring")] }), catalog)!

  assert.deepEqual(ids(build.end), ["unheard", "boots"])
})

test("two of the same item lie in two slots", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "sword", "boots", "sword")] }), catalog)!

  assert.deepEqual(ids(build.end), ["sword", "boots", "sword"])
})

test("an inventory nobody could read is no record, and one seen empty is", () => {
  assert.equal(buildOf(seat({ equipmentSnapshots: [inventory(800)] }), catalog), null)
  assert.equal(buildOf(seat(), catalog), null)

  const empty = buildOf(seat({ equipmentSnapshots: [inventory(30, null, null, null, null, null, null)] }), catalog)!
  assert.deepEqual([empty.end, empty.unread], [[], 0])
})

test("a moment of the game shows the inventory seen last by then, whole", () => {
  const player = seat({ equipmentSnapshots: [inventory(800, "spear"), inventory(300, "ring", "boots")] })

  assert.deepEqual(ids(inventoryAt(player, catalog, 500)!.end), ["ring", "boots"])
  assert.equal(inventoryAt(player, catalog, 200), null, "nothing was seen yet")
})

test("a lineup shows what was built until a second of the game is asked for", () => {
  const player = seat({ build: [step("spear")], equipmentSnapshots: [inventory(300, "boots")] })

  assert.deepEqual(ids(shownBuild(player, catalog, null)!.end), ["spear"])
  assert.deepEqual(ids(shownBuild(player, catalog, 300)!.end), ["boots"])
})

test("the moments of a game are those an inventory was seen at, each once", () => {
  const side = (...snapshots: EquipmentSnapshot[]) =>
    ({ side: "BLUE", teamId: "a", bans: [], participants: [seat({ equipmentSnapshots: snapshots })] }) as GameSide

  assert.deepEqual(inventoryTimes([side(inventory(800), inventory(300)), side(inventory(300))]), [300, 800])
})

const enchantment = (id: string, primary: boolean, tier: number): EnchantmentAllocation => ({
  selection: { id },
  primary,
  tier,
})

test("enchantments stand by branch, the primary one and the highest tier first", () => {
  const player = seat({
    enchantments: {
      status: "KNOWN",
      entries: [
        enchantment("e", false, 2),
        enchantment("a", true, 1),
        enchantment("c", true, 3),
        enchantment("b", true, 2),
        enchantment("d", false, 1),
      ],
    },
  })

  assert.deepEqual(
    enchantmentBranches(player).map((branch) => [branch.primary, branch.entries.map((entry) => entry.selection.id)]),
    [
      [true, ["c", "b", "a"]],
      [false, ["e", "d"]],
    ],
  )
  assert.equal(mainEnchantment(player)?.selection.id, "c")
})

test("without the primary branch no enchantment is the main one", () => {
  const player = seat({ enchantments: { status: "PARTIAL", entries: [enchantment("e", false, 2)] } })

  assert.equal(mainEnchantment(player), null)
  assert.equal(enchantmentBranches(player).length, 1)
})

test("enchantments nobody saw are none, whatever was entered for them", () => {
  const player = seat({ enchantments: { status: "UNKNOWN", entries: [enchantment("a", true, 3)] } })

  assert.deepEqual(enchantmentBranches(player), [])
})

test("a seat is recorded once anything beside its hero is", () => {
  assert.equal(isRecorded(seat(), catalog), false)
  assert.equal(isRecorded(seat({ spell: {} }), catalog), false, "an empty selection names no spell")
  assert.equal(isRecorded(seat({ spell: { name: "Tốc biến" } }), catalog), true)
  assert.equal(isRecorded(seat({ build: [step("spear")] }), catalog), true)
})

const game = (seats: Participant[], durationSeconds: number | null = 800) =>
  ({
    content: {
      durationSeconds,
      sides: [
        { side: "BLUE", teamId: "a", bans: [], participants: seats },
        { side: "RED", teamId: "b", bans: [], participants: [] },
      ],
    },
    catalog,
    players: { p1: { code: "p1", nickname: "Vịt" } },
  }) as unknown as PublishedGame

test("a game counts the seats each thing is recorded for", () => {
  const record = lineupRecord(
    game([
      seat({ playerId: "p1", spell: { id: "flash" }, build: [step("spear")] }),
      seat({ playerId: "gone", equipmentSnapshots: [inventory(800, "boots")] }),
      seat({ enchantments: { status: "PARTIAL", entries: [enchantment("a", true, 3)] } }),
    ]),
  )

  assert.deepEqual(record, {
    seats: 3,
    players: 1,
    spells: 1,
    enchantments: 1,
    arcana: 0,
    items: 2,
    built: 1,
    mainOnly: true,
    atEnd: true,
    unread: true,
  })
})

test("an inventory seen before the end is not the one a game ended with", () => {
  assert.equal(lineupRecord(game([seat({ equipmentSnapshots: [inventory(500, "boots")] })])).atEnd, false)
})

test("at a second of the game only the inventories seen by then count", () => {
  const early = seat({ build: [step("spear")], equipmentSnapshots: [inventory(300, "boots")] })
  const late = seat({ equipmentSnapshots: [inventory(700, "boots")] })
  const record = lineupRecord(game([early, late]), 400)

  assert.deepEqual([record.items, record.built], [1, 0])
})

test("more than one enchantment of a player is more than the main one", () => {
  const both = [enchantment("a", true, 3), enchantment("b", false, 2)]
  const record = lineupRecord(game([seat({ enchantments: { status: "KNOWN", entries: both } })]))

  assert.equal(record.mainOnly, false)
})

const bans = (...counts: number[]) =>
  counts.map((count) => ({
    bans: Array.from({ length: count }, (_, index) => ({ id: `hero-${index}` })),
  })) as GameSide[]

test("a side that shows fewer bans keeps a place for the ones nobody saw", () => {
  assert.equal(banPlaces(bans(3, 4)), 4)
  assert.equal(banPlaces(bans(5, 2)), 5)
  assert.equal(banPlaces(bans(0, 0)), 0)
  assert.equal(banPlaces([{ bans: [{}, {}] }, { bans: [] }] as unknown as GameSide[]), 0, "nobody saw any ban")
})
