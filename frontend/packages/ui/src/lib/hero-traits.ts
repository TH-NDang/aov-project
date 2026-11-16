/**
 * The yes/no traits of a hero (ADR-029), shared by the Admin editor and the Wiki. The codes match the backend's
 * `TraitCode`; the order here is the order every list shows them in.
 */
export type HeroTraitCode =
  | "TRUE_DAMAGE"
  | "PERCENT_HP_DAMAGE"
  | "MISSING_HP_DAMAGE"
  | "ARMOR_SHRED"
  | "DASH"
  | "WALL_CROSS"
  | "UNTARGETABLE"
  | "STEALTH"
  | "GLOBAL"
  | "CC_IMMUNE"
  | "CLEANSE"
  | "SELF_HEAL"
  | "SHIELD"
  | "DAMAGE_REDUCTION"
  | "REVIVE"
  | "HARD_CC"
  | "DISPLACE"
  | "SILENCE"
  | "ALLY_HEAL"
  | "ALLY_SHIELD"
  | "ALLY_BUFF"
  | "VISION"

export type HeroTraitGroup = "DAMAGE" | "MOBILITY" | "SURVIVAL" | "CONTROL" | "TEAM"

export const HERO_TRAIT_GROUPS: readonly { key: HeroTraitGroup; vi: string; en: string }[] = [
  { key: "DAMAGE", vi: "Sát thương", en: "Damage" },
  { key: "MOBILITY", vi: "Di chuyển", en: "Mobility" },
  { key: "SURVIVAL", vi: "Sống sót", en: "Survival" },
  { key: "CONTROL", vi: "Khống chế", en: "Crowd control" },
  { key: "TEAM", vi: "Đồng đội", en: "Team" },
]

export interface HeroTraitInfo {
  code: HeroTraitCode
  group: HeroTraitGroup
  vi: string
  en: string
  /** The skill text rarely says it, so an editor decides from play rather than from a suggestion. */
  manual?: boolean
}

export const HERO_TRAITS: readonly HeroTraitInfo[] = [
  { code: "TRUE_DAMAGE", group: "DAMAGE", vi: "Sát thương chuẩn", en: "True damage" },
  {
    code: "PERCENT_HP_DAMAGE",
    group: "DAMAGE",
    vi: "Sát thương theo % máu mục tiêu",
    en: "Damage from the target's health",
  },
  {
    code: "MISSING_HP_DAMAGE",
    group: "DAMAGE",
    vi: "Mạnh hơn khi mục tiêu đã mất máu",
    en: "Stronger against wounded targets",
  },
  { code: "ARMOR_SHRED", group: "DAMAGE", vi: "Giảm giáp mục tiêu", en: "Lowers the target's armor" },
  { code: "DASH", group: "MOBILITY", vi: "Có kỹ năng lướt", en: "Has a dash" },
  { code: "WALL_CROSS", group: "MOBILITY", vi: "Lướt qua tường", en: "Dashes over walls", manual: true },
  { code: "UNTARGETABLE", group: "MOBILITY", vi: "Có lúc không thể bị chọn", en: "Can become untargetable" },
  { code: "STEALTH", group: "MOBILITY", vi: "Tàng hình", en: "Stealth" },
  { code: "GLOBAL", group: "MOBILITY", vi: "Hiện diện tầm bản đồ", en: "Map-wide presence" },
  { code: "CC_IMMUNE", group: "SURVIVAL", vi: "Miễn khống", en: "Crowd control immunity" },
  { code: "CLEANSE", group: "SURVIVAL", vi: "Tự giải khống chế", en: "Cleanses crowd control" },
  { code: "SELF_HEAL", group: "SURVIVAL", vi: "Tự hồi máu", en: "Heals itself" },
  { code: "SHIELD", group: "SURVIVAL", vi: "Lá chắn", en: "Shields" },
  { code: "DAMAGE_REDUCTION", group: "SURVIVAL", vi: "Giảm sát thương nhận vào", en: "Reduces damage taken" },
  { code: "REVIVE", group: "SURVIVAL", vi: "Hồi sinh hoặc miễn tử", en: "Revives or defies death" },
  { code: "HARD_CC", group: "CONTROL", vi: "Khống chế cứng", en: "Hard crowd control" },
  { code: "DISPLACE", group: "CONTROL", vi: "Đẩy lùi hoặc kéo", en: "Knocks back or pulls" },
  { code: "SILENCE", group: "CONTROL", vi: "Câm lặng", en: "Silence" },
  { code: "ALLY_HEAL", group: "TEAM", vi: "Hồi máu cho đồng đội", en: "Heals allies" },
  { code: "ALLY_SHIELD", group: "TEAM", vi: "Lá chắn cho đồng đội", en: "Shields allies" },
  { code: "ALLY_BUFF", group: "TEAM", vi: "Tăng tốc hoặc tăng lực cho đồng đội", en: "Speeds up or empowers allies" },
  { code: "VISION", group: "TEAM", vi: "Soi tầm nhìn", en: "Reveals vision" },
]

const order = new Map(HERO_TRAITS.map((trait, index) => [trait.code, index]))

/** The trait's place in the shared order; an unknown code goes last. */
export const heroTraitOrder = (code: string) => order.get(code as HeroTraitCode) ?? HERO_TRAITS.length

export const heroTraitInfo = (code: string): HeroTraitInfo | undefined =>
  HERO_TRAITS[order.get(code as HeroTraitCode) ?? -1]
