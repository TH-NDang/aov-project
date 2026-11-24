import type { CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { matchWinner } from "./competition-model.ts"
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

/** Whether every match of a table's stage has its result; a plan may still expect matches nobody entered. */
export function allPlayed(view: CompetitionView, table: Table) {
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === table.stageCode)
  return entries.length > 0 && entries.every((entry) => matchWinner(entry) != null)
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

/**
 * The groups of a table. A plan keeps a group stage as one table, so teams that only meet among themselves are read
 * as one group, ranked on its own; pairs and lone teams make no groups, and then the table stays whole. A team
 * without a match in the stage is left out once others have one.
 */
export function standingGroups(view: CompetitionView, source: Table): StandingGroup[] {
  const table = ordersByGames(view, source) ? { ...source, rows: settledByGames(source.rows) } : source
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === table.stageCode)
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
    return [{ name: null, rows: playing.length ? playing : table.rows }]
  }
  return lists
    .map(([key, rows]) => ({
      letter: groupLetter(entries.filter((entry) => root(teamsOf(entry).a!) === key)),
      rows: rows.map((row, index) => ({ ...row, rank: index + 1, tied: false })),
    }))
    .sort((x, y) => (x.letter ?? "").localeCompare(y.letter ?? ""))
    .map(({ letter, rows }, index) => ({ name: letter ?? String(index + 1), rows }))
}
