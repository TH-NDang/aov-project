import assert from "node:assert/strict"
import { test } from "node:test"
import type { BuildStep, EquipmentSnapshot, Participant, Reference } from "@aov/community-contracts"
import {
  MAX_STEPS,
  addItem,
  buildOf,
  buildProblems,
  editBuild,
  endSlots,
  fates,
  itemGroups,
  itemIndex,
  itemKey,
  itemName,
  recipeParts,
  refused,
  removeItem,
  seenItems,
  setRole,
  setSold,
  setTime,
  shiftItem,
  togglePart,
  toggleReplaced,
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
const step = (id: string, more: Partial<BuildStep> = {}): BuildStep => ({
  item: pick(id),
  from: [],
  role: "CORE",
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
/** Items typed by hand and sold on the way, as many as asked for. */
const typed = (count: number) =>
  Array.from({ length: count }, (_, position): BuildStep => ({
    item: { id: null, name: `Món ${position}` },
    role: "PROTECTIVE",
    sold: true,
  }))
const SIX = ["holy", "aegis", "fang", "revive", "boots", "greaves"]

const keys = (edit: BuildEdit) => (refused(edit) ? edit : edit.map((entry) => itemKey(entry.item, index)))
const partsOf = (edit: BuildEdit, id: string) =>
  refused(edit) ? edit : edit.find((entry) => entry.item.id === id)?.from?.map((part) => itemKey(part, index))
const steps = (edit: BuildEdit) => {
  assert.ok(!refused(edit), `refused: ${String(edit)}`)
  return edit
}

test("a list somebody wrote is read as it is, whatever the snapshots show", () => {
  const build = buildOf(
    participant({ build: [step("sword", { sold: true })], equipmentSnapshots: [snapshot(900, ["holy"])] }),
    LENGTH,
    index,
  )
  assert.deepEqual(keys(build.steps), ["sword"])
  assert.equal(build.snapshot, null)
})

test("a list of the first kind reads its places as roles and sales", () => {
  const first = [
    { item: pick("sword"), from: [], place: "REPLACED" },
    { item: pick("boots"), from: [], place: "REPLACED" },
    { item: pick("holy"), from: [pick("sword")], place: "KEPT" },
    { item: pick("revive"), from: [], place: "SITUATIONAL" },
  ] as unknown as BuildStep[]
  const { steps: read } = buildOf(participant({ build: first }), LENGTH, index)
  assert.deepEqual(
    read.map((entry) => [entry.role, !!entry.sold, "place" in entry]),
    [
      ["CORE", false, false],
      ["CORE", true, false],
      ["CORE", false, false],
      ["PROTECTIVE", false, false],
    ],
  )
  assert.deepEqual(fates(read, index), ["UPGRADED", "SOLD", "HELD", "HELD"])
})

test("without a list the items are those the game ended with, all of them the build itself", () => {
  const build = buildOf(
    participant({ equipmentSnapshots: [snapshot(300, ["boots"]), snapshot(900, ["holy", undefined, "boots", null])] }),
    LENGTH,
    index,
  )
  assert.deepEqual(keys(build.steps), ["holy", "boots"])
  assert.deepEqual(
    build.steps.map((entry) => entry.role),
    ["CORE", "CORE"],
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
  const after = editBuild(before, LENGTH, (list) => addItem(list, pick("revive"), "PROTECTIVE", index), index)
  assert.ok(!refused(after))
  assert.deepEqual(keys(after.build!), ["holy", "boots", "revive"])
  assert.equal(after.equipmentSnapshots, before.equipmentSnapshots, "the snapshot stays")
})

test("over an inventory of the middle of the game the first edit starts an empty list", () => {
  const before = participant({ equipmentSnapshots: [snapshot(300, ["boots"])] })
  const after = editBuild(before, LENGTH, (list) => addItem(list, pick("revive"), "CORE", index), index)
  assert.ok(!refused(after))
  assert.deepEqual(keys(after.build!), ["revive"])
})

test("an edit that changes nothing leaves the player untouched", () => {
  const before = participant({ build: [step("holy")] })
  assert.equal(
    editBuild(before, LENGTH, (list) => setRole(list, "holy", "CORE", index), index),
    before,
  )
})

test("an item is added as the latest one built, with the role it is given", () => {
  const list = steps(addItem([step("boots")], pick("revive"), "PROTECTIVE", index, 420))
  assert.deepEqual(list[1], step("revive", { role: "PROTECTIVE", atSeconds: 420 }))
})

test("an item added with a time stands before the first one built later", () => {
  const list = [step("boots"), step("greaves", { atSeconds: 300 }), step("holy", { atSeconds: 600 })]
  assert.deepEqual(keys(addItem(list, pick("aegis"), "CORE", index, 450)), ["boots", "greaves", "aegis", "holy"])
  assert.deepEqual(keys(addItem(list, pick("aegis"), "CORE", index, 600)), ["boots", "greaves", "holy", "aegis"])
})

test("an item grows from the parts of its recipe the player held when it was bought", () => {
  const list = steps(addItem([step("sword", { atSeconds: 100 }), step("boots")], pick("holy"), "CORE", index, 500))
  assert.deepEqual(partsOf(list, "holy"), ["sword"])
  assert.deepEqual(fates(list, index), ["UPGRADED", "HELD", "HELD"])
})

test("a part that already went into another item is not taken again", () => {
  const list = steps(addItem([step("sword"), step("fang", { from: [pick("sword")] })], pick("holy"), "CORE", index))
  assert.deepEqual(partsOf(list, "holy"), [])
})

test("an item that is listed already is not listed twice", () => {
  assert.equal(addItem([step("boots"), step("holy")], pick("boots"), "CORE", index), "TWICE")
})

test("an item typed by hand is the catalogue's item of that name", () => {
  const name = { id: null, name: "giay ho ve" }
  assert.deepEqual(steps(addItem([], name, "CORE", index))[0]!.item, pick("boots"))
  assert.equal(addItem([step("boots")], name, "CORE", index), "TWICE", "so it is listed once")
})

test("an item of tier 1 is no step of a build", () => {
  assert.equal(addItem([], pick("short"), "CORE", index), "TIER")
})

test("an item the catalogue does not know can be listed under its name", () => {
  const list = steps(addItem([], { id: null, name: "Món cũ" }, "CORE", index))
  assert.equal(itemName(list[0]!.item, index), "Món cũ")
})

test("with six items held a seventh asks which one was sold for it", () => {
  const six = SIX.map((id) => step(id))
  assert.equal(addItem(six, pick("gauntlet"), "CORE", index), "HELD")
  const list = steps(addItem(six, pick("gauntlet"), "CORE", index, null, [pick("boots")]))
  assert.deepEqual(list.at(-1)!.replaces, [pick("boots")])
  assert.deepEqual(keys(endSlots(list, index)), ["holy", "aegis", "fang", "revive", "greaves", "gauntlet"])
})

test("an item that grows from one of the six takes no seventh slot", () => {
  const six = ["sword", "boots", "greaves", "gauntlet", "comet", "aegis"].map((id) => step(id))
  const list = steps(addItem(six, pick("holy"), "CORE", index))
  assert.deepEqual(partsOf(list, "holy"), ["sword"])
})

test("an item is sold only for one bought before it and still held then", () => {
  const list = [step("sword"), step("fang", { from: [pick("sword")] })]
  assert.equal(addItem(list, pick("revive"), "CORE", index, null, [pick("sword")]), "GONE")
  assert.equal(addItem(list, pick("revive"), "CORE", index, null, [pick("holy")]), "GONE")
})

test("a list holds at most twenty-four items", () => {
  assert.equal(addItem(typed(MAX_STEPS), pick("holy"), "CORE", index), "STEPS")
})

test("the end slots are the items held, those of the build before the protective ones", () => {
  const list = [step("revive", { role: "PROTECTIVE" }), step("holy"), step("boots", { sold: true })]
  assert.deepEqual(keys(endSlots(list, index)), ["holy", "revive"])
})

test("an item moves one place in the order it was bought", () => {
  const list = [step("boots"), step("sword"), step("holy"), step("aegis")]
  assert.deepEqual(keys(shiftItem(list, "boots", 1, index)), ["sword", "boots", "holy", "aegis"])
  assert.deepEqual(keys(shiftItem(list, "aegis", -1, index)), ["boots", "sword", "aegis", "holy"])
})

test("an item at either end of the list stays where it is", () => {
  const list = [step("boots"), step("sword"), step("holy")]
  assert.equal(shiftItem(list, "boots", -1, index), list)
  assert.equal(shiftItem(list, "holy", 1, index), list)
})

test("an item does not move past one whose time says otherwise, nor above one sold for it", () => {
  assert.equal(
    shiftItem([step("boots", { atSeconds: 100 }), step("sword", { atSeconds: 200 })], "boots", 1, index),
    "ORDER",
  )
  const sold = [step("boots"), step("revive", { replaces: [pick("boots")] })]
  assert.equal(shiftItem(sold, "revive", -1, index), "GONE")
})

test("an upgrade adds the later item grown from the lower one, bought for the same", () => {
  const list = steps(
    upgradeItem([step("boots"), step("sword", { role: "PROTECTIVE", atSeconds: 180 })], "sword", pick("revive"), index),
  )
  assert.deepEqual(list[2], step("revive", { role: "PROTECTIVE", from: [pick("sword")] }))
  assert.deepEqual(fates(list, index), ["HELD", "UPGRADED", "HELD"])
})

test("an upgrade at a second goes where that second belongs, never before the lower item", () => {
  const list = [step("sword", { atSeconds: 100 }), step("boots", { atSeconds: 300 })]
  assert.deepEqual(keys(upgradeItem(list, "sword", pick("holy"), index, 200)), ["sword", "holy", "boots"])
  assert.equal(upgradeItem([step("sword", { atSeconds: 300 })], "sword", pick("holy"), index, 200), "ORDER")
})

test("upgrading into an item listed later makes the lower one its part there", () => {
  const list = steps(upgradeItem([step("sword"), step("holy", { atSeconds: 400 })], "sword", pick("holy"), index))
  assert.deepEqual(list, [step("sword"), step("holy", { atSeconds: 400, from: [pick("sword")] })])
})

test("an item listed before another did not grow from it", () => {
  assert.equal(upgradeItem([step("holy"), step("sword")], "sword", pick("holy"), index), "ORDER")
})

test("an item made of two takes both as its parts, one after the other", () => {
  const one = steps(upgradeItem([step("gauntlet"), step("greaves")], "gauntlet", pick("aegis"), index))
  const both = steps(upgradeItem(one, "greaves", pick("aegis"), index))
  assert.deepEqual(keys(both), ["gauntlet", "greaves", "aegis"])
  assert.deepEqual(partsOf(both, "aegis"), ["gauntlet", "greaves"])
  assert.deepEqual(fates(both, index), ["UPGRADED", "UPGRADED", "HELD"])
})

test("an item is upgraded into none of tier 1, nor into one it cannot have grown from", () => {
  assert.equal(upgradeItem([step("sword")], "sword", pick("short"), index), "TIER")
  assert.equal(upgradeItem([step("holy")], "holy", pick("sword"), index), "LOWER")
})

test("an upgrade into a listed item that has three parts already is refused", () => {
  const list = [step("greaves"), step("aegis", { from: ["sword", "gauntlet", "boots"].map(pick) })]
  assert.equal(upgradeItem(list, "greaves", pick("aegis"), index), "PARTS")
})

test("a part pressed again is taken off", () => {
  const on = steps(togglePart([step("holy")], "holy", pick("sword"), index))
  assert.deepEqual(partsOf(on, "holy"), ["sword"])
  assert.deepEqual(partsOf(togglePart(on, "holy", pick("sword"), index), "holy"), [])
})

test("an item is built from at most three others", () => {
  const list = [step("revive", { from: ["sword", "greaves", "boots"].map(pick) })]
  assert.equal(togglePart(list, "revive", pick("gauntlet"), index), "PARTS")
})

test("a part is of a lower tier than its item, or one the recipe names", () => {
  assert.equal(togglePart([step("holy")], "holy", pick("aegis"), index), "LOWER")
  assert.equal(togglePart([step("sword")], "sword", pick("holy"), index), "LOWER")
  assert.deepEqual(partsOf(togglePart([step("comet")], "comet", pick("fang"), index), "comet"), ["fang"])
})

test("a part the catalogue does not know is taken, its tier being unknown", () => {
  const name = { id: null, name: "Món cũ" }
  assert.equal(steps(togglePart([step("holy")], "holy", name, index))[0]!.from!.length, 1)
})

test("an item is no part of itself, and no part is of tier 1", () => {
  assert.equal(togglePart([step("holy")], "holy", pick("holy"), index), "SAME")
  assert.equal(togglePart([step("holy")], "holy", pick("short"), index), "TIER")
})

test("an item sold for another is pressed on and off among those held before it", () => {
  const list = [step("boots"), step("sword"), step("revive")]
  const on = steps(toggleReplaced(list, "revive", pick("boots"), index))
  assert.deepEqual(on[2]!.replaces, [pick("boots")])
  assert.deepEqual(steps(toggleReplaced(on, "revive", pick("boots"), index)), list)
  assert.equal(toggleReplaced(list, "revive", pick("revive"), index), "SAME")
  assert.equal(toggleReplaced(list, "sword", pick("revive"), index), "GONE")
})

test("an item is bought from the sale of at most two others", () => {
  const list = [
    step("boots"),
    step("sword"),
    step("greaves"),
    step("revive", { replaces: ["boots", "sword"].map(pick) }),
  ]
  assert.equal(toggleReplaced(list, "revive", pick("greaves"), index), "REPLACED")
})

test("an item sold for nothing recorded is held no more, and held again only into a free slot", () => {
  const sold = steps(setSold([step("boots")], "boots", true, index))
  assert.deepEqual(fates(sold, index), ["SOLD"])
  const seven = [...SIX.map((id) => step(id)), step("sword", { sold: true })]
  assert.equal(setSold(seven, "sword", false, index), "HELD")
})

test("a role is changed in place", () => {
  const list = steps(setRole([step("holy"), step("revive")], "revive", "PROTECTIVE", index))
  assert.deepEqual(
    list.map((entry) => entry.role),
    ["CORE", "PROTECTIVE"],
  )
})

test("a time is inside the game, or any while its length is unknown", () => {
  assert.equal(setTime([step("holy")], "holy", 901, 900, index), "TIME")
  assert.equal(steps(setTime([step("holy")], "holy", 901, null, index))[0]!.atSeconds, 901)
  assert.equal(steps(setTime([step("holy", { atSeconds: 60 })], "holy", null, 900, index))[0]!.atSeconds, null)
})

test("a time that contradicts those of other items moves the item to where it belongs", () => {
  const list = [step("holy", { atSeconds: 600 }), step("boots"), step("fang", { atSeconds: 800 })]
  assert.deepEqual(keys(setTime(list, "boots", 200, LENGTH, index)), ["boots", "holy", "fang"])
  assert.deepEqual(keys(setTime(list, "holy", 850, LENGTH, index)), ["boots", "fang", "holy"])
})

test("a time that agrees with the others leaves the item where it is", () => {
  const list = [step("holy"), step("boots"), step("fang", { atSeconds: 800 })]
  assert.deepEqual(keys(setTime(list, "boots", 800, LENGTH, index)), ["holy", "boots", "fang"])
  assert.deepEqual(keys(setTime(list, "fang", null, LENGTH, index)), ["holy", "boots", "fang"])
})

test("a time that would move an item after the one sold for it is refused", () => {
  const list = [step("boots"), step("revive", { atSeconds: 500, replaces: [pick("boots")] })]
  assert.equal(setTime(list, "boots", 600, LENGTH, index), "GONE")
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
  const list = [step("holy", { atSeconds: 400 }), step("holy", { role: "PROTECTIVE" })]
  assert.deepEqual(removeItem(list, "holy", index), [list[0]])
})

test("an item taken out is taken out of what was bought from its sale", () => {
  const list = [step("boots"), step("revive", { replaces: [pick("boots")] })]
  assert.deepEqual(removeItem(list, "boots", index), [step("revive")])
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
    [step("holy", { from: [pick("sword")] })],
    index,
  )
  assert.deepEqual(seen, [])
})

test("what the service would refuse in a list is named item by item", () => {
  const problems = buildProblems(
    [
      step("holy", { atSeconds: 2000 }),
      step("short"),
      step("fang", { from: [pick("fang")] }),
      step("holy"),
      step("boots", { from: [pick("aegis")] }),
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

test("times that go back, sales of what was not held and a seventh held item are named", () => {
  const problems = buildProblems(
    [
      step("boots", { atSeconds: 300 }),
      step("sword", { atSeconds: 200 }),
      step("revive", { replaces: [pick("greaves")] }),
      ...["holy", "aegis", "fang", "comet"].map((id) => step(id)),
    ],
    LENGTH,
    index,
  )
  assert.deepEqual(
    problems.map(({ step: entry, reason }) => [entry.item.id, reason]),
    [
      ["sword", "ORDER"],
      ["revive", "GONE"],
      ["comet", "HELD"],
    ],
  )
})

test("a list the service accepts has nothing to fix", () => {
  const list = [
    step("gauntlet"),
    step("aegis", { from: ["gauntlet", "greaves"].map(pick), atSeconds: 400 }),
    step("boots"),
    step("revive", { role: "PROTECTIVE", replaces: [pick("boots")] }),
  ]
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
  const list = [step("aegis", { from: [pick("greaves"), pick("greaves")] })]
  assert.deepEqual(
    buildProblems(list, LENGTH, index).map(({ reason }) => reason),
    ["TWICE"],
  )
})

test("an item looked for among its own parts is said not to grow from itself", () => {
  assert.equal(unlisted(index, "thanh kiem", pick("holy")), "SAME")
})

test("a list takes a twenty-fourth item and refuses a twenty-fifth", () => {
  assert.equal(steps(addItem(typed(23), pick("holy"), "CORE", index)).length, 24)
  assert.equal(addItem(typed(24), pick("holy"), "CORE", index), "STEPS")
})

test("a list written elsewhere with a twenty-fifth item names that one", () => {
  const problems = buildProblems(typed(25), LENGTH, index)
  assert.deepEqual(
    problems.map(({ step: entry, reason }) => [entry.item.name, reason]),
    [["Món 24", "STEPS"]],
  )
})

test("only the items held to the end count against its six slots", () => {
  const six = SIX.map((id) => step(id))
  assert.deepEqual(buildProblems([...six, step("sword", { sold: true })], LENGTH, index), [])
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
