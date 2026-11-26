import type {
  BuildPlace,
  BuildStep,
  Catalog,
  EnchantmentAllocation,
  EquipmentSnapshot,
  GameSide,
  Participant,
  PublishedGame,
  Selection,
} from "@aov/community-contracts"
import { findReference, hasLoadout, present, snapshotAt } from "./tournament-model.ts"

/** The slots of an inventory. */
const SLOTS = 6

/** An item with the game second it was held, where that is known. */
export type BuiltPart = { item: Selection; atSeconds: number | null }
/** An item a player had, with the items of a lower tier it grew from. */
export type BuiltItem = BuiltPart & { from: BuiltPart[] }

/** What a player had, the way a reader asks for it: held to the end, given up, and bought for a moment. */
export type BuildView = {
  /** Read from the items somebody wrote down, or from an inventory the source showed. */
  source: "STEPS" | "INVENTORY"
  /** In the order somebody listed them, or the order they lay in the inventory. */
  kept: BuiltItem[]
  replaced: BuiltItem[]
  situational: BuiltItem[]
  /** Slots of the inventory nobody could read. */
  unread: number
  /** The game second the inventory was shown; null for items written down. */
  atSeconds: number | null
  note: string | null
}

/** One entry of the wiki, or one name while the record has no more than that. */
const identity = ({ id, name }: Selection) => id || `name:${name?.trim().toLocaleLowerCase("vi-VN")}`

/**
 * The items written down, each told once: one that was given up and went into another item is told by that item, with
 * the time it was first held. A second purchase is no step of its own, so when it was held again is not known.
 */
function fromSteps(steps: BuildStep[]): BuildView {
  const givenUp = new Map(
    steps.filter((step) => step.place === "REPLACED").map((step) => [identity(step.item), step.atSeconds ?? null]),
  )
  const used = new Set<string>()
  const partOf = (item: Selection): BuiltPart => {
    const key = identity(item)
    const atSeconds = used.has(key) ? null : (givenUp.get(key) ?? null)
    used.add(key)
    return { item, atSeconds }
  }
  const built = steps.map(({ place, item, atSeconds = null, from = [] }) => ({
    place,
    item,
    atSeconds,
    from: from.filter(present).map(partOf),
  }))
  const placed = (place: BuildPlace) =>
    built
      .filter((one) => one.place === place && !(place === "REPLACED" && used.has(identity(one.item))))
      .map(({ item, atSeconds, from }): BuiltItem => ({ item, atSeconds, from }))
  return {
    source: "STEPS",
    kept: placed("KEPT"),
    replaced: placed("REPLACED"),
    situational: placed("SITUATIONAL"),
    unread: 0,
    atSeconds: null,
    note: null,
  }
}

/** An inventory as the source showed it; `whole` keeps the items of the lowest tier beside those of higher ones. */
function fromInventory(snapshot: EquipmentSnapshot, catalog: Catalog, whole: boolean): BuildView | null {
  const read = snapshot.slots.filter((slot) => slot.known).sort((a, b) => a.slot - b.slot)
  if (!read.length) return null
  const held = read.flatMap(({ item }) => (present(item) ? [item] : []))
  const lowest = (item: Selection) => findReference(catalog, "items", item)?.tier === 1
  const shown = whole || held.every(lowest) ? held : held.filter((item) => !lowest(item))
  return {
    source: "INVENTORY",
    kept: shown.map((item) => ({ item, atSeconds: null, from: [] })),
    replaced: [],
    situational: [],
    unread: Math.max(0, SLOTS - read.length),
    atSeconds: snapshot.atSeconds,
    note: snapshot.note?.trim() || null,
  }
}

/**
 * What a player built. While nobody wrote it down the last inventory shown stands in for it, without the items of the
 * lowest tier unless it held nothing else. Null where neither is recorded.
 */
export function buildOf(participant: Participant, catalog: Catalog): BuildView | null {
  const steps = (participant.build ?? []).filter((step) => present(step.item))
  if (steps.length) return fromSteps(steps)
  const last = snapshotAt(participant.equipmentSnapshots, Number.POSITIVE_INFINITY)
  return last ? fromInventory(last, catalog, false) : null
}

/** What a player held at a second of the game: the inventory shown last by then, whole. */
export function inventoryAt(participant: Participant, catalog: Catalog, seconds: number): BuildView | null {
  const seen = snapshotAt(participant.equipmentSnapshots, seconds)
  return seen ? fromInventory(seen, catalog, true) : null
}

/** Whether the times of items say that they are listed in the order they were built. */
export function inBuiltOrder(items: BuiltItem[]): boolean {
  const times = items.flatMap(({ atSeconds }) => atSeconds ?? [])
  return times.length > 1 && times.every((second, at) => at === 0 || second >= times[at - 1]!)
}

/** What a lineup shows of a player: what was built over the whole game, or the inventory at a second of it. */
export const shownBuild = (participant: Participant, catalog: Catalog, at: number | null) =>
  at == null ? buildOf(participant, catalog) : inventoryAt(participant, catalog, at)

/** The seconds of a game at which the source showed an inventory, each once, in order. */
export function inventoryTimes(sides: GameSide[]): number[] {
  const times = sides.flatMap((side) =>
    side.participants.flatMap((participant) => participant.equipmentSnapshots.map((snapshot) => snapshot.atSeconds)),
  )
  return [...new Set(times)].sort((a, b) => a - b)
}

export type EnchantmentBranch = { primary: boolean; entries: EnchantmentAllocation[] }

/** The recorded enchantments of a player by branch, the primary branch first and the highest tier of each first. */
export function enchantmentBranches(participant: Participant): EnchantmentBranch[] {
  const entries = hasLoadout(participant, "enchantments")
    ? participant.enchantments.entries.filter((entry) => present(entry.selection))
    : []
  return [true, false].flatMap((primary) => {
    const own = entries.filter((entry) => entry.primary === primary).sort((a, b) => b.tier - a.tier)
    return own.length ? [{ primary, entries: own }] : []
  })
}

/** The enchantment a player's loadout is named by: the highest tier of the primary branch. */
export const mainEnchantment = (participant: Participant): EnchantmentAllocation | null =>
  enchantmentBranches(participant).find((branch) => branch.primary)?.entries[0] ?? null

/** Whether anything but the hero is recorded of a player. */
export const isRecorded = (participant: Participant, catalog: Catalog) =>
  present(participant.spell) ||
  enchantmentBranches(participant).length > 0 ||
  hasLoadout(participant, "arcana") ||
  buildOf(participant, catalog) != null

/** How much of a game is recorded, counted in seats. */
export type LineupRecord = {
  seats: number
  players: number
  spells: number
  enchantments: number
  arcana: number
  items: number
  /** Seats whose items were written down rather than read from an inventory. */
  built: number
  /** No enchantment beside the main one of each player is known. */
  mainOnly: boolean
  /** Every inventory read is the one the player ended the game with. */
  atEnd: boolean
  /** Some slot of an inventory read is not known. */
  unread: boolean
}

/** `at` is the second of the game whose inventories are counted instead of what was built. */
export function lineupRecord(
  { content, catalog, players }: Pick<PublishedGame, "content" | "catalog" | "players">,
  at: number | null = null,
): LineupRecord {
  const seats = content.sides.flatMap((side) => side.participants)
  const builds = seats.flatMap((seat) => shownBuild(seat, catalog, at) ?? [])
  const inventories = builds.filter((build) => build.source === "INVENTORY")
  const branches = seats.map(enchantmentBranches).filter((own) => own.length > 0)
  return {
    seats: seats.length,
    players: seats.filter((seat) => seat.playerId && players[seat.playerId]?.nickname).length,
    spells: seats.filter((seat) => present(seat.spell)).length,
    enchantments: branches.length,
    arcana: seats.filter((seat) => hasLoadout(seat, "arcana")).length,
    items: builds.length,
    built: builds.length - inventories.length,
    mainOnly: branches.every((own) => own.length === 1 && own[0]!.primary && own[0]!.entries.length === 1),
    atEnd: inventories.every((build) => build.atSeconds === content.durationSeconds),
    unread: inventories.some((build) => build.unread > 0),
  }
}

/**
 * The places for bans of each side: as many as the side that banned more, so a ban nobody saw keeps its place. None
 * while no ban of the game is known.
 */
export const banPlaces = (sides: GameSide[]) =>
  sides.some((side) => side.bans.some(present)) ? Math.max(...sides.map((side) => side.bans.length)) : 0
