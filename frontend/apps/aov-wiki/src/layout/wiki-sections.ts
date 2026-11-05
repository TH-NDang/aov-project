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
    path: "/warehouse?tab=items",
    group: "warehouse",
  },
  {
    key: "enchantments",
    icon: "enchantments",
    path: "/warehouse?tab=enchantments",
    group: "warehouse",
  },
  {
    key: "arcana",
    icon: "arcana",
    path: "/warehouse?tab=arcana",
    group: "warehouse",
  },
  {
    key: "spells",
    icon: "spells",
    path: "/warehouse?tab=spells",
    group: "warehouse",
  },
  {
    key: "updates",
    icon: "patch",
    path: "/updates",
    group: "news",
  },
] as const

export type WikiSectionKey = (typeof wikiSections)[number]["key"]
