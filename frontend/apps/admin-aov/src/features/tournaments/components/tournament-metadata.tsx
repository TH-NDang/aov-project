import type { TournamentContent } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"

export const TOURNAMENT_TIERS = {
  UNKNOWN: "Chưa xác định",
  S: "S-Tier",
  A: "A-Tier",
  B: "B-Tier",
  C: "C-Tier",
  D: "D-Tier",
}
export const COMPETITION_TYPES = {
  UNKNOWN: "Chưa xác định",
  LEAGUE: "Giải vô địch",
  CUP: "Cúp",
  QUALIFIER: "Vòng loại",
  SHOWMATCH: "Giao hữu / biểu diễn",
  OTHER: "Khác",
}
export const CAREER_STATUSES = {
  UNKNOWN: "Chưa xác định",
  ACTIVE: "Đang thi đấu",
  INACTIVE: "Tạm nghỉ",
  RETIRED: "Đã giải nghệ",
}
export const VENUE_MODES = { UNKNOWN: "Chưa xác định", ONLINE: "Trực tuyến", OFFLINE: "Trực tiếp", HYBRID: "Kết hợp" }
export const TOURNAMENT_STATUSES = {
  UNKNOWN: "Chưa xác định",
  ANNOUNCED: "Đã công bố",
  UPCOMING: "Sắp diễn ra",
  ONGOING: "Đang diễn ra",
  FINISHED: "Đã kết thúc",
}
export const RESULT_VERIFICATIONS = {
  UNVERIFIED: "Chưa xác minh",
  PRIMARY: "Nguồn chính",
  SECONDARY_CORROBORATED: "Nguồn phụ đã đối chiếu",
  SECONDARY_CAPTURE: "Bản lưu nguồn phụ",
  SECONDARY_PRESS_ONLY: "Báo chí nguồn phụ",
}

export function tournamentDates(data: TournamentContent) {
  if (data.startsOn && data.endsOn) return `${formatCalendarDate(data.startsOn)} — ${formatCalendarDate(data.endsOn)}`
  if (data.startsOn) return `Từ ${formatCalendarDate(data.startsOn)}`
  if (data.endsOn) return `Đến ${formatCalendarDate(data.endsOn)}`
  return ""
}
