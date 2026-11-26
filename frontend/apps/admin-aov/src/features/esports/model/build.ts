import type {
  BuildPlace,
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
export const MAX_KEPT = 6
export const MAX_PARTS = 3
/** Items of a lower tier are bought on the way to another and are no step of a build. */
export const MIN_TIER = 2
/** An inventory seen this close to the end of a game is the one the player ended it with. */
const END_SECONDS = 60
/** No game lasts a day; the bound of a time while the length of the game is unknown. */
const MAX_GAME_SECOND = 86_400

/** What becomes of an item, in the order the editor shows the three places. */
export const BUILD_PLACES: { code: BuildPlace; label: string; short: string; hint: string }[] = [
  {
    code: "KEPT",
    label: "Giữ đến cuối ván",
    short: "Cuối ván",
    hint: "Các món còn trong sáu ô khi ván kết thúc, theo thứ tự lên",
  },
  {
    code: "REPLACED",
    label: "Đã đổi",
    short: "Đã đổi",
    hint: "Các món đã lên rồi bán đi hoặc thay bằng món khác trước khi ván kết thúc",
  },
  {
    code: "SITUATIONAL",
    label: "Tình huống",
    short: "Tình huống",
    hint: "Các món mua để sống sót qua một lúc, như món hồi sinh, không thuộc bộ chính",
  },
]
export const buildPlace = (code: BuildPlace) => BUILD_PLACES.find((place) => place.code === code)!

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
    steps.push({ item: selectionOf(slot.item), from: [], place: "KEPT", atSeconds: null })
  }
  return { steps, snapshot: steps.length ? snapshot : null, leftOut }
}

/** The items of a player of a game of that length. */
export function buildOf(
  participant: Participant,
  duration: number | null | undefined,
  index: ItemIndex = NO_ITEMS,
): Build {
  if (participant.build?.length) return { steps: participant.build, snapshot: null, leftOut: 0 }
  const snapshot = endSnapshot(participant, duration)
  return snapshot ? readSnapshot(snapshot, index) : { steps: [], snapshot: null, leftOut: 0 }
}

export const stepsAt = (steps: BuildStep[], place: BuildPlace) => steps.filter((step) => step.place === place)

/** Why an edit is refused, or what is wrong with a list written elsewhere. */
export type BuildRefusal = "STEPS" | "KEPT" | "TWICE" | "TIER" | "PARTS" | "SAME" | "LOWER" | "TIME" | "LAST"
export const BUILD_REFUSALS: Record<BuildRefusal, string> = {
  STEPS: `Danh sách đã đủ ${MAX_STEPS} món.`,
  KEPT: "Đã đủ sáu ô giữ đến cuối ván.",
  TWICE: "Mỗi món chỉ ghi một lần.",
  TIER: "Chỉ ghi trang bị cấp 2 và cấp 3.",
  PARTS: `Một món lên từ nhiều nhất ${MAX_PARTS} món.`,
  SAME: "Một món không lên từ chính nó.",
  LOWER: "Món ghép phải cấp thấp hơn, trừ khi công thức có món đó.",
  TIME: "Thời điểm phải nằm trong ván.",
  LAST: "Danh sách trống sẽ lại đọc từ mốc. Thêm món khác trước khi bỏ món này.",
}

/** The list after an edit, or why it stays as it was. */
export type BuildEdit = BuildStep[] | BuildRefusal
export const refused = (result: BuildEdit | Participant): result is BuildRefusal => typeof result === "string"

const positionOf = (steps: BuildStep[], key: string, index: ItemIndex) =>
  steps.findIndex((step) => itemKey(step.item, index) === key)

const withStep = (steps: BuildStep[], at: number, change: Partial<BuildStep>) =>
  steps.map((step, position) => (position === at ? { ...step, ...change } : step))

/** Moves an item to another place; the list keeps the order in which the items were built. */
export function moveItem(steps: BuildStep[], key: string, place: BuildPlace, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0 || steps[at]!.place === place) return steps
  if (place === "KEPT" && stepsAt(steps, "KEPT").length >= MAX_KEPT) return "KEPT"
  return withStep(steps, at, { place })
}

/** Puts an item where its time belongs, before the first one built later; without a time it is the latest one. */
function placed(steps: BuildStep[], step: BuildStep): BuildStep[] {
  const { atSeconds } = step
  const later = atSeconds == null ? -1 : steps.findIndex((entry) => (entry.atSeconds ?? -1) > atSeconds)
  return later < 0 ? [...steps, step] : [...steps.slice(0, later), step, ...steps.slice(later)]
}

/** Adds an item, in the order of the known times; one that is listed already moves instead of being listed twice. */
export function addItem(
  steps: BuildStep[],
  item: Selection,
  place: BuildPlace,
  index: ItemIndex,
  atSeconds: number | null = null,
): BuildEdit {
  const key = itemKey(item, index)
  if (positionOf(steps, key, index) >= 0) return moveItem(steps, key, place, index)
  if (tooLow(item, index)) return "TIER"
  if (steps.length >= MAX_STEPS) return "STEPS"
  if (place === "KEPT" && stepsAt(steps, "KEPT").length >= MAX_KEPT) return "KEPT"
  return placed(steps, {
    item: selectionOf(item.id ? item : (index.find(item) ?? item)),
    from: [],
    place,
    atSeconds,
  })
}

/** Takes an item out; of one a list written elsewhere names twice, the later. */
export function removeItem(steps: BuildStep[], key: string, index: ItemIndex): BuildStep[] {
  const at = steps.map((step) => itemKey(step.item, index)).lastIndexOf(key)
  return steps.filter((_, position) => position !== at)
}

/** Puts an item one step earlier or later among those of its place. */
export function shiftItem(steps: BuildStep[], key: string, by: -1 | 1, index: ItemIndex): BuildStep[] {
  const at = positionOf(steps, key, index)
  const step = steps[at]
  if (!step) return steps
  let to = at + by
  while (steps[to] && steps[to]!.place !== step.place) to += by
  if (!steps[to]) return steps
  const rest = steps.filter((_, position) => position !== at)
  return [...rest.slice(0, to), step, ...rest.slice(to)]
}

/**
 * Replaces an item by the one it went into, which keeps it as a part. An item that was listed on its own takes the
 * part over instead. The time goes: it said when the lower item was held.
 */
export function upgradeItem(steps: BuildStep[], key: string, target: Selection, index: ItemIndex): BuildEdit {
  const step = steps[positionOf(steps, key, index)]
  const targetKey = itemKey(target, index)
  if (!step || targetKey === key) return steps
  if (tooLow(target, index)) return "TIER"
  const listed = steps.find((entry) => itemKey(entry.item, index) === targetKey)
  const parts = new Map(
    [...(listed?.from ?? []), ...(step.from ?? []), step.item]
      .map((part) => [itemKey(part, index), part] as const)
      .filter(([partKey]) => partKey !== targetKey),
  )
  if (parts.size > MAX_PARTS) return "PARTS"
  const from = [...parts.values()].map(selectionOf)
  if (from.some((part) => !growsFrom(target, part, index))) return "LOWER"
  if (listed)
    return steps.flatMap((entry) => (entry === step ? [] : entry === listed ? [{ ...listed, from }] : [entry]))
  return steps.map((entry) =>
    entry === step ? { item: selectionOf(target), from, place: step.place, atSeconds: null } : entry,
  )
}

/** Adds a part to an item, or takes it off. */
export function togglePart(steps: BuildStep[], key: string, part: Selection, index: ItemIndex): BuildEdit {
  const at = positionOf(steps, key, index)
  if (at < 0) return steps
  const partKey = itemKey(part, index)
  const from = steps[at]!.from ?? []
  const left = from.filter((entry) => itemKey(entry, index) !== partKey)
  if (left.length < from.length) return withStep(steps, at, { from: left })
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
  const inOrder = steps.every(({ atSeconds }, position) =>
    second == null || atSeconds == null || position === at
      ? true
      : position < at
        ? atSeconds <= second
        : atSeconds >= second,
  )
  if (inOrder) return withStep(steps, at, { atSeconds: second })
  const rest = steps.filter((_, position) => position !== at)
  return placed(rest, { ...steps[at]!, atSeconds: second })
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
  let kept = 0
  steps.forEach((step, position) => {
    // One step has each reason once: an item listed twice that also names a part twice is said to repeat once.
    const reasons = new Set<BuildRefusal>()
    const key = itemKey(step.item, index)
    const from = step.from ?? []
    const parts = from.map((part) => itemKey(part, index))
    if (position >= MAX_STEPS) reasons.add("STEPS")
    if (named.has(key) || new Set(parts).size < parts.length) reasons.add("TWICE")
    named.add(key)
    if (step.place === "KEPT" && ++kept > MAX_KEPT) reasons.add("KEPT")
    if ([step.item, ...from].some((item) => tooLow(item, index))) reasons.add("TIER")
    if (parts.length > MAX_PARTS) reasons.add("PARTS")
    if (parts.includes(key)) reasons.add("SAME")
    if (from.some((part, at) => parts[at] !== key && !growsFrom(step.item, part, index))) reasons.add("LOWER")
    if (step.atSeconds != null && outside(step.atSeconds, duration)) reasons.add("TIME")
    for (const reason of reasons) problems.push({ step, reason })
  })
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
