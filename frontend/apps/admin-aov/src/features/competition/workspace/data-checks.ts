import type {
  CompetitionPlan,
  CompetitionStage,
  DocumentView,
  GameContent,
  Lane,
  PlannedMatch,
  PlayerContent,
  ResolvedMatch,
  RosterMembershipContent,
  SeriesContent,
  StaffMember,
  TeamContent,
  TournamentContent,
  TournamentStatus,
} from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { LANE_ORDER } from "@/lib/lanes"
import { statusConflict } from "@/features/tournaments/model/tournament-status"
import { decidesSeries, inferredLinks, matchPasses, scoreFromGames, stagesByDate } from "../model/schedule-model"
import { hasScore, isLeagueStage, layoutBracket } from "./model"
import type { GamePatchScope } from "@/features/tournaments/api/tournament-api"

/**
 * A data fault Admin can see in one tournament, with what its fix needs (spec 04, the data check panel). Each kind is
 * a code; the panel words it.
 */
export type DataIssue =
  | {
      kind: "STAFF_OFF_TEAMS"
      key: string
      staff: StaffMember
      /** The tournament team that bears the same core name, when exactly one does. */
      suggestedTeamId?: string
    }
  | {
      kind: "ROSTER_SAME_PERSON"
      key: string
      teamId: string
      rows: [DocumentView<RosterMembershipContent>, DocumentView<RosterMembershipContent>]
    }
  | {
      kind: "PLAYS_WITHOUT_ROSTER"
      key: string
      teamId: string
      /** The team with a roster here, no match here and the same core name, when exactly one fits. */
      rosterTeamId?: string
      rosterRows: DocumentView<RosterMembershipContent>[]
    }
  | { kind: "UNLINKED_MVP"; key: string; games: number }
  | { kind: "GAMES_OUTSIDE_PATCH_RANGE"; key: string; games: number; firstLineOn?: string }
  /** Scores the winners of the recorded games contradict. */
  | { kind: "SCORE_DIFFERS"; key: string; matches: number }
  /** Matches without a score whose recorded games already decide them. */
  | { kind: "SCORE_UNREAD"; key: string; matches: number }
  | {
      kind: "ROSTER_LANES"
      key: string
      teamId: string
      /** Lanes with more than one starter, and lanes without any. */
      crowded: Lane[]
      empty: Lane[]
    }
  | { kind: "PLAYER_TWO_TEAMS"; key: string; playerId: string; teamIds: string[] }
  | { kind: "SERIES_OUTSIDE_PLAN"; key: string; series: DocumentView<SeriesContent>[] }
  | { kind: "STAGE_ORDER"; key: string; stages: CompetitionStage[] }
  | { kind: "BRACKET_LOOSE"; key: string; stageCode: string; stageName: string; links: number }
  | { kind: "OUTSIDE_DATES"; key: string; matches: number; from: string; to: string }
  | { kind: "TEAM_TWICE"; key: string; teamId: string; matchKeys: [string, string] }
  | { kind: "STATUS_STALE"; key: string; status: TournamentStatus; reason: string }

export type DataCheckInput = {
  plan: Pick<CompetitionPlan, "entrants"> & {
    stages?: CompetitionPlan["stages"]
    matches?: PlannedMatch[]
    timezone?: string
  }
  staff: readonly StaffMember[]
  rosters: readonly DocumentView<RosterMembershipContent>[]
  series: readonly DocumentView<SeriesContent>[]
  games?: readonly DocumentView<GameContent>[]
  /** Teams by id, including teams named only by a staff line. */
  teams: Record<string, TeamContent | undefined>
  /** Players by id, at least everyone on a roster of the tournament. */
  players: ReadonlyMap<string, PlayerContent> | undefined
  /** Where each game's patch comes from, by game id (spec 04, patch ranges). */
  patchScopes?: ReadonlyMap<string, GamePatchScope>
  /** How the plan's matches stand now, by key; the checks of the schedule wait for it. */
  resolved?: ReadonlyMap<string, ResolvedMatch>
  /** The tournament record, for its dates and status. */
  tournament?: TournamentContent
}

const TEAM_WORDS =
  /\b(team|esports?|e-sports?|gaming|club|the|vn|vietnam|viet nam|th|thailand|id|indonesia|tw|taiwan)\b/g

/** The name of a team without the words that only say what it is or where it plays, letters and digits only. */
export function coreTeamName(name: string | undefined | null) {
  return foldSearchText(name ?? "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(TEAM_WORDS, " ")
    .replace(/\s+/g, "")
}

function coreNamesOf(team: TeamContent | undefined) {
  if (!team) return new Set<string>()
  return new Set(
    [team.name, team.shortName, ...(team.aliases ?? [])].map(coreTeamName).filter((name) => name.length > 1),
  )
}

function playerNames(player: PlayerContent | undefined) {
  if (!player) return new Set<string>()
  return new Set(
    [player.nickname, ...(player.aliases ?? [])].map((name) => foldSearchText(name ?? "").trim()).filter(Boolean),
  )
}

/** The one team among `candidates` whose core names meet `team`'s; none when no team or several do. */
function sameNamedTeam(teamId: string, candidates: Iterable<string>, teams: DataCheckInput["teams"]) {
  const names = coreNamesOf(teams[teamId])
  if (!names.size) return undefined
  const found = [...candidates].filter(
    (other) => other !== teamId && [...coreNamesOf(teams[other])].some((name) => names.has(name)),
  )
  return found.length === 1 ? found[0] : undefined
}

export function dataIssues(input: DataCheckInput): DataIssue[] {
  const issues: DataIssue[] = []
  const rosterTeams = new Set(input.rosters.map((row) => row.content.teamId))
  const seriesTeams = new Set(input.series.flatMap((row) => [row.content.teamAId, row.content.teamBId]))
  const tournamentTeams = new Set([...input.plan.entrants.map((entry) => entry.teamId), ...rosterTeams, ...seriesTeams])

  for (const staff of input.staff) {
    if (tournamentTeams.has(staff.teamId)) continue
    issues.push({
      kind: "STAFF_OFF_TEAMS",
      key: `staff:${staff.teamId}:${staff.pageId}:${staff.role}`,
      staff,
      suggestedTeamId: sameNamedTeam(staff.teamId, tournamentTeams, input.teams),
    })
  }

  const byTeam = new Map<string, DocumentView<RosterMembershipContent>[]>()
  for (const row of input.rosters) byTeam.set(row.content.teamId, [...(byTeam.get(row.content.teamId) ?? []), row])
  if (input.players) {
    for (const [teamId, rows] of byTeam) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const [a, b] = [rows[i]!, rows[j]!]
          if (a.content.playerId === b.content.playerId) continue
          const names = playerNames(input.players.get(a.content.playerId))
          if (![...playerNames(input.players.get(b.content.playerId))].some((name) => names.has(name))) continue
          issues.push({ kind: "ROSTER_SAME_PERSON", key: `same:${a.id}:${b.id}`, teamId, rows: [a, b] })
        }
      }
    }
  }

  const benchOnly = [...rosterTeams].filter((teamId) => !seriesTeams.has(teamId))
  for (const teamId of seriesTeams) {
    if (!teamId || rosterTeams.has(teamId)) continue
    const rosterTeamId = sameNamedTeam(teamId, benchOnly, input.teams)
    issues.push({
      kind: "PLAYS_WITHOUT_ROSTER",
      key: `roster:${teamId}`,
      teamId,
      rosterTeamId,
      rosterRows: rosterTeamId ? (byTeam.get(rosterTeamId) ?? []) : [],
    })
  }

  const unlinked = (input.games ?? []).filter(
    (game) => !game.content.mvpPlayerId && /(^|\n)MVP: \S/.test(game.content.note ?? ""),
  ).length
  if (unlinked) issues.push({ kind: "UNLINKED_MVP", key: "mvp", games: unlinked })
  const lineDays = (input.plan.stages ?? [])
    .flatMap((stage) => stage.patches ?? [])
    .map((line) => line.releasedOn)
    .filter((day): day is string => !!day)
  if (lineDays.length && input.patchScopes) {
    const outside = [...input.patchScopes.values()].filter((scope) => scope.source === "NONE").length
    if (outside)
      issues.push({
        kind: "GAMES_OUTSIDE_PATCH_RANGE",
        key: "patch-range",
        games: outside,
        firstLineOn: [...lineDays].sort()[0],
      })
  }
  issues.push(...rosterIssues(byTeam), ...scheduleIssues(input), ...recordIssues(input))
  return issues
}

/** Starters who share a lane, lanes nobody starts in, and players who start for two teams of the tournament. */
function rosterIssues(byTeam: ReadonlyMap<string, DocumentView<RosterMembershipContent>[]>): DataIssue[] {
  const issues: DataIssue[] = []
  const teamsOf = new Map<string, string[]>()
  for (const [teamId, rows] of byTeam) {
    const starters = rows.filter((row) => row.content.status === "ACTIVE")
    for (const row of starters)
      teamsOf.set(row.content.playerId, [...(teamsOf.get(row.content.playerId) ?? []), teamId])
    if (starters.length < LANE_ORDER.length) continue
    const count = (lane: Lane) => starters.filter((row) => row.content.lane === lane).length
    const crowded = LANE_ORDER.filter((lane) => count(lane) > 1)
    const empty = LANE_ORDER.filter((lane) => count(lane) === 0)
    if (crowded.length || empty.length)
      issues.push({ kind: "ROSTER_LANES", key: `lanes:${teamId}`, teamId, crowded, empty })
  }
  for (const [playerId, teamIds] of teamsOf)
    if (teamIds.length > 1) issues.push({ kind: "PLAYER_TWO_TEAMS", key: `two:${playerId}`, playerId, teamIds })
  return issues
}

/** What the schedule, its results and the recorded games say against each other. */
function scheduleIssues(input: DataCheckInput): DataIssue[] {
  const { resolved } = input
  const matches = input.plan.matches
  const stages = input.plan.stages ?? []
  if (!resolved || !matches) return []

  const issues: DataIssue[] = []
  const series = new Map(input.series.map((row) => [row.id, row]))
  const gamesOf = new Map<string, DocumentView<GameContent>[]>()
  for (const game of input.games ?? [])
    gamesOf.set(game.content.seriesId, [...(gamesOf.get(game.content.seriesId) ?? []), game])
  const facts = matches.map((match) => ({
    match,
    row: resolved.get(match.key),
    series: match.seriesId ? series.get(match.seriesId) : undefined,
    games: (match.seriesId && gamesOf.get(match.seriesId)) || [],
    gamesKnown: !!input.games,
  }))

  const differing = facts.filter((row) => matchPasses(row, "SCORE_DIFFERS")).length
  if (differing) issues.push({ kind: "SCORE_DIFFERS", key: "score-differs", matches: differing })
  const unread = facts.filter((row) => {
    if (!row.series || hasScore(row.row)) return false
    const score = scoreFromGames(row.series.content, row.games)
    return !!score && decidesSeries(row.match.bestOf, score)
  }).length
  if (unread) issues.push({ kind: "SCORE_UNREAD", key: "score-unread", matches: unread })

  const planned = new Set(matches.map((match) => match.seriesId).filter(Boolean))
  const outside = input.series.filter((row) => !planned.has(row.id))
  if (matches.length && outside.length)
    issues.push({ kind: "SERIES_OUTSIDE_PLAN", key: "outside-plan", series: outside })

  const dated = stagesByDate({ stages, matches })
  if (dated.some((stage, index) => stage.code !== stages[index]?.code))
    issues.push({ kind: "STAGE_ORDER", key: "stage-order", stages: dated })
  for (const stage of stages) {
    const own = matches.filter((match) => match.stageCode === stage.code)
    if (isLeagueStage(stage) || own.length < 3 || layoutBracket(own).linked) continue
    const links = inferredLinks({ matches }, stage.code, resolved).length
    if (links)
      issues.push({
        kind: "BRACKET_LOOSE",
        key: `loose:${stage.code}`,
        stageCode: stage.code,
        stageName: stage.name,
        links,
      })
  }

  const slots = new Map<string, string>()
  for (const { match, row } of facts) {
    if (!match.scheduledAt) continue
    for (const teamId of [row?.teamAId, row?.teamBId]) {
      if (!teamId) continue
      const slot = `${teamId}:${match.scheduledAt}`
      const other = slots.get(slot)
      if (other) issues.push({ kind: "TEAM_TWICE", key: `twice:${slot}`, teamId, matchKeys: [other, match.key] })
      else slots.set(slot, match.key)
    }
  }
  return issues
}

/** What the tournament record says against its schedule. */
function recordIssues({ tournament, plan }: DataCheckInput): DataIssue[] {
  if (!tournament) return []
  const issues: DataIssue[] = []
  const zone = plan.timezone ?? "Asia/Ho_Chi_Minh"
  const days = (plan.matches ?? [])
    .flatMap((match) => (match.scheduledAt ? [dayKeyInZone(match.scheduledAt, zone)] : []))
    .filter((day): day is string => !!day)
    .sort()
  const { startsOn, endsOn } = tournament
  const outside = days.filter((day) => (startsOn && day < startsOn) || (endsOn && day > endsOn)).length
  if (outside && startsOn && endsOn)
    issues.push({
      kind: "OUTSIDE_DATES",
      key: "outside-dates",
      matches: outside,
      from: days[0]! < startsOn ? days[0]! : startsOn,
      to: days.at(-1)! > endsOn ? days.at(-1)! : endsOn,
    })
  const conflict = statusConflict(tournament)
  if (conflict) issues.push({ kind: "STATUS_STALE", key: "status", ...conflict })
  return issues
}

/** The staff with one line moved to another team; a line the other team already holds is dropped instead. */
export function staffMovedTo(staff: readonly StaffMember[], line: StaffMember, teamId: string): StaffMember[] {
  const same = (row: StaffMember) => row.teamId === line.teamId && row.pageId === line.pageId && row.role === line.role
  const taken = staff.some((row) => row.teamId === teamId && row.pageId === line.pageId && row.role === line.role)
  return taken ? staff.filter((row) => !same(row)) : staff.map((row) => (same(row) ? { ...row, teamId } : row))
}
