import { plainComparisonText } from "./hero-comparison"
import { formatPatchValue } from "./patch-value"
import { skillSlot } from "./hero-skills"
import type { Skill } from "./types"

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const numeric = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 })
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

function rankSummary(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(rankSummary).join(" / ")
  return formatPatchValue(clean(String(value)).replace(/^(?:lv\.?|cấp(?: chiêu)?)\s*\d+\s*:\s*/i, ""))
}

export function skillRankCount(skill?: Skill | null): number | null {
  const source = skill?.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
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
  const text = clean(value).replaceAll("−", "-")
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

export const hasRankFormula = (value: unknown) => typeof value === "string" && /\brank\b/.test(formula(value))

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
  beforeSkill?: Skill | null,
  afterSkill?: Skill | null,
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
  return {
    columns: Array.from({ length: count }, (_, index) => `Cấp ${index + 1}`),
    before: oldValues,
    after: newValues,
    changed: oldValues.map(
      (value, index) => plainComparisonText(value ?? "") !== plainComparisonText(newValues[index] ?? ""),
    ),
    summary: { before: rankSummary(before), after: rankSummary(after) },
  }
}

export function skillSourceTable(skill: Skill) {
  const source = skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
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
      summary: rankSummary(row.values),
      values: count && row.values.length === 1 ? (rankValues(row.values[0], count) ?? row.values) : row.values,
    })),
    derived: !!count,
  }
}
