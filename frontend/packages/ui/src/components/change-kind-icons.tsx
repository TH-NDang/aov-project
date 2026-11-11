import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/change-art.svg?no-inline", import.meta.url).href

/** Illustrated marks for what a version changed, drawn like the navigation art so both read as one set. */
export const changeKindIcons = {
  BUFF: createArtworkIcon(artwork, "buff"),
  NERF: createArtworkIcon(artwork, "nerf"),
  BALANCE: createArtworkIcon(artwork, "balance"),
  ADJUSTMENT: createArtworkIcon(artwork, "adjustment"),
  REWORK: createArtworkIcon(artwork, "rework"),
  FIX: createArtworkIcon(artwork, "fix"),
  ADDED: createArtworkIcon(artwork, "added"),
  REMOVED: createArtworkIcon(artwork, "removed"),
  UPDATED: createArtworkIcon(artwork, "updated"),
  DATA_BASELINE: createArtworkIcon(artwork, "baseline"),
}

// A hero joining the game wears the same mark as a new item.
const ALIASES: Record<string, keyof typeof changeKindIcons> = { ADJUST: "ADJUSTMENT", BUG_FIX: "FIX", RELEASE: "ADDED" }

/** The mark for a change kind, or undefined for a kind that has none. */
export function changeKindIcon(kind: string) {
  const known = ALIASES[kind] ?? kind
  return Object.hasOwn(changeKindIcons, known) ? changeKindIcons[known as keyof typeof changeKindIcons] : undefined
}
