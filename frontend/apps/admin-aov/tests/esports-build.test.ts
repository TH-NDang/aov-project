import assert from "node:assert/strict"
import { test } from "node:test"
import type { BuildStep, EquipmentSnapshot, Participant, Reference } from "@aov/community-contracts"
import {
  MAX_STEPS,
  addItem,
  buildOf,
  buildProblems,
  editBuild,
  itemGroups,
  itemIndex,
  itemKey,
  itemName,
  moveItem,
  recipeParts,
  refused,
  removeItem,
  seenItems,
  setTime,
  shiftItem,
  stepsAt,
  togglePart,
  unlisted,
  upgradeItem,
  upgradesOf,
  type BuildEdit,
} from "../src/features/esports/model/build"

const reference = (id: string, name: string, tier: number, components: string[] = []): Reference => ({
  id,
  code: id,
  name,
  tier,
  components,
})
const ITEMS = [
  reference("short", "Kiếm ngắn", 1),
  reference("glove", "Găng tay", 1),
  reference("sword", "Kiếm dài", 2, ["short"]),
  reference("gauntlet", "Găng bạch kim", 2, ["glove"]),
  reference("greaves", "Giáp chân", 2),
  reference("boots", "Giày hộ vệ", 2),
  reference("holy", "Thánh kiếm", 3, ["sword", "glove"]),
  reference("aegis", "Khiên thánh quang", 3, ["gauntlet", "greaves"]),
  reference("fang", "Nanh Fenrir", 3, ["sword"]),
  reference("revive", "Giáp hộ mệnh", 3, ["sword"]),
  reference("comet", "Trượng bùng nổ", 3, ["fang"]),
]
/** The length of the games these players are of. */
const LENGTH = 900
const index = itemIndex(ITEMS)
const pick = (id: string) => ({ id, name: ITEMS.find((item) => item.id === id)!.name })
const step = (id: string, place: BuildStep["place"] = "KEPT", more: Partial<BuildStep> = {}): BuildStep => ({
  item: pick(id),
  from: [],
  place,
  atSeconds: null,
  ...more,
})
const snapshot = (atSeconds: number, ids: (string | null | undefined)[]): EquipmentSnapshot => ({
  atSeconds,
  slots: ids.map((id, slot) => ({ slot: slot + 1, known: id !== undefined, item: id ? pick(id) : null })),
})
const participant = (more: Partial<Participant> = {}): Participant => ({
  lane: "TOP",
  hero: { id: "hero", name: "Biron" },
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "UNKNOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  ...more,
})
/** Twenty-four items typed by hand, as many as a list holds. */
const full = Array.from({ length: MAX_STEPS }, (_, position): BuildStep => ({
  item: { id: null, name: `Món ${position}` },
  place: "SITUATIONAL",
}))

const keys = (edit: BuildEdit) => (refused(edit) ? edit : edit.map((entry) => itemKey(entry.item, index)))
const partsOf = (edit: BuildEdit, id: string) =>
  refused(edit) ? edit : edit.find((entry) => entry.item.id === id)?.from?.map((part) => itemKey(part, index))
const steps = (edit: BuildEdit) => {
  assert.ok(!refused(edit), `refused: ${String(edit)}`)
  return edit
}

test("a list somebody wrote is read as it is, whatever the snapshots show", () => {
  const build = buildOf(
    participant({ build: [step("sword", "REPLACED")], equipmentSnapshots: [snapshot(900, ["holy"])] }),
    LENGTH,
    index,
  )
  assert.deepEqual(keys(build.steps), ["sword"])
  assert.equal(build.snapshot, null)
})

test("without a list the items are those the game ended with, all of them kept", () => {
  const build = buildOf(
    participant({ equipmentSnapshots: [snapshot(300, ["boots"]), snapshot(900, ["holy", undefined, "boots", null])] }),
    LENGTH,
    index,
  )
  assert.deepEqual(keys(build.steps), ["holy", "boots"])
  assert.deepEqual(
    build.steps.map((entry) => entry.place),
    ["KEPT", "KEPT"],
  )
  assert.equal(build.snapshot?.atSeconds, 900)
})

test("an inventory of the last minute is the one the game ended with, an earlier one is not", () => {
  const read = (atSeconds: number) =>
    keys(buildOf(participant({ equipmentSnapshots: [snapshot(atSeconds, ["holy"])] }), LENGTH, index).steps)
  assert.deepEqual(read(LENGTH - 60), ["holy"])
  assert.deepEqual(read(LENGTH - 61), [])
})

test("while the length of the game is unknown no inventory is the one it ended with", () => {
  const player = participant({ equipmentSnapshots: [snapshot(900, ["holy"])] })
  for (const length of [null, undefined, 0]) assert.deepEqual(buildOf(player, length, index).steps, [])
})

test("an item a snapshot shows twice is listed once, and one of tier 1 not at all", () => {
  const build = buildOf(
    participant({ equipmentSnapshots: [snapshot(900, ["sword", "short", "sword", "holy"])] }),
    LENGTH,
    index,
  )
  assert.deepEqual(keys(build.steps), ["sword", "holy"])
  assert.equal(build.leftOut, 2)
})

test("a snapshot that shows no item leaves nothing to read", () => {
  const build = buildOf(participant({ equipmentSnapshots: [snapshot(900, [null, undefined])] }), LENGTH, index)
  assert.deepEqual(build.steps, [])
  assert.equal(build.snapshot, null)
})

test("the first edit writes a list of its own out of what the snapshot shows", () => {
  const before = participant({ equipmentSnapshots: [snapshot(900, ["holy", "boots"])] })
  const after = editBuild(before, LENGTH, (list) => addItem(list, pick("revive"), "SITUATIONAL", index), index)
  assert.ok(!refused(after))
  assert.deepEqual(keys(after.build!), ["holy", "boots", "revive"])
  assert.equal(after.equipmentSnapshots, before.equipmentSnapshots, "the snapshot stays")
})

test("over an inventory of the middle of the game the first edit starts an empty list", () => {
  const before = participant({ equipmentSnapshots: [snapshot(300, ["boots"])] })
  const after = editBuild(before, LENGTH, (list) => addItem(list, pick("revive"), "KEPT", index), index)
  assert.ok(!refused(after))
  assert.deepEqual(keys(after.build!), ["revive"])
})

test("an edit that changes nothing leaves the player untouched", () => {
  const before = participant({ build: [step("holy")] })
  assert.equal(
    editBuild(before, LENGTH, (list) => moveItem(list, "holy", "KEPT", index), index),
    before,
  )
})

test("an item is added as the latest one built", () => {
  const list = steps(addItem([step("boots")], pick("holy"), "REPLACED", index, 420))
  assert.deepEqual(list[1], step("holy", "REPLACED", { atSeconds: 420 }))
})

test("an item added with a time stands before the first one built later, in whatever place", () => {
  const list = [step("boots"), step("sword", "REPLACED", { atSeconds: 300 }), step("holy", "KEPT", { atSeconds: 600 })]
  assert.deepEqual(keys(addItem(list, pick("fang"), "KEPT", index, 450)), ["boots", "sword", "fang", "holy"])
  assert.deepEqual(keys(addItem(list, pick("fang"), "KEPT", index, 600)), ["boots", "sword", "holy", "fang"])
})

test("adding an item that is listed moves it instead of listing it twice", () => {
  const list = steps(addItem([step("boots"), step("holy")], pick("boots"), "REPLACED", index))
  assert.deepEqual(keys(list), ["boots", "holy"])
  assert.equal(list[0]!.place, "REPLACED")
})

test("an item typed by hand is the catalogue's item of that name", () => {
  const typed = { id: null, name: "giay ho ve" }
  assert.deepEqual(steps(addItem([], typed, "KEPT", index))[0]!.item, pick("boots"))
  assert.deepEqual(keys(addItem([step("boots")], typed, "SITUATIONAL", index)), ["boots"], "so it is listed once")
})

test("an item of tier 1 is no step of a build", () => {
  assert.equal(addItem([], pick("short"), "KEPT", index), "TIER")
})

test("an item the catalogue does not know can be listed under its name", () => {
  const list = steps(addItem([], { id: null, name: "Món cũ" }, "KEPT", index))
  assert.equal(itemName(list[0]!.item, index), "Món cũ")
})

test("a seventh item cannot be kept to the end, neither added nor moved there", () => {
  const six = ["holy", "aegis", "fang", "revive", "boots", "greaves"].map((id) => step(id))
  assert.equal(addItem(six, pick("sword"), "KEPT", index), "KEPT")
  assert.equal(moveItem([...six, step("sword", "REPLACED")], "sword", "KEPT", index), "KEPT")
})

test("a list holds at most twenty-four items", () => {
  assert.equal(addItem(full, pick("holy"), "SITUATIONAL", index), "STEPS")
})

test("an item moves past the next one of its place, whatever stands between them", () => {
  const list = [step("boots"), step("sword", "REPLACED"), step("holy"), step("aegis")]
  assert.deepEqual(keys(shiftItem(list, "boots", 1, index)), ["sword", "holy", "boots", "aegis"])
  assert.deepEqual(keys(stepsAt(shiftItem(list, "aegis", -1, index), "KEPT")), ["boots", "aegis", "holy"])
})

test("an item at the end of its place stays where it is", () => {
  const list = [step("boots"), step("sword", "REPLACED"), step("holy")]
  assert.equal(shiftItem(list, "boots", -1, index), list)
  assert.equal(shiftItem(list, "sword", 1, index), list)
})

test("an upgraded item keeps its place, takes the lower one as its part and has no time yet", () => {
  const list = steps(
    upgradeItem([step("boots"), step("sword", "SITUATIONAL", { atSeconds: 180 })], "sword", pick("holy"), index),
  )
  assert.deepEqual(list[1], step("holy", "SITUATIONAL", { from: [pick("sword")] }))
})

test("upgrading into an item that is listed makes the lower one its part there", () => {
  const list = steps(
    upgradeItem([step("holy", "KEPT", { atSeconds: 400 }), step("sword")], "sword", pick("holy"), index),
  )
  assert.deepEqual(list, [step("holy", "KEPT", { atSeconds: 400, from: [pick("sword")] })])
})

test("an item made of two takes both as its parts, one after the other", () => {
  const one = steps(upgradeItem([step("gauntlet"), step("greaves")], "gauntlet", pick("aegis"), index))
  const both = steps(upgradeItem(one, "greaves", pick("aegis"), index))
  assert.deepEqual(keys(both), ["aegis"])
  assert.deepEqual(partsOf(both, "aegis"), ["gauntlet", "greaves"])
})

test("an item is upgraded into none of tier 1", () => {
  assert.equal(upgradeItem([step("sword")], "sword", pick("short"), index), "TIER")
})

test("a part pressed again is taken off", () => {
  const on = steps(togglePart([step("holy")], "holy", pick("sword"), index))
  assert.deepEqual(partsOf(on, "holy"), ["sword"])
  assert.deepEqual(partsOf(togglePart(on, "holy", pick("sword"), index), "holy"), [])
})

test("an item is built from at most three others", () => {
  const list = [step("revive", "KEPT", { from: ["sword", "greaves", "boots"].map(pick) })]
  assert.equal(togglePart(list, "revive", pick("gauntlet"), index), "PARTS")
})

test("a part is of a lower tier than its item, or one the recipe names", () => {
  assert.equal(togglePart([step("holy")], "holy", pick("aegis"), index), "LOWER")
  assert.equal(togglePart([step("sword")], "sword", pick("holy"), index), "LOWER")
  assert.deepEqual(partsOf(togglePart([step("comet")], "comet", pick("fang"), index), "comet"), ["fang"])
})

test("a part the catalogue does not know is taken, its tier being unknown", () => {
  const typed = { id: null, name: "Món cũ" }
  assert.equal(steps(togglePart([step("holy")], "holy", typed, index))[0]!.from!.length, 1)
})

test("an item with a part that cannot go into another is not upgraded into it", () => {
  const list = [step("greaves", "KEPT", { from: [pick("boots")] })]
  const finished = reference("plate", "Giáp thép", 2, ["greaves"])
  assert.equal(upgradeItem(list, "greaves", { id: "plate" }, itemIndex([...ITEMS, finished])), "LOWER")
})

test("an item is no part of itself, and no part is of tier 1", () => {
  assert.equal(togglePart([step("holy")], "holy", pick("holy"), index), "SAME")
  assert.equal(togglePart([step("holy")], "holy", pick("short"), index), "TIER")
})

test("a time is inside the game, or any while its length is unknown", () => {
  assert.equal(setTime([step("holy")], "holy", 901, 900, index), "TIME")
  assert.equal(steps(setTime([step("holy")], "holy", 901, null, index))[0]!.atSeconds, 901)
  assert.equal(steps(setTime([step("holy", "KEPT", { atSeconds: 60 })], "holy", null, 900, index))[0]!.atSeconds, null)
})

test("a time that contradicts those of other items moves the item to where it belongs", () => {
  const list = [step("holy", "KEPT", { atSeconds: 600 }), step("boots"), step("fang", "KEPT", { atSeconds: 800 })]
  assert.deepEqual(keys(setTime(list, "boots", 200, LENGTH, index)), ["boots", "holy", "fang"])
  assert.deepEqual(keys(setTime(list, "holy", 850, LENGTH, index)), ["boots", "fang", "holy"])
})

test("a time that agrees with the others leaves the item where it is", () => {
  const list = [step("holy"), step("boots"), step("fang", "KEPT", { atSeconds: 800 })]
  assert.deepEqual(keys(setTime(list, "boots", 800, LENGTH, index)), ["holy", "boots", "fang"])
  assert.deepEqual(keys(setTime(list, "fang", null, LENGTH, index)), ["holy", "boots", "fang"])
})

test("the last item of a list over a snapshot cannot be taken out, since the snapshot would be read again", () => {
  const before = participant({ build: [step("boots")], equipmentSnapshots: [snapshot(900, ["holy"])] })
  const remove = (list: BuildStep[]) => removeItem(list, "boots", index)
  assert.equal(editBuild(before, LENGTH, remove, index), "LAST")
})

test("the last item of a list can be taken out over nothing, and over an inventory of the middle of the game", () => {
  for (const equipmentSnapshots of [[], [snapshot(300, ["holy"])]]) {
    const before = participant({ build: [step("boots")], equipmentSnapshots })
    const after = editBuild(before, LENGTH, (list) => removeItem(list, "boots", index), index)
    assert.ok(!refused(after))
    assert.deepEqual(after.build, [])
  }
})

test("of an item a list written elsewhere names twice, the later one is taken out", () => {
  const list = [step("holy", "KEPT", { atSeconds: 400 }), step("holy", "SITUATIONAL")]
  assert.deepEqual(removeItem(list, "holy", index), [list[0]])
})

test("a recipe offers the parts of tier 2 and up", () => {
  assert.deepEqual(
    recipeParts(pick("aegis"), index).map((part) => part.id),
    ["gauntlet", "greaves"],
  )
  assert.deepEqual(
    recipeParts(pick("holy"), index).map((part) => part.id),
    ["sword"],
    "a part of tier 1 is left out",
  )
})

test("an item offers what it goes into, by name", () => {
  assert.deepEqual(
    upgradesOf(pick("sword"), index).map((item) => item.name),
    ["Giáp hộ mệnh", "Nanh Fenrir", "Thánh kiếm"],
  )
  assert.deepEqual(upgradesOf({ id: null, name: "Món cũ" }, index), [])
})

test("an item seen at an earlier moment is offered with that moment, one the game ended with without", () => {
  const seen = seenItems(
    participant({
      equipmentSnapshots: [snapshot(300, ["boots", "short"]), snapshot(900, ["boots", "holy", "fang"])],
      equipmentEvents: [{ atSeconds: 500, type: "BUY", item: pick("revive"), toSlot: 2 }],
    }),
    LENGTH,
    [step("holy")],
    index,
  )
  assert.deepEqual(
    seen.map(({ item, atSeconds }) => [item.id, atSeconds]),
    [
      ["boots", 300],
      ["revive", 500],
      ["fang", null],
    ],
  )
})

test("the last inventory of the middle of a game offers its items with its moment", () => {
  const seen = seenItems(participant({ equipmentSnapshots: [snapshot(400, ["boots"])] }), LENGTH, [], index)
  assert.deepEqual(
    seen.map(({ item, atSeconds }) => [item.id, atSeconds]),
    [["boots", 400]],
  )
})

test("an item that is a part already is not offered as seen", () => {
  const seen = seenItems(
    participant({ equipmentSnapshots: [snapshot(300, ["sword"]), snapshot(900, ["holy"])] }),
    LENGTH,
    [step("holy", "KEPT", { from: [pick("sword")] })],
    index,
  )
  assert.deepEqual(seen, [])
})

test("what the service would refuse in a list is named item by item", () => {
  const problems = buildProblems(
    [
      step("holy", "KEPT", { atSeconds: 2000 }),
      step("short", "REPLACED"),
      step("fang", "KEPT", { from: [pick("fang")] }),
      step("holy", "SITUATIONAL"),
      step("boots", "KEPT", { from: [pick("aegis")] }),
    ],
    LENGTH,
    index,
  )
  assert.deepEqual(
    problems.map(({ step: entry, reason }) => [entry.item.id, reason]),
    [
      ["holy", "TIME"],
      ["short", "TIER"],
      ["fang", "SAME"],
      ["holy", "TWICE"],
      ["boots", "LOWER"],
    ],
  )
})

test("a list the service accepts has nothing to fix", () => {
  const list = [step("aegis", "KEPT", { from: ["gauntlet", "greaves"].map(pick), atSeconds: 400 }), step("boots")]
  assert.deepEqual(buildProblems(list, 900, index), [])
})

test("the catalogue lists finished items before those of tier 2, and none of tier 1", () => {
  assert.deepEqual(
    itemGroups(index, "").map((group) => group.tier),
    [3, 2],
  )
})

test("where the parts of an item are looked for, only what it can have grown from is listed, the lowest first", () => {
  const groups = (id: string) =>
    itemGroups(index, "", pick(id)).map(({ tier, items }) => [tier, items.map((item) => item.id)])
  assert.deepEqual(groups("aegis"), [[2, ["gauntlet", "greaves", "boots", "sword"]]])
  assert.deepEqual(groups("comet"), [
    [2, ["gauntlet", "greaves", "boots", "sword"]],
    [3, ["fang"]],
  ])
  assert.deepEqual(groups("boots"), [])
})

test("a search that finds only what cannot be listed says why", () => {
  assert.equal(unlisted(index, "kiem ngan"), "TIER")
  assert.equal(unlisted(index, "nanh", pick("aegis")), "LOWER")
  assert.equal(unlisted(index, "nanh"), null)
  assert.equal(unlisted(index, "không có món này"), null)
})

test("a part a list written elsewhere names twice is said to repeat, not to be one too many", () => {
  const list = [step("aegis", "KEPT", { from: [pick("greaves"), pick("greaves")] })]
  assert.deepEqual(
    buildProblems(list, LENGTH, index).map(({ reason }) => reason),
    ["TWICE"],
  )
})

test("an item looked for among its own parts is said not to grow from itself", () => {
  assert.equal(unlisted(index, "thanh kiem", pick("holy")), "SAME")
})

/** Items typed by hand, as many as asked for. */
const typed = (count: number) =>
  Array.from({ length: count }, (_, position): BuildStep => ({
    item: { id: null, name: `Món ${position}` },
    place: "SITUATIONAL",
  }))

test("a list takes a twenty-fourth item and refuses a twenty-fifth", () => {
  assert.equal(steps(addItem(typed(23), pick("holy"), "SITUATIONAL", index)).length, 24)
  assert.equal(addItem(typed(24), pick("holy"), "SITUATIONAL", index), "STEPS")
})

test("a list written elsewhere with a twenty-fifth item names that one", () => {
  const problems = buildProblems(typed(25), LENGTH, index)
  assert.deepEqual(
    problems.map(({ step: entry, reason }) => [entry.item.name, reason]),
    [["Món 24", "STEPS"]],
  )
})

test("only the items kept to the end count against its six slots", () => {
  const six = ["holy", "aegis", "fang", "revive", "boots", "greaves"].map((id) => step(id))
  assert.deepEqual(buildProblems([...six, step("sword", "REPLACED")], LENGTH, index), [])
})

test("an upgrade that would give the new item a fourth part is refused", () => {
  const list = [step("greaves", "KEPT", { from: ["sword", "gauntlet", "boots"].map(pick) })]
  assert.equal(upgradeItem(list, "greaves", pick("aegis"), index), "PARTS")
})

test("a time before the game starts is refused and its last second is taken", () => {
  assert.equal(setTime([step("holy")], "holy", -1, LENGTH, index), "TIME")
  assert.equal(steps(setTime([step("holy")], "holy", LENGTH, LENGTH, index))[0]!.atSeconds, LENGTH)
})

test("a slot nobody saw is not read, whatever it names, and slots are read in their order", () => {
  const seen: EquipmentSnapshot = {
    atSeconds: LENGTH,
    slots: [
      { slot: 2, known: true, item: pick("aegis") },
      { slot: 3, known: false, item: pick("fang") },
      { slot: 1, known: true, item: pick("holy") },
    ],
  }
  assert.deepEqual(keys(buildOf(participant({ equipmentSnapshots: [seen] }), LENGTH, index).steps), ["holy", "aegis"])
})

test("the last item of a list can be taken out over an inventory of the end that holds only items of tier 1", () => {
  const player = participant({ build: [step("holy")], equipmentSnapshots: [snapshot(LENGTH, ["short"])] })
  const next = editBuild(player, LENGTH, (list) => removeItem(list, "holy", index), index)
  assert.ok(!refused(next) && next.build?.length === 0)
})

test("an item of tier 1 is offered as no upgrade, even where it names the item", () => {
  const odd = itemIndex([...ITEMS, reference("charm", "Bùa nhỏ", 1, ["sword"])])
  assert.ok(!upgradesOf(pick("sword"), odd).some((item) => item.id === "charm"))
})

test("an item an upgrade brought is offered as seen, and one of a slot nobody saw is not", () => {
  const seen = seenItems(
    participant({
      equipmentSnapshots: [{ atSeconds: 300, slots: [{ slot: 1, known: false, item: pick("fang") }] }],
      equipmentEvents: [{ atSeconds: 200, type: "UPGRADE", item: pick("aegis"), toSlot: 1 }],
    }),
    LENGTH,
    [],
    index,
  )
  assert.deepEqual(
    seen.map(({ item }) => item.id),
    ["aegis"],
  )
})

test("an item of no known tier is listed after all others", () => {
  const mixed = itemIndex([...ITEMS, { id: "old", code: "old", name: "Món cũ" }])
  for (const partsOf of [null, pick("holy")]) assert.equal(itemGroups(mixed, "", partsOf).at(-1)!.tier, null)
})

test("a search needs no accents and puts names that begin with it first", () => {
  assert.deepEqual(
    itemGroups(index, "kiem").map((group) => group.items.map((item) => item.name)),
    [["Thánh kiếm"], ["Kiếm dài"]],
  )
  assert.deepEqual(
    itemGroups(index, "gia").flatMap((group) => group.items.map((item) => item.name)),
    ["Giáp hộ mệnh", "Giáp chân", "Giày hộ vệ"],
  )
  const named = itemIndex([reference("a", "Áo choàng thánh", 3), reference("b", "Thánh kiếm", 3)])
  assert.deepEqual(
    itemGroups(named, "thanh")[0]!.items.map((item) => item.name),
    ["Thánh kiếm", "Áo choàng thánh"],
  )
})
