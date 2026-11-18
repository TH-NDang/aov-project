import { formatGameNumber } from "@aov/ui/lib/game-number"
/** The stats the game shows as a number, a bar and a percent, such as armor at "150 | 20%". */
const PERCENT_STATS: ReadonlySet<string> = new Set(["ARMOR", "MAGIC_DEFENSE", "ARMOR_PIERCE", "MAGIC_PIERCE"])

export const hasStatPercent = (statKey: string) => PERCENT_STATS.has(statKey)

export const formatStatNumber = (value: number) => formatGameNumber(value, 12)

/** Reads as the game shows it. A percent nobody recorded stays out rather than reading as 0%. */
export function formatStatReading(value: number | null | undefined, percent: number | null | undefined) {
  const number = value == null ? "" : formatStatNumber(value)
  if (percent == null) return number
  return `${number || "—"} | ${formatStatNumber(percent)}%`
}

export type ParsedStatReading =
  { ok: true; value: number | null; percent: number | null } | { ok: false; message: string }

const EXAMPLE = "Nhập như trong game, ví dụ 150 | 20%."
const NUMBER = /^\d+(?:[.,]\d+)?$/
const toNumber = (text: string) => Number(text.replace(",", "."))
const fail = (message: string): ParsedStatReading => ({ ok: false, message })

/** Takes what the editor typed or pasted: "150 | 20%", "150|20" or only "150" while the percent is unknown. */
export function parseStatReading(input: string): ParsedStatReading {
  const parts = input.split("|").map((part) => part.trim())
  if (parts.length > 2) return fail("Chỉ có một dấu | giữa số và phần trăm, ví dụ 150 | 20%.")
  const [number, percent] = parts

  if (percent === undefined) {
    if (!number) return { ok: true, value: null, percent: null }
    if (number.includes("%")) return fail(`Thiếu số hoặc thiếu dấu |. ${EXAMPLE}`)
    if (!NUMBER.test(number)) return fail(`Số chưa đúng. ${EXAMPLE}`)
    return { ok: true, value: toNumber(number), percent: null }
  }

  if (!number) return fail(`Thiếu số trước dấu |. ${EXAMPLE}`)
  if (!NUMBER.test(number)) return fail(`Số trước dấu | chưa đúng. ${EXAMPLE}`)
  if (!percent) return fail(`Thiếu phần trăm sau dấu |. Game ghi 0% thì nhập ${number} | 0%.`)

  const digits = percent.replace(/\s*%$/, "")
  if (!NUMBER.test(digits)) return fail("Phần trăm sau dấu | phải là số, ví dụ 20%.")
  if (toNumber(digits) > 100) return fail("Phần trăm sau dấu | phải từ 0 đến 100.")
  return { ok: true, value: toNumber(number), percent: toNumber(digits) }
}

export type StatNumbers = { baseValue?: number | null; percentValue?: number | null }

/** Reading of one stat row in a snapshot, or null when the row or its number is missing. */
export const statRowReading = (stat: StatNumbers | null | undefined) =>
  stat?.baseValue == null ? null : formatStatReading(stat.baseValue, stat.percentValue)

/** A comparison shows the number and the percent as one line, but only once a percent has been recorded. */
export function statReadingChange(
  statKey: string,
  before: StatNumbers | null | undefined,
  after: StatNumbers | null | undefined,
) {
  if (!hasStatPercent(statKey) || (before?.percentValue == null && after?.percentValue == null)) return null
  return { before: statRowReading(before), after: statRowReading(after) }
}
