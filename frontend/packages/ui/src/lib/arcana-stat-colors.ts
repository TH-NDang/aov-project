import { defaultEntityColor, foldEntitySearch, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { ArcanaContent } from "./warehouse-content"

/** Each group lists the stat keys, the Vietnamese labels seen in the data and the English labels of `en-US` content. */
const statGroups: [string, string[]][] = [
  [
    "cong-phep",
    [
      "magicAttack",
      "magicPierce",
      "Công phép",
      "Xuyên giáp phép",
      "Xuyên thủ phép",
      "Hút máu phép",
      "Hút phép",
      "magic-penetration",
      "magic-lifesteal",
      "Ability Power",
      "Magic Pierce",
      "Magic Life Steal",
    ],
  ],
  [
    "cong-vat-ly",
    [
      "physicalAttack",
      "armorPierce",
      "Công vật lý",
      "Công vậy lý",
      "Xuyên giáp",
      "armor-penetration",
      "Attack Damage",
      "Armor Pierce",
    ],
  ],
  ["giap", ["armor", "Giáp"]],
  ["giap-phep", ["magicDefense", "Giáp phép", "Thủ phép", "Kháng phép", "Magic Defense"]],
  [
    "hoi-mau",
    [
      "maxHealth",
      "Máu",
      "Máu tối đa",
      "Hồi máu",
      "Hồi máu/5s",
      "Hút máu",
      "health-regen-per-five-seconds",
      "physical-lifesteal",
      "Max HP",
      "HP",
      "HP/5s",
      "Life Steal",
    ],
  ],
  ["toc-danh", ["attackSpeed", "Tốc đánh", "Tốc độ đánh"]],
  ["toc-chay", ["movementSpeed", "Tốc chạy", "Tốc độ di chuyển"]],
  [
    "chi-mang",
    ["criticalChance", "criticalDamage", "Chí mạng", "Tỉ lệ chí mạng", "Tỷ lệ chí mạng", "Sát thương chí mạng"],
  ],
  ["giam-hoi-chieu", ["cooldownReduction", "Giảm hồi chiêu", "Giám hồi chiêu", "Hồi chiêu", "Cooldown Speed"]],
]

const normalize = (value: string) =>
  foldEntitySearch(value.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .replace(/[-_\s]+/g, " ")
    .trim()
const groupsByLabel = new Map(statGroups.flatMap(([term, labels]) => labels.map((label) => [normalize(label), term])))
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

export function arcanaCombatGroup(content: ArcanaContent): "physical" | "magic" | "neutral" {
  const groups = new Set<"physical" | "magic">()
  for (const stat of content.stats) {
    const term =
      groupsByLabel.get(normalize(stat.key)) ??
      content.translations.map((text) => groupsByLabel.get(normalize(text.statLabels?.[stat.key] ?? ""))).find(Boolean)
    if (term === "cong-vat-ly") groups.add("physical")
    if (term === "cong-phep") groups.add("magic")
  }
  // Hybrid and utility arcana belong to the neutral group, so every card appears exactly once.
  return groups.size === 1 ? [...groups][0]! : "neutral"
}

export function createArcanaStatColors(entities: EntityReference[]) {
  const terms = new Map<string, EntityReference>()
  for (const entity of entities) {
    if (entity.kind !== "term") continue
    for (const label of [entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])]) {
      terms.set(normalize(label), entity)
    }
  }
  const entityColor = (entity?: EntityReference) => {
    if (!entity) return undefined
    const saved = entity.display?.color
    return saved && hexColor.test(saved) ? saved : defaultEntityColor(entity)
  }
  return (label: string, key?: string) => {
    const exact = entityColor(terms.get(normalize(label)))
    if (exact) return exact
    const group = (key && groupsByLabel.get(normalize(key))) || groupsByLabel.get(normalize(label))
    if (!group) return undefined
    return entityColor(terms.get(normalize(group))) ?? defaultEntityColor({ kind: "term", id: group })
  }
}
