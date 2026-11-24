import type {
  CompetitionPlan,
  DocumentView,
  GameContent,
  PlayerContent,
  RosterMembershipContent,
  SeriesContent,
  StaffMember,
  TeamContent,
} from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"

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

export type DataCheckInput = {
  plan: Pick<CompetitionPlan, "entrants">
  staff: readonly StaffMember[]
  rosters: readonly DocumentView<RosterMembershipContent>[]
  series: readonly DocumentView<SeriesContent>[]
  games?: readonly DocumentView<GameContent>[]
  /** Teams by id, including teams named only by a staff line. */
  teams: Record<string, TeamContent | undefined>
  /** Players by id, at least everyone on a roster of the tournament. */
  players: ReadonlyMap<string, PlayerContent> | undefined
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
  return issues
}

/** The staff with one line moved to another team; a line the other team already holds is dropped instead. */
export function staffMovedTo(staff: readonly StaffMember[], line: StaffMember, teamId: string): StaffMember[] {
  const same = (row: StaffMember) => row.teamId === line.teamId && row.pageId === line.pageId && row.role === line.role
  const taken = staff.some((row) => row.teamId === teamId && row.pageId === line.pageId && row.role === line.role)
  return taken ? staff.filter((row) => !same(row)) : staff.map((row) => (same(row) ? { ...row, teamId } : row))
}
