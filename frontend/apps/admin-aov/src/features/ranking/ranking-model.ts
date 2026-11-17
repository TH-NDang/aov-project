import type { RankingDetail, RankingHero, RankingMetric, RankingRole, RankingValue } from "./ranking-api"
import { formatGameNumber } from "@aov/ui/lib/game-number"
import { formatNumber, normalize, readerLocale } from "@/lib/text"

export type MetricKind = "TIER" | "PERCENT" | "AMOUNT" | "HERO"

export interface MetricInfo {
  metric: RankingMetric
  /** The column title as the game prints it, so a value is easy to find on its screenshot. */
  label: string
  short: string
  kind: MetricKind
  board: "RATES" | "FIGURES"
  /** Whether a larger number is better for the hero; drives the colour of a change. */
  higherIsBetter?: boolean
}

export const METRICS: Record<RankingMetric, MetricInfo> = {
  TIER: { metric: "TIER", label: "Tier", short: "Tier", kind: "TIER", board: "RATES" },
  WIN_RATE: {
    metric: "WIN_RATE",
    label: "Tỷ lệ thắng",
    short: "Thắng",
    kind: "PERCENT",
    board: "RATES",
    higherIsBetter: true,
  },
  PICK_RATE: { metric: "PICK_RATE", label: "Tỷ lệ chọn", short: "Chọn", kind: "PERCENT", board: "RATES" },
  BAN_RATE: { metric: "BAN_RATE", label: "Tỷ lệ cấm", short: "Cấm", kind: "PERCENT", board: "RATES" },
  COUNTER_1: {
    metric: "COUNTER_1",
    label: "Thắng nhiều khi gặp (1)",
    short: "Khắc chế 1",
    kind: "HERO",
    board: "RATES",
  },
  COUNTER_2: {
    metric: "COUNTER_2",
    label: "Thắng nhiều khi gặp (2)",
    short: "Khắc chế 2",
    kind: "HERO",
    board: "RATES",
  },
  COUNTER_3: {
    metric: "COUNTER_3",
    label: "Thắng nhiều khi gặp (3)",
    short: "Khắc chế 3",
    kind: "HERO",
    board: "RATES",
  },
  DAMAGE_DEALT: {
    metric: "DAMAGE_DEALT",
    label: "Sát thương mỗi trận",
    short: "Sát thương",
    kind: "AMOUNT",
    board: "FIGURES",
  },
  KILLS: { metric: "KILLS", label: "Hạ", short: "Hạ", kind: "AMOUNT", board: "FIGURES" },
  GOLD: { metric: "GOLD", label: "Vàng", short: "Vàng", kind: "AMOUNT", board: "FIGURES" },
  DAMAGE_TAKEN: {
    metric: "DAMAGE_TAKEN",
    label: "Sát thương phải chịu",
    short: "Chịu",
    kind: "AMOUNT",
    board: "FIGURES",
  },
  ASSISTS: { metric: "ASSISTS", label: "Phụ", short: "Phụ", kind: "AMOUNT", board: "FIGURES" },
}

export const COUNTERS: RankingMetric[] = ["COUNTER_1", "COUNTER_2", "COUNTER_3"]
export const RATE_COLUMNS: RankingMetric[] = ["WIN_RATE", "PICK_RATE", "BAN_RATE"]
export const FIGURE_COLUMNS: RankingMetric[] = ["DAMAGE_DEALT", "KILLS", "GOLD", "DAMAGE_TAKEN", "ASSISTS"]

export const ROLE_LABELS: Record<RankingRole, string> = {
  TANK: "Đỡ đòn",
  WARRIOR: "Đấu sĩ",
  ASSASSIN: "Sát thủ",
  MAGE: "Pháp sư",
  MARKSMAN: "Xạ thủ",
  SUPPORT: "Trợ thủ",
}
export const ROLE_ORDER = Object.keys(ROLE_LABELS) as RankingRole[]

/** A statistic in the reader's locale with two decimals, such as `49,42%` in Vietnamese; a tier as read: `T0`. */
export function formatValue(value: RankingValue | undefined, locale = readerLocale()): string {
  if (!value) return "—"
  if (value.tier) return value.tier
  if (value.number == null) return "—"
  const number = formatNumber(value.number, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale)
  return METRICS[value.metric].kind === "PERCENT" ? `${number}%` : number
}

/** Lower is stronger: T0 is the top tier. Unknown tiers sort last. */
export const tierRank = (tier: string | null | undefined) => (tier && /^T\d$/.test(tier) ? Number(tier[1]) : 99)

export interface RankingRow {
  hero: RankingHero
  values: Partial<Record<RankingMetric, RankingValue>>
  /** The same hero in the snapshot being compared against; absent when there is none or the hero is new there. */
  previous?: Partial<Record<RankingMetric, RankingValue>>
  comparing: boolean
}

const byMetric = (hero: RankingHero) =>
  Object.fromEntries(hero.values.map((value) => [value.metric, value])) as Partial<Record<RankingMetric, RankingValue>>

export function rankingRows(detail: RankingDetail, compare?: RankingDetail | null): RankingRow[] {
  const before = new Map(compare?.heroes.map((hero) => [hero.heroId, byMetric(hero)]) ?? [])
  return detail.heroes.map((hero) => ({
    hero,
    values: byMetric(hero),
    previous: before.get(hero.heroId),
    comparing: !!compare,
  }))
}

/** Heroes the compared snapshot had but this one does not. */
export function droppedHeroes(detail: RankingDetail, compare?: RankingDetail | null): RankingHero[] {
  if (!compare) return []
  const present = new Set(detail.heroes.map((hero) => hero.heroId))
  return compare.heroes.filter((hero) => !present.has(hero.heroId))
}

/** How a number moved since the compared snapshot, or null when either side has no number. */
export function change(row: RankingRow, metric: RankingMetric): number | null {
  const now = row.values[metric]?.number
  const then = row.previous?.[metric]?.number
  return now == null || then == null ? null : Math.round((now - then) * 100) / 100
}

/** Positive when the hero climbed tiers. */
export function tierChange(row: RankingRow): number | null {
  const now = row.values.TIER?.tier
  const then = row.previous?.TIER?.tier
  return now && then ? tierRank(then) - tierRank(now) : null
}

export function formatChange(metric: RankingMetric, delta: number, locale = readerLocale()): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±"
  const number = formatNumber(Math.abs(delta), { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale)
  return `${sign}${number}${METRICS[metric].kind === "PERCENT" ? " điểm" : ""}`
}

export function fold(text: string): string {
  return normalize(text.replace(/[’‘`]/g, "'"))
}

export type SortKey = "POSITION" | RankingMetric
export interface RankingView {
  role: RankingRole | "ALL"
  reviewOnly: boolean
  query: string
  sort: SortKey
  descending: boolean
  /** Sort by how much a column moved instead of its value, while comparing. */
  byChange: boolean
}

export const DEFAULT_VIEW: RankingView = {
  role: "ALL",
  reviewOnly: false,
  query: "",
  sort: "POSITION",
  descending: false,
  byChange: false,
}

/** Larger numbers come first by default; the game's own order and tiers read from the top. */
export const defaultDescending = (key: SortKey) => key !== "POSITION" && key !== "TIER" && METRICS[key]?.kind !== "HERO"

export const needsReview = (row: RankingRow) => Object.values(row.values).some((value) => value?.needsReview)

export function viewRows(rows: RankingRow[], view: RankingView): RankingRow[] {
  const query = fold(view.query)
  const visible = rows.filter(
    (row) =>
      (view.role === "ALL" || row.hero.roleOnScreen === view.role) &&
      (!view.reviewOnly || needsReview(row)) &&
      (!query || fold(row.hero.nameOnScreen).includes(query) || row.hero.heroCode.includes(query)),
  )
  const position = (row: RankingRow) => row.hero.ratesPosition ?? 1000 + (row.hero.figuresPosition ?? 0)
  const key = (row: RankingRow): number | null => {
    if (view.sort === "POSITION") return position(row)
    if (view.sort === "TIER") {
      if (view.byChange && row.comparing) return tierChange(row)
      const tier = row.values.TIER?.tier
      return tier ? tierRank(tier) * 1000 + position(row) : null
    }
    if (view.byChange && row.comparing) return change(row, view.sort)
    return row.values[view.sort]?.number ?? null
  }
  // Rows without a value stay at the bottom whichever way the column is sorted.
  return visible
    .map((row) => ({ row, key: key(row) }))
    .sort((a, b) => {
      if (a.key == null || b.key == null) return a.key == null ? (b.key == null ? 0 : 1) : -1
      const order = a.key - b.key || position(a.row) - position(b.row)
      return view.descending ? -order : order
    })
    .map((entry) => entry.row)
}

export function roleCounts(rows: RankingRow[]): Record<RankingRole | "ALL", number> {
  const counts = Object.fromEntries([["ALL", rows.length], ...ROLE_ORDER.map((role) => [role, 0])]) as Record<
    RankingRole | "ALL",
    number
  >
  for (const row of rows) counts[row.hero.roleOnScreen]++
  return counts
}

/** The text an editor corrects for a value: a plain number with a decimal dot, which parseNumber reads back. */
export function editText(value: RankingValue): string {
  if (value.tier) return value.tier
  if (value.number == null) return ""
  return formatGameNumber(value.number, 2)
}

/** Reads `130.189,10`, `49,42%` or `49.42` back into a number; null when the text is not a number. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[%\s]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Number(normalized)
}

const METRIC_ORDER = Object.keys(METRICS) as RankingMetric[]

/**
 * The value an editor reviews after `current`: the next one still waiting, in the game's row order and column order,
 * wrapping to the first. Null when nothing else waits.
 */
export function nextToReview(
  detail: RankingDetail,
  current: { heroId: string; metric: RankingMetric } | null,
): { heroId: string; metric: RankingMetric } | null {
  const ordered = detail.heroes.flatMap((hero) =>
    [...hero.values]
      .sort((a, b) => METRIC_ORDER.indexOf(a.metric) - METRIC_ORDER.indexOf(b.metric))
      .map((value) => ({ heroId: hero.heroId, metric: value.metric, waiting: value.needsReview })),
  )
  const at = current
    ? ordered.findIndex((entry) => entry.heroId === current.heroId && entry.metric === current.metric)
    : -1
  const next = [...ordered.slice(at + 1), ...ordered.slice(0, Math.max(at, 0))].find((entry) => entry.waiting)
  return next ? { heroId: next.heroId, metric: next.metric } : null
}
