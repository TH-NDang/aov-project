/**
 * Competitions for tests of their results, with one line a match: "SF1 1: a 3-1 b" is the match SF1 of round 1. A side
 * is a team, the winner or the loser of a match above ("W:SF1", "L:SF1"), a seed ("#3") or nobody yet ("?"). A match
 * without a score reads "a - b", and an hour may follow ("@2026-10-17T12:00Z"). The tables are those of the backend.
 */
import type {
  CompetitionPlan,
  CompetitionSlot,
  CompetitionStage,
  CompetitionStanding,
  PlannedMatch,
  ResolvedMatch,
  TeamContent,
} from "@aov/community-contracts"

export type TestStage = { stage: CompetitionStage; lines: string[] }

/** A stage whose name is its code unless `more` gives one. */
export const stage = (
  code: string,
  format: string,
  lines: string[],
  more: Partial<CompetitionStage> = {},
): TestStage => ({
  lines,
  stage: {
    code,
    name: code,
    format,
    bestOf: 5,
    legs: 1,
    winPoints: 1,
    lossPoints: 0,
    advance: 0,
    tieBreakers: [],
    sourceUrl: "",
    patches: [],
    ...more,
  },
})

/** Every pair of one-letter teams once: the earlier one wins, or the later one of a pair among the upsets ("db"). */
export function roundRobin(prefix: string, teams: string, upsets: string[] = []) {
  const ids = [...teams]
  return ids.flatMap((one, index) =>
    ids.slice(index + 1).map((other) => {
      const [winner, loser] = upsets.includes(other + one) ? [other, one] : [one, other]
      return `${prefix}${one}${other} 1: ${winner} 2-0 ${loser}`
    }),
  )
}

function slot(text: string): CompetitionSlot {
  if (text === "?") return { type: "TBD" }
  if (text.startsWith("#")) return { type: "SEED", seed: Number(text.slice(1)) }
  if (text.startsWith("W:")) return { type: "WINNER", matchKey: text.slice(2) }
  if (text.startsWith("L:")) return { type: "LOSER", matchKey: text.slice(2) }
  return { type: "TEAM", teamId: text }
}

function parsed(line: string, stageCode: string) {
  const found = /^(\S+) (\d+): (\S+) (\d*)-(\d*) (\S+)(?: @(\S+))?$/.exec(line)
  if (!found) throw new Error(`Unreadable match: ${line}`)
  const [, key, round, a, scoreA, scoreB, b, scheduledAt] = found
  const match: PlannedMatch = {
    key: key!,
    stageCode,
    round: Number(round),
    bestOf: 5,
    scheduledAt,
    a: slot(a!),
    b: slot(b!),
  }
  return { match, score: scoreA && scoreB ? ([Number(scoreA), Number(scoreB)] as const) : null }
}

/** The teams and scores of the matches, each side taken from the matches above it. */
function resolve(matches: ReturnType<typeof parsed>[], seeds: Record<number, string>): ResolvedMatch[] {
  const rows: ResolvedMatch[] = []
  const teamOf = ({ type, teamId, seed, matchKey }: CompetitionSlot) => {
    if (type === "TEAM") return teamId ?? null
    if (type === "SEED") return seeds[seed!] ?? null
    const row = rows.find(({ key }) => key === matchKey)
    if (!row || row.scoreA == null || row.scoreB == null || row.scoreA === row.scoreB) return null
    return (row.scoreA > row.scoreB === (type === "WINNER") ? row.teamAId : row.teamBId) ?? null
  }
  for (const { match, score } of matches)
    rows.push({
      key: match.key,
      teamAId: teamOf(match.a),
      teamBId: teamOf(match.b),
      scoreA: score?.[0],
      scoreB: score?.[1],
      consistent: true,
    })
  return rows
}

/** The table of a round robin: by points, then by the games where the stage says so; level teams share a rank. */
function table({ code, winPoints, lossPoints, tieBreakers }: CompetitionStage, teams: string[], rows: ResolvedMatch[]) {
  const standings = teams.map((teamId): CompetitionStanding => {
    const row = { teamId, rank: 0, played: 0, won: 0, lost: 0, gameWins: 0, gameLosses: 0, points: 0 }
    for (const { teamAId, teamBId, scoreA, scoreB } of rows) {
      if (scoreA == null || scoreB == null || (teamAId !== teamId && teamBId !== teamId)) continue
      const [own, other] = teamAId === teamId ? [scoreA, scoreB] : [scoreB, scoreA]
      row.played++
      row.gameWins += own
      row.gameLosses += other
      row.won += own > other ? 1 : 0
      row.lost += own < other ? 1 : 0
      row.points += own > other ? winPoints : lossPoints
    }
    return { ...row, tied: false, qualified: false }
  })
  const values = (row: CompetitionStanding) => [
    row.points,
    tieBreakers.includes("GAME_DIFF") ? row.gameWins - row.gameLosses : 0,
    tieBreakers.includes("GAME_WINS") ? row.gameWins : 0,
  ]
  const compare = (x: CompetitionStanding, y: CompetitionStanding) =>
    values(y)
      .map((value, at) => value - values(x)[at]!)
      .find((difference) => difference) ?? 0
  const ranked = standings.map((row) => ({
    ...row,
    rank: 1 + standings.filter((other) => compare(row, other) > 0).length,
    tied: standings.some((other) => other !== row && !compare(row, other)),
  }))
  const complete = rows.every(({ scoreA, scoreB }) => scoreA != null && scoreB != null)
  return { stageCode: code, complete, rows: ranked.sort(compare) }
}

/** A competition of some stages; every team is its id in capitals and an entrant unless `more` says otherwise. */
export function competition(stages: TestStage[], more: Partial<CompetitionPlan> = {}) {
  const read = stages.flatMap(({ stage: { code }, lines }) => lines.map((line) => parsed(line, code)))
  const named = read.flatMap(({ match }) => [match.a.teamId, match.b.teamId].filter((id) => id != null))
  const ids = [...new Set([...named, ...Object.values(more.playoffSeeds ?? {})])]
  const plan: CompetitionPlan = {
    circuit: "",
    organizer: "",
    timezone: "Asia/Ho_Chi_Minh",
    prizePool: "",
    currency: "VND",
    sourceUrl: "",
    notes: "",
    venues: [],
    entrants: ids.map((teamId) => ({ teamId, status: "REGISTERED", note: "" })),
    stages: stages.map((entry) => entry.stage),
    playoffSeeds: {},
    matches: read.map(({ match }) => match),
    ...more,
  }
  const resolved = resolve(read, plan.playoffSeeds)
  const all = [...new Set([...ids, ...plan.entrants.map(({ teamId }) => teamId)])]
  const inStage = (code: string) =>
    resolved.filter(({ key }) => read.some(({ match }) => match.key === key && match.stageCode === code))
  return {
    plan,
    resolved,
    standings: plan.stages
      .filter(({ format }) => format === "ROUND_ROBIN")
      .map((entry) => table(entry, entry.teamIds ?? all, inStage(entry.code))),
    teams: Object.fromEntries(all.map((id): [string, TeamContent] => [id, { code: id, name: id.toUpperCase() }])),
  }
}
