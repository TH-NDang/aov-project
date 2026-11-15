import { formatPatchValue } from "@aov/ui/lib/patch-value"
import {
  compareSkillRanks,
  rankPartLabel,
  splitSkillRanks,
  type RankPart,
  type RankSkill,
} from "@aov/ui/lib/skill-rank-values"
import { formatChangeValue, type HeroChangeItem } from "../../lib/wiki-change-format"

/** A level's value this short is a plain number, so a row of levels fits a phone as a table. */
const PLAIN_CELL = 8

const ENGLISH_RANK_TERMS: [RegExp, string][] = [
  [/Công vật lý cộng thêm/g, "bonus physical attack"],
  [/Công vật lý/g, "physical attack"],
  [/Công phép/g, "magic attack"],
  [/Máu tối đa/g, "max HP"],
  [/cấp chiêu/g, "skill level"],
  [/cấp tướng/g, "hero level"],
  [/Cấp (\d+)/g, "Lv $1"],
  [/^Thêm mỗi /, "Per "],
]

/** Rank values are worded in Vietnamese by the shared formula reader. */
function rankText(value: string | null, locale: string) {
  if (!value) return "—"
  if (!locale.startsWith("en")) return value
  return ENGLISH_RANK_TERMS.reduce((text, [term, english]) => text.replace(term, english), value)
}

/** The stat a share is taken from, as the shared formula reader names it. */
const statName = (key: RankPart["key"]) => formatPatchValue(`1*${key}`).replace(/^1 × /, "")

/**
 * One side of a formula the way the glossary teaches to read it: the base with its growth by skill level in brackets,
 * then the share of each stat, as in "350 (+110 a level) + 40% of magic attack". Null when that side has no value.
 */
export function formulaSide(parts: RankPart[], side: "before" | "after") {
  if (parts.every((part) => part.summary[side] === null)) return null
  // What the base gains with the hero's level reads right after the base, before the stats it adds.
  const place = (part: RankPart) => (part.key === "base" ? 0 : part.key === "heroLevel" ? 1 : 2)
  const terms = [...parts]
    .sort((first, second) => place(first) - place(second))
    .flatMap((part) => {
      const value = part.summary[side]
      // A term only the other side has counts as zero here, and a zero term is not written.
      if (value === null || part[side].every((cell) => cell === null || /^0%?$/.test(cell))) return []
      if (part.key === "base") return [value]
      return [part.key === "heroLevel" ? `${value} × ${statName(part.key)}` : `${value} ${statName(part.key)}`]
    })
  if (!terms.length) return "0"
  return terms.reduce((text, term) => (/^[−-]/.test(term) ? `${text} − ${term.slice(1)}` : `${text} + ${term}`))
}

/**
 * A value outside skill levels. The shared wording gives up on a whole value when it cannot read one term, such as the
 * range in "200~396 + 0.3*bonusPhysicalAttack". The terms it can read are still worded, a range takes the dash other
 * notes write it with, and anything else stays as published.
 */
export function readableValue(value: string | null | undefined, locale: string) {
  const whole = formatChangeValue(value, locale)
  if (!value || whole !== value) return whole
  let worded = false
  const terms = value.split(/\s([+-])\s/).map((term, index) => {
    if (index % 2) return term
    const read = term ? formatChangeValue(term, locale) : term
    if (read !== term) worded = true
    return read.replace(/^(\d+(?:\.\d+)?)~(\d+(?:\.\d+)?)$/, "$1–$2")
  })
  return worded ? terms.map((term, index) => (index % 2 && term === "-" ? "−" : term)).join(" ") : value
}

/** A mechanic's key is sometimes written for readers, such as a skill's name, and sometimes a code like "self-heal". */
export const writtenForReaders = (key: string | null | undefined) => (key && /[^\w.:-]/.test(key) ? key : null)

/** A value at each skill level, before and after, with the levels where the two differ. */
export interface LevelRows {
  before: string[]
  after: string[]
  changed: boolean[]
}

/** What a formula adds on top of its base: the share of one stat, the same at every skill level. */
export interface ShareLine {
  key: string
  name: string
  before: string
  after: string
}

export interface LevelTable {
  columns: string[]
  rows: LevelRows
  shares: ShareLine[]
}

/**
 * How one recorded change reads. Plain numbers by skill level are a table and nothing else. Every other value is a
 * before and an after; one that grows by skill level can also be read level by level.
 */
export type ChangeValues =
  { view: "levels"; table: LevelTable } | { view: "pair"; before: string; after: string; table?: LevelTable }

const worded = (cells: (string | null)[], locale: string) => cells.map((cell) => rankText(cell, locale))

/** Reads the before and after of a change of one field. `label` is the field's name as the reader sees it. */
export function readChangeValues(
  change: Pick<HeroChangeItem, "oldValue" | "newValue">,
  skill: RankSkill | undefined,
  label: string,
  locale: string,
): ChangeValues {
  const ranks = compareSkillRanks(change.oldValue, change.newValue, skill, skill)
  const split = splitSkillRanks(change.oldValue, change.newValue, skill, skill)
  const columns = ranks ? worded(ranks.columns, locale) : []
  const rows = (source: { before: (string | null)[]; after: (string | null)[]; changed: boolean[] }): LevelRows => ({
    before: worded(source.before, locale),
    after: worded(source.after, locale),
    changed: source.changed,
  })
  const plain = (source: { before: (string | null)[]; after: (string | null)[] }) =>
    [...source.before, ...source.after].every((cell) => (cell ?? "").length <= PLAIN_CELL)

  if (ranks && plain(ranks)) return { view: "levels", table: { columns, rows: rows(ranks), shares: [] } }

  const side = (name: "before" | "after", value: string | null | undefined) =>
    split
      ? rankText(formulaSide(split.parts, name), locale)
      : ranks
        ? rankText(ranks.summary[name], locale)
        : readableValue(value, locale)
  const pair = { view: "pair" as const, before: side("before", change.oldValue), after: side("after", change.newValue) }
  if (!ranks) return pair

  // A formula's levels are tabled by its base number; the stats it adds follow on lines of their own.
  const base = split?.parts.find((part) => part.key === "base")
  const shares = split?.parts.filter((part) => part.key !== "base") ?? []
  const steady = shares.every((part) => new Set(part.before).size <= 1 && new Set(part.after).size <= 1)
  if (!base || !steady || !plain(base)) return { ...pair, table: { columns, rows: rows(ranks), shares: [] } }
  return {
    ...pair,
    table: {
      columns,
      rows: rows(base),
      shares: shares.map((part) => ({
        key: part.key,
        name: rankText(part.key === "heroLevel" ? rankPartLabel(part.key, label) : `+ ${statName(part.key)}`, locale),
        before: rankText(part.before[0] ?? null, locale),
        after: rankText(part.after[0] ?? null, locale),
      })),
    },
  }
}
