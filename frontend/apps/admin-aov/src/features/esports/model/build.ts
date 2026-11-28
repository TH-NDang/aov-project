import type {
  BuildRole,
  BuildStep,
  EquipmentSnapshot,
  Participant,
  Reference,
  Selection,
} from "@aov/community-contracts"
import { matchesQuery, normalize } from "@/lib/text"
import { nameKey } from "./name-key"

/** The limits of a build, the ones the service refuses a game for: its steps, the six slots and the parts of an item. */
export const MAX_STEPS = 24
export const MAX_HELD = 6
export const MAX_PARTS = 3
/** Items sold for one item: a full inventory gives one up, rarely two. */
export const MAX_REPLACED = 2
/** Items of a lower tier are bought on the way to another and are no step of a build. */
export const MIN_TIER = 2
/** An inventory seen this close to the end of a game is the one the player ended it with. */
const END_SECONDS = 60
/** No game lasts a day; the bound of a time while the length of the game is unknown. */
const MAX_GAME_SECOND = 86_400

/** What an item was bought for. An active effect says nothing of it: some active items are the build itself. */
export const BUILD_ROLES: { code: BuildRole; label: string; hint: string }[] = [
  { code: "CORE", label: "Chính", hint: "Món của bộ trang bị, kể cả món có kích hoạt" },
  { code: "PROTECTIVE", label: "Bảo hộ", hint: "Món mua để sống sót, như hồi sinh hay món cứu một lúc" },
]
export const buildRole = (code: BuildRole) => BUILD_ROLES.find((role) => role.code === code)!

/** What became of an item: held when the game ended, gone into a later item, or sold. */
export type Fate = "HELD" | "UPGRADED" | "SOLD"

/** Finds the catalogue's entry of a recorded item by its id, or by its name when it was recorded without one. */
export type ItemIndex = { items: Reference[]; find: (item: Selection | null | undefined) => Reference | undefined }

export function itemIndex(items: Reference[] = []): ItemIndex {
  const byId = new Map(items.map((item) => [item.id, item]))
  const byName = new Map(items.map((item) => [nameKey(item.name), item]))
  return {
    items,
    find: (item) => (item?.id ? byId.get(item.id) : item?.name ? byName.get(nameKey(item.name)) : undefined),
  }
}

const NO_ITEMS = itemIndex()

/** What makes two recorded items the same one: their entry in the catalogue, or the name typed by hand. */
export const itemKey = (item: Selection | null | undefined, index: ItemIndex) =>
  index.find(item)?.id ?? item?.id ?? nameKey(item?.name ?? "")

/** The name an item is shown by. */
export const itemName = (item: Selection | null | undefined, index: ItemIndex) =>
  item?.name?.trim() || index.find(item)?.name || "Chưa rõ tên"

const present = (item: Selection | null | undefined): item is Selection => !!(item?.id || item?.name?.trim())

/** An item the catalogue does not know has no known tier, so nothing speaks against it. */
const tooLow = (item: Selection, index: ItemIndex) => (index.find(item)?.tier ?? MIN_TIER) < MIN_TIER

/** Whether an item can have grown from a part: one of a lower tier, or one its recipe names. */
function growsFrom(item: Selection, part: Selection, index: ItemIndex) {
  const whole = index.find(item)
  const lower = index.find(part)
  if (whole?.tier == null || lower?.tier == null) return true
  return lower.tier < whole.tier || !!whole.components?.includes(lower.id)
}

const selectionOf = (item: Selection): Selection => ({ id: item.id ?? null, name: item.name ?? null })

/** A step as the service writes it: what it grew from always, what it replaced and its sale only when there are some. */
function stepOf(
  item: Selection,
  role: BuildRole,
  atSeconds: number | null,
  from: Selection[] = [],
  replaces: Selection[] = [],
): BuildStep {
  return {
    item: selectionOf(item),
    from: from.map(selectionOf),
    ...(replaces.length ? { replaces: replaces.map(selectionOf) } : {}),
    role,
    atSeconds,
  }
}

const names = (selections: Selection[] | undefined, key: string, index: ItemIndex) =>
  (selections ?? []).some((selection) => present(selection) && itemKey(selection, index) === key)

/** The step whose item a later step grew from or replaced, or -1 while it is held or sold for nothing recorded. */
export function successor(steps: BuildStep[], at: number, index: ItemIndex): number {
  const step = steps[at]
  if (!step || !present(step.item)) return -1
  const key = itemKey(step.item, index)
  for (let later = at + 1; later < steps.length; later++) {
    if (names(steps[later]!.from, key, index) || names(steps[later]!.replaces, key, index)) return later
  }
  return -1
}

/** What became of each step, read from the steps after it, as the service reads it. */
export function fates(steps: BuildStep[], index: ItemIndex): Fate[] {
  return steps.map((step, at) => {
    const next = successor(steps, at, index)
    if (next >= 0) return names(steps[next]!.from, itemKey(step.item, index), index) ? "UPGRADED" : "SOLD"
    return step.sold ? "SOLD" : "HELD"
  })
}

/** The items held when the game ended, those of the build itself before the protective ones, each in buying order. */
export function endSlots(steps: BuildStep[], index: ItemIndex): BuildStep[] {
  const fate = fates(steps, index)
  const held = steps.filter((_, at) => fate[at] === "HELD")
  return [...held.filter((step) => step.role !== "PROTECTIVE"), ...held.filter((step) => step.role === "PROTECTIVE")]
}

const heldCount = (steps: BuildStep[], index: ItemIndex) => fates(steps, index).filter((fate) => fate === "HELD").length

/** The steps before `at` the player still held when it was bought: nothing between grew from or replaced them. */
export function heldBefore(steps: BuildStep[], at: number, index: ItemIndex): BuildStep[] {
  const before = steps.slice(0, at)
  return before.filter((_, earlier) => successor(before, earlier, index) < 0)
}

/** A step without a field the service leaves out while it is empty. */
function without(step: BuildStep, field: "replaces" | "sold"): BuildStep {
  const copy = { ...step }
  delete copy[field]
  return copy
}

/**
 * A list as it is written now. The first lists (25/11/2026) put each item in a place instead of a role; the service
 * reads them so and never answers them again, but a list held in the page since then may still have one.
 */
function current(steps: BuildStep[], index: ItemIndex): BuildStep[] {
  const placeOf = (step: BuildStep) => (step as BuildStep & { place?: string }).place
  if (steps.every((step) => step.role && placeOf(step) == null)) return steps
  return steps.map((step, at) => {
    const place = placeOf(step)
    const copy: BuildStep & { place?: string } = without(step, "sold")
    delete copy.place
    const sold = !!step.sold || (place === "REPLACED" && successor(steps, at, index) < 0)
    return { ...copy, role: step.role ?? (place === "SITUATIONAL" ? "PROTECTIVE" : "CORE"), ...(sold ? { sold } : {}) }
  })
}

/**
 * The items of a player. While nobody wrote a list, they are read from the `snapshot` the game ended with, which then
 * says where they come from; `leftOut` counts its slots a build does not name, for holding a tier 1 item or one named
 * already.
 */
export type Build = { steps: BuildStep[]; snapshot: EquipmentSnapshot | null; leftOut: number }

const lastSnapshot = (snapshots: readonly EquipmentSnapshot[]): EquipmentSnapshot | null =>
  snapshots.reduce<EquipmentSnapshot | null>(
    (last, snapshot) => (!last || snapshot.atSeconds >= last.atSeconds ? snapshot : last),
    null,
  )

/**
 * The inventory a player ended a game with: the last one seen, if that was in the game's last minute. What a player
 * held in the middle of a game says nothing of its end, as the service reads it too.
 */
export function endInventory(
  snapshots: readonly EquipmentSnapshot[],
  duration: number | null | undefined,
): EquipmentSnapshot | null {
  const last = lastSnapshot(snapshots)
  return last && duration && last.atSeconds >= duration - END_SECONDS ? last : null
}

/** The inventory a list is read from while nobody wrote one. */
const endSnapshot = (participant: Participant, duration: number | null | undefined) =>
  endInventory(participant.equipmentSnapshots, duration)

function readSnapshot(snapshot: EquipmentSnapshot, index: ItemIndex): Build {
  const steps: BuildStep[] = []
  const named = new Set<string>()
  let leftOut = 0
  for (const slot of [...snapshot.slots].sort((a, b) => a.slot - b.slot)) {
    if (!slot.known || !present(slot.item)) continue
    const key = itemKey(slot.item, index)
    if (named.has(key) || tooLow(slot.item, index)) {
      leftOut++
      continue
    }
    named.add(key)
    steps.push(stepOf(slot.item, "CORE", null))
  }
  return { steps, snapshot: steps.length ? snapshot : null, leftOut }
}

/** The items of a player of a game of that length. */
export function buildOf(
  participant: Participant,
  duration: number | null | undefined,
  index: ItemIndex = NO_ITEMS,
): Build {
  if (participant.build?.length) return { steps: current(participant.build, index), snapshot: null, leftOut: 0 }
  const snapshot = endSnapshot(participant, duration)
  return snapshot ? readSnapshot(snapshot, index) : { steps: [], snapshot: null, leftOut: 0 }
}

/** Why an edit is refused, or what is wrong with a list written elsewhere. */
export type BuildRefusal =
  "STEPS" | "HELD" | "TWICE" | "TIER" | "PARTS" | "SAME" | "LOWER" | "TIME" | "ORDER" | "REPLACED" | "GONE" | "LAST"
export const BUILD_REFUSALS: Record<BuildRefusal, string> = {
  STEPS: `Danh sách đã đủ ${MAX_STEPS} món.`,
  HELD: "Đủ sáu ô cuối ván. Chọn món đã bán để lấy món này.",
  TWICE: "Mỗi món chỉ ghi một lần.",
  TIER: "Chỉ ghi trang bị cấp 2 và cấp 3.",
  PARTS: `Một món lên từ nhiều nhất ${MAX_PARTS} món.`,
  SAME: "Một món không lên từ hay thay chính nó.",
  LOWER: "Món ghép phải cấp thấp hơn, trừ khi công thức có món đó.",
  TIME: "Thời điểm phải nằm trong ván.",
  ORDER: "Các món có giờ phải theo thứ tự lên.",
  REPLACED: `Một món thay nhiều nhất ${MAX_REPLACED} món.`,
  GONE: "Món bị thay phải lên trước và còn giữ đến lúc đó.",
  LAST: "Danh sách trống sẽ lại đọc từ mốc. Thêm món khác trước khi bỏ món này.",
}

/** The list after an edit, or why it stays as it was. */
export type BuildEdit = BuildStep[] | BuildRefusal
export const refused = (result: BuildEdit | Participant): result is BuildRefusal => typeof result === "string"

const positionOf = (steps: BuildStep[], key: string, index: ItemIndex) =>
  steps.findIndex((step) => itemKey(step.item, index) === key)

const withStep = (steps: BuildStep[], at: number, change: Partial<BuildStep>) =>
  steps.map((step, position) => (position === at ? { ...step, ...change } : step))

/** Where an item bought at that second goes: before the first one built later; without a time it is the latest one. */
function positionFor(steps: BuildStep[], atSeconds: number | null) {
  const later = atSeconds == null ? -1 : steps.findIndex((entry) => (entry.atSeconds ?? -1) > atSeconds)
  return later < 0 ? steps.length : later
}

const insert = (steps: BuildStep[], at: number, step: BuildStep) => [...steps.slice(0, at), step, ...steps.slice(at)]

/** Whether the items a list replaces are each bought before and held then, the same check the service makes. */
const replacesHold = (steps: BuildStep[], index: ItemIndex) =>
  !buildProblems(steps, null, index).some(({ reason }) => reason === "GONE")

/** The second an item would be bought at goes into the list only in the order of the others. */
function keepsOrder(steps: BuildStep[], at: number, second: number | null) {
  if (second == null) return true
  return steps.every(({ atSeconds }, position) =>
    atSeconds == null || position === at ? true : position < at ? atSeconds <= second : atSeconds >= second,
  )
}

/** Which held items an item bought at that second would grow from: those of its recipe the player had then. */
export function heldParts(steps: BuildStep[], item: Selection, atSeconds: number | null, index: ItemIndex) {
  const recipe = index.find(item)?.components ?? []
  if (!recipe.length) return []
  return heldBefore(steps, positionFor(steps, atSeconds), index)
    .filter((step) => recipe.includes(itemKey(step.item, index)))
    .slice(0, MAX_PARTS)
    .map((step) => step.item)
}

/** The items an item bought at that second could be sold for: those held then. */
export const sellable = (steps: BuildStep[], atSeconds: number | null, index: ItemIndex) =>
  heldBefore(steps, positionFor(steps, atSeconds), index)

/**
 * Adds an item at its time, grown from the parts of its recipe the player held then. With six held already it is
 * refused unless it replaces one of them.
 */
export function addItem(
  steps: BuildStep[],
  item: Selection,
  role: BuildRole,
  index: ItemIndex,
  atSeconds: number | null = null,
  replaces: Selection[] = [],
): BuildEdit {
  const key = itemKey(item, index)
  if (positionOf(steps, key, index) >= 0) return "TWICE"
  if (tooLow(item, index)) return "TIER"
  if (steps.length >= MAX_STEPS) return "STEPS"
  if (replaces.length > MAX_REPLACED) return "REPLACED"
  const chosen = item.id ? item : (index.find(item) ?? item)
  const from = heldParts(steps, chosen, atSeconds, index)
  const gone = replaces.filter((entry) => !from.some((part) => itemKey(part, index) === itemKey(entry, index)))
  const next = insert(steps, positionFor(steps, atSeconds), stepOf(chosen, role, atSeconds, from, gone))
  if (!replacesHold(next, index)) return "GONE"
  return heldCount(next, index) > MAX_HELD ? "HELD" : next
}

/** Takes an item out, and out of what later items say they replaced; of one listed twice, the later. */
export function removeItem(steps: BuildStep[], key: string, index: ItemIndex): BuildStep[] {
  const at = steps.map((step) => itemKey(step.item, index)).lastIndexOf(key)
  return steps.flatMap((step, position) => {
    if (position === at) return []
    if (!names(step.replaces, key, index)) return [step]
    const replaces = step.replaces!.filter((entry) => itemKey(entry, index) !== key)
    return [replaces.length ? { ...step, replaces } : without(step, "replaces")]
  })
}

/** Puts an item one step earlier or later in the order it was bought. */
export function shiftItem(steps: BuildStep[], key: string, by: -1 | 1, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  const step = steps[at]
  const to = at + by
  if (!step || !steps[to]) return steps
  const next = insert(
    steps.filter((_, position) => position !== at),
    to,
    step,
  )
  if (!keepsOrder(next, to, step.atSeconds ?? null)) return "ORDER"
  return replacesHold(next, index) || !replacesHold(steps, index) ? next : "GONE"
}

/** What an item was bought for. */
export function setRole(steps: BuildStep[], key: string, role: BuildRole, index: ItemIndex): BuildStep[] {
  const at = positionOf(steps, key, index)
  return at < 0 || steps[at]!.role === role ? steps : withStep(steps, at, { role })
}

/** Marks an item sold for something nobody recorded, or held again. */
export function setSold(steps: BuildStep[], key: string, sold: boolean, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0 || !!steps[at]!.sold === sold) return steps
  if (!sold && heldCount(steps, index) >= MAX_HELD) return "HELD"
  return steps.map((step, position) => (position === at ? (sold ? { ...step, sold } : without(step, "sold")) : step))
}

/**
 * Says an item was bought from another one's sale, or takes that back: one bought before it and held until then. An
 * item taken back is held to the end again, so six held refuse it.
 */
export function toggleReplaced(steps: BuildStep[], key: string, gone: Selection, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0) return steps
  const goneKey = itemKey(gone, index)
  const replaces = steps[at]!.replaces ?? []
  const left = replaces.filter((entry) => itemKey(entry, index) !== goneKey)
  if (left.length < replaces.length) {
    const next = steps.map((step, position) =>
      position === at ? (left.length ? { ...step, replaces: left } : without(step, "replaces")) : step,
    )
    return heldCount(next, index) > MAX_HELD ? "HELD" : next
  }
  if (goneKey === key) return "SAME"
  if (replaces.length >= MAX_REPLACED) return "REPLACED"
  if (!heldBefore(steps, at, index).some((step) => itemKey(step.item, index) === goneKey)) return "GONE"
  return withStep(steps, at, { replaces: [...replaces, selectionOf(gone)] })
}

/**
 * Records that an item went into a later one. One that is listed after it takes it as a part; otherwise the later item
 * is added, at the second given or else as the latest, with the role of the one it grew from.
 */
export function upgradeItem(
  steps: BuildStep[],
  key: string,
  target: Selection,
  index: ItemIndex,
  atSeconds: number | null = null,
): BuildEdit {
  const at = positionOf(steps, key, index)
  const step = steps[at]
  const targetKey = itemKey(target, index)
  if (!step || targetKey === key) return steps
  if (tooLow(target, index)) return "TIER"
  if (!growsFrom(target, step.item, index)) return "LOWER"
  const listed = positionOf(steps, targetKey, index)
  if (listed >= 0) {
    if (listed < at) return "ORDER"
    if (names(steps[listed]!.from, key, index)) return steps
    const from = steps[listed]!.from ?? []
    if (from.length >= MAX_PARTS) return "PARTS"
    return withStep(steps, listed, { from: [...from, selectionOf(step.item)] })
  }
  if (steps.length >= MAX_STEPS) return "STEPS"
  if (atSeconds != null && step.atSeconds != null && atSeconds < step.atSeconds) return "ORDER"
  const chosen = target.id ? target : (index.find(target) ?? target)
  const place = Math.max(at + 1, positionFor(steps, atSeconds))
  const next = insert(steps, place, stepOf(chosen, step.role ?? "CORE", atSeconds, [step.item]))
  return keepsOrder(next, place, atSeconds) ? next : "ORDER"
}

/** Adds a part to an item, or takes it off. */
export function togglePart(steps: BuildStep[], key: string, part: Selection, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0) return steps
  const partKey = itemKey(part, index)
  const from = steps[at]!.from ?? []
  const left = from.filter((entry) => itemKey(entry, index) !== partKey)
  if (left.length < from.length) {
    const next = withStep(steps, at, { from: left })
    return heldCount(next, index) > MAX_HELD ? "HELD" : next
  }
  if (partKey === key) return "SAME"
  if (tooLow(part, index)) return "TIER"
  if (!growsFrom(steps[at]!.item, part, index)) return "LOWER"
  if (from.length >= MAX_PARTS) return "PARTS"
  return withStep(steps, at, { from: [...from, selectionOf(part)] })
}

const outside = (second: number, duration?: number | null) => second < 0 || second > (duration ?? MAX_GAME_SECOND)

/** Writes the game second the player had an item, which may move it among the others, or takes it off. */
export function setTime(
  steps: BuildStep[],
  key: string,
  second: number | null,
  duration: number | null | undefined,
  index: ItemIndex,
): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0) return steps
  if (second != null && outside(second, duration)) return "TIME"
  if (keepsOrder(steps, at, second)) return withStep(steps, at, { atSeconds: second })
  const rest = steps.filter((_, position) => position !== at)
  const next = insert(rest, positionFor(rest, second), { ...steps[at]!, atSeconds: second })
  return replacesHold(next, index) || !replacesHold(steps, index) ? next : "GONE"
}

/**
 * Applies an edit to the list a player has now. The first one writes a list of its own out of what the snapshot at the
 * end shows. An edit the list refuses changes nothing, and neither does one that would leave it empty over such a
 * snapshot: an empty list is read from it again.
 */
export function editBuild(
  participant: Participant,
  duration: number | null | undefined,
  edit: (steps: BuildStep[]) => BuildEdit,
  index: ItemIndex,
): Participant | BuildRefusal {
  const { steps } = buildOf(participant, duration, index)
  const next = edit(steps)
  if (refused(next)) return next
  if (next === steps) return participant
  const snapshot = endSnapshot(participant, duration)
  if (!next.length && snapshot && readSnapshot(snapshot, index).steps.length) return "LAST"
  return { ...participant, build: next }
}

/** What the service would refuse in a list written elsewhere, or no longer true since the game was cut shorter. */
export function buildProblems(steps: BuildStep[], duration: number | null | undefined, index: ItemIndex) {
  const problems: { step: BuildStep; reason: BuildRefusal }[] = []
  const named = new Set<string>()
  const held = new Set<string>()
  let previous: number | null = null
  steps.forEach((step, position) => {
    // One step has each reason once: an item listed twice that also names a part twice is said to repeat once.
    const reasons = new Set<BuildRefusal>()
    const key = itemKey(step.item, index)
    const from = step.from ?? []
    const parts = from.map((part) => itemKey(part, index))
    const gone = (step.replaces ?? []).map((entry) => itemKey(entry, index))
    if (position >= MAX_STEPS) reasons.add("STEPS")
    if (named.has(key) || new Set(parts).size < parts.length || new Set(gone).size < gone.length) reasons.add("TWICE")
    if ([step.item, ...from].some((item) => tooLow(item, index))) reasons.add("TIER")
    if (parts.length > MAX_PARTS) reasons.add("PARTS")
    if (parts.includes(key) || gone.includes(key)) reasons.add("SAME")
    if (from.some((part, at) => parts[at] !== key && !growsFrom(step.item, part, index))) reasons.add("LOWER")
    if (gone.length > MAX_REPLACED) reasons.add("REPLACED")
    for (const entry of new Set(gone)) {
      if (entry !== key && !held.delete(entry)) reasons.add("GONE")
    }
    if (step.atSeconds != null) {
      if (outside(step.atSeconds, duration)) reasons.add("TIME")
      if (previous != null && step.atSeconds < previous) reasons.add("ORDER")
      previous = step.atSeconds
    }
    for (const part of parts) held.delete(part)
    named.add(key)
    held.add(key)
    for (const reason of reasons) problems.push({ step, reason })
  })
  // The items held to the end past the sixth: the last ones bought are those that do not fit.
  const fate = fates(steps, index)
  steps
    .filter((_, at) => fate[at] === "HELD")
    .slice(MAX_HELD)
    .forEach((step) => problems.push({ step, reason: "HELD" }))
  return problems
}

const byName = (a: Reference, b: Reference) => a.name.localeCompare(b.name, "vi")
const byTier = (a: Reference, b: Reference) => (b.tier ?? 0) - (a.tier ?? 0) || byName(a, b)

/** The items of tier 2 and up an item is made of, as the Wiki's recipe says. */
export const recipeParts = (item: Selection, index: ItemIndex): Reference[] =>
  (index.find(item)?.components ?? []).flatMap((id) => {
    const part = index.find({ id })
    return part && (part.tier ?? 0) >= MIN_TIER ? [part] : []
  })

/** The items an item goes into, the finished ones first. */
export function upgradesOf(item: Selection, index: ItemIndex): Reference[] {
  const id = index.find(item)?.id
  if (!id) return []
  return index.items.filter((entry) => (entry.tier ?? 0) >= MIN_TIER && entry.components?.includes(id)).sort(byTier)
}

/** An item a source showed on the player, with the second it was first seen unless that is only the end of the game. */
export type SeenItem = { item: Reference; atSeconds: number | null }

/** Items the snapshots and the recorded purchases name that the list does not, the earliest first. */
export function seenItems(
  participant: Participant,
  duration: number | null | undefined,
  steps: BuildStep[],
  index: ItemIndex,
): SeenItem[] {
  const end = endSnapshot(participant, duration)
  const seen = new Map<string, SeenItem>()
  const named = new Set(steps.flatMap((step) => [step.item, ...(step.from ?? [])].map((item) => itemKey(item, index))))
  const sightings = [
    ...participant.equipmentSnapshots.flatMap((snapshot) =>
      snapshot.slots.map((slot) => ({
        item: slot.known ? slot.item : null,
        at: snapshot.atSeconds,
        timed: snapshot !== end,
      })),
    ),
    ...participant.equipmentEvents.map((event) => ({
      item: event.type === "BUY" || event.type === "UPGRADE" ? event.item : null,
      at: event.atSeconds,
      timed: true,
    })),
  ].sort((a, b) => a.at - b.at)
  for (const sighting of sightings) {
    const item = index.find(sighting.item)
    if (!item || (item.tier ?? 0) < MIN_TIER || named.has(item.id) || seen.has(item.id)) continue
    seen.set(item.id, { item, atSeconds: sighting.timed ? sighting.at : null })
  }
  return [...seen.values()]
}

/** Whether the name of an item begins with what was typed, which is what a typed name means first of all. */
export const beginsWith = (item: Reference, query: string) => {
  const typed = normalize(query)
  return !!typed && normalize(item.name).startsWith(typed)
}

/** The items of one tier a search finds. */
export type ItemGroup = { tier: number | null; items: Reference[] }

/** Whether a list may name an item, or an item another as what it grew from. */
const listable = (item: Reference, partsOf: Selection | null, index: ItemIndex) =>
  !tooLow(item, index) &&
  (!partsOf || (itemKey(item, index) !== itemKey(partsOf, index) && growsFrom(partsOf, item, index)))

/**
 * The catalogue as a picker lists it: the finished items first. Where the parts of an item are looked for, only what it
 * can have grown from is listed, the lowest first. Each group goes by name, after those whose name begins with the
 * search.
 */
export function itemGroups(index: ItemIndex, query: string, partsOf: Selection | null = null): ItemGroup[] {
  const found = index.items.filter(
    (item) => listable(item, partsOf, index) && matchesQuery(query, item.name, item.code),
  )
  const order = partsOf ? -1 : 1
  return [...new Set(found.map((item) => item.tier ?? null))]
    .sort((a, b) => Number(a == null) - Number(b == null) || ((b ?? 0) - (a ?? 0)) * order)
    .map((tier) => ({
      tier,
      items: found
        .filter((item) => (item.tier ?? null) === tier)
        .sort((a, b) => Number(beginsWith(b, query)) - Number(beginsWith(a, query)) || byName(a, b)),
    }))
}

/**
 * Why a search lists nothing: the catalogue knows what was typed, only not as something to list here. Among the parts of
 * an item, the item itself is the one meant where all else found is of the lowest tier.
 */
export function unlisted(index: ItemIndex, query: string, partsOf: Selection | null = null): BuildRefusal | null {
  const known = index.items.filter((item) => matchesQuery(query, item.name, item.code))
  if (!known.length || known.some((item) => listable(item, partsOf, index))) return null
  const others = known.filter((item) => !partsOf || itemKey(item, index) !== itemKey(partsOf, index))
  if (others.length < known.length && others.every((item) => tooLow(item, index))) return "SAME"
  return known.every((item) => tooLow(item, index)) ? "TIER" : "LOWER"
}
