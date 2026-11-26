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
  inBuiltOrder,
  inventoryAt,
  inventoryTimes,
  isRecorded,
  lineupRecord,
  mainEnchantment,
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

const kept = (id: string, extra: Partial<BuildStep> = {}): BuildStep => ({ item: { id }, place: "KEPT", ...extra })
const ids = (items: BuiltItem[]) => items.map((built) => built.item.id)

test("items written down keep their order and stand by what became of them", () => {
  const build = buildOf(
    seat({
      build: [
        kept("boots", { atSeconds: 190 }),
        kept("armor", { place: "REPLACED" }),
        kept("spear", { atSeconds: 430 }),
        kept("revive", { place: "SITUATIONAL", atSeconds: 900 }),
      ],
    }),
    catalog,
  )!

  assert.equal(build.source, "STEPS")
  assert.deepEqual(
    [ids(build.kept), ids(build.replaced), ids(build.situational)],
    [["boots", "spear"], ["armor"], ["revive"]],
  )
  assert.deepEqual(
    build.kept.map((built) => built.atSeconds),
    [190, 430],
  )
})

test("an item tells the ones it grew from", () => {
  const build = buildOf(seat({ build: [kept("spear", { from: [{ id: "sword" }, { name: "Kiếm lạ" }] })] }), catalog)!

  assert.deepEqual(build.kept[0]!.from, [
    { item: { id: "sword" }, atSeconds: null },
    { item: { name: "Kiếm lạ" }, atSeconds: null },
  ])
})

test("an item given up into a later one is told by that one, with the time it was first held", () => {
  const build = buildOf(
    seat({
      build: [
        kept("sword", { place: "REPLACED", atSeconds: 180 }),
        kept("spear", { from: [{ id: "sword" }], atSeconds: 420 }),
      ],
    }),
    catalog,
  )!

  assert.deepEqual(ids(build.replaced), [])
  assert.deepEqual(build.kept[0]!.from, [{ item: { id: "sword" }, atSeconds: 180 }])
})

test("an item that went into two others tells when it was first held with the first of them alone", () => {
  const build = buildOf(
    seat({
      build: [
        kept("sword", { place: "REPLACED", atSeconds: 180 }),
        kept("spear", { from: [{ id: "sword" }], atSeconds: 420 }),
        kept("armor", { from: [{ id: "sword" }], atSeconds: 600 }),
      ],
    }),
    catalog,
  )!

  assert.deepEqual(
    build.kept.map((built) => built.from[0]!.atSeconds),
    [180, null],
  )
  assert.deepEqual(build.replaced, [])
})

test("an item held to the end stays its own even where another grew from the same", () => {
  const build = buildOf(
    seat({ build: [kept("sword", { atSeconds: 600 }), kept("spear", { from: [{ id: "sword" }] })] }),
    catalog,
  )!

  assert.deepEqual(ids(build.kept), ["sword", "spear"])
  assert.equal(build.kept[1]!.from[0]!.atSeconds, null, "when the second one was bought says nothing of the first")
})

test("items known by name alone are told apart by it", () => {
  const build = buildOf(
    seat({
      build: [
        { item: { name: "Kiếm dài" }, place: "REPLACED" },
        { item: { name: "Thương" }, from: [{ name: "kiếm dài " }], place: "KEPT" },
      ],
    }),
    catalog,
  )!

  assert.deepEqual(build.replaced, [])
})

test("a list tells its order where the times of at least two items agree with it", () => {
  const told = (times: (number | null)[]) =>
    inBuiltOrder(times.map((atSeconds, at) => ({ item: { id: String(at) }, atSeconds, from: [] })))
  assert.equal(told([200, null, 500]), true)
  assert.equal(told([500, null, 200]), false)
  assert.equal(told([null, 200, null]), false)
  assert.equal(told([null, null]), false)
})

test("the last inventory stands in for a build nobody wrote down", () => {
  const build = buildOf(
    seat({ equipmentSnapshots: [inventory(800, "boots", "spear"), inventory(300, "sword")] }),
    catalog,
  )!

  assert.deepEqual([build.source, build.atSeconds, build.unread], ["INVENTORY", 800, 4])
  assert.deepEqual(ids(build.kept), ["boots", "spear"])
})

test("items written down speak instead of any inventory", () => {
  const build = buildOf(seat({ build: [kept("spear")], equipmentSnapshots: [inventory(800, "boots")] }), catalog)!

  assert.deepEqual(ids(build.kept), ["spear"])
})

test("items of the lowest tier are left out of an inventory that holds others", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "ring", "boots", "dagger")] }), catalog)!

  assert.deepEqual(ids(build.kept), ["boots"])
  assert.equal(build.unread, 3, "a slot that was read is not unread")
})

test("items of the lowest tier stay where an inventory holds nothing else", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(60, "ring", null, "dagger")] }), catalog)!

  assert.deepEqual(ids(build.kept), ["ring", "dagger"])
})

test("an item whose tier nobody knows is kept", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "unheard", "boots", "ring")] }), catalog)!

  assert.deepEqual(ids(build.kept), ["unheard", "boots"])
})

test("two of the same item lie in two slots", () => {
  const build = buildOf(seat({ equipmentSnapshots: [inventory(800, "sword", "boots", "sword")] }), catalog)!

  assert.deepEqual(ids(build.kept), ["sword", "boots", "sword"])
})

test("an inventory nobody could read is no record, and one seen empty is", () => {
  assert.equal(buildOf(seat({ equipmentSnapshots: [inventory(800)] }), catalog), null)
  assert.equal(buildOf(seat(), catalog), null)

  const empty = buildOf(seat({ equipmentSnapshots: [inventory(30, null, null, null, null, null, null)] }), catalog)!
  assert.deepEqual([empty.kept, empty.unread], [[], 0])
})

test("a moment of the game shows the inventory seen last by then, whole", () => {
  const player = seat({ equipmentSnapshots: [inventory(800, "spear"), inventory(300, "ring", "boots")] })

  assert.deepEqual(ids(inventoryAt(player, catalog, 500)!.kept), ["ring", "boots"])
  assert.equal(inventoryAt(player, catalog, 200), null, "nothing was seen yet")
})

test("a lineup shows what was built until a second of the game is asked for", () => {
  const player = seat({ build: [kept("spear")], equipmentSnapshots: [inventory(300, "boots")] })

  assert.deepEqual(ids(shownBuild(player, catalog, null)!.kept), ["spear"])
  assert.deepEqual(ids(shownBuild(player, catalog, 300)!.kept), ["boots"])
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
  assert.equal(isRecorded(seat({ build: [kept("spear")] }), catalog), true)
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
      seat({ playerId: "p1", spell: { id: "flash" }, build: [kept("spear")] }),
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
  const early = seat({ build: [kept("spear")], equipmentSnapshots: [inventory(300, "boots")] })
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
