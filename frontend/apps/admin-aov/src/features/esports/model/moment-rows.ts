import type { Side } from "@aov/community-contracts"
import {
  clusterEvents,
  clusterKills,
  eventSeats,
  type SeatKey,
  type TimelineEvent,
  type TimelineKind,
} from "./timeline"

/** Moments a few seconds apart read as one fight or one shopping trip. */
const BLOCK_SECONDS = 5

/** Moments that stand together in the list; `fight` counts the kills where there are several. */
export type MomentBlock = {
  id: string
  start: number
  end: number
  fight: Record<Side, number> | null
  events: TimelineEvent[]
}

export const momentBlocks = (events: TimelineEvent[]): MomentBlock[] =>
  clusterEvents(events, BLOCK_SECONDS).map((cluster) => {
    const kills = clusterKills(cluster)
    return {
      id: cluster.id,
      start: cluster.start,
      end: cluster.end,
      fight: kills.BLUE + kills.RED > 1 ? kills : null,
      events: cluster.events,
    }
  })

/** What the list is narrowed to. Items of tier 1 and 2 are left out unless they are asked for. */
export type MomentFilter = { kind: TimelineKind | null; seat: SeatKey | null; allItems: boolean }
export const EVERY_MOMENT: MomentFilter = { kind: null, seat: null, allItems: false }

export const isFiltered = (filter: MomentFilter) => !!filter.kind || !!filter.seat || filter.allItems

type IsMajor = (event: TimelineEvent) => boolean

export const shownMoments = (events: TimelineEvent[], filter: MomentFilter, isMajor: IsMajor) =>
  events.filter(
    (event) =>
      (filter.allItems || isMajor(event)) &&
      (!filter.kind || event.kind === filter.kind) &&
      (!filter.seat || eventSeats(event).includes(filter.seat)),
  )

function counted<K>(keys: K[]) {
  const counts = new Map<K, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}

/** What the moments of a game can be narrowed to, each with how many it leaves. */
export function momentChoices(events: TimelineEvent[], isMajor: IsMajor) {
  const major = events.filter(isMajor)
  return {
    kinds: counted(major.map((event) => event.kind)),
    seats: counted(major.flatMap((event) => [...new Set(eventSeats(event))])),
    hiddenItems: events.length - major.length,
  }
}
