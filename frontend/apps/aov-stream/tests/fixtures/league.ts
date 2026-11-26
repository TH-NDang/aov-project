import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { countedMatches, steppedTable, tableAfter, type SteppedTable } from "../../src/lib/standings-steps.ts"
import { competition, matchesOf, on, stage, type TestMatch } from "./competition.ts"

/** A round robin of a test plan; its level teams are told apart by game difference unless `extra` says otherwise. */
export const league = (extra: object = {}) =>
  stage("RR", { format: "ROUND_ROBIN", bestOf: 3, winPoints: 1, lossPoints: 0, tieBreakers: ["GAME_DIFF"], ...extra })

export const leagueStage = (extra: object = {}) => league(extra) as unknown as CompetitionStage

/** Three rounds of four teams, best of three; after the second round C has overtaken A and B. */
export const leagueMatches: TestMatch[] = [
  { key: "m1", a: "a", b: "b", score: [2, 1], label: "Vòng 1 · A vs B", scheduledAt: on(1) },
  { key: "m2", a: "c", b: "d", score: [0, 2], label: "Vòng 1 · C vs D", scheduledAt: on(1) },
  { key: "m3", a: "a", b: "c", score: [0, 2], label: "Vòng 2 · A vs C", scheduledAt: on(2) },
  { key: "m4", a: "b", b: "d", score: [0, 2], label: "Vòng 2 · B vs D", scheduledAt: on(2) },
  { key: "m5", a: "a", b: "d", score: [2, 0], label: "Vòng 3 · A vs D", scheduledAt: on(3) },
  { key: "m6", a: "b", b: "c", score: [0, 2], label: "Vòng 3 · B vs C", scheduledAt: on(3) },
]

/** The table of a competition's round robin as the service works it out. */
export const tableRows = (view: CompetitionView, extra: object = {}): CompetitionStanding[] =>
  tableAfter(
    leagueStage(extra),
    view.content.plan.entrants.map(({ teamId }) => teamId),
    countedMatches(matchesOf(view).filter((entry) => entry.match.stageCode === "RR")),
  )

/** A competition with a round robin and its published table, followed by the given stages and their matches. */
export function leagueView(
  matches: TestMatch[] = leagueMatches,
  {
    extra = {},
    later = [],
    stages = [],
    complete = true,
    tournament = {},
  }: {
    extra?: object
    later?: TestMatch[]
    stages?: ReturnType<typeof stage>[]
    complete?: boolean
    tournament?: object
  } = {},
): CompetitionView {
  const view = competition(
    [...matches, ...later].map((match) => ({ bestOf: 3, ...match })),
    { stages: [league(extra), ...stages], tournament },
  )
  view.content.standings = [{ stageCode: "RR", complete, rows: tableRows(view, extra) }]
  return view
}

/** The steps of a competition's round robin. */
export const leagueSteps = (view: CompetitionView = leagueView()): SteppedTable =>
  steppedTable(view, view.content.standings[0]!)!

/** The teams of a table in their order: "dabc". */
export const teamsIn = (rows: CompetitionStanding[]) => rows.map(({ teamId }) => teamId).join("")
