export const wikiSections = [
  {
    key: "heroes",
    icon: "hero",
    path: "/hero",
    group: "characters",
  },
  {
    key: "skins",
    icon: "skin",
    path: "/skins",
    group: "characters",
  },
  {
    key: "items",
    icon: "items",
    path: "/warehouse/items",
    group: "warehouse",
  },
  {
    key: "enchantments",
    icon: "enchantments",
    path: "/warehouse/enchantments",
    group: "warehouse",
  },
  {
    key: "arcana",
    icon: "arcana",
    path: "/warehouse/arcana",
    group: "warehouse",
  },
  {
    key: "spells",
    icon: "spells",
    path: "/warehouse/spells",
    group: "warehouse",
  },
  {
    key: "modes",
    icon: "mode",
    path: "/modes",
    group: "play",
  },
  {
    key: "updates",
    icon: "updates",
    path: "/updates",
    group: "news",
  },
  {
    key: "terms",
    icon: "terms",
    path: "/terms",
    group: "news",
  },
] as const

export type WikiSectionKey = (typeof wikiSections)[number]["key"]
