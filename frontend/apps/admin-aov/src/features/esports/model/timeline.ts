import type { EquipmentEvent, EquipmentSnapshot, Lane, Side } from "@aov/community-contracts"

/** Stable seat inside one game: side plus lane, e.g. `BLUE:MID`. */
export type SeatKey = `${Side}:${Lane}`
export const seatKey = (side: Side, lane: Lane): SeatKey => `${side}:${lane}`
export const seatSide = (key: SeatKey): Side => key.split(":")[0] as Side
export const otherSide = (side: Side): Side => (side === "BLUE" ? "RED" : "BLUE")

export type ItemRef = { id?: string | null; name: string }
export type ObjectiveKind = "DARK_SLAYER" | "ABYSSAL_DRAGON" | "TURRET" | "BASE" | "OTHER"
export type ItemAction = "BUY" | "SELL" | "UPGRADE" | "SWAP"

export const OBJECTIVE_LABELS: Record<ObjectiveKind, string> = {
  DARK_SLAYER: "Tà thần Caesar",
  ABYSSAL_DRAGON: "Rồng",
  TURRET: "Trụ",
  BASE: "Nhà chính",
  OTHER: "Mục tiêu khác",
}
/** Who gets credit: structures are destroyed, monsters are last-hit. */
export const objectiveActor = (objective: ObjectiveKind) =>
  objective === "TURRET" || objective === "BASE" ? "Người phá" : "Người kết liễu"

export const ITEM_ACTION_LABELS: Record<ItemAction, string> = {
  BUY: "Mua",
  SELL: "Bán",
  UPGRADE: "Ghép",
  SWAP: "Đổi ô",
}

type EventBase = { id: string; at: number; note?: string }
export type KillEvent = EventBase & { kind: "KILL"; killer?: SeatKey; victim?: SeatKey; assists: SeatKey[] }
export type ObjectiveEvent = EventBase & { kind: "OBJECTIVE"; side: Side; objective: ObjectiveKind; by?: SeatKey }
export type ItemEvent = EventBase & {
  kind: "ITEM"
  seat: SeatKey
  action: ItemAction
  slot: number
  toSlot?: number
  item?: ItemRef
}
export type NoteEvent = EventBase & { kind: "NOTE"; side?: Side; title: string }
export type TimelineEvent = KillEvent | ObjectiveEvent | ItemEvent | NoteEvent
export type TimelineKind = TimelineEvent["kind"]

export const KIND_LABELS: Record<TimelineKind, string> = {
  KILL: "Hạ gục",
  OBJECTIVE: "Mục tiêu",
  ITEM: "Trang bị",
  NOTE: "Khoảnh khắc",
}

export function eventSide(event: TimelineEvent): Side | null {
  switch (event.kind) {
    case "KILL":
      return event.killer ? seatSide(event.killer) : event.victim ? otherSide(seatSide(event.victim)) : null
    case "OBJECTIVE":
      return event.side
    case "ITEM":
      return seatSide(event.seat)
    case "NOTE":
      return event.side ?? null
  }
}

/** Seats that took part in an event, used for player filters and highlighting. */
export function eventSeats(event: TimelineEvent): SeatKey[] {
  switch (event.kind) {
    case "KILL":
      return [event.killer, event.victim, ...event.assists].filter((seat): seat is SeatKey => !!seat)
    case "OBJECTIVE":
      return event.by ? [event.by] : []
    case "ITEM":
      return [event.seat]
    case "NOTE":
      return []
  }
}

export const sortEvents = (events: TimelineEvent[]) =>
  [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))

export function killScoreAt(events: TimelineEvent[], at: number): Record<Side, number> {
  const score: Record<Side, number> = { BLUE: 0, RED: 0 }
  for (const event of events) {
    if (event.kind !== "KILL" || event.at > at) continue
    const side = eventSide(event)
    if (side) score[side]++
  }
  return score
}

export type SeatStats = { kills: number; deaths: number; assists: number }
export function seatStatsAt(events: TimelineEvent[], at: number): Map<SeatKey, SeatStats> {
  const stats = new Map<SeatKey, SeatStats>()
  const get = (seat: SeatKey) => {
    let entry = stats.get(seat)
    if (!entry) stats.set(seat, (entry = { kills: 0, deaths: 0, assists: 0 }))
    return entry
  }
  for (const event of events) {
    if (event.kind !== "KILL" || event.at > at) continue
    if (event.killer) get(event.killer).kills++
    if (event.victim) get(event.victim).deaths++
    for (const seat of event.assists) get(seat).assists++
  }
  return stats
}

export function objectivesAt(events: TimelineEvent[], at: number) {
  const counts: Record<Side, Partial<Record<ObjectiveKind, number>>> = { BLUE: {}, RED: {} }
  for (const event of events) {
    if (event.kind !== "OBJECTIVE" || event.at > at) continue
    counts[event.side][event.objective] = (counts[event.side][event.objective] ?? 0) + 1
  }
  return counts
}

/** Kill difference (blue minus red) as step points for the momentum line. */
export function killMomentum(events: TimelineEvent[], duration: number) {
  const points = [{ at: 0, diff: 0 }]
  let diff = 0
  for (const event of sortEvents(events)) {
    if (event.kind !== "KILL") continue
    const side = eventSide(event)
    if (!side) continue
    diff += side === "BLUE" ? 1 : -1
    points.push({ at: event.at, diff })
  }
  points.push({ at: duration, diff })
  return points
}

/**
 * Six inventory slots at a moment. `undefined` means the slot was never observed, `null` an observed
 * empty slot. Snapshots reset the state; later events are applied in order. Sales are only shown
 * when recorded, never inferred from two snapshots.
 */
export type SlotState = ItemRef | null | undefined
export function inventoryAt(
  seat: SeatKey,
  at: number,
  snapshots: EquipmentSnapshot[],
  events: TimelineEvent[],
): SlotState[] {
  const slots: SlotState[] = Array(6).fill(undefined)
  const base = [...snapshots]
    .filter((snapshot) => snapshot.atSeconds <= at)
    .sort((a, b) => b.atSeconds - a.atSeconds)[0]
  if (base)
    for (const slot of base.slots) {
      if (slot.slot < 1 || slot.slot > 6 || !slot.known) continue
      slots[slot.slot - 1] = slot.item?.name || slot.item?.id ? { id: slot.item.id, name: slot.item.name ?? "" } : null
    }
  const from = base?.atSeconds ?? -1
  for (const event of sortEvents(events)) {
    if (event.kind !== "ITEM" || event.seat !== seat || event.at <= from || event.at > at) continue
    const index = event.slot - 1
    if (index < 0 || index > 5) continue
    if (event.action === "SELL") slots[index] = null
    else if (event.action === "SWAP" && event.toSlot && event.toSlot >= 1 && event.toSlot <= 6)
      [slots[index], slots[event.toSlot - 1]] = [slots[event.toSlot - 1], slots[index]]
    else if (event.item) slots[index] = event.item
  }
  return slots
}

/** Converts a participant's stored equipment events into timeline item events. */
export function recordedItemEvents(seat: SeatKey, events: EquipmentEvent[]): ItemEvent[] {
  return events.flatMap((event, index) => {
    const slot = event.type === "SELL" ? (event.fromSlot ?? event.toSlot) : (event.toSlot ?? event.fromSlot)
    if (!slot) return []
    const item = event.item?.name || event.item?.id ? { id: event.item.id, name: event.item.name ?? "" } : undefined
    return [
      {
        id: `equipment:${seat}:${index}`,
        kind: "ITEM" as const,
        at: event.atSeconds,
        seat,
        action: event.type,
        slot: event.type === "SWAP" ? (event.fromSlot ?? slot) : slot,
        toSlot: event.type === "SWAP" ? event.toSlot : undefined,
        item:
          event.type === "SELL"
            ? (item ?? (event.replacedItem?.name ? { name: event.replacedItem.name } : undefined))
            : item,
        note: event.note,
      },
    ]
  })
}

export function newEventId() {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Events close together on the clock, shown as one marker and one feed block (a teamfight, a shopping trip). */
export type EventCluster = {
  id: string
  lane: string
  side: Side | null
  start: number
  end: number
  events: TimelineEvent[]
}

const KIND_PRIORITY: Record<TimelineKind, number> = { KILL: 0, OBJECTIVE: 1, ITEM: 2, NOTE: 3 }

/** The event that represents a cluster: kills first, then objectives, items and notes. */
export const leadEvent = (cluster: EventCluster) =>
  [...cluster.events].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.at - b.at)[0]

/**
 * Chains events whose gap to the previous one in the same lane is at most `window` seconds. Without `laneOf`
 * everything shares one lane; a cluster mixing both sides has no single side.
 */
export function clusterEvents(
  events: TimelineEvent[],
  window: number,
  laneOf: (event: TimelineEvent) => string = () => "ALL",
): EventCluster[] {
  const clusters: EventCluster[] = []
  const open = new Map<string, EventCluster>()
  for (const event of sortEvents(events)) {
    const side = eventSide(event)
    const lane = laneOf(event)
    const current = open.get(lane)
    if (current && event.at - current.end <= window) {
      current.events.push(event)
      current.end = event.at
      if (current.side !== side) current.side = null
      continue
    }
    const cluster = { id: event.id, lane, side, start: event.at, end: event.at, events: [event] }
    clusters.push(cluster)
    open.set(lane, cluster)
  }
  return clusters
}

/** Kills per side inside a cluster, for "teamfight 2–1" summaries. */
export function clusterKills(cluster: EventCluster): Record<Side, number> {
  return killScoreAt(cluster.events, Number.POSITIVE_INFINITY)
}
