import { skillSlot, splitSkillRanks, type RankPart, type RankVariable } from "@aov/ui/lib/skill-rank-values"
import type { Skill } from "../../api/types"

/**
 * The skill a mechanic note is about. Notes name it the way the patch notes do (the passive, or skill N) or by its key;
 * the first form of that slot stands for it, so the note sits in the skill's card with its icon.
 */
export function mechanicSkillKey(name: string, skills: Skill[] = []): string | undefined {
  const key = name.trim()
  if (skills.some((skill) => skill.skillKey === key)) return key
  const slot = /^(?:nội tại|passive)$/iu.test(key) ? 0 : Number(/^(?:chiêu|skill)[\s_-]*(\d+)$/iu.exec(key)?.[1])
  if (!Number.isInteger(slot)) return undefined
  return skills
    .filter((skill) => skillSlot(skill) === slot)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.skillKey.localeCompare(b.skillKey))[0]?.skillKey
}

const statWords: [RegExp, RankVariable][] = [
  [/^công vật lý cộng thêm/iu, "bonusPhysicalAttack"],
  [/^công vật lý/iu, "physicalAttack"],
  [/^công phép/iu, "magicAttack"],
  [/^máu tối đa/iu, "maxHealth"],
]

// A share of a stat, such as 50% of magic attack or 5% of max health, or a bare number that is not a duration, a count or a share.
const valueToken =
  /(\d+(?:[.,]\d+)?)\s*%(?=\s*(công vật lý|công phép|máu tối đa))|(?<![\d.,%+−-])(\d+(?:[.,]\d+)?)(?![\d%]|[.,]\d|\s*(?:%|giây|s\b|lần|tầng|dấu|mét|m\b|đơn vị|kẻ|mục tiêu|đòn|cấp|lớp|chiêu))/giu

const amount = (value: string) => Number(value.replace("%", "").replace(",", ".").trim())

type Candidate = { key: RankPart["key"]; before: string; after: string }

/**
 * Marks, in the skill's own description, the numbers a recorded change set: where the description shows the new
 * level-1 value of a changed part, it reads "350 → 500". Each recorded part marks one place at most, in the order the
 * changes were recorded, and only numbers written between markup tags are read.
 */
export function markDescriptionChanges(
  description: string,
  fields: { oldValue: unknown; newValue: unknown }[],
  skill?: Skill | null,
): { text: string; marks: number } {
  const candidates: Candidate[] = fields.flatMap(
    (field) =>
      splitSkillRanks(field.oldValue, field.newValue, skill, skill)?.parts.flatMap((part) => {
        const [before, after] = [part.before[0], part.after[0]]
        return before !== null && after !== null && before !== after ? [{ key: part.key, before, after }] : []
      }) ?? [],
  )
  if (!candidates.length) return { text: description, marks: 0 }

  const used = new Set<Candidate>()
  let marks = 0
  const mark = (match: string, number: string, key: Candidate["key"]) => {
    const candidate = candidates.find(
      (item) => !used.has(item) && item.key === key && amount(item.after) === amount(number),
    )
    if (!candidate) return match
    used.add(candidate)
    marks++
    // The match is the number and, for a share, its "%": the candidate's values carry their own sign.
    return `<muted>${candidate.before} → </muted><b>${candidate.after}</b>`
  }
  const text = description.replace(/(<[^>]*>)|([^<]+)/g, (whole, tag: string | undefined) =>
    tag
      ? tag
      : whole.replace(
          valueToken,
          (match, share: string | undefined, stat: string | undefined, base: string | undefined) => {
            if (share !== undefined) {
              const key = statWords.find(([pattern]) => pattern.test(stat ?? ""))?.[1]
              return key ? mark(match, share, key) : match
            }
            return base !== undefined ? mark(match, base, "base") : match
          },
        ),
  )
  return { text, marks }
}
