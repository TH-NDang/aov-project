import type {
  Lane,
  PlayerContent,
  RosterMembershipContent,
  SeriesContent,
  Side,
  TeamContent,
  TournamentContent,
} from "./index"
import type { PersonRole } from "./pages"
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
  /** How heroes may be picked again within a series; absent or null when the sources do not say. */
  draftRule?: DraftRule | null
  sideSelection?: SideSelection | null
  rulesNote?: string | null
  /** Game updates used during the stage, in time order. Absent in plans saved before 23/11/2026. */
  patches?: StagePatch[]
  /** The entrants that play this stage, such as one group; absent or empty when all of them do. */
  teamIds?: string[]
}
export const DRAFT_RULES = ["GLOBAL", "STANDARD"] as const
export type DraftRule = (typeof DRAFT_RULES)[number]
export const SIDE_SELECTIONS = ["HOME_FIRST_THEN_LOSER", "OTHER"] as const
export type SideSelection = (typeof SIDE_SELECTIONS)[number]
/**
 * A game update used during a stage. `patchId` and `seasonId` point to the Wiki when it has them; until then the
 * publisher's patch notes (`sourceUrl`) and the release day stand for the update. `seasonName` lets readers show the
 * season without asking the Wiki.
 */
export type StagePatch = {
  label?: string | null
  /** yyyy-mm-dd */
  releasedOn?: string | null
  name?: string | null
  patchId?: string | null
  seasonId?: string | null
  seasonName?: string | null
  sourceUrl?: string | null
  note?: string | null
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
/** The circuit of a competition; its short name and introduction are what its page says now. */
export type CompetitionCircuit = {
  id: string
  code: string
  name: string
  logoUrl?: string | null
  published: boolean
  shortName?: string | null
  introduction?: string | null
}
/**
 * A team, player or person of published competitions, named as the newest of them names it. A player carries the team
 * of that competition's roster, a person the team they worked for and what they did. People carry no picture; the id of
 * a person is the one of their profile page.
 */
export type CompetitionParticipant = {
  id: string
  kind: "TEAM" | "PLAYER" | "PERSON"
  /** What a person did in that competition; empty for teams and players. */
  roles: PersonRole[]
  name: string
  shortName?: string | null
  country?: string | null
  imageUrl?: string | null
  imageDarkUrl?: string | null
  competitions: number
  competitionId: string
  competitionName: string
  team?: {
    id: string
    name: string
    shortName?: string | null
    logoUrl?: string | null
    logoDarkUrl?: string | null
  } | null
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
/**
 * A profile page a competition names for its broadcast or staff, as the snapshot read it. A page that was not
 * published has no `code` or picture, and readers do not link to it.
 */
export type CompetitionPerson = {
  id: string
  code?: string | null
  name: string
  avatarUrl?: string | null
  published: boolean
}
export type CompetitionSnapshot = {
  circuit?: CompetitionCircuit | null
  organizer?: { id: string; code: string; name: string; logoUrl?: string | null; published: boolean } | null
  tournament: TournamentContent
  plan: CompetitionPlan
  teams: Record<string, TeamContent>
  players: Record<string, PlayerContent>
  series: Record<string, SeriesContent>
  rosters: RosterMembershipContent[]
  resolved: ResolvedMatch[]
  standings: { stageCode: string; complete: boolean; rows: CompetitionStanding[] }[]
  /** Absent in snapshots taken before ADR-032. */
  people?: Record<string, CompetitionPerson>
}
export type CompetitionView = { id: string; version: number; publishedAt?: string | null; content: CompetitionSnapshot }
/**
 * A hero over the published games of a competition; one without an id was recorded by its name only. `wins` are the
 * picks of the side that won.
 */
export type HeroCount = {
  id?: string | null
  code?: string | null
  name: string
  iconUrl?: string | null
  picks: number
  wins: number
  bans: number
  bluePicks: number
}
/**
 * What the published games of a competition add up to; the lengths are absent while no game has one. `withBans` are the
 * games that show who was banned, which the bans of a hero are out of.
 */
export type CompetitionStatistics = {
  games: number
  decided: number
  blueWins: number
  withBans: number
  averageSeconds?: number | null
  longest?: { id: string; seconds: number } | null
  shortest?: { id: string; seconds: number } | null
  heroes: HeroCount[]
  mvps: { playerId: string; games: number }[]
}
/** A hero the games of a competition name; one without an id was recorded by its name only. */
export type LineupHero = { id?: string | null; code?: string | null; name: string; iconUrl?: string | null }
/** A player the games of a competition name; `name` is the nickname in the newest of them that knew one. */
export type LineupPlayer = { id: string; name?: string | null }
/** `hero` and `player` are places in the lists of the answer; `turn` counts all turns of a draft whose order is known. */
export type LineupPick = { hero: number; lane?: Lane | null; player?: number | null; turn?: number | null }
export type LineupBan = { hero: number; turn?: number | null }
/** A game whose two sides list no ban is one whose bans nobody wrote down. */
export type LineupTeam = { teamId?: string | null; picks: LineupPick[]; bans: LineupBan[] }
export type LineupGame = {
  id: string
  seriesId: string
  number?: number | null
  winner?: Side | null
  seconds?: number | null
  mvp?: number | null
  blue?: LineupTeam | null
  red?: LineupTeam | null
}
/** Every published game of a competition in short: who picked and banned what, and how it ended. */
export type CompetitionLineups = { heroes: LineupHero[]; players: LineupPlayer[]; games: LineupGame[] }
export type BuildPart = { id?: string | null; name: string; iconUrl?: string | null; tier?: number | null }
/** Parts are places in the lists of the answer. `items` were held to the end; the other two lists may be absent. */
export type HeroBuild = {
  gameId: string
  spell?: number | null
  enchantment?: number | null
  items: number[]
  replaced?: number[]
  situational?: number[]
}
/** What a hero was played with in the published games of a competition. */
export type HeroBuilds = { spells: BuildPart[]; enchantments: BuildPart[]; items: BuildPart[]; builds: HeroBuild[] }
/** One entry of a plan's history, without the plan itself. */
export type CompetitionRevision = {
  id: string
  action: "SAVE" | "MATERIALIZE" | "PUBLISH" | "WITHDRAW"
  createdAt: string
  entrants: number
  stages: number
  matches: number
}
/**
 * How a bracket is drawn: the seeds it holds, whether the losing semifinalists play for third place, and the seed that
 * seed one chose to meet in the AOG playoffs (a double elimination of six).
 */
export type BracketOptions = { teams?: number | null; thirdPlace?: boolean; opponent: number }
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
      patches: [],
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
      patches: [],
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
