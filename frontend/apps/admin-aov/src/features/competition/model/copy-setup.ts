import type {
  CompetitionPlan,
  CompetitionStage,
  DocumentView,
  RosterMembershipContent,
  TournamentContent,
} from "@aov/community-contracts"
import type { RosterBatch } from "@/features/tournaments/api/tournament-api"

/** What a new season may take over from an earlier tournament. Matches, results and final tables never carry over. */
export const COPY_PARTS = ["info", "entrants", "rosters", "stages", "staff", "broadcast"] as const
export type CopyPart = (typeof COPY_PARTS)[number]

export const COPY_PART_LABELS: Record<CopyPart, string> = {
  info: "Tổ chức, hệ thống giải, múi giờ, tiền tệ và địa điểm",
  entrants: "Đội tham dự",
  rosters: "Đội hình của các đội",
  stages: "Giai đoạn, thể thức và luật",
  staff: "Ban huấn luyện",
  broadcast: "Ê-kíp phát sóng",
}

/** Game updates belong to the season they were played in, so a copied stage starts without any. */
export const copiedStages = (stages: readonly CompetitionStage[], sourceUrl = ""): CompetitionStage[] =>
  stages.map((stage) => ({ ...stage, sourceUrl, patches: [], teamIds: [] }))

/** A roster line as it starts in another tournament: who plays where, without the old dates, source and note. */
const copiedLine = (line: RosterMembershipContent, tournamentId: string): RosterMembershipContent => ({
  tournamentId,
  teamId: line.teamId,
  playerId: line.playerId,
  lane: line.lane ?? null,
  jerseyNumber: line.jerseyNumber ?? null,
  status: line.status ?? "UNKNOWN",
  startsOn: null,
  endsOn: null,
  sourceUrl: null,
  verification: "UNVERIFIED",
  note: null,
})

/**
 * The lines of earlier rosters a tournament does not have yet. Players who left a team stay behind, and so does a
 * player already listed for that team.
 */
export function copiedRoster(
  from: readonly RosterMembershipContent[],
  tournamentId: string,
  existing: readonly RosterMembershipContent[],
  teamIds?: ReadonlySet<string>,
): RosterMembershipContent[] {
  const taken = new Set(existing.map((line) => `${line.teamId}:${line.playerId}`))
  return from
    .filter((line) => line.status !== "INACTIVE" && (!teamIds || teamIds.has(line.teamId)))
    .filter((line) => !taken.has(`${line.teamId}:${line.playerId}`))
    .map((line) => copiedLine(line, tournamentId))
}

/** The plan with the chosen parts of another one taken over. Teams already entered stay, stages are replaced. */
export function planWithCopy(
  plan: CompetitionPlan,
  source: CompetitionPlan,
  parts: ReadonlySet<CopyPart>,
): CompetitionPlan {
  const next = { ...plan }
  if (parts.has("info")) {
    next.circuit = source.circuit
    next.circuitPageId = source.circuitPageId
    next.organizer = source.organizer
    next.organizerPageId = source.organizerPageId
    next.timezone = source.timezone
    next.currency = source.currency
    next.venues = source.venues.map((venue) => ({ ...venue, stageCode: parts.has("stages") ? venue.stageCode : "" }))
  }
  if (parts.has("stages")) next.stages = copiedStages(source.stages, plan.sourceUrl)
  if (parts.has("entrants")) {
    const entered = new Set(plan.entrants.map((entry) => entry.teamId))
    next.entrants = [
      ...plan.entrants,
      ...source.entrants
        .filter((entry) => entry.status !== "WITHDRAWN" && !entered.has(entry.teamId))
        .map((entry) => ({ teamId: entry.teamId, status: "REGISTERED", note: "" })),
    ]
  }
  return next
}

/** The tournament record with the people of another one: staff of the teams taken over and the broadcast crew. */
export function tournamentWithCopy(
  content: TournamentContent,
  source: TournamentContent,
  parts: ReadonlySet<CopyPart>,
  teamIds: ReadonlySet<string>,
): TournamentContent {
  const next = { ...content }
  if (parts.has("broadcast")) next.broadcast = source.broadcast
  if (parts.has("staff")) {
    const kept = content.staff ?? []
    const has = (line: NonNullable<TournamentContent["staff"]>[number]) =>
      kept.some((row) => row.teamId === line.teamId && row.pageId === line.pageId && row.role === line.role)
    next.staff = [...kept, ...(source.staff ?? []).filter((line) => teamIds.has(line.teamId) && !has(line))]
  }
  return next
}

/** One write per 500 lines, the most the server takes at once. */
export function rosterBatches(lines: RosterMembershipContent[]): RosterBatch[] {
  const batches: RosterBatch[] = []
  for (let at = 0; at < lines.length; at += 500) batches.push({ create: lines.slice(at, at + 500) })
  return batches
}

export const rosterContents = (rows: readonly DocumentView<RosterMembershipContent>[]) => rows.map((row) => row.content)
