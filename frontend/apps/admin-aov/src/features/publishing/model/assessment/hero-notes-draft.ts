import type { HeroRankingReading } from "../../api/publishing-api"
import { selectSkillTranslation } from "../skills/hero-skills"
import type { HeroNotes, Role, Skill, Trait, TraitCode } from "../../api/types"

/** The per-match figures a draft can talk about, with the words for a high and a low rank. */
const FIGURES: { metric: string; word: string; per: string; high: string; low: string; lowFor?: Role[] }[] = [
  {
    metric: "DAMAGE_DEALT",
    word: "sát thương gây ra",
    per: "mỗi trận",
    high: "Gây nhiều sát thương",
    low: "Gây ít sát thương",
    lowFor: ["WARRIOR", "ASSASSIN", "MAGE", "MARKSMAN"],
  },
  {
    metric: "DAMAGE_TAKEN",
    word: "sát thương gánh chịu",
    per: "mỗi trận",
    high: "Gánh nhiều sát thương",
    low: "Gánh ít sát thương",
    lowFor: ["TANK", "WARRIOR"],
  },
  {
    metric: "KILLS",
    word: "lần hạ gục",
    per: "mỗi trận",
    high: "Hạ gục nhiều",
    low: "Ít hạ gục",
    lowFor: ["WARRIOR", "ASSASSIN", "MAGE", "MARKSMAN"],
  },
  // Few assists only matter for heroes whose job is to help: a solo laner with few is not weaker for it.
  {
    metric: "ASSISTS",
    word: "lần hỗ trợ",
    per: "mỗi trận",
    high: "Hỗ trợ nhiều",
    low: "Ít hỗ trợ",
    lowFor: ["TANK", "SUPPORT"],
  },
  { metric: "GOLD", word: "vàng", per: "mỗi phút", high: "Kiếm vàng nhanh", low: "Kiếm vàng chậm" },
]
/** A large share of damage taken only reads as a strength for heroes meant to take it. */
const HIGH_FOR: Partial<Record<string, Role[]>> = { DAMAGE_TAKEN: ["TANK", "WARRIOR"] }

/** An in-game figure as the game writes it (QUY-UOC-VIET section 3): `98000`, `1.25`, never `98.000` or `1,25`. */
const amount = (value: number) => String(value >= 1000 ? Math.round(value) : Math.round(value * 100) / 100)

function snapshotDay(snapshot: NonNullable<HeroRankingReading["snapshot"]>) {
  try {
    return new Date(snapshot.capturedAt).toLocaleDateString("vi-VN", {
      timeZone: snapshot.sourceTimeZone ?? "Asia/Ho_Chi_Minh",
    })
  } catch {
    return snapshot.capturedAt.slice(0, 10)
  }
}

export interface NotesDraftInput {
  traits: Trait[]
  skills: Skill[]
  roles: Role[]
  ranking?: HeroRankingReading | null
  /** The game's survivability bar as shown, and the top of its scale. */
  survivability?: { value: number; maximum: number } | null
}

/**
 * A machine draft of the editor's notes, in Vietnamese, one point per line. Every point says where it comes from: the
 * ranked snapshot with its day, the game's own bar, or a confirmed trait. The editor rewrites it before saving.
 */
export function draftHeroNotes({ traits, skills, roles, ranking, survivability }: NotesDraftInput): HeroNotes {
  const has = (code: TraitCode) => traits.some((trait) => trait.code === code)
  const detail = (code: TraitCode) => {
    const trait = traits.find((entry) => entry.code === code)
    if (!trait) return ""
    const written = trait.translations.find((text) => text.locale === "vi-VN")?.detail
    if (written) return written
    return skills
      .filter((skill) => trait.skillKeys.includes(skill.skillKey))
      .map((skill) => selectSkillTranslation(skill, "vi-VN")?.name || skill.skillKey)
      .join(", ")
  }
  const within = (code: TraitCode, text: string) => (detail(code) ? `${text} (${detail(code)})` : text)
  const strengths: string[] = []
  const weaknesses: string[] = []
  const counters: string[] = []

  const snapshot = ranking?.snapshot
  for (const figure of FIGURES) {
    const reading = ranking?.entry?.figures.find((entry) => entry.metric === figure.metric)
    if (!snapshot || !reading || reading.value === null || reading.rank === null || !reading.of) continue
    // A quarter of the heroes on the board is worth a point at either end.
    const quarter = Math.ceil(reading.of / 4)
    const place = `${amount(reading.value)} ${figure.word} ${figure.per}, hạng ${reading.rank}/${reading.of} ở ${snapshot.modeLabel} ngày ${snapshotDay(snapshot)}`
    const highFor = HIGH_FOR[figure.metric]
    if (reading.rank <= quarter && (!highFor || roles.some((role) => highFor.includes(role))))
      strengths.push(`${figure.high}: ${place}.`)
    if (reading.rank > reading.of - quarter && (!figure.lowFor || roles.some((role) => figure.lowFor!.includes(role))))
      weaknesses.push(`${figure.low}: ${place}.`)
  }

  const piercing = [
    has("TRUE_DAMAGE") && within("TRUE_DAMAGE", "sát thương chuẩn"),
    has("PERCENT_HP_DAMAGE") && within("PERCENT_HP_DAMAGE", "sát thương theo % máu"),
  ].filter(Boolean)
  if (piercing.length) strengths.push(`Xuyên được tướng trâu: ${piercing.join(", ")}.`)
  if (has("MISSING_HP_DAMAGE")) strengths.push(`Kết liễu tốt: ${detail("MISSING_HP_DAMAGE")}.`)
  if (has("WALL_CROSS")) strengths.push(`Lướt qua được tường: ${detail("WALL_CROSS")}.`)
  if (has("GLOBAL")) strengths.push(`Hiện diện tầm bản đồ: ${detail("GLOBAL")}.`)
  if (has("CC_IMMUNE")) strengths.push(`Có miễn khống: ${detail("CC_IMMUNE")}.`)
  if (has("REVIVE")) strengths.push(`Có hồi sinh hoặc miễn tử: ${detail("REVIVE")}.`)
  if (has("HARD_CC")) strengths.push(`Khống chế cứng: ${detail("HARD_CC")}.`)
  const team = (["ALLY_HEAL", "ALLY_SHIELD", "ALLY_BUFF"] as const).filter(has)
  if (team.length) {
    const words = { ALLY_HEAL: "hồi máu", ALLY_SHIELD: "lá chắn", ALLY_BUFF: "tăng tốc hoặc tăng lực" }
    const details = team.map(detail).filter(Boolean)
    strengths.push(
      `Giúp đồng đội: ${team.map((code) => words[code]).join(", ")}${details.length ? ` (${details.join("; ")})` : ""}.`,
    )
  }

  if (!has("DASH") && !has("UNTARGETABLE"))
    weaknesses.push("Không có kỹ năng lướt: dễ bị đuổi và bắt khi đứng sai chỗ.")
  if (!has("CC_IMMUNE") && !has("CLEANSE"))
    weaknesses.push("Không có miễn khống hay giải khống: khống chế cứng bắt được bất cứ lúc nào.")
  if (!has("SELF_HEAL") && !has("SHIELD") && !has("DAMAGE_REDUCTION"))
    weaknesses.push("Bộ kỹ năng không có lá chắn, hồi máu hay giảm sát thương: sống sót nhờ vị trí và trang bị.")
  if (survivability && survivability.maximum > 0 && survivability.value <= survivability.maximum * 0.4)
    weaknesses.push(`Thanh Sinh tồn của game chỉ ${amount(survivability.value)}/${amount(survivability.maximum)}.`)

  if (has("SELF_HEAL")) counters.push(`Trang bị giảm hồi máu cắt bớt lượng hồi từ ${detail("SELF_HEAL")}.`)
  if (has("CC_IMMUNE"))
    counters.push(
      `${within("CC_IMMUNE", "Miễn khống")}: khống chế trước khi tướng vào chiêu, hoặc chờ hiệu ứng kết thúc rồi mới dùng.`,
    )
  if (has("CLEANSE"))
    counters.push(`${detail("CLEANSE")} giải khống chế: để dành khống chế cho tới khi chiêu đó đã được dùng.`)
  if (has("UNTARGETABLE"))
    counters.push(
      `${detail("UNTARGETABLE")} làm tướng không thể bị chọn: giữ chiêu chỉ định cho tới khi tướng hiện lại.`,
    )
  if (has("SHIELD")) counters.push(`Lá chắn từ ${detail("SHIELD")}: chờ lá chắn tan rồi mới dồn sát thương.`)
  if (has("DAMAGE_REDUCTION"))
    counters.push(`${within("DAMAGE_REDUCTION", "Giảm sát thương")}: tránh dồn sát thương vào lúc hiệu ứng còn.`)
  if (has("REVIVE"))
    counters.push(`${within("REVIVE", "Hồi sinh hoặc miễn tử")}: chờ hiệu ứng đã dùng rồi mới dốc sức kết liễu.`)
  if (has("STEALTH"))
    counters.push(`${within("STEALTH", "Tàng hình")}: giữ tầm nhìn ở nơi tướng hay xuất hiện và đi cùng đồng đội.`)

  const lines = (list: string[]) => [...new Set(list)].join("\n") || null
  return { strengths: lines(strengths), weaknesses: lines(weaknesses), counterTips: lines(counters) }
}
