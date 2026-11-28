import type {
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

/** What became of an item: held when the game ended, gone into a later item, or sold. */
export type Fate = "HELD" | "UPGRADED" | "SOLD"
/** An item with the game second it was bought, where that is known. */
export type BuiltPart = { item: Selection; atSeconds: number | null }
/** An item a player had, the earlier ones it grew from, and whether it was bought for protection. */
export type BuiltItem = BuiltPart & { from: BuiltPart[]; protective: boolean }
/** An item of the path with what became of it, and the earlier items sold for it. */
export type PathStep = BuiltItem & {
  fate: Fate
  /** The later item it went into or was sold for, with its place in the path; null when nothing recorded follows it. */
  next: (BuiltPart & { at: number }) | null
  replaces: BuiltPart[]
}

/** What a player had, the way a reader asks for it: what they ended with, and the path that led there. */
export type BuildView = {
  /** Read from the items somebody wrote down, or from an inventory the source showed. */
  source: "STEPS" | "INVENTORY"
  /** The slots held at the end, the build itself before what was bought for protection; an inventory in its order. */
  end: BuiltItem[]
  /** The items written down, in the order they were bought; none for an inventory. */
  path: PathStep[]
  /** Slots of the inventory nobody could read. */
  unread: number
  /** The game second the inventory was shown; null for items written down. */
  atSeconds: number | null
  note: string | null
}

/** One entry of the wiki, or one name while the record has no more than that. */
const identity = ({ id, name }: Selection) => id || `name:${name?.trim().toLocaleLowerCase("vi-VN").normalize("NFKC")}`

const names = (selections: Selection[] | undefined, key: string) =>
  (selections ?? []).some((selection) => present(selection) && identity(selection) === key)

/**
 * The items written down, with what became of each as the service reads it: an item a later step grew from went into
 * it, one a later step replaces was sold for it, and the rest were held to the end unless marked sold.
 */
function fromSteps(steps: BuildStep[]): BuildView {
  const keys = steps.map((step) => identity(step.item))
  const next = keys.map((key, at) =>
    steps.findIndex((later, after) => after > at && (names(later.from, key) || names(later.replaces, key))),
  )
  const fate = (at: number): Fate => {
    if (next[at]! >= 0) return names(steps[next[at]!]!.from, keys[at]!) ? "UPGRADED" : "SOLD"
    return steps[at]!.sold ? "SOLD" : "HELD"
  }
  // A part is the earlier step that went into this one; an item nobody wrote down as a step has no time.
  const partsOf = (at: number, selections: Selection[] = []) =>
    selections.filter(present).map((item): BuiltPart => {
      const earlier = next.findIndex((successor, before) => successor === at && keys[before] === identity(item))
      return { item, atSeconds: earlier >= 0 ? (steps[earlier]!.atSeconds ?? null) : null }
    })
  const path = steps.map((step, at): PathStep => {
    const later = steps[next[at]!]
    return {
      item: step.item,
      atSeconds: step.atSeconds ?? null,
      from: partsOf(at, step.from),
      protective: step.role === "PROTECTIVE",
      fate: fate(at),
      next: later ? { item: later.item, atSeconds: later.atSeconds ?? null, at: next[at]! } : null,
      replaces: partsOf(at, step.replaces),
    }
  })
  const held = path.filter((step) => step.fate === "HELD")
  return {
    source: "STEPS",
    end: [...held.filter((step) => !step.protective), ...held.filter((step) => step.protective)],
    path,
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
    end: shown.map((item) => ({ item, atSeconds: null, from: [], protective: false })),
    path: [],
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

/** Seconds between the marks on the time of a chart. */
const TICK = 300
/** The share of a chart at its end that holds the length of the game, so no other mark stands there. */
const END_ROOM = 0.12

/** One bar of a chart of the path, as shares of the game; `open` where the item was sold for nothing recorded. */
export type PathBar = { from: number; to: number; open: boolean }
export type PathChart = { bars: PathBar[]; ticks: number[] }

/**
 * The items of a path as bars over the minutes of a game, each from when it was bought until it went into another, was
 * sold or the game ended. Null where that cannot be drawn: the length of the game or the time of an item is not known.
 */
export function pathChart(path: PathStep[], duration: number | null | undefined): PathChart | null {
  if (!duration || path.length < 2) return null
  if (path.some(({ atSeconds }) => atSeconds == null || atSeconds > duration)) return null
  const share = (second: number) => Math.min(1, Math.max(0, second / duration))
  const bars = path.map((step) => {
    const from = share(step.atSeconds!)
    return {
      from,
      to: Math.max(from, share(step.next?.atSeconds ?? duration)),
      open: step.fate === "SOLD" && !step.next,
    }
  })
  const ticks = Array.from({ length: Math.floor((duration * (1 - END_ROOM)) / TICK) + 1 }, (_, at) => at * TICK)
  return { bars, ticks }
}

/** What a player held at a second of the game: the inventory shown last by then, whole. */
export function inventoryAt(participant: Participant, catalog: Catalog, seconds: number): BuildView | null {
  const seen = snapshotAt(participant.equipmentSnapshots, seconds)
  return seen ? fromInventory(seen, catalog, true) : null
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
