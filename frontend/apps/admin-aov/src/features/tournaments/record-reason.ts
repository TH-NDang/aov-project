import type { DocumentView, PlayerContent, RankContext, TeamContent, TournamentContent } from "@aov/community-contracts"
import { calendarDaysBetween, currentTimeZone } from "@aov/ui/lib/time-zone"
import { dateRange, formatDate } from "@/features/esports/model/labels"
import { registrySearchText } from "./registry-form-model"
import { TEAM_REGIONS } from "./team-region"

export type RecordKind = "teams" | "players" | "tournaments"
type RecordContent = TeamContent | PlayerContent | TournamentContent

export const recordName = (kind: RecordKind, content: RecordContent) =>
  kind === "players" ? (content as PlayerContent).nickname : (content as TeamContent | TournamentContent).name

export const recordIcon = (kind: RecordKind, content: RecordContent) =>
  kind === "players"
    ? ((content as PlayerContent).photoUrl ?? undefined)
    : ((content as TeamContent | TournamentContent).logoUrl ?? undefined)

const CONTEXT_LABELS: Record<RankContext, string> = {
  TEAM_IN_TOURNAMENT: "Trong đội hình giải này",
  TEAM: "Từng ở đội này",
  TOURNAMENT: "Trong giải này",
  PARTICIPANT: "Đã tham gia",
}

/** Why a row sits where it does: what it has to do with the picker it is in, then when it was last active. */
export function recordReason(kind: RecordKind, row: DocumentView<RecordContent>) {
  const context = row.context ? CONTEXT_LABELS[row.context] : null
  if (kind === "tournaments") {
    const content = row.content as TournamentContent
    const dates = dateRange(content.startsOn ?? undefined, content.endsOn ?? undefined)
    return context ? `${context} · ${dates}` : dates
  }
  const active = activityLabel(row.lastActiveOn)
  return context ? `${context} · ${active}` : active
}

export const activityLabel = (lastActiveOn?: string | null) =>
  lastActiveOn ? `Hoạt động ${formatDate(lastActiveOn)}` : "Chưa ghi nhận trận nào"

/** How a tournament stands against today, for the list that ranks by it. Empty once it is too far back to matter. */
export function tournamentTiming(
  content: Pick<TournamentContent, "startsOn" | "endsOn" | "status">,
  now = new Date(),
  timeZone = currentTimeZone(),
) {
  const { startsOn, endsOn, status } = content
  if (!startsOn && !endsOn) return ""
  const untilStart = startsOn ? calendarDaysBetween(now, startsOn, timeZone) : null
  const untilEnd = endsOn ? calendarDaysBetween(now, endsOn, timeZone) : null
  if (untilStart !== null && untilStart > 0)
    return untilStart === 1 ? "Bắt đầu ngày mai" : `Bắt đầu sau ${untilStart} ngày`
  if (untilEnd === null) return ""
  if (untilEnd < 0) return untilEnd >= -365 ? `Kết thúc ${-untilEnd} ngày trước` : ""
  if (status === "FINISHED") return ""
  return untilEnd === 0 ? "Kết thúc hôm nay" : `Còn ${untilEnd} ngày`
}

/** Regions a search names, by code or by name, so that typing a place still finds its tournaments. */
export function regionsNamedBy(search: string) {
  const wanted = registrySearchText(search)
  if (!wanted) return []
  return TEAM_REGIONS.filter((region) => registrySearchText(`${region.id} ${region.name}`).includes(wanted)).map(
    (region) => region.id,
  )
}
