import type { Lane, Side, TournamentContent } from "@aov/community-contracts"

export type StagePhase = "GROUP" | "UPPER" | "LOWER" | "FINAL" | "OTHER"
export type StageInfo = { code: string; label: string; phase: StagePhase; order: number }

const ROUND_NAMES: Record<string, { label: string; order: number }> = {
  ROUND_OF_16: { label: "Vòng 1/8", order: 1 },
  QUARTERFINAL: { label: "Tứ kết", order: 2 },
  SEMIFINAL: { label: "Bán kết", order: 3 },
  FINAL: { label: "Chung kết", order: 4 },
}

/** Maps a stored stage code (or free text) to a display label and its place in the competition. */
export function stageInfo(stage?: string | null): StageInfo {
  const code = (stage ?? "").trim()
  if (!code) return { code: "", label: "Chưa phân vòng", phase: "OTHER", order: 99 }
  const regular = code.match(/^(?:REGULAR_SEASON|GROUP_STAGE)(?:_(FIRST|SECOND|THIRD)_LEG)?$/)
  if (regular) {
    const leg = { FIRST: "Lượt đi", SECOND: "Lượt về", THIRD: "Lượt 3" }[regular[1] ?? ""]
    return {
      code,
      label: leg ? `Vòng bảng · ${leg}` : "Vòng bảng",
      phase: "GROUP",
      order: { FIRST: 1, SECOND: 2, THIRD: 3 }[regular[1] ?? ""] ?? 0,
    }
  }
  if (code === "GRAND_FINAL") return { code, label: "Chung kết tổng", phase: "FINAL", order: 40 }
  const bracket = code.match(/^(UPPER|LOWER)_BRACKET_(ROUND_(\d+)|ROUND_OF_16|QUARTERFINAL|SEMIFINAL|FINAL)$/)
  if (bracket) {
    const side = bracket[1] === "UPPER" ? "nhánh thắng" : "nhánh thua"
    const numbered = bracket[3] ? Number(bracket[3]) : null
    const round = numbered ? { label: `Vòng ${numbered}`, order: numbered } : ROUND_NAMES[bracket[2]]
    return {
      code,
      label: `${round.label} ${side}`,
      phase: bracket[1] === "UPPER" ? "UPPER" : "LOWER",
      order: (bracket[1] === "UPPER" ? 10 : 20) + round.order,
    }
  }
  return { code, label: code, phase: "OTHER", order: 90 }
}

export const PHASE_LABELS: Record<StagePhase, string> = {
  GROUP: "Vòng bảng",
  UPPER: "Nhánh thắng",
  LOWER: "Nhánh thua",
  FINAL: "Chung kết",
  OTHER: "Khác",
}

export const LANE_LABELS: Record<Lane, { name: string; short: string }> = {
  TOP: { name: "Đường Caesar", short: "Caesar" },
  JUNGLE: { name: "Đi rừng", short: "Rừng" },
  MID: { name: "Đường giữa", short: "Giữa" },
  DRAGON: { name: "Đường Rồng", short: "Rồng" },
  SUPPORT: { name: "Trợ thủ", short: "Trợ thủ" },
}
export const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]

export const SIDE_LABELS: Record<Side, string> = { BLUE: "Đội Xanh", RED: "Đội Đỏ" }

export const TIER_LABELS: Record<NonNullable<TournamentContent["tier"]>, string> = {
  S: "S-Tier",
  A: "A-Tier",
  B: "B-Tier",
  C: "C-Tier",
  UNKNOWN: "Chưa xếp hạng",
}

export const STATUS_LABELS: Record<NonNullable<TournamentContent["status"]>, string> = {
  ONGOING: "Đang diễn ra",
  UPCOMING: "Sắp diễn ra",
  ANNOUNCED: "Đã công bố",
  FINISHED: "Đã kết thúc",
  UNKNOWN: "Chưa rõ",
}

export const FORMAT_LABELS: Record<NonNullable<TournamentContent["competitionType"]>, string> = {
  LEAGUE: "Giải vô địch",
  CUP: "Cúp",
  QUALIFIER: "Vòng loại",
  UNKNOWN: "Chưa rõ",
}

export const VENUE_LABELS: Record<NonNullable<TournamentContent["venueMode"]>, string> = {
  OFFLINE: "Thi đấu trực tiếp",
  ONLINE: "Trực tuyến",
  HYBRID: "Kết hợp",
  UNKNOWN: "Chưa rõ",
}

const REGION_NAMES: Record<string, string> = {
  VN: "Việt Nam",
  TH: "Thái Lan",
  TW: "Đài Loan",
  "TW/HK/MO": "Đài Loan / Hồng Kông / Ma Cao",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  SG: "Singapore",
  GLOBAL: "Quốc tế",
}
export const regionName = (code?: string | null) => (code && REGION_NAMES[code]) || code || "Chưa rõ khu vực"

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
const dayFormat = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })
const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" })

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDate = (value?: string | null) => {
  const date = parseDate(value)
  return date ? dateFormat.format(date) : ""
}
export const formatDay = (value?: string | null) => {
  const date = parseDate(value)
  return date ? dayFormat.format(date) : ""
}
export const formatTime = (value?: string | null) => {
  const date = parseDate(value)
  return date ? timeFormat.format(date) : ""
}

const exactDateFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})
const DAY_MS = 86_400_000
const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * Calendar-day words for dates near today (today, yesterday, 3 days ago, tomorrow); further away the short
 * date, with the year only when it is not this year.
 */
export function relativeDay(value?: string | null, now = new Date()) {
  const date = parseDate(value)
  if (!date) return ""
  const day = (moment: Date) => new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime()
  const days = Math.round((day(date) - day(now)) / DAY_MS)
  if (days === 0) return "Hôm nay"
  if (days === -1) return "Hôm qua"
  if (days === 1) return "Ngày mai"
  if (days < 0 && days > -7) return `${-days} ngày trước`
  if (days > 0 && days < 7) return `${days} ngày nữa`
  return date.getFullYear() === now.getFullYear() ? dayFormat.format(date) : dateFormat.format(date)
}

/** The full date, plus the time when the value carries one and it is wanted, for tooltips under relative dates. */
export function exactDate(value?: string | null, withTime = true) {
  const date = parseDate(value)
  if (!date) return ""
  const text = exactDateFormat.format(date)
  return withTime && value && !dateOnly(value) ? `${text}, ${timeFormat.format(date)}` : text
}

export function dateRange(startsOn?: string, endsOn?: string) {
  if (startsOn && endsOn) return `${formatDate(startsOn)} – ${formatDate(endsOn)}`
  if (startsOn) return `Từ ${formatDate(startsOn)}`
  if (endsOn) return `Đến ${formatDate(endsOn)}`
  return "Chưa có lịch"
}

/** Share of the scheduled calendar that has elapsed, clamped to [0, 1]; null when dates are unknown. */
export function seasonProgress(startsOn?: string, endsOn?: string, now = Date.now()) {
  const start = parseDate(startsOn)?.getTime()
  const end = parseDate(endsOn)?.getTime()
  if (start === undefined || end === undefined || end <= start) return null
  return Math.min(1, Math.max(0, (now - start) / (end - start + 86_400_000)))
}
