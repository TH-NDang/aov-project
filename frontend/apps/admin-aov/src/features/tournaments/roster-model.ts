import type { RosterMembershipContent } from "@aov/community-contracts"

export const ROSTER_STATUSES = {
  UNKNOWN: "Chưa xác định",
  ACTIVE: "Thi đấu chính",
  SUBSTITUTE: "Dự bị",
  INACTIVE: "Không tham dự",
}

export function initialRosterMembership(teamId: string, tournamentId: string): RosterMembershipContent {
  return { teamId, tournamentId, playerId: "", lane: null, status: "UNKNOWN", verification: "UNVERIFIED" }
}

export function rosterFormIssue(content: RosterMembershipContent): string | null {
  if (!content.teamId || !content.tournamentId || !content.playerId) return "Chọn giải, đội và hồ sơ tuyển thủ."
  if (content.sourceUrl && !/^https?:\/\//i.test(content.sourceUrl.trim()))
    return "Nguồn kiểm chứng cần link http:// hoặc https://."
  if (content.verification && content.verification !== "UNVERIFIED" && !content.sourceUrl?.trim())
    return "Cần nguồn kiểm chứng cho mức xác minh đã chọn."
  if (content.startsOn && content.endsOn && content.startsOn > content.endsOn)
    return "Ngày kết thúc không được trước ngày bắt đầu."
  return null
}
