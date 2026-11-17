import { isEnglishLocale, localeText } from "@aov/ui/lib/locale-text"
/** Readable wording for published hero change records. Unknown keys and formulas stay as the source wrote them. */
const text = (locale: string, vietnamese: string, english: string) => localeText(locale)(vietnamese, english)

export interface HeroChangeItem {
  id: string
  type: string
  changeKind?: string | null
  skillKey?: string | null
  fieldKey?: string | null
  statKey?: string | null
  oldValue?: string | null
  newValue?: string | null
  mechanicKey?: string | null
  description?: string | null
}

const FIELDS: Record<string, [string, string]> = {
  shield: ["Lá chắn", "Shield"],
  magicDamage: ["Sát thương phép", "Magic damage"],
  physicalDamage: ["Sát thương vật lý", "Physical damage"],
  trueDamage: ["Sát thương chuẩn", "True damage"],
  cooldownSeconds: ["Hồi chiêu (giây)", "Cooldown (seconds)"],
  attackSpeedPercent: ["Tốc đánh (%)", "Attack Speed (%)"],
  empoweredPhysicalDamage: ["Sát thương vật lý cường hóa", "Empowered physical damage"],
  baseMagicDamage: ["Sát thương phép cơ bản", "Base magic damage"],
  hitMagicDamage: ["Sát thương phép khi trúng", "Magic damage on hit"],
  pathMagicDamage: ["Sát thương phép trên đường đi", "Magic damage along the path"],
  triangleMagicDamage: ["Sát thương phép vùng tam giác", "Magic damage in the triangle"],
  initialMagicDamage: ["Sát thương phép ban đầu", "Initial magic damage"],
  periodicMagicDamage: ["Sát thương phép theo thời gian", "Periodic magic damage"],
  magicDefenseReduction: ["Giảm giáp phép", "Magic Defense reduction"],
  empoweredAttackDash: ["Lướt khi đánh cường hóa", "Empowered attack dash"],
  energyCost: ["Năng lượng tiêu hao", "Mana cost"],
  stackDecay: ["Mất tầng cộng dồn", "Stack decay"],
  cannonSeparation: ["Tách pháo thành chiêu riêng", "Separate cannon ability"],
  doliaRefreshImmortality: ["Miễn tử sau khi làm mới chiêu", "Immortality after a refresh"],
}

const STATS: Record<string, [string, string]> = {
  physicalAttack: ["Công vật lý", "Attack Damage"],
  bonusPhysicalAttack: ["Công vật lý cộng thêm", "bonus Attack Damage"],
  magicAttack: ["Công phép", "Ability Power"],
  maxHealth: ["Máu tối đa", "Max HP"],
}

export function changeFieldLabel(key: string | null | undefined, locale: string) {
  if (!key) return text(locale, "Thay đổi", "Change")
  // Keys may carry the skill they belong to, such as "passive.stackDecay" or "skill_2.magicDamage".
  const field = key.slice(key.lastIndexOf(".") + 1)
  const known = FIELDS[field]
  if (known) return text(locale, ...known)
  if (!isEnglishLocale(locale)) return "Thông số"
  const words = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Skill keys follow skill-{slot}-{form}; slot 0 is the passive. */
export function changeSkillLabel(key: string | null | undefined, locale: string) {
  if (key === "passive" || key === "capture-passive") return text(locale, "Nội tại", "Passive")
  const slot = /^(?:capture-)?skill-(\d+)/.exec(key ?? "")?.[1]
  if (slot === undefined) return null
  return slot === "0" ? text(locale, "Nội tại", "Passive") : `${text(locale, "Chiêu", "Ability")} ${slot}`
}

/** Reads rank and ratio terms as words: "21*(rank-1)" becomes 21 per rank, "0.2*physicalAttack" becomes 20% of the stat. */
export function formatChangeValue(value: string | null | undefined, locale: string) {
  if (value == null || value === "") return "—"
  const parts = value.split(/\s([+-])\s/)
  const terms = parts.map((part, index) => {
    if (index % 2) return part === "-" ? "−" : "+"
    const perRank = /^([\d.]+)\*\(rank-1\)$/.exec(part)
    if (perRank) return `${perRank[1]} ${text(locale, "mỗi cấp", "per level")}`
    const ratio = /^([\d.]+)\*([a-zA-Z]+)$/.exec(part)
    const stat = ratio && STATS[ratio[2]]
    if (ratio && stat) return `${Number((Number(ratio[1]) * 100).toFixed(2))}% ${text(locale, ...stat)}`
    return /^[\d.]+$/.test(part) ? part : null
  })
  return terms.every((term) => term !== null) ? terms.join(" ") : value
}

/** Imported notes put the source and an editor's remark in the summary; readers get them apart from the sentence. */
export function parseChangeSummary(summary: string | null | undefined) {
  const parsed: { text: string; source: string | null } = { text: "", source: null }
  const lines: string[] = []
  for (const line of (summary ?? "").split("\n").map((value) => value.trim())) {
    const source = /^Nguồn:\s*(https:\/\/\S+)/i.exec(line)
    if (source) parsed.source = source[1]
    else if (line && !/^Đối chiếu/i.test(line)) lines.push(line)
  }
  parsed.text = lines.join("\n")
  return parsed
}

/** One label for a whole change set: its own kind, the kind all its changes share, or a general adjustment. */
export function changeSetKind(row: { overallKind?: string | null; changes?: Pick<HeroChangeItem, "changeKind">[] }) {
  if (row.overallKind) return row.overallKind
  const kinds = new Set((row.changes ?? []).map((change) => change.changeKind).filter(Boolean))
  return kinds.size === 1 ? [...kinds][0] : kinds.size ? "ADJUSTMENT" : null
}
