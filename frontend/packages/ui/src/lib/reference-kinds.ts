/** What a reference may name, in the order lists show the kinds. */
export const entityKinds = [
  "hero",
  "skill",
  "item",
  "enchantment",
  "arcana",
  "spell",
  "mode",
  "circuit",
  "organization",
  "competition",
  "team",
  "player",
  "person",
  "country",
  "term",
] as const
export type EntityKind = (typeof entityKinds)[number]

/** The kinds as a part of the regular expressions that read `<ref=kind:id>`. */
export const referenceKinds = entityKinds.join("|")
