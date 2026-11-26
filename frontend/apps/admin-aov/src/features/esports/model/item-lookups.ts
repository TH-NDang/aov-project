import type { Reference } from "@aov/community-contracts"
import { referenceIndex } from "./game-view"
import type { ItemRef, TimelineEvent } from "./timeline"

export type ItemLookups = {
  itemIcon: (item: ItemRef) => string | null | undefined
  itemTier: (item: ItemRef) => number | null | undefined
}

export function itemLookups(items: Reference[]): ItemLookups {
  const icons = referenceIndex(items)
  return { itemIcon: (item) => icons(item)?.iconUrl, itemTier: (item) => icons(item)?.tier }
}

/** Only finished (tier 3) items stand on the timeline; components stay in the line-ups and behind the list's filter. */
export const isMajorMoment = (lookups: ItemLookups) => (event: TimelineEvent) =>
  event.kind !== "ITEM" || (!!event.item && lookups.itemTier(event.item) === 3)
