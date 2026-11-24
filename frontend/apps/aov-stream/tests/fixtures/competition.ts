import type { CompetitionSlot, CompetitionView, PlannedMatch, SeriesContent } from "@aov/community-contracts"
import { competitionMatches } from "../../src/lib/match-model.ts"

/** A match of a test plan: `a` and `b` are team ids, or slots that name the match that fills them. */
export type TestMatch = Partial<Omit<PlannedMatch, "a" | "b">> & {
  key: string
  a?: string | CompetitionSlot
  b?: string | CompetitionSlot
  /** Games won by each side, once the match is played. */
  score?: [number, number]
}

const slot = (value?: string | CompetitionSlot): CompetitionSlot =>
  typeof value === "string" ? { type: "TEAM", teamId: value } : (value ?? { type: "TBD" })

export const winnerOf = (matchKey: string): CompetitionSlot => ({ type: "WINNER", matchKey })
export const loserOf = (matchKey: string): CompetitionSlot => ({ type: "LOSER", matchKey })

/** A stage of a test plan; an elimination stage unless `format` says otherwise. */
export const stage = (code: string, extra: object = {}) => ({
  code,
  name: code,
  format: "SINGLE_ELIMINATION",
  bestOf: 5,
  legs: 1,
  advance: 0,
  tieBreakers: [],
  ...extra,
})

/** A published competition with the given matches; every team is named after its id, in capitals. */
export function competition(
  matches: TestMatch[],
  {
    stages = [stage("KO")],
    tournament = {},
    standings = [],
    id = "competition",
    plan = {},
  }: {
    stages?: ReturnType<typeof stage>[]
    tournament?: object
    standings?: CompetitionView["content"]["standings"]
    id?: string
    plan?: object
  } = {},
): CompetitionView {
  const planned = matches.map(({ score: _, a, b, ...match }): PlannedMatch => ({
    stageCode: stages[0]!.code,
    round: 1,
    bestOf: 5,
    ...match,
    a: slot(a),
    b: slot(b),
  }))
  const teamIds = new Set(planned.flatMap((match) => [match.a.teamId, match.b.teamId]).filter((team) => team != null))
  const done = new Map<string, { teamAId: string | null; teamBId: string | null; score?: [number, number] }>()
  const teamOf = (value: CompetitionSlot): string | null => {
    const source = done.get(value.matchKey ?? "")
    if (!source?.score) return value.teamId ?? null
    const first = source.score[0] > source.score[1]
    return (value.type === "WINNER") === first ? source.teamAId : source.teamBId
  }
  matches.forEach(({ key, score }, index) =>
    done.set(key, { teamAId: teamOf(planned[index]!.a), teamBId: teamOf(planned[index]!.b), score }),
  )
  return {
    id,
    version: 1,
    content: {
      tournament: { code: id, name: "Giải thử", region: "VN", status: "ONGOING", ...tournament },
      plan: {
        circuit: "",
        organizer: "",
        timezone: "Asia/Ho_Chi_Minh",
        entrants: [...teamIds].map((teamId) => ({ teamId, status: "CONFIRMED", note: "" })),
        stages,
        playoffSeeds: {},
        venues: [],
        matches: planned,
        ...plan,
      },
      teams: Object.fromEntries(
        [...teamIds].map((team) => [
          team,
          { code: team, name: `Đội ${team.toUpperCase()}`, shortName: team.toUpperCase() },
        ]),
      ),
      players: {},
      series: {} as Record<string, SeriesContent>,
      rosters: [],
      standings,
      resolved: [...done].map(([key, { teamAId, teamBId, score }]) => ({
        key,
        teamAId,
        teamBId,
        scoreA: score?.[0] ?? null,
        scoreB: score?.[1] ?? null,
        consistent: true,
      })),
    },
  } as unknown as CompetitionView
}

/** The matches of a test competition, ready for the models. */
export const matchesOf = (view: CompetitionView) => competitionMatches([view])

/** The start of a match on a day of November 2026, at noon in Vietnam. */
export const on = (day: number) => `2026-11-${String(day).padStart(2, "0")}T05:00:00Z`
