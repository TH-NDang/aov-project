import { matchTitleText, type MatchTitle } from "@aov/community-contracts/match-titles"
import { localeText } from "@aov/ui/lib/locale-text"

/**
 * Names of rounds as the imported plans write them, such as "Week 3", "Upper Bracket Finals" or "Group A Matches",
 * in both languages. A name no pattern knows is kept as written: it is a name an editor chose.
 */
const PATTERNS: [RegExp, (n: string) => readonly [vi: string, en: string]][] = [
  [/^(?:match)?week (\d+)$/i, (n) => [`Tuần ${n}`, `Week ${n}`]],
  [/^match ?day (\d+)$/i, (n) => [`Ngày thi đấu ${n}`, `Matchday ${n}`]],
  [/^day (\d+)$/i, (n) => [`Ngày ${n}`, `Day ${n}`]],
  [/^group ([a-z])$/i, (n) => [`Bảng ${n.toUpperCase()}`, `Group ${n.toUpperCase()}`]],
  [/^(?:vòng|round) (\d+)$/i, (n) => [`Vòng ${n}`, `Round ${n}`]],
  [/^first round$/i, () => ["Vòng 1", "Round 1"]],
  [/^(?:upper bracket|ub|winners?) (?:r|round )(\d+)$/i, (n) => [`Vòng ${n} nhánh thắng`, `Upper bracket round ${n}`]],
  [/^(?:lower bracket|lb|losers?) (?:r|round )(\d+)$/i, (n) => [`Vòng ${n} nhánh thua`, `Lower bracket round ${n}`]],
  [/^(?:upper bracket|ub|winners?) quarter-?finals?$/i, () => ["Tứ kết nhánh thắng", "Upper bracket quarterfinal"]],
  [/^(?:lower bracket|lb|losers?) quarter-?finals?$/i, () => ["Tứ kết nhánh thua", "Lower bracket quarterfinal"]],
  [/^(?:upper bracket|ub|winners?) semi-?finals?$/i, () => ["Bán kết nhánh thắng", "Upper bracket semifinal"]],
  [/^(?:lower bracket|lb|losers?) semi-?finals?$/i, () => ["Bán kết nhánh thua", "Lower bracket semifinal"]],
  [/^(?:upper bracket|ub|winners?) finals?$/i, () => ["Chung kết nhánh thắng", "Upper bracket final"]],
  [/^(?:lower bracket|lb|losers?) finals?$/i, () => ["Chung kết nhánh thua", "Lower bracket final"]],
  [/^(?:chung kết tổng|grand finals?)$/i, () => ["Chung kết tổng", "Grand final"]],
  [/^(?:chung kết|finals?)$/i, () => ["Chung kết", "Final"]],
  [/^(?:bán kết|semi-?finals?)$/i, () => ["Bán kết", "Semifinal"]],
  [/^(?:tứ kết|quarter-?finals?)$/i, () => ["Tứ kết", "Quarterfinal"]],
  [/^(?:3rd|third) place match$/i, () => ["Tranh hạng ba", "Third place match"]],
  [/^cancelled$/i, () => ["Đã hủy", "Cancelled"]],
]

/** A heading of a results page that slipped into a name, such as "June 18 ― 0-0 (Bo3)". */
const PAGE_HEADING = /^[A-Z][a-z]+ \d{1,2}\s*[―—–-]/

/** A stage's name without the English word an import left at its end. */
export const stageName = (name: string) => name.replace(/^(Vòng .+) Stage$/u, "$1")

/** One part of a match's name in `locale`, or null when it says nothing a reader could use. */
export function roundPart(part: string, locale: string): string | null {
  const name = stageName(part)
    .replace(/\s*\((?:bo\s*\d+)?\)$/i, "")
    .replace(/\s+matches$/i, "")
    .trim()
  if (!name || PAGE_HEADING.test(name)) return null
  for (const [pattern, wording] of PATTERNS) {
    const match = pattern.exec(name)
    if (match) return wording(match[1] ?? "")[locale.startsWith("en") ? 1 : 0]
  }
  return name
}

/** Parts of a name as one line; a number alone counts the matches of the round before it. */
function line(parts: string[], locale: string) {
  const text = localeText(locale)
  return parts.map((part, at) => (at && /^\d+$/.test(part) ? text(`trận ${part}`, `match ${part}`) : part)).join(", ")
}

const partsOf = (name: string) => name.split("·").map((part) => part.trim())

/**
 * The round of a match in `locale`, by the name an editor or an import gave it, or else by its title. A name goes
 * without its pairing, which the teams beside it show, and without `shown`. Null when nothing is left to say.
 */
export function matchRound(
  name: string | null | undefined,
  title: MatchTitle | null | undefined,
  locale: string,
  shown?: string | null,
): string | null {
  const given = name?.trim()
  if (!given) return line(partsOf(matchTitleText(title, localeText(locale)) ?? ""), locale) || null
  const parts = partsOf(given)
    .filter((part) => part && !/\bvs\.?\b/i.test(part) && part !== shown)
    .flatMap((part) => roundPart(part, locale) ?? [])
  return line(parts, locale) || null
}
