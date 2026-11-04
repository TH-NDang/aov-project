import type { PlayerContent, TeamContent, TournamentContent, SeriesContent, RosterMembershipContent } from "./index"

export type CompetitionSlot = {
  type: "TEAM" | "SEED" | "WINNER" | "LOSER" | "TBD"
  teamId?: string | null
  seed?: number | null
  matchKey?: string | null
  label?: string | null
}
export type PlannedMatch = {
  key: string
  stageCode: string
  round: number
  label: string
  bestOf: number
  scheduledAt?: string | null
  a: CompetitionSlot
  b: CompetitionSlot
  seriesId?: string | null
}
export type CompetitionStage = {
  code: string
  name: string
  format: string
  bestOf: number
  legs: number
  winPoints: number
  lossPoints: number
  advance: number
  tieBreakers: string[]
  sourceUrl: string
  patchNote: string
}
export type CompetitionPlan = {
  circuit: string
  circuitPageId?: string | null
  organizer: string
  organizerPageId?: string | null
  timezone: string
  prizePool: string
  currency: string
  sourceUrl: string
  notes: string
  venues: { name: string; city: string; stageCode: string }[]
  entrants: { teamId: string; seed?: number | null; status: string; note: string }[]
  stages: CompetitionStage[]
  playoffSeeds: Record<number, string>
  matches: PlannedMatch[]
}
export type ResolvedMatch = {
  key: string
  teamAId?: string | null
  teamBId?: string | null
  scoreA?: number | null
  scoreB?: number | null
  seriesId?: string | null
  consistent: boolean
}
export type CompetitionStanding = {
  rank: number
  teamId: string
  played: number
  won: number
  lost: number
  gameWins: number
  gameLosses: number
  points: number
  tied: boolean
  qualified: boolean
}
export type CompetitionSnapshot = {
  circuit?: { id: string; code: string; name: string; logoUrl?: string | null; published: boolean } | null
  organizer?: { id: string; code: string; name: string; logoUrl?: string | null; published: boolean } | null
  tournament: TournamentContent
  plan: CompetitionPlan
  teams: Record<string, TeamContent>
  players: Record<string, PlayerContent>
  series: Record<string, SeriesContent>
  rosters: RosterMembershipContent[]
  resolved: ResolvedMatch[]
  standings: { stageCode: string; complete: boolean; rows: CompetitionStanding[] }[]
}
export type CompetitionView = { id: string; version: number; publishedAt?: string | null; content: CompetitionSnapshot }
export function aogStages(sourceUrl = ""): CompetitionStage[] {
  return [
    {
      code: "GROUP",
      name: "Vòng bảng",
      format: "ROUND_ROBIN",
      bestOf: 5,
      legs: 2,
      winPoints: 1,
      lossPoints: 0,
      advance: 6,
      tieBreakers: ["GAME_DIFF", "GAME_WINS"],
      sourceUrl,
      patchNote: "",
    },
    {
      code: "PLAYOFF",
      name: "Playoffs",
      format: "DOUBLE_ELIMINATION",
      bestOf: 7,
      legs: 1,
      winPoints: 1,
      lossPoints: 0,
      advance: 1,
      tieBreakers: [],
      sourceUrl,
      patchNote: "",
    },
  ]
}
export function slotLabel(slot: CompetitionSlot, teams: Record<string, TeamContent>): string {
  if (slot.type === "TEAM") return teams[slot.teamId || ""]?.name || "Đội chưa có thông tin"
  if (slot.type === "SEED") return `Hạt giống ${slot.seed}`
  if (slot.type === "WINNER" || slot.type === "LOSER")
    return `${slot.type === "WINNER" ? "Thắng" : "Thua"} ${slot.matchKey}`
  return slot.label || "Chưa xác định"
}
