import type {
  CompetitionParticipant,
  CompetitionView,
  Lane,
  PersonRole,
  PlayerContent,
  TeamContent,
} from "@aov/community-contracts"
import { competitionChampion, finalTable } from "./champion-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"
import { teamRecord, type TeamRecord } from "./standings-model.ts"

const startOf = (view: CompetitionView) =>
  Date.parse(view.content.tournament.startsOn || "") || Date.UTC(view.content.tournament.year || 0, 0, 1)

/** Competitions by when they started, the newest first. */
export const newestFirst = (views: CompetitionView[]) => [...views].sort((a, b) => startOf(b) - startOf(a))

/** The place a team took in a competition: a line of its final table, or the two sides of its final. */
export function teamPlace(view: CompetitionView, teamId: string): string | null {
  const line = finalTable(view).find((row) => row.team.id === teamId)
  if (line) return line.place
  const won = competitionChampion(view)
  return won?.winner.id === teamId ? "1" : won?.runnerUp?.id === teamId ? "2" : null
}

/** The matches of a competition a team stands in. */
export const teamMatches = (view: CompetitionView, teamId: string): CompetitionMatch[] =>
  competitionMatches([view]).filter(({ match, result }) =>
    [result?.teamAId || match.a.teamId, result?.teamBId || match.b.teamId].includes(teamId),
  )

export type TeamSeason = {
  view: CompetitionView
  place: string | null
  entries: CompetitionMatch[]
  record: TeamRecord
}

export type TeamProfile = {
  team: TeamContent
  seasons: TeamSeason[]
  titles: number
  won: number
  lost: number
}

/** A team as its published competitions show it, named as the newest of them names it. */
export function teamProfile(views: CompetitionView[], teamId: string): TeamProfile | null {
  const played = newestFirst(views).filter((view) => view.content.teams[teamId])
  if (!played.length) return null
  const seasons = played.map((view): TeamSeason => {
    const entries = teamMatches(view, teamId)
    return { view, place: teamPlace(view, teamId), entries, record: teamRecord(entries, teamId) }
  })
  return {
    team: played[0]!.content.teams[teamId]!,
    seasons,
    titles: seasons.filter((season) => season.place === "1").length,
    won: seasons.reduce((sum, season) => sum + season.record.won, 0),
    lost: seasons.reduce((sum, season) => sum + season.record.lost, 0),
  }
}

export type PlayerSeason = {
  view: CompetitionView
  teamId: string | null
  team: TeamContent | null
  lane: Lane | null
  place: string | null
  awards: string[]
  mvps: number
}

export type PlayerProfile = {
  player: PlayerContent
  lane: Lane | null
  seasons: PlayerSeason[]
  titles: number
  mvps: number
  awards: number
}

/** A player as the published competitions that registered them show it. */
export function playerProfile(views: CompetitionView[], playerId: string): PlayerProfile | null {
  const played = newestFirst(views).filter((view) => view.content.players[playerId])
  if (!played.length) return null
  const seasons = played.map((view): PlayerSeason => {
    const { rosters, teams, tournament, series } = view.content
    const line = rosters.find((row) => row.playerId === playerId)
    return {
      view,
      teamId: line?.teamId ?? null,
      team: line ? (teams[line.teamId] ?? null) : null,
      lane: line?.lane ?? null,
      place: line ? teamPlace(view, line.teamId) : null,
      awards: (tournament.awards ?? []).filter((award) => award.playerId === playerId).map((award) => award.title),
      mvps: Object.values(series).filter((match) => match.mvpPlayerId === playerId).length,
    }
  })
  const player = played[0]!.content.players[playerId]!
  return {
    player,
    lane: player.lane ?? seasons.find((season) => season.lane)?.lane ?? null,
    seasons,
    titles: seasons.filter((season) => season.place === "1").length,
    mvps: seasons.reduce((sum, season) => sum + season.mvps, 0),
    awards: seasons.reduce((sum, season) => sum + season.awards.length, 0),
  }
}

export type PersonSeason = {
  view: CompetitionView
  /** What they did, with the wording a team's staff list gives. */
  roles: { role: PersonRole; title: string | null }[]
  teamId: string | null
  team: TeamContent | null
  /** Matches whose own crew names them, besides the crew of the whole competition. */
  matches: number
}

export type PersonProfile = { name: string; roles: PersonRole[]; seasons: PersonSeason[] }

/** Someone of the broadcast or of a team's staff, as the published competitions that name them show it. */
export function personProfile(views: CompetitionView[], pageId: string): PersonProfile | null {
  const named = newestFirst(views).filter((view) => view.content.people?.[pageId])
  if (!named.length) return null
  const seasons = named.map((view): PersonSeason => {
    const { tournament, series, teams } = view.content
    const staff = (tournament.staff ?? []).filter((member) => member.pageId === pageId)
    const crews = Object.values(series).map((match) => (match.broadcast ?? []).filter((one) => one.pageId === pageId))
    const roles = new Map<PersonRole, string | null>()
    for (const { role, title } of staff) if (!roles.get(role)) roles.set(role, title?.trim() || null)
    for (const { role } of [...(tournament.broadcast ?? []).filter((one) => one.pageId === pageId), ...crews.flat()])
      if (!roles.has(role)) roles.set(role, null)
    const teamId = staff[0]?.teamId ?? null
    return {
      view,
      roles: [...roles].map(([role, title]) => ({ role, title })),
      teamId,
      team: teamId ? (teams[teamId] ?? null) : null,
      matches: crews.filter((crew) => crew.length).length,
    }
  })
  return {
    name: named[0]!.content.people![pageId]!.name,
    roles: [...new Set(seasons.flatMap((season) => season.roles.map(({ role }) => role)))],
    seasons,
  }
}

/** The kinds of page that published competitions list, whether or not they have a public page of their own. */
export const isParticipantKind = (kind: string | null | undefined): kind is CompetitionParticipant["kind"] =>
  kind === "TEAM" || kind === "PLAYER" || kind === "PERSON"

/** Where a participant's name leads. */
export const participantPath = ({ kind, id }: Pick<CompetitionParticipant, "kind" | "id">) =>
  `/${{ TEAM: "teams", PLAYER: "players", PERSON: "people" }[kind]}/${id}`

export type TeamStint = { teamId: string; team: TeamContent; from: number | null; to: number | null; seasons: number }

/** The teams a player was registered with, the latest first; seasons in a row with one team are one stint. */
export function playerStints(seasons: PlayerSeason[]): TeamStint[] {
  const stints: TeamStint[] = []
  for (const { view, teamId, team } of seasons) {
    if (!teamId || !team) continue
    const { year, startsOn } = view.content.tournament
    const at = year ?? (Number(startsOn?.slice(0, 4)) || null)
    const last = stints.at(-1)
    if (last?.teamId === teamId) {
      last.from = at ?? last.from
      last.seasons += 1
    } else stints.push({ teamId, team, from: at, to: at, seasons: 1 })
  }
  return stints
}
