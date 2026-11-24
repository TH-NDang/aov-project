import type { EntityKind } from "../lib/entity-rich-text"
import { gameIcon } from "./game-icons"

/**
 * The mark of each kind of reference, from Game Icons: a kind the Wiki has a section for wears that section's icon,
 * so the Admin glossary filters, its navigation and the Wiki agree. They take the colour of the text around them.
 */
export const entityKindIcons = {
  hero: gameIcon("samurai-helmet"),
  skill: gameIcon("skills"),
  item: gameIcon("battle-gear"),
  enchantment: gameIcon("winged-emblem"),
  arcana: gameIcon("gem-pendant"),
  spell: gameIcon("magic-swirl"),
  team: gameIcon("meeple-group"),
  player: gameIcon("swordman"),
  country: gameIcon("world"),
  term: gameIcon("spell-book"),
} satisfies Record<EntityKind, ReturnType<typeof gameIcon>>

/** The mark of a list that holds every kind at once. */
export const AllEntityKindsIcon = gameIcon("stack")
