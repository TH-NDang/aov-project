import type { PlayerContent, TeamContent, TournamentContent, SeriesContent, RosterMembershipContent } from "./index"
import { matchName, type MatchTitle, type TitleText } from "./match-titles.ts"

export type CompetitionSlot = {
  type: "TEAM" | "SEED" | "WINNER" | "LOSER" | "TBD"
  teamId?: string | null
  seed?: number | null
  matchKey?: string | null
  label?: string | null
}
/**
 * A match of a competition plan. `title` says what it is in its stage, worded by `matchName`; `label` is a name an
 * editor typed, shown instead when set. Matches saved before titles carry only their `label`.
 */
export type PlannedMatch = {
  key: string
  stageCode: string
  round: number
  label?: string | null
  title?: MatchTitle | null
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
export type CompetitionSummary = {
  id: string
  entrants: number
  matches: number
  publishedAt?: string | null
  tournament: TournamentContent
}
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
/**
 * How one side of a planned match reads before its team is known, in the language `text` picks: the seeded team or
 * the seed, the match it comes from, or the editor's description of an open slot.
 */
export function slotLabel(
  slot: CompetitionSlot,
  plan: Pick<CompetitionPlan, "matches" | "playoffSeeds">,
  teams: Record<string, TeamContent>,
  text: TitleText,
): string {
  if (slot.type === "TEAM")
    return teams[slot.teamId || ""]?.name || text("Đội chưa có thông tin", "No team information yet")
  if (slot.type === "SEED") {
    const seeded = plan.playoffSeeds[slot.seed ?? 0]
    return (seeded && teams[seeded]?.name) || text(`Hạt giống ${slot.seed}`, `Seed ${slot.seed}`)
  }
  if (slot.type === "WINNER" || slot.type === "LOSER") {
    const source = plan.matches.find((match) => match.key === slot.matchKey)
    const name = (source && matchName(source, text)) || slot.matchKey || ""
    return slot.type === "WINNER"
      ? text(`Thắng ${name}`, `Winner of ${name}`)
      : text(`Thua ${name}`, `Loser of ${name}`)
  }
  return slot.label?.trim() || text("Chưa xác định", "TBD")
}
