import { formatPatchValue } from "./patch-value"
import { referenceInputPlainText } from "./reference-input-dom"

/** The parts of a skill that say how many levels it has, common to the admin and public skill records. */
export interface RankSkill {
  skillKey: string
  kind: string
  effects?: { effectType: string; metadata?: Record<string, unknown> | null }[]
}

const plainComparisonText = (text: string) => (text.includes("<") ? referenceInputPlainText(text) : text)

export function skillSlot(skill: RankSkill): number | null {
  const snapshot = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  if (typeof snapshot?.sourceSlot === "number" && Number.isInteger(snapshot.sourceSlot) && snapshot.sourceSlot >= 0)
    return snapshot.sourceSlot
  const match = /^skill-(\d+)-(\d+)$/.exec(skill.skillKey)
  if (match) return Number(match[1])
  if (skill.skillKey === "capture-passive") return 0
  const captured = /^capture-skill-(\d+)$/.exec(skill.skillKey)
  return captured ? Number(captured[1]) : null
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const numeric = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6, useGrouping: false })
const rankColumn = (value: unknown) => /^(?:lv\.?|cấp(?: chiêu)?)\s*(\d+)$/i.exec(String(value).trim())
const clean = (value: string) =>
  plainComparisonText(value)
    .trim()
    .replace(/^(?:Thông tin công bố|Hồi chiêu|H\.chiêu)\s*:\s*/i, "")

export interface RankComparison {
  columns: string[]
  before: (string | null)[]
  after: (string | null)[]
  changed: boolean[]
  summary: { before: string | null; after: string | null }
}

export function rankFieldLabel(label: string): string {
  return label === "Hồi chiêu" ? "Hồi chiêu (giây)" : label
}

const rankPrefix = /^(?:lv\.?|cấp(?: chiêu)?)\s*(\d+)\s*:\s*/i
const rankScalar =
  /^([+−-]?\d+(?:[.,]\d{1,6})?)\s*(%|s|giây)?(\s*\(\s*\+\d+(?:[.,]\d+)?%\s+(?:công phép|công vật lý(?: cộng thêm)?|máu tối đa)\s*\))?$/i

/** Derive the display from the recorded cells without replacing them with a guessed formula. */
export function rankSummary(value: unknown, columns?: readonly string[]): string | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return formatPatchValue(clean(String(value)).replace(rankPrefix, ""))
  const cells = value.map((item) => clean(String(item ?? "")))
  const parts = cells.map((cell) => cell.replace(rankPrefix, ""))
  const fallback = parts.map((part) => formatPatchValue(part) || "—").join(" / ")
  if (
    cells.length < 2 ||
    (columns &&
      (columns.length !== cells.length || columns.some((col, i) => Number(rankColumn(col)?.[1]) !== i + 1))) ||
    cells.some((cell, i) => rankPrefix.test(cell) && Number(cell.match(rankPrefix)![1]) !== i + 1)
  )
    return fallback
  const readings = parts.map((part) => rankScalar.exec(part))
  const first = readings[0]
  if (!first || !readings.every((reading) => reading && reading[2] === first[2] && reading[3] === first[3]))
    return fallback

  // Compare millionths as integers so decimal cooldowns do not accumulate floating-point error.
  const scale = 1_000_000
  const numbers = readings.map((reading) => Math.round(Number(reading![1].replace(",", ".").replace("−", "-")) * scale))
  const step = numbers[1] - numbers[0]
  if (!numbers.every((n, i) => Number.isSafeInteger(n) && (!i || n - numbers[i - 1] === step))) return fallback
  const unit = first[2] === "giây" ? " giây" : (first[2] ?? "")
  const suffix = first[3] ? " " + first[3].trim() : ""
  const base = numeric.format(numbers[0] / scale) + unit
  if (!step) return base + suffix
  const increment = (step > 0 ? "+" : "−") + numeric.format(Math.abs(step) / scale) + unit
  return `${base} (${increment}/cấp chiêu)${suffix}`
}

export function skillRankCount(skill?: RankSkill | null): number | null {
  const source = skill?.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  const table = record(source?.levelTable)
  const columns = Array.isArray(table?.column_labels) ? table.column_labels : []
  const ranks = columns.map(rankColumn)
  if (ranks.length > 1 && ranks.every(Boolean)) {
    const count = Math.max(...ranks.map((match) => Number(match![1])))
    return count >= 1 && count <= 18 ? count : null
  }
  if (!skill || skill.kind !== "ACTIVE") return null
  // Standard active slots are the fallback for patch notes that replace the source table with one formula.
  const slot = skillSlot(skill)
  return slot === 1 || slot === 2 ? 6 : slot === 3 ? 3 : null
}

function formula(value: string): string {
  const text = clean(value).replaceAll("−", "-").replaceAll("×", "*")
  const shorthand =
    /^(\d+(?:[.,]\d+)?)\s*(?:s|giây)?\s*\(?\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*(?:s|giây)?\s*\/\s*cấp(?: chiêu)?\s*\)?$/i.exec(
      text,
    )
  if (shorthand) return `${shorthand[1].replace(",", ".")}${shorthand[2]}${shorthand[3].replace(",", ".")}*(rank-1)`
  return text
    .replace(/công vật lý cộng thêm/gi, "bonusPhysicalAttack")
    .replace(/công vật lý/gi, "physicalAttack")
    .replace(/công phép/gi, "magicAttack")
    .replace(/máu tối đa/gi, "maxHealth")
    .replace(/cấp tướng/gi, "heroLevel")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/([+-])\s*(\d+(?:\.\d+)?)\s*(?:s|giây)?\s*\/\s*cấp(?: chiêu)?/gi, "$1$2*(rank-1)")
    .replace(/(\d+(?:\.\d+)?)\s*%\s*(physicalAttack|bonusPhysicalAttack|magicAttack|maxHealth)/g, "($1/100)*$2")
    .replace(/(\d)\s+(physicalAttack|bonusPhysicalAttack|magicAttack|maxHealth|heroLevel)/g, "$1*$2")
    .replace(/([\d)])\s*\(\s*([+-])/g, "$1$2(")
}

const percentProgression =
  /^([+−-]?\d+(?:[.,]\d+)?)\s*%\s*\(?\s*([+−-])\s*(\d+(?:[.,]\d+)?)\s*%\s*\/\s*cấp(?: chiêu)?\s*\)?$/i

export const hasRankFormula = (value: unknown) =>
  typeof value === "string" && (/\brank\b/.test(formula(value)) || percentProgression.test(clean(value)))

type Linear = { constant: number; terms: Record<string, number> }
const numberValue = (constant: number): Linear => ({ constant, terms: {} })
const scale = (value: Linear, factor: number): Linear => ({
  constant: value.constant * factor,
  terms: Object.fromEntries(Object.entries(value.terms).map(([key, coefficient]) => [key, coefficient * factor])),
})
const add = (left: Linear, right: Linear): Linear => {
  const terms = { ...left.terms }
  for (const [key, value] of Object.entries(right.terms)) terms[key] = (terms[key] ?? 0) + value
  return { constant: left.constant + right.constant, terms }
}

/** Parse only arithmetic and known stat variables. Never execute formulas or assume a hero's combat stats. */
function evaluateRank(expression: string, rank: number): Linear | null {
  const tokens = expression.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/]/g)
  if (!tokens || tokens.length > 120 || tokens.join("") !== expression.replace(/\s/g, "")) return null
  let cursor = 0
  const atom = (): Linear => {
    const token = tokens[cursor++]
    if (token === "+" || token === "-") return scale(atom(), token === "-" ? -1 : 1)
    if (token === "(") {
      const value = sum()
      if (tokens[cursor++] !== ")") throw new Error("Unclosed rank expression")
      return value
    }
    if (/^\d/.test(token ?? "")) return numberValue(Number(token))
    if (token === "rank") return numberValue(rank)
    if (["physicalAttack", "bonusPhysicalAttack", "magicAttack", "maxHealth", "heroLevel"].includes(token))
      return { constant: 0, terms: { [token]: 1 } }
    throw new Error("Unsupported rank expression")
  }
  const product = (): Linear => {
    let value = atom()
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++]
      const right = atom()
      if (operator === "/") {
        if (Object.keys(right.terms).length || right.constant === 0) throw new Error("Unsupported rank divisor")
        value = scale(value, 1 / right.constant)
      } else if (!Object.keys(right.terms).length) value = scale(value, right.constant)
      else if (!Object.keys(value.terms).length) value = scale(right, value.constant)
      else throw new Error("Nonlinear rank expression")
    }
    return value
  }
  const sum = (): Linear => {
    let value = product()
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const sign = tokens[cursor++] === "-" ? -1 : 1
      value = add(value, scale(product(), sign))
    }
    return value
  }
  try {
    const value = sum()
    return cursor === tokens.length && [value.constant, ...Object.values(value.terms)].every(Number.isFinite)
      ? value
      : null
  } catch {
    return null
  }
}

function displayLinear(value: Linear): string {
  const terms = Object.entries(value.terms).filter(([, coefficient]) => Math.abs(coefficient) > 1e-10)
  let result = value.constant || !terms.length ? numeric.format(value.constant) : ""
  for (const [key, coefficient] of terms) {
    const label = formatPatchValue(`1*${key}`).replace(/^1 × /, "")
    result += `${result ? (coefficient < 0 ? " − " : " + ") : coefficient < 0 ? "−" : ""}${numeric.format(Math.abs(coefficient))} × ${label}`
  }
  return result
}

export function rankValues(value: unknown, count: number): (string | null)[] | null {
  if (!Number.isInteger(count) || count < 1 || count > 18) return null
  if (value === null || value === undefined) return Array.from({ length: count }, () => null)
  if (Array.isArray(value)) {
    if (!value.length || !value.every((item) => typeof item === "number" || typeof item === "string")) return null
    const values = value.map((item) => clean(String(item)).replace(/^(?:lv\.?|cấp(?: chiêu)?)\s*\d+\s*:\s*/i, ""))
    if (values.length === 1) return rankValues(values[0], count)
    if (!values.every((item) => /^[-−+]?\d/.test(item))) return null
    return Array.from({ length: count }, (_, index) =>
      values[index] === undefined ? null : (rankValues(values[index], 1)?.[0] ?? values[index]),
    )
  }
  if (typeof value !== "string" && typeof value !== "number") return null
  const percent = percentProgression.exec(clean(String(value)))
  if (percent) {
    const base = Number(percent[1].replace(",", ".").replace("−", "-"))
    const step = Number(percent[3].replace(",", ".")) * (percent[2] === "+" ? 1 : -1)
    const values = Array.from({ length: count }, (_, index) => base + step * index)
    return values.every(Number.isFinite) ? values.map((number) => `${numeric.format(number)}%`) : null
  }
  const text = formula(String(value))
  const scalar = /^(-?\d+(?:[.,]\d+)?)\s*(s|giây|%)?$/i.exec(text)
  if (scalar)
    return Array.from(
      { length: count },
      () => numeric.format(Number(scalar[1].replace(",", "."))) + (scalar[2] === "%" ? "%" : ""),
    )
  if (!/\b(?:rank|physicalAttack|bonusPhysicalAttack|magicAttack|maxHealth|heroLevel)\b/.test(text)) return null
  const values = Array.from({ length: count }, (_, index) => evaluateRank(text, index + 1))
  return values.every((item) => item !== null) ? values.map((item) => displayLinear(item!)) : null
}

export function compareSkillRanks(
  before: unknown,
  after: unknown,
  beforeSkill?: RankSkill | null,
  afterSkill?: RankSkill | null,
): RankComparison | null {
  const arrayCount = Math.max(Array.isArray(before) ? before.length : 0, Array.isArray(after) ? after.length : 0)
  if (
    arrayCount < 2 &&
    !hasRankFormula(Array.isArray(before) ? before[0] : before) &&
    !hasRankFormula(Array.isArray(after) ? after[0] : after)
  )
    return null
  const count = arrayCount > 1 ? arrayCount : (skillRankCount(afterSkill) ?? skillRankCount(beforeSkill))
  if (!count || count > 18) return null
  const oldValues = rankValues(before, count)
  const newValues = rankValues(after, count)
  if (!oldValues || !newValues) return null
  const columns = Array.from({ length: count }, (_, i) => `Cấp ${i + 1}`)
  return {
    columns,
    before: oldValues,
    after: newValues,
    changed: oldValues.map(
      (value, index) => plainComparisonText(value ?? "") !== plainComparisonText(newValues[index] ?? ""),
    ),
    summary: { before: rankSummary(before, columns), after: rankSummary(after, columns) },
  }
}

const rankVariables = ["physicalAttack", "bonusPhysicalAttack", "magicAttack", "maxHealth", "heroLevel"] as const
export type RankVariable = (typeof rankVariables)[number]

/** One number a formula is made of: the value itself ("base") or the share of a stat it adds. */
export interface RankPart {
  key: "base" | RankVariable
  before: (string | null)[]
  after: (string | null)[]
  changed: boolean[]
  summary: { before: string | null; after: string | null }
}

export interface RankPartsComparison {
  columns: string[]
  parts: RankPart[]
}

/** Each rank of a recorded value as numbers, or null when a side is not a formula of known stats. */
function linearRanks(value: unknown, count: number): (Linear | null)[] | null {
  if (value === null || value === undefined) return Array.from({ length: count }, () => null)
  if (Array.isArray(value)) {
    if (value.length === 1) return linearRanks(value[0], count)
    if (value.length !== count) return null
    const items = value.map((item, index) =>
      evaluateRank(formula(clean(String(item ?? "")).replace(rankPrefix, "")), index + 1),
    )
    return items.every(Boolean) ? items : null
  }
  if (typeof value !== "string" && typeof value !== "number") return null
  const text = formula(String(value))
  // A plain percentage that rises by rank is one number already; it has no parts to show.
  if (text.includes("%")) return null
  const items = Array.from({ length: count }, (_, index) => evaluateRank(text, index + 1))
  return items.every(Boolean) ? items : null
}

const exact = (number: number) => Math.round(number * 1_000_000) / 1_000_000

/**
 * Splits a before/after formula such as "350 + 110*(rank-1) + 0.4*magicAttack" into its numbers, so each reads as
 * plain values by rank: the base, then the share of every stat it scales with, as the game writes it ("40%").
 * Returns null when neither side scales with a stat; the whole comparison already shows plain numbers then.
 */
export function splitSkillRanks(
  before: unknown,
  after: unknown,
  beforeSkill?: RankSkill | null,
  afterSkill?: RankSkill | null,
): RankPartsComparison | null {
  // A value that does not change with rank, such as "0.9*physicalAttack", splits as one value with no rank columns.
  const whole = compareSkillRanks(before, after, beforeSkill, afterSkill) ?? {
    columns: [] as string[],
    before: [],
    after: [],
    changed: [],
    summary: { before: null, after: null },
  }
  const count = Math.max(whole.columns.length, 1)
  const old = linearRanks(before, count)
  const next = linearRanks(after, count)
  if (!old || !next) return null
  const used = rankVariables.filter((key) =>
    [...old, ...next].some((linear) => linear && Math.abs(linear.terms[key] ?? 0) > 1e-10),
  )
  if (!used.length) return null

  const parts = (["base", ...used] as const).map((key): RankPart => {
    const read = (linear: Linear | null) => {
      if (!linear) return null
      const number = exact(key === "base" ? linear.constant : (linear.terms[key] ?? 0))
      // A stat's share reads as the game writes it, a percentage of the stat; a hero-level term stays a per-level number.
      return key === "base" || key === "heroLevel" ? numeric.format(number) : `${numeric.format(exact(number * 100))}%`
    }
    const oldValues = old.map(read)
    const newValues = next.map(read)
    const summary = (values: (string | null)[]) =>
      values.every((value) => value === null) ? null : count === 1 ? values[0] : rankSummary(values, whole.columns)
    return {
      key,
      before: oldValues,
      after: newValues,
      changed: oldValues.map((value, index) => value !== newValues[index]),
      summary: { before: summary(oldValues), after: summary(newValues) },
    }
  })
  // A formula made only of stat shares has no base number of its own.
  const base = parts[0]
  const noBase = [...base.before, ...base.after].every((value) => value === null || value === "0")
  return { columns: whole.columns, parts: noBase ? parts.slice(1) : parts }
}

/** The same split for one value, as the data at a patch records it. */
export function splitSkillRankValues(value: unknown, skill?: RankSkill | null) {
  const split = splitSkillRanks(null, value, skill, skill)
  return (
    split && {
      columns: split.columns,
      parts: split.parts.map(({ key, after, summary }) => ({ key, values: after, summary: summary.after })),
    }
  )
}

const partNames: Record<RankVariable, string> = {
  physicalAttack: "Tỉ lệ Công vật lý",
  bonusPhysicalAttack: "Tỉ lệ Công vật lý cộng thêm",
  magicAttack: "Tỉ lệ Công phép",
  maxHealth: "Tỉ lệ Máu tối đa",
  heroLevel: "Thêm mỗi cấp tướng",
}

/** The row label of a part: the field's own base number, or the stat whose share it is. */
export function rankPartLabel(key: RankPart["key"], fieldLabel: string): string {
  if (key !== "base") return partNames[key]
  return /(?:^|\s)gốc(?:\s|$)/i.test(fieldLabel) ? fieldLabel : `${fieldLabel} gốc`
}

export function skillSourceTable(skill: RankSkill) {
  const source = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  const table = record(source?.levelTable)
  const rawColumns = Array.isArray(table?.column_labels) ? table.column_labels.map(String) : []
  const rows = (Array.isArray(table?.rows) ? table.rows : []).flatMap((value) => {
    const row = record(value)
    return row && Array.isArray(row.display_values)
      ? [
          {
            label: String(row.label ?? "Chưa có nhãn"),
            values: row.display_values.map(String),
            reviewRequired: row.review_required === true,
          },
        ]
      : []
  })
  const derived = rows.some((row) => row.values.length === 1 && hasRankFormula(row.values[0]))
  const count = derived ? skillRankCount(skill) : null
  const columns = count
    ? Array.from({ length: count }, (_, index) => `Cấp ${index + 1}`)
    : rawColumns.map((column) => (rankColumn(column) ? `Cấp ${rankColumn(column)![1]}` : column))
  return {
    columns,
    rows: rows.map((row) => ({
      ...row,
      label: rankFieldLabel(row.label),
      summary: rankSummary(row.values, columns),
      values: count && row.values.length === 1 ? (rankValues(row.values[0], count) ?? row.values) : row.values,
    })),
    derived: !!count,
  }
}
