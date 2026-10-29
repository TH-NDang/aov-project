import type { TournamentContent } from "@aov/community-contracts"

export const TOURNAMENT_TIERS = { UNKNOWN: "Chưa xác định", S: "S-Tier", A: "A-Tier", B: "B-Tier", C: "C-Tier" }
export const COMPETITION_TYPES = {
  UNKNOWN: "Chưa xác định",
  LEAGUE: "Giải vô địch",
  CUP: "Cúp",
  QUALIFIER: "Vòng loại",
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
  const format = (value: string) => {
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN")
  }
  if (data.startsOn && data.endsOn) return `${format(data.startsOn)} — ${format(data.endsOn)}`
  if (data.startsOn) return `Từ ${format(data.startsOn)}`
  if (data.endsOn) return `Đến ${format(data.endsOn)}`
  return ""
}
