import type { Catalog, EquipmentSnapshot, Participant, Reference } from "@aov/community-contracts"

/** A player of a test game of whom nothing but the hero is recorded, unless `extra` says more. */
export const participant = (extra: Partial<Participant> = {}): Participant => ({
  lane: "TOP",
  hero: { id: "airi" },
  spell: null,
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "UNKNOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  build: [],
  ...extra,
})

/** An entry of a test catalog, named after its id unless `name` is given. */
export const reference = (id: string, tier: number | null = null, name = id): Reference => ({
  id,
  code: id,
  name,
  tier,
})

export const catalogOf = (entries: Partial<Catalog> = {}): Catalog => ({
  heroes: [],
  items: [],
  arcana: [],
  enchantments: [],
  spells: [],
  ...entries,
})

/** An inventory: an item by its id, null for a slot seen empty, undefined for one nobody could read. */
export const inventory = (atSeconds: number, ...held: (string | null | undefined)[]): EquipmentSnapshot => ({
  atSeconds,
  slots: Array.from({ length: 6 }, (_, index) => {
    const id = held[index]
    return { slot: index + 1, known: id !== undefined, item: id ? { id } : null }
  }),
})
