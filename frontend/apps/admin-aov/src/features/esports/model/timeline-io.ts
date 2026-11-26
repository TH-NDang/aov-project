import type {
  EquipmentEvent,
  GameContent,
  Lane,
  Seat,
  Side,
  TimelineEvent as StoredEvent,
  VodPause,
} from "@aov/community-contracts"
import { recordedItemEvents, seatKey, sortEvents, type ItemEvent, type SeatKey, type TimelineEvent } from "./timeline"

const toKey = (seat?: Seat | null): SeatKey | undefined => (seat ? seatKey(seat.side, seat.lane) : undefined)
const toSeat = (key?: SeatKey): Seat | null => {
  if (!key) return null
  const [side, lane] = key.split(":") as [Side, Lane]
  return { side, lane }
}

/** All moments of a stored game: timeline events plus every participant's equipment events. */
export function readTimeline(content: GameContent): TimelineEvent[] {
  const events: TimelineEvent[] = (content.timeline?.events ?? []).flatMap((event): TimelineEvent[] => {
    const base = { id: event.id, at: event.atSeconds, note: event.note ?? undefined }
    switch (event.kind) {
      case "KILL":
        return [
          {
            ...base,
            kind: "KILL",
            killer: toKey(event.killer),
            victim: toKey(event.victim),
            assists: (event.assists ?? []).map((seat) => seatKey(seat.side, seat.lane)),
          },
        ]
      case "OBJECTIVE":
        return event.side && event.objective
          ? [{ ...base, kind: "OBJECTIVE", side: event.side, objective: event.objective, by: toKey(event.by) }]
          : []
      case "NOTE":
        return [{ ...base, kind: "NOTE", title: event.title ?? "", side: event.side ?? undefined }]
      default:
        return []
    }
  })
  for (const side of content.sides)
    for (const participant of side.participants)
      events.push(...recordedItemEvents(seatKey(side.side, participant.lane), participant.equipmentEvents))
  return sortEvents(events)
}

function toStored(event: Exclude<TimelineEvent, ItemEvent>): StoredEvent {
  const base = { id: event.id, atSeconds: Math.round(event.at), note: event.note || null }
  switch (event.kind) {
    case "KILL":
      return {
        ...base,
        kind: "KILL",
        killer: toSeat(event.killer),
        victim: toSeat(event.victim),
        assists: event.assists.map((key) => toSeat(key)!),
      }
    case "OBJECTIVE":
      return { ...base, kind: "OBJECTIVE", side: event.side, objective: event.objective, by: toSeat(event.by) }
    case "NOTE":
      return { ...base, kind: "NOTE", title: event.title, side: event.side ?? null }
  }
}

/** The slots of an item event under the names the game keeps them by. */
function slotsOf({ action, slot, toSlot }: ItemEvent): Pick<EquipmentEvent, "fromSlot" | "toSlot"> {
  if (action === "SELL") return { fromSlot: slot }
  return action === "SWAP" ? { fromSlot: slot, toSlot } : { toSlot: slot }
}

function toEquipment(event: ItemEvent): EquipmentEvent {
  // Every save writes all of them again, so what a moment does not carry must come from its own record. What is said of
  // a purchase says nothing of the sale it was corrected to.
  const kept = event.stored?.type === event.action ? event.stored : undefined
  const item = event.item && event.action !== "SWAP" ? { id: event.item.id ?? null, name: event.item.name } : kept?.item
  return {
    ...kept,
    atSeconds: Math.round(event.at),
    type: event.action,
    item,
    ...slotsOf(event),
    note: event.note,
  }
}

/**
 * Writes the full set of moments back into the game: equipment events go to their participant (time ordered, as the
 * API requires) and everything else to `timeline.events`. Pauses and other game fields are kept.
 */
export function writeTimeline(content: GameContent, events: TimelineEvent[]): GameContent {
  const sorted = sortEvents(events)
  const items = sorted.filter((event): event is ItemEvent => event.kind === "ITEM")
  return {
    ...content,
    sides: content.sides.map((side) => ({
      ...side,
      participants: side.participants.map((participant) => ({
        ...participant,
        equipmentEvents: items.filter((event) => event.seat === seatKey(side.side, participant.lane)).map(toEquipment),
      })),
    })),
    timeline: {
      pauses: content.timeline?.pauses ?? [],
      events: sorted.filter((event): event is Exclude<TimelineEvent, ItemEvent> => event.kind !== "ITEM").map(toStored),
    },
  }
}

export type Playback = { startSecond?: number | null; pauses?: VodPause[]; durationSeconds?: number }

/** Updates the game start, duration and pauses without touching recorded moments. */
export function withPlayback(content: GameContent, change: Playback): GameContent {
  return {
    ...content,
    ...(change.startSecond !== undefined ? { sourceTimestampSeconds: change.startSecond ?? undefined } : {}),
    ...(change.durationSeconds !== undefined ? { durationSeconds: change.durationSeconds } : {}),
    timeline: {
      events: content.timeline?.events ?? [],
      pauses: [...(change.pauses ?? content.timeline?.pauses ?? [])].sort((a, b) => a.atSeconds - b.atSeconds),
    },
  }
}

/** Replaces or appends one moment. */
export const upsertEvent = (events: TimelineEvent[], event: TimelineEvent) =>
  events.some((entry) => entry.id === event.id)
    ? events.map((entry) => (entry.id === event.id ? event : entry))
    : [...events, event]

/** The game with one recorded moment moved to another second of the game clock; null when it is not stored. */
export function moveEvent(content: GameContent, id: string, gameSecond: number): GameContent | null {
  const events = readTimeline(content)
  const event = events.find((candidate) => candidate.id === id)
  if (!event) return null
  return writeTimeline(content, upsertEvent(events, { ...event, at: Math.max(0, Math.round(gameSecond)) }))
}
