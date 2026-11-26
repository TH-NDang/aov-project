import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { competitionStatus, matchWinner, playedOrder } from "./competition-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"

type Table = CompetitionView["content"]["standings"][number]

const teamsOf = ({ match, result }: CompetitionMatch) => ({
  a: result?.teamAId || match.a.teamId || null,
  b: result?.teamBId || match.b.teamId || null,
})
const startOf = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "") || 0

/** The decided matches of a team, newest first. */
function decidedMatches(entries: CompetitionMatch[], teamId: string) {
  return entries
    .filter((entry) => {
      const { a, b } = teamsOf(entry)
      return (a === teamId || b === teamId) && matchWinner(entry) != null
    })
    .sort((x, y) => startOf(y) - startOf(x))
}

export type FormMark = { entry: CompetitionMatch; won: boolean }

/** The last decided matches of a team, oldest first, so the newest stands at the end. */
export function teamForm(entries: CompetitionMatch[], teamId: string, size = 5): FormMark[] {
  return decidedMatches(entries, teamId)
    .slice(0, size)
    .reverse()
    .map((entry) => ({ entry, won: teamsOf(entry)[matchWinner(entry)!] === teamId }))
}

export type TeamRecord = { played: number; won: number; lost: number; gamesWon: number; gamesLost: number }

/** What a team has done over the given matches. */
export function teamRecord(entries: CompetitionMatch[], teamId: string): TeamRecord {
  const record: TeamRecord = { played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0 }
  for (const entry of decidedMatches(entries, teamId)) {
    const own = teamsOf(entry).a === teamId ? "a" : "b"
    const { scoreA, scoreB } = entry.result!
    record.played += 1
    if (matchWinner(entry) === own) record.won += 1
    else record.lost += 1
    record.gamesWon += own === "a" ? scoreA! : scoreB!
    record.gamesLost += own === "a" ? scoreB! : scoreA!
  }
  return record
}

/** The decided matches between two teams, newest first. */
export function meetings(entries: CompetitionMatch[], one: string, other: string) {
  return decidedMatches(entries, one).filter((entry) => Object.values(teamsOf(entry)).includes(other))
}

/**
 * Rows with the teams level on points told apart by their games: the difference, then the games won. Only for a stage
 * whose plan records no rule for it; a recorded rule has already been applied, and teams it leaves level stay level.
 */
function settledByGames(rows: CompetitionStanding[]): CompetitionStanding[] {
  const difference = (row: CompetitionStanding) => row.gameWins - row.gameLosses
  const sorted = [...rows].sort((x, y) => x.rank - y.rank || difference(y) - difference(x) || y.gameWins - x.gameWins)
  const level = (x: CompetitionStanding | undefined, y: CompetitionStanding | undefined) =>
    !!x && !!y && x.rank === y.rank && difference(x) === difference(y) && x.gameWins === y.gameWins
  let rank = 0
  return sorted.map((row, index) => {
    if (!level(row, sorted[index - 1])) rank = index + 1
    return { ...row, rank, tied: level(row, sorted[index - 1]) || level(row, sorted[index + 1]) }
  })
}

/** Whether level teams of a table had to be told apart by their games, for want of a recorded rule. */
export function ordersByGames(view: CompetitionView, table: Table) {
  const rules = view.content.plan.stages.find((stage) => stage.code === table.stageCode)?.tieBreakers ?? []
  return !rules.length && table.rows.some((row) => row.tied && row.played > 0)
}

/** Whether a table holds drawn matches, which then stand between those won and those lost. */
export const hasDraws = (rows: CompetitionStanding[]) => rows.some((row) => row.played > row.won + row.lost)

/** Rows with drawn matches apart; a table published before they were counted has them among those lost. */
function drawsApart(rows: CompetitionStanding[], entries: CompetitionMatch[]): CompetitionStanding[] {
  if (hasDraws(rows)) return rows
  const drawn = new Map<string, number>()
  for (const entry of entries) {
    const { scoreA, scoreB, consistent } = entry.result ?? {}
    if (scoreA == null || scoreA !== scoreB || consistent === false) continue
    for (const team of Object.values(teamsOf(entry))) if (team) drawn.set(team, (drawn.get(team) ?? 0) + 1)
  }
  return rows.map((row) => ({ ...row, lost: Math.max(0, row.lost - (drawn.get(row.teamId) ?? 0)) }))
}

/** Whether a match is decided: won by a team, or drawn once all its games were played. */
function decided(entry: CompetitionMatch) {
  const { scoreA, scoreB } = entry.result ?? {}
  if (scoreA == null || scoreB == null) return false
  return matchWinner(entry) != null || (scoreA === scoreB && scoreA + scoreB >= entry.match.bestOf)
}

/** Whether every match of a table's stage has its result; a plan may still expect matches nobody entered. */
export function allPlayed(view: CompetitionView, table: Table) {
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === table.stageCode)
  return entries.length > 0 && entries.every(decided)
}

/** The stages played after one, the next first. */
export function laterStages(view: CompetitionView, stageCode: string): CompetitionStage[] {
  const { plan } = view.content
  const order = playedOrder(
    plan.stages.filter((stage) => plan.matches.some((match) => match.stageCode === stage.code)),
    plan.matches,
  )
  const at = order.findIndex((stage) => stage.code === stageCode)
  return at < 0 ? [] : order.slice(at + 1)
}

/**
 * Whether a table is final: every match has its result, the event is over, or a later stage that took only some of its
 * teams has begun. An event moves on without the matches a team that withdrew never played.
 */
export function tableOver(view: CompetitionView, table: Table) {
  if (table.complete || allPlayed(view, table)) return true
  if (!table.rows.some((row) => row.played > 0)) return false
  if (competitionStatus(view.content) === "FINISHED") return true
  const entries = competitionMatches([view])
  const teamsIn = (code: string) => {
    const teams = entries
      .filter((entry) => entry.match.stageCode === code)
      .flatMap((entry) => Object.values(teamsOf(entry)))
    return new Set(teams.filter((team) => team != null))
  }
  const own = teamsIn(table.stageCode)
  return laterStages(view, table.stageCode).some(({ code }) => {
    const going = [...teamsIn(code)].filter((team) => own.has(team))
    const begun = entries.some((entry) => entry.match.stageCode === code && entry.result?.scoreA != null)
    return begun && going.length > 0 && going.length < own.size
  })
}

export type StandingGroup = {
  /** The letter of a group the plan names, or its number; null while the stage is one table. */
  name: string | null
  rows: CompetitionStanding[]
}

/** The letter every match of a group carries in its name ("Group A Matches"), when they all carry the same. */
function groupLetter(entries: CompetitionMatch[]) {
  const letters = new Set(entries.map((entry) => /\b(?:group|bảng)\s+([a-z])\b/i.exec(entry.match.label ?? "")?.[1]))
  const [letter] = letters
  return letters.size === 1 && letter ? letter.toUpperCase() : null
}

/** Some rows of a table ranked on their own: places count from 1, and teams level in the table stay level. */
function rankedAlone(rows: CompetitionStanding[]): CompetitionStanding[] {
  return rows.map((row) => {
    const level = rows.filter((other) => other.rank === row.rank)
    return { ...row, rank: rows.indexOf(level[0]!) + 1, tied: level.length > 1 }
  })
}

/**
 * The groups of a table. A plan keeps a group stage as one table, so teams that only meet among themselves are read
 * as one group, ranked on its own; pairs and lone teams make no groups, and then the table stays whole. A team
 * without a match in the stage is left out once others have one.
 */
export function standingGroups(view: CompetitionView, source: Table): StandingGroup[] {
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === source.stageCode)
  const ranked = ordersByGames(view, source) ? settledByGames(source.rows) : source.rows
  const table = { ...source, rows: drawsApart(ranked, entries) }
  const parent = new Map<string, string>()
  const root = (team: string): string => {
    const up = parent.get(team)
    return up == null || up === team ? team : root(up)
  }
  for (const entry of entries) {
    const { a, b } = teamsOf(entry)
    if (!a || !b) return [{ name: null, rows: table.rows }]
    for (const team of [a, b]) if (!parent.has(team)) parent.set(team, team)
    parent.set(root(a), root(b))
  }
  const groups = new Map<string, CompetitionStanding[]>()
  for (const row of table.rows.filter((item) => parent.has(item.teamId)))
    groups.set(root(row.teamId), [...(groups.get(root(row.teamId)) ?? []), row])
  const lists = [...groups]
  if (lists.length < 2 || lists.some(([, rows]) => rows.length < 3)) {
    const playing = table.rows.filter((row) => parent.has(row.teamId))
    return [{ name: null, rows: playing.length ? rankedAlone(playing) : table.rows }]
  }
  return lists
    .map(([key, rows]) => ({
      letter: groupLetter(entries.filter((entry) => root(teamsOf(entry).a!) === key)),
      rows: rankedAlone(rows),
    }))
    .sort((x, y) => (x.letter ?? "").localeCompare(y.letter ?? ""))
    .map(({ letter, rows }, index) => ({ name: letter ?? String(index + 1), rows }))
}
