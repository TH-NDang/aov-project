/**
 * The glossary term that explains each hero stat (V087), so Admin and the wiki show the same words for a stat. A stat
 * without a term here has no explanation yet.
 */
export const HERO_STAT_TERMS: Readonly<Record<string, string>> = {
  HP: "mau-toi-da",
  ATTACK_DAMAGE: "cong-vat-ly",
  ABILITY_POWER: "cong-phep",
  ARMOR: "giap",
  MAGIC_DEFENSE: "giap-phep",
  MAX_RESOURCE: "nang-luong",
  MAX_ENERGY: "nang-luong",
  MOVEMENT_SPEED: "toc-chay",
  ATTACK_RANGE_TYPE: "tam-danh",
  ARMOR_PIERCE: "xuyen-giap",
  MAGIC_PIERCE: "xuyen-giap-phep",
  BONUS_ATTACK_SPEED: "toc-danh",
  CRITICAL_CHANCE: "ti-le-chi-mang",
  CRITICAL_DAMAGE: "sat-thuong-chi-mang",
  PHYSICAL_LIFESTEAL: "hut-mau",
  MAGIC_LIFESTEAL: "hut-mau-phep",
  COOLDOWN_REDUCTION: "giam-hoi-chieu",
  TENACITY: "khang-hieu-ung",
  HP_REGEN: "hoi-mau-moi-5-giay",
  RESOURCE_REGEN: "hoi-nang-luong-moi-5-giay",
}

/**
 * The item stat filter (`stats=` of the item catalog) that lists the items giving what a term explains, so a stat's
 * explanation can point at the items the shop sells today instead of naming them once.
 */
export const TERM_ITEM_FILTERS: Readonly<Record<string, string>> = {
  "mau-toi-da": "health",
  "hoi-mau-moi-5-giay": "health",
  "cong-vat-ly": "physical",
  "cong-phep": "magic",
  giap: "armor",
  "giap-phep": "magic-defense",
  "nang-luong": "mana",
  "hoi-nang-luong-moi-5-giay": "mana",
  "toc-chay": "movement",
  "xuyen-giap": "pierce",
  "xuyen-giap-phep": "pierce",
  "toc-danh": "attack-speed",
  "chi-mang": "crit",
  "ti-le-chi-mang": "crit",
  "sat-thuong-chi-mang": "crit",
  "hut-mau": "lifesteal",
  "hut-mau-phep": "lifesteal",
  "giam-hoi-chieu": "cooldown",
}

export const heroStatTerm = (statKey: string): string | undefined => HERO_STAT_TERMS[statKey]
