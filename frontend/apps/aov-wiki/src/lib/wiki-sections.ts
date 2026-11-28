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
    key: "map",
    icon: "map",
    path: "/map",
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

/** The name of each section and group of sections, in Vietnamese and English. */
export const SECTION_NAMES: Record<string, readonly [string, string]> = {
  characters: ["Sổ tay nhân vật", "Character handbook"],
  heroes: ["Tướng", "Heroes"],
  skins: ["Trang phục", "Skins"],
  warehouse: ["Kho trang bị", "Armory"],
  items: ["Trang bị", "Equipment"],
  enchantments: ["Phù hiệu", "Enchantments"],
  arcana: ["Bảng ngọc", "Arcana"],
  spells: ["Phụ trợ", "Talents"],
  news: ["Tham khảo", "Reference"],
  updates: ["Ghi chú cập nhật", "Patch notes"],
  updatesShort: ["Cập nhật", "Updates"],
  terms: ["Thuật ngữ", "Glossary"],
  map: ["Bản đồ", "Maps"],
  mode: ["Chế độ chơi", "Game modes"],
  modes: ["Chế độ chơi", "Game modes"],
  play: ["Lối chơi", "Gameplay"],
}
