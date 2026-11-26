import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionPlan, TeamContent, TournamentContent, TournamentPlacement } from "@aov/community-contracts"
import {
  blocksFilling,
  filledPlacements,
  finalCheckState,
  finalOutcome,
  finalStateText,
  isOver,
  placesAgree,
  sharedFirst,
} from "../src/features/competition/workspace/final-state"
import { competition, roundRobin, stage, type TestStage } from "./fixtures/competition-plan"
import { tournamentRow } from "./fixtures/tournament-list-data"

const knockout = (...lines: string[]) => stage("Playoffs", "SINGLE_ELIMINATION", lines)
const semifinals = ["SF1 1: a 3-1 c", "SF2 1: b 3-2 d"]
const played = [knockout(...semifinals, "F 2: a 4-2 b")]
const line = (place: string, teamId: string, more: Partial<TournamentPlacement> = {}): TournamentPlacement => ({
  place,
  teamId,
  teamName: teamId.toUpperCase(),
  ...more,
})
const allPlaced = [line("1", "a"), line("2", "b"), line("3-4", "c"), line("3-4", "d")]
const result = (winnerName: string, winnerScore: number | null = 4, runnerUpScore: number | null = 2) =>
  ({
    winnerName,
    runnerUpName: "B",
    winnerScore,
    runnerUpScore,
    sourceUrl: "https://example.org/final",
    verification: "PRIMARY",
  }) as TournamentContent["result"]

/** The outcome of a finished tournament on the first of December 2026, unless `content` says it goes on. */
function outcome(
  stages: TestStage[],
  content: Partial<TournamentContent> = {},
  { teams, ...plan }: Partial<CompetitionPlan> & { teams?: Record<string, Partial<TeamContent>> } = {},
) {
  const built = competition(stages, plan)
  for (const [id, more] of Object.entries(teams ?? {})) built.teams[id] = { ...built.teams[id]!, ...more }
  return finalOutcome({
    tournament: tournamentRow("t", "Giải", content).content,
    ...built,
    now: new Date("2026-12-01T05:00:00Z"),
  })
}

const label = (read: ReturnType<typeof outcome>) => [finalStateText(read.state), finalCheckState(read)]
const rows = (read: ReturnType<typeof outcome>) =>
  read.rows.map(({ state, place, teamId }) => [state, place ?? "", teamId ?? "?"].join(" "))

test("a finished tournament without final places counts the teams the matches place", () => {
  assert.deepEqual(label(outcome(played, { result: result("A") })), ["4 gợi ý chưa điền", "todo"])
})

test("a final table that holds every team is complete", () => {
  assert.deepEqual(label(outcome(played, { placements: allPlaced })), ["Đã đủ 4 đội", "ok"])
})

test("a tournament that goes on waits for its end", () => {
  const running = [knockout(...semifinals, "F 2: a - b")]

  assert.deepEqual(label(outcome(running, { status: "ONGOING" })), ["Chờ giải kết thúc", "waiting"])
})

test("a result nobody can tell the places of is named as one without places", () => {
  assert.deepEqual(label(outcome([], { result: result("A") })), ["Có kết quả, chưa có thứ hạng", "todo"])
})

test("awards without a result and places are named as such", () => {
  const awards = [{ title: "MVP", recipientName: "X" }]

  assert.deepEqual(label(outcome([], { awards })), ["Có giải thưởng, chưa có thứ hạng", "todo"])
})

test("a finished tournament with nothing recorded has nothing yet", () => {
  assert.deepEqual(label(outcome([])), ["Chưa có", "todo"])
})

test("a recorded champion the matches contradict is a conflict, not a suggestion", () => {
  assert.deepEqual(label(outcome(played, { result: result("C") })), ["Kết quả chưa khớp", "todo"])
})

test("a final table that leaves out teams nothing places counts those it has", () => {
  const group = stage("Vòng bảng", "ROUND_ROBIN", ["G1 1: a 2-0 e", "G2 1: b - e", "G3 1: a 2-0 b"])
  const read = outcome([group, ...played], { placements: allPlaced })

  assert.deepEqual(label(read), ["4/5 đội có hạng", "todo"])
})

test("an entrant that plays no match does not hold the final table open", () => {
  const entrants = ["a", "b", "c", "d", "z"].map((teamId) => ({ teamId, status: "REGISTERED", note: "" }))

  assert.equal(label(outcome(played, { placements: allPlaced }, { entrants }))[0], "Đã đủ 4 đội")
})

test("a show match asks for no places", () => {
  const read = outcome(played, { competitionType: "SHOWMATCH" })

  assert.deepEqual([label(read), rows(read)], [["Giao hữu, không xếp hạng", "waiting"], []])
})

const over = (content: Partial<TournamentContent>, stages: TestStage[] = played, now = "2026-11-22T05:00:00Z") => {
  const { plan, resolved } = competition(stages)
  return isOver({ tournament: tournamentRow("t", "Giải", content).content, plan, resolved, now: new Date(now) })
}
const open = [knockout(...semifinals, "F 2: a - b")]

test("a tournament is over once its record says so", () => {
  assert.deepEqual([over({ status: "FINISHED" }, open), over({ status: "ONGOING" }, open)], [true, false])
})

test("a tournament is over on the day after its last one, in the zone of the tournament", () => {
  const content = { status: "ONGOING", endsOn: "2026-11-21" } as const

  // 17:30 UTC is already the 22nd in Ho Chi Minh City.
  assert.equal(over(content, open, "2026-11-21T16:30:00Z"), false)
  assert.equal(over(content, open, "2026-11-21T17:30:00Z"), true)
})

test("a tournament is over once its last bracket has every score", () => {
  assert.equal(over({ status: "ONGOING" }), true)
})

test("a bracket with every score days before the last day of its tournament may still go on", () => {
  assert.equal(over({ status: "ONGOING", endsOn: "2026-11-29" }), false)
  assert.equal(over({ status: "ONGOING", endsOn: "2026-11-22" }), true)
})

test("a league with every score may still go on", () => {
  assert.equal(over({ status: "ONGOING" }, [stage("Vòng bảng", "ROUND_ROBIN", roundRobin("G", "abc"))]), false)
})

test("a tournament with a stage that has no matches yet is not over", () => {
  assert.equal(
    over({ status: "ONGOING" }, [knockout(...semifinals), stage("Chung kết", "SINGLE_ELIMINATION", [])]),
    false,
  )
})

test("a place within the shared one the matches give agrees with it", () => {
  assert.deepEqual(
    [placesAgree("3", "3-4"), placesAgree("3–4", "3"), placesAgree("5", "3-4"), placesAgree("dq", "8")],
    [true, true, false, true],
  )
})

test("rows tell what the table and the matches say about each team", () => {
  const read = outcome(played, { placements: [line("1", "a"), line("4", "c"), line("5", "d")] })

  assert.deepEqual(rows(read), ["SAME 1 a", "MISSING 2 b", "SAME 4 c", "DIFFERS 5 d"])
})

test("a team in a line without a link is found by its name, its short name or another name", () => {
  const placements = [
    { place: "1", teamName: "a" },
    { place: "2", teamName: "Beta" },
    { place: "3-4", teamName: "Gamma" },
    { place: "3-4", teamName: "D" },
  ]
  const read = outcome(played, { placements }, { teams: { b: { shortName: "Beta" }, c: { aliases: ["Gamma"] } } })

  assert.deepEqual(rows(read), ["SAME 1 a", "SAME 2 b", "SAME 3-4 c", "SAME 3-4 d"])
})

test("a place other teams hold already is marked, so it is not filled twice", () => {
  const read = outcome(played, { placements: [line("1", "a"), line("2", "x")] })

  assert.equal(read.rows.find(({ teamId }) => teamId === "b")?.state, "TAKEN")
  assert.equal(read.rows.find(({ teamId }) => teamId === "b")?.reason, "X")
})

test("a line no match confirms says why", () => {
  const read = outcome(played, { placements: [...allPlaced, line("5", "x")] })

  assert.deepEqual(
    read.rows.filter(({ state }) => state === "RECORDED").map(({ teamName, reason }) => [teamName, reason]),
    [["X", "Không có trận nào trong lịch"]],
  )
})

test("a place that waits for its match is shown until the table gives it", () => {
  const unplayed = [knockout(...semifinals, "F 2: a - b")]

  assert.deepEqual(rows(outcome(unplayed)).slice(0, 2), ["PENDING 1 ?", "PENDING 2 ?"])
  assert.deepEqual(rows(outcome(unplayed, { placements: allPlaced })), [
    "RECORDED 1 a",
    "RECORDED 2 b",
    "SAME 3-4 c",
    "SAME 3-4 d",
  ])
})

test("lines without a number and teams without a place come last", () => {
  const group = stage("Vòng bảng", "ROUND_ROBIN", ["G1 1: a 2-0 e", "G2 1: b - e", "G3 1: a 2-0 b"])
  const read = outcome([group, ...played], { placements: [line("dq", "x"), ...allPlaced] })

  assert.deepEqual(rows(read).slice(-2), ["RECORDED dq x", "OPEN  e"])
})

test("a plan that stops days before the tournament ended is read where it ends in the recorded champion", () => {
  const dated = [...semifinals, "F 2: a 4-2 b"].map((entry) => `${entry} @2026-10-01T12:00Z`)
  const content = { endsOn: "2026-10-11" }

  assert.deepEqual(rows(outcome([knockout(...dated)], content)).slice(0, 1), ["OPEN  a"])
  assert.deepEqual(rows(outcome([knockout(...dated)], { ...content, result: result("A") })).slice(0, 1), [
    "MISSING 1 a",
  ])
})

test("the champion is read from the matches while nothing is recorded", () => {
  const { result: shown } = outcome(played)

  assert.deepEqual(shown, {
    winner: { teamId: "a", name: "A" },
    runnerUp: { teamId: "b", name: "B" },
    score: "4–2",
    source: "MATCHES",
  })
})

test("the final table names the champion before the recorded result does", () => {
  const read = outcome(played, { placements: allPlaced, result: result("C") })

  assert.deepEqual([read.result?.winner.name, read.result?.source], ["A", "TABLE"])
})

test("a recorded result keeps its own score", () => {
  const read = outcome(played, { result: result("A", 4, 2) })

  assert.deepEqual([read.result?.score, read.result?.source, read.issue], ["4–2", "RESULT", null])
})

test("a champion under another of its names contradicts nothing", () => {
  assert.equal(outcome(played, { result: result("Alpha") }, { teams: { a: { aliases: ["Alpha"] } } }).issue, null)
})

test("another champion than the matches show is an issue that blocks filling", () => {
  const { issue } = outcome(played, { result: result("C") })

  assert.deepEqual(issue, { kind: "CHAMPION", source: "RESULT", recorded: "C", found: "A" })
  assert.equal(blocksFilling(issue), true)
})

test("a recorded champion the matches place lower is an issue even while the final is open", () => {
  const { issue } = outcome([knockout(...semifinals, "F 2: a - b")], { result: result("C") })

  assert.deepEqual([issue?.kind, issue?.found], ["CHAMPION", "C hạng 3-4"])
})

test("another runner-up than the matches show is an issue that blocks filling", () => {
  const { issue } = outcome(played, { placements: [line("1", "a"), line("2", "c")] })

  assert.deepEqual(issue, { kind: "RUNNER_UP", source: "TABLE", recorded: "C", found: "B" })
  assert.equal(blocksFilling(issue), true)
})

test("another score of the final is an issue that blocks nothing", () => {
  const { issue } = outcome(played, { result: result("A", 4, 3) })

  assert.deepEqual([issue?.kind, issue?.recorded, issue?.found], ["SCORE", "4–3", "4–2"])
  assert.equal(blocksFilling(issue), false)
})

test("an old result that names another champion than the final table is an issue", () => {
  const { issue } = outcome(played, { placements: allPlaced, result: result("D") })

  assert.deepEqual(issue, { kind: "OLD_RESULT", source: "TABLE", recorded: "D", found: "A" })
})

test("filling adds the missing teams without prizes and leaves the other lines as they are", () => {
  const first = line("1", "a", { prizeUsd: 1000, lastOpponent: "B" })
  const { rows: read } = outcome(played, { placements: [line("3-4", "d"), first] })

  assert.deepEqual(filledPlacements([line("3-4", "d"), first], read, "MISSING"), [
    first,
    { ...line("2", "b"), prizeUsd: null, prizeLocal: null, lastOpponent: "A", lastScore: "2–4" },
    line("3-4", "d"),
    { ...line("3-4", "c"), prizeUsd: null, prizeLocal: null, lastOpponent: "A", lastScore: "1–3" },
  ])
})

test("replacing moves the lines the matches contradict and keeps their prizes", () => {
  const placements = [line("1", "a"), line("2", "c", { prizeUsd: 500 }), line("3", "b", { prizeLocal: 7 })]
  const { rows: read } = outcome(played, { placements })

  assert.deepEqual(
    filledPlacements(placements, read, "DIFFERS").map(({ place, teamId, prizeUsd, prizeLocal }) => [
      place,
      teamId,
      prizeUsd ?? prizeLocal ?? null,
    ]),
    [
      ["1", "a", null],
      ["2", "b", 7],
      ["3-4", "c", 500],
    ],
  )
})

test("first places several teams share are no champion", () => {
  const read = outcome([], { placements: [line("1-2", "a"), line("1-2", "b"), line("3", "c")] })

  assert.deepEqual([read.result, sharedFirst(read.rows)], [null, { place: "1-2", teams: ["A", "B"], recorded: true }])
})

test("the teams a qualifier sends on share the first places before the table holds them", () => {
  const read = outcome([knockout("A 1: a 2-0 b", "B 1: c 2-0 d")], { competitionType: "QUALIFIER" })

  assert.deepEqual(sharedFirst(read.rows), { place: "1-2", teams: ["A", "C"], recorded: false })
})

test("the teams a qualifier sends on are recorded only once the table holds all of them", () => {
  const read = outcome([knockout("A 1: a 2-0 b", "B 1: c 2-0 d")], {
    competitionType: "QUALIFIER",
    placements: [line("1-2", "a")],
  })

  assert.equal(sharedFirst(read.rows)?.recorded, false)
})

test("one team alone at a shared first place is no qualifier's group", () => {
  assert.equal(sharedFirst(outcome([], { placements: [line("1-2", "a"), line("3", "c")] }).rows), null)
})

/** The table with c listed a second time, at the first place, before its own line. */
const twice = [line("1", "a"), line("1", "c"), line("2", "b"), line("3-4", "c"), line("3-4", "d")]

test("a team the table lists twice is confirmed at the place the matches give, and its other line is a repeat", () => {
  const read = outcome(played, { placements: twice })

  assert.deepEqual(rows(read), ["SAME 1 a", "RECORDED 1 c", "SAME 2 b", "SAME 3-4 c", "SAME 3-4 d"])
  assert.equal(read.rows.find(({ state }) => state === "RECORDED")?.reason, "Đội đã có dòng hạng 3–4")
})

test("a team the table lists twice counts once among its teams", () => {
  assert.deepEqual(label(outcome(played, { placements: twice })), ["Đã đủ 4 đội", "ok"])
})

test("two lines that give one name the plan does not know are one team listed twice", () => {
  const read = outcome(played, {
    placements: [...allPlaced, { place: "5", teamName: "Zeta" }, { place: "6", teamName: "zeta" }],
  })

  assert.deepEqual(label(read), ["Đã đủ 5 đội", "ok"])
  assert.equal(read.rows.at(-1)?.reason, "Đội đã có dòng hạng 5")
})

test("replacing places writes no team twice at one place", () => {
  const { rows: read } = outcome(played, { placements: twice })

  assert.deepEqual(
    filledPlacements(twice, read, "DIFFERS").map(({ place, teamId }) => `${place} ${teamId}`),
    ["1 a", "1 c", "2 b", "3-4 c", "3-4 d"],
  )
})

test("where no team played, every entrant without a place keeps the table open", () => {
  const entrants = ["a", "b", "c", "d", "e"].map((teamId) => ({ teamId, status: "REGISTERED", note: "" }))

  assert.deepEqual(label(outcome([], { placements: [line("1", "a"), line("2", "b")] }, { entrants })), [
    "2/5 đội có hạng",
    "todo",
  ])
})

/** The final was never played: the table names its two teams as disqualified. */
const struck = [line("1", "c"), line("2", "d"), line("dq", "a"), line("dq", "b")]
const unplayedFinal = [knockout(...semifinals, "F 2: a - b")]

test("finalists the table strikes out leave the recorded champion standing, with every place confirmed", () => {
  const read = outcome(unplayedFinal, { placements: struck })

  assert.equal(read.issue, null)
  assert.deepEqual(label(read), ["Đã đủ 4 đội", "ok"])
  assert.deepEqual(rows(read).slice(0, 2), ["SAME 1 c", "SAME 2 d"])
})

test("a finalist the table strikes out under another record still leaves the recorded champion standing", () => {
  const placements = [line("1", "c"), line("2", "d"), line("dq", "a"), { place: "dq", teamName: "Bê Đội" }]

  assert.equal(outcome(unplayedFinal, { placements }).issue, null)
})

test("a struck line read as a finalist under another record is said to wait for the final, like the other", () => {
  const placements = [line("1", "c"), line("2", "d"), line("dq", "a"), { place: "dq", teamName: "Bê Đội" }]
  const recorded = outcome(unplayedFinal, { placements }).rows.filter(({ state }) => state === "RECORDED")

  assert.deepEqual(
    recorded.map(({ teamName, reason }) => [teamName, reason]),
    [
      ["A", "Trận cuối chưa có tỷ số"],
      ["Bê Đội", "Trận cuối chưa có tỷ số"],
    ],
  )
})

test("a team struck out below the finalists does not clear another champion than the matches show", () => {
  const { issue } = outcome(played, { placements: [line("1", "b"), line("2", "a"), line("dq", "c")] })

  assert.equal(issue?.kind, "CHAMPION")
})

test("a line without a number goes after every numbered one, whatever the matches say of the team", () => {
  const read = outcome(played, { placements: [line("1", "a"), line("2", "b"), line("dq", "c"), line("3-4", "d")] })

  assert.deepEqual(rows(read), ["SAME 1 a", "SAME 2 b", "SAME 3-4 d", "SAME dq c"])
})

test("a line without a link that names a team waiting for its last match says so", () => {
  const read = outcome(unplayedFinal, { placements: [{ place: "1", teamName: "A" }] })

  assert.equal(read.rows.find(({ state }) => state === "RECORDED")?.reason, "Trận cuối chưa có tỷ số")
})

test("a place that waits for its match is not asked for where the table gives it to a team a place", () => {
  const qualifier = knockout(
    "A1 1: a 2-0 b",
    "A2 1: c 2-1 d",
    "A3 2: a 2-0 c",
    "B1 1: e 2-0 f",
    "B2 1: g 2-1 h",
    "B3 2: e - g",
  )
  const read = outcome([qualifier], { competitionType: "QUALIFIER", placements: [line("1", "a"), line("2", "e")] })

  assert.deepEqual(
    rows(read).filter((row) => row.startsWith("PENDING")),
    ["PENDING 3-4 ?"],
  )
})

test("a place that still waits for its match keeps the table open", () => {
  const read = outcome(unplayedFinal, { placements: [line("3-4", "c"), line("3-4", "d")] })

  assert.deepEqual(label(read), ["2/4 đội có hạng", "todo"])
})

test("a tournament that goes on with some places recorded counts them instead of waiting", () => {
  const read = outcome(unplayedFinal, { status: "ONGOING", placements: [line("3-4", "c")] })

  assert.deepEqual(label(read), ["1/4 đội có hạng", "waiting"])
})

test("a recorded champion the matches do not confirm takes no score from them", () => {
  assert.equal(outcome(played, { result: result("C", null, null) }).result?.score, null)
})

test("two lines at the first place name no champion of the table, so the recorded result stands", () => {
  const read = outcome(played, { placements: [line("1", "a"), line("1", "x")], result: result("A") })

  assert.equal(read.result?.source, "RESULT")
})

test("replacing a place keeps the last match a line recorded where the matches tell none", () => {
  const league = [stage("Vòng bảng", "ROUND_ROBIN", roundRobin("G", "abc"))]
  const placements = [line("1", "a"), line("3", "b", { lastOpponent: "C", lastScore: "1-2" }), line("2", "c")]
  const { rows: read } = outcome(league, { placements })

  assert.deepEqual(
    filledPlacements(placements, read, "DIFFERS")
      .filter(({ teamId }) => teamId === "b")
      .map(({ place, lastOpponent }) => [place, lastOpponent]),
    [["2", "C"]],
  )
})
