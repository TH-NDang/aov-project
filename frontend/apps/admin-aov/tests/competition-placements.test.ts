import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionPlan, CompetitionStage, CompetitionType } from "@aov/community-contracts"
import { suggestedPlacements, type PlacementSuggestions } from "../src/features/competition/workspace/placements"
import { competition, roundRobin, stage, type TestStage } from "./fixtures/competition-plan"

type Options = Partial<CompetitionPlan> & { competitionType?: CompetitionType; finished?: boolean; endsOn?: string }

function suggest(stages: TestStage[], { competitionType, finished = true, endsOn, ...plan }: Options = {}) {
  return suggestedPlacements({ ...competition(stages, plan), competitionType, finished, endsOn })
}

const table = (lines: string[], code = "Vòng bảng", more?: Partial<CompetitionStage>) =>
  stage(code, "ROUND_ROBIN", lines, more)
const knockout = (...lines: string[]) => stage("Playoffs", "SINGLE_ELIMINATION", lines)
const double = (...lines: string[]) => stage("Playoffs", "DOUBLE_ELIMINATION", lines)

const places = ({ lines }: PlacementSuggestions) => lines.map(({ place, teamId }) => `${place} ${teamId ?? "?"}`)
const reasonOf = ({ lines }: PlacementSuggestions, teamId: string) =>
  lines.find((line) => line.teamId === teamId)?.reason
const open = (suggestions: PlacementSuggestions) =>
  suggestions.open.map(({ teamId, reason }) => `${teamId}: ${reason}`).sort()
const openTeams = (suggestions: PlacementSuggestions) => suggestions.open.map(({ teamId }) => teamId).sort()

const seeds = { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f" }
const aogPlayoffs = [
  "US1 1: #1 4-2 #3",
  "US2 1: #2 4-1 #4",
  "LQ1 2: #5 1-4 L:US1",
  "LQ2 2: #6 4-3 L:US2",
  "UF 2: W:US1 3-4 W:US2",
  "LS 3: W:LQ1 4-3 W:LQ2",
  "LF 4: L:UF 2-4 W:LS",
  "GF 5: W:UF 4-2 W:LF",
]
const eightTeams = [
  "QF1 1: a 3-0 h",
  "QF2 1: d 3-1 e",
  "QF3 1: b 3-1 g",
  "QF4 1: c 3-2 f",
  "SF1 2: a 3-1 d",
  "SF2 2: b 3-2 c",
]

test("linked playoffs with lower seeds place everybody by the round of the last lost match", () => {
  const suggestions = suggest([double(...aogPlayoffs)], { playoffSeeds: seeds })

  assert.deepEqual(places(suggestions), ["1 b", "2 c", "3 a", "4 f", "5-6 e", "5-6 d"])
})

test("the teams that did not reach the bracket follow by their rank in the table", () => {
  const suggestions = suggest([table(roundRobin("G", "abcdefgh")), double(...aogPlayoffs)], { playoffSeeds: seeds })

  assert.deepEqual(places(suggestions).slice(-2), ["7 g", "8 h"])
  assert.equal(reasonOf(suggestions, "g"), "Hạng 7 ở Vòng bảng")
})

test("an imported bracket without links is read by the teams that go on", () => {
  const suggestions = suggest([knockout(...eightTeams, "F 3: a 4-2 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 d", "3-4 c", "5-8 h", "5-8 e", "5-8 g", "5-8 f"])
})

test("an imported double elimination is read by the teams that play on after a loss", () => {
  const suggestions = suggest([
    double("U1 1: a 3-0 b", "U2 1: c 3-0 d", "UF 2: a 3-1 c", "L1 2: b 3-2 d", "LF 3: c 3-2 b", "GF 4: a 2-3 c"),
  ])

  assert.deepEqual(places(suggestions), ["1 c", "2 a", "3 b", "4 d"])
})

test("every suggestion names the round it comes from", () => {
  const suggestions = suggest([double(...aogPlayoffs)], { playoffSeeds: seeds })

  assert.deepEqual(
    ["b", "c", "a", "f", "d"].map((id) => reasonOf(suggestions, id)),
    [
      "Thắng chung kết tổng",
      "Thua chung kết tổng",
      "Thua chung kết nhánh thua",
      "Thua bán kết nhánh thua",
      "Thua vòng 1 nhánh thua",
    ],
  )
})

test("a line carries who the team met last and the score from its own side", () => {
  const { lines } = suggest([knockout(...eightTeams, "F 3: a 4-2 b")])

  assert.deepEqual(
    lines.slice(0, 3).map(({ teamId, lastOpponent, lastScore }) => [teamId, lastOpponent, lastScore]),
    [
      ["a", "B", "4–2"],
      ["b", "A", "2–4"],
      ["d", "A", "1–3"],
    ],
  )
})

test("teams that enter a round later stand by the round they lost in", () => {
  const suggestions = suggest([
    knockout("QF1 1: c 3-0 f", "QF2 1: d 3-1 e", "SF1 2: a 3-1 d", "SF2 2: b 3-2 c", "F 3: a 4-2 b"),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 d", "3-4 c", "5-6 f", "5-6 e"])
})

test("a match between the beaten semifinalists gives the third and the fourth place", () => {
  const suggestions = suggest([knockout(...eightTeams, "P3 3: d 3-1 c", "F 3: a 4-2 b")])

  assert.deepEqual(places(suggestions).slice(2, 4), ["3 d", "4 c"])
  assert.equal(reasonOf(suggestions, "c"), "Thua trận tranh hạng ba")
})

test("a match between the beaten quarterfinalists gives the fifth and the sixth place", () => {
  const suggestions = suggest([
    knockout(
      "QF1 1: a 3-0 h",
      "QF2 1: d 3-1 e",
      "SF1 2: a 3-1 c",
      "SF2 2: b 3-2 d",
      "P5 2: e 3-0 h",
      "P3 3: c 3-2 d",
      "F 3: a 4-2 b",
    ),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d", "5 e", "6 h"])
  assert.equal(reasonOf(suggestions, "e"), "Thắng trận phân hạng")
})

test("the lower of two page playoff matches puts its loser last", () => {
  const suggestions = suggest([
    stage("Playoffs", "SINGLE_ELIMINATION", ["Q 1: a 3-1 b", "E 1: c 3-2 d", "SF 2: b 3-1 c", "F 3: a 3-2 b"]),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
})

test("a rematch of the finalists decides a double elimination", () => {
  const suggestions = suggest([
    double(
      "U1 1: a 3-0 b",
      "U2 1: c 3-0 d",
      "UF 2: a 3-1 c",
      "L1 2: b 3-2 d",
      "LF 3: c 3-2 b",
      "G1 4: a 2-3 c",
      "G2 5: a 3-1 c",
    ),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 c", "3 b", "4 d"])
})

test("a pair that meets twice in a row takes nothing from the places of its bracket", () => {
  const suggestions = suggest([
    knockout("Q 1: a 3-1 b", "E1 1: c 3-2 d", "E2 1: c 3-1 d", "SF 2: b 3-1 c", "F 3: a 3-2 b"),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
})

test("matches still to be played leave their places waiting while those below are known", () => {
  const suggestions = suggest([double(...aogPlayoffs.slice(0, 6), "LF 4: L:UF - W:LS", "GF 5: W:UF - W:LF")], {
    playoffSeeds: seeds,
    finished: false,
  })

  assert.deepEqual(places(suggestions), ["1 ?", "2 ?", "3 ?", "4 f", "5-6 e", "5-6 d"])
  assert.deepEqual(
    suggestions.lines.slice(0, 3).map(({ reason }) => reason),
    ["Chờ chung kết tổng", "Chờ chung kết tổng", "Chờ chung kết nhánh thua"],
  )
})

test("a running bracket that names no links tells nothing yet", () => {
  const suggestions = suggest([knockout("SF1 1: a 3-1 c", "SF2 1: b 3-1 d")], { finished: false })

  assert.deepEqual(places(suggestions), [])
})

test("a final nobody scored keeps both finalists waiting for their places", () => {
  const suggestions = suggest([knockout("SF1 1: a 3-1 c", "SF2 1: b 3-1 d", "F 2: a - b")])

  assert.deepEqual(places(suggestions), ["1 ?", "2 ?", "3-4 c", "3-4 d"])
  assert.deepEqual(suggestions.waiting, ["a", "b"])
})

test("a match nobody scored went to the team that plays on, and the other team stays open", () => {
  const suggestions = suggest([knockout("SF1 1: a - c", "SF2 1: b 3-1 d", "F 2: a 3-2 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 d"])
  assert.deepEqual(open(suggestions), ["c: Trận bán kết chưa có tỷ số"])
})

test("a match nobody scored was won by the team that had lost before and plays on", () => {
  const suggestions = suggest([
    double("U1 1: a 3-0 b", "U2 1: c 3-0 d", "UF 2: a 3-1 c", "L1 1: b - d", "LF 2: c 3-2 b", "GF 3: a 2-3 c"),
  ])

  assert.deepEqual(places(suggestions), ["1 c", "2 a", "3 b"])
  assert.deepEqual(open(suggestions), ["d: Trận bán kết nhánh thua chưa có tỷ số"])
})

test("in a qualifier the winner of a match nobody scored may have left, so nothing is read from it", () => {
  const suggestions = suggest([knockout("U1 1: a - c", "U2 1: b 3-1 d", "L1 2: c 3-1 d")], {
    competitionType: "QUALIFIER",
  })

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Playoffs còn 1 trận chưa rõ đội thắng")
})

test("in a qualifier whose round sends its winners on, the team that plays on won the match nobody scored", () => {
  const suggestions = suggest([knockout("SF1 1: a - c", "SF2 1: b 3-1 d", "F 2: a 3-2 b")], {
    competitionType: "QUALIFIER",
  })

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 d"])
})

test("results in which a team plays on after three losses are not read as a bracket", () => {
  const suggestions = suggest([
    knockout("M1 1: a 3-1 b", "M2 2: c 3-1 b", "M3 3: d 3-1 b", "M4 4: b 3-1 e", "M5 5: a 3-1 b"),
  ])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Kết quả ở Playoffs không tạo thành một nhánh đấu")
})

test("a place the hours and the rounds disagree on stays open", () => {
  const suggestions = suggest([
    knockout(
      "QF1 1: a 3-0 e @2026-10-10T12:00Z",
      "SF1 2: a 3-1 c @2026-10-18T12:00Z",
      "SF2 2: b 3-2 d @2026-10-18T15:00Z",
      "F 3: a 4-2 b @2026-10-17T12:00Z",
    ),
  ])

  assert.ok(openTeams(suggestions).includes("c"))
  assert.ok(!places(suggestions).some((place) => place.endsWith(" c")))
})

test("show matches in the stage of the bracket rank nobody", () => {
  const suggestions = suggest([knockout(...eightTeams, "F 3: a 4-2 b", "S 1: x 2-0 y")])

  assert.deepEqual(places(suggestions).slice(0, 2), ["1 a", "2 b"])
  assert.deepEqual(openTeams(suggestions), ["x", "y"])
})

test("the teams a qualifier sends on share the first places", () => {
  const suggestions = suggest(
    [knockout("A1 1: a 2-0 b", "A2 1: c 2-1 d", "A3 2: a 2-0 c", "B1 1: e 2-0 f", "B2 1: g 2-1 h", "B3 2: e 2-0 g")],
    { competitionType: "QUALIFIER" },
  )

  assert.deepEqual(places(suggestions).slice(0, 4), ["1-2 a", "1-2 e", "3-4 c", "3-4 g"])
  assert.equal(reasonOf(suggestions, "a"), "Đi tiếp, thắng vòng 2")
})

test("a qualifier that gives the loser of its first winner another chance is read by its two lanes", () => {
  const suggestions = suggest([knockout("Q 1: a 3-1 b", "E 1: c 3-2 d", "SF 2: b 3-1 c")], {
    competitionType: "QUALIFIER",
  })

  assert.deepEqual(places(suggestions), ["1-2 a", "1-2 b", "3 c", "4 d"])
  assert.equal(reasonOf(suggestions, "b"), "Đi tiếp, thắng chung kết nhánh thua")
})

test("a qualifier whose ways are not as long as each other lacks a match and is not read", () => {
  const suggestions = suggest([knockout("A1 1: a 2-0 b", "A2 1: c 2-1 d", "A3 2: a 2-0 c", "B1 1: e 2-0 f")], {
    competitionType: "QUALIFIER",
  })

  assert.deepEqual(places(suggestions), [])
})

test("a qualifier whose rounds contradict its links is not read", () => {
  const suggestions = suggest(
    [
      knockout(
        "M1 3: a 3-0 b @2026-10-01T12:00Z",
        "M2 1: W:M1 3-0 c @2026-10-01T12:00Z",
        "M3 4: W:M2 3-0 d @2026-10-01T12:00Z",
        "M4 4: W:M3 3-0 e @2026-10-01T12:00Z",
        "X 3: c 3-0 e @2026-10-04T12:00Z",
      ),
    ],
    { competitionType: "QUALIFIER" },
  )

  assert.deepEqual(places(suggestions), [])
})

test("a tournament whose bracket ends in several matches has no champion yet", () => {
  const suggestions = suggest([knockout("SF1 1: a 3-1 c", "SF2 1: b 3-1 d")])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Playoffs có 2 trận cuối, chưa có trận quyết định nhà vô địch")
})

test("teams the table leaves level share their places", () => {
  const suggestions = suggest([table(roundRobin("G", "abcde", ["ec"])), knockout("F 1: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-5 c", "3-5 d", "3-5 e"])
  assert.equal(reasonOf(suggestions, "c"), "Đồng hạng 3 ở Vòng bảng")
})

test("a stage that leaves teams level and has no rule to part them is named", () => {
  const stages = [table(roundRobin("G", "abcde", ["ec"])), knockout("F 1: a 3-1 b")]

  assert.deepEqual(
    suggest(stages).level.map(({ code }) => code),
    ["Vòng bảng"],
  )
})

test("teams out of a Swiss stage share a place by their record, and no missing rule is named", () => {
  const suggestions = suggest([table(["S1 1: a 2-0 c", "S2 1: b 2-0 d"], "Swiss"), knockout("F 2: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 c", "3-4 d"])
  assert.deepEqual(suggestions.level, [])
})

test("a team level with one that went on takes the place below it", () => {
  const suggestions = suggest([table(roundRobin("G", "abcd", ["db"])), knockout("F 1: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 c", "3-4 d"])
})

test("the teams of one rank in two groups share their places", () => {
  const suggestions = suggest([
    table([...roundRobin("A", "abcd"), ...roundRobin("B", "efgh")]),
    knockout("SF1 1: a 3-1 f", "SF2 1: e 3-1 b", "F 2: a 3-1 e"),
  ])

  assert.deepEqual(places(suggestions).slice(4), ["5-6 c", "5-6 g", "7-8 d", "7-8 h"])
  assert.equal(reasonOf(suggestions, "c"), "Hạng 3 một bảng ở Vòng bảng")
})

test("groups planned as stages of their own are read side by side", () => {
  const suggestions = suggest([
    table(roundRobin("A", "abc"), "Bảng A", { teamIds: ["a", "b", "c"] }),
    table(roundRobin("B", "def"), "Bảng B", { teamIds: ["d", "e", "f"] }),
    knockout("SF1 1: a 3-1 e", "SF2 1: d 3-1 b", "F 2: a 3-1 d"),
  ])

  assert.deepEqual(places(suggestions).slice(4), ["5-6 c", "5-6 f"])
  assert.equal(reasonOf(suggestions, "f"), "Hạng 3 ở Bảng B")
})

test("of two tables in a row the first ranks only those it sends no further", () => {
  const suggestions = suggest([
    table(roundRobin("G", "abcdef"), "Vòng bảng"),
    table(roundRobin("S", "bacd"), "Vòng siêu bảng", { teamIds: ["a", "b", "c", "d"] }),
  ])

  assert.deepEqual(places(suggestions), ["1 b", "2 a", "3 c", "4 d", "5 e", "6 f"])
})

test("the legs of a league are added up", () => {
  const suggestions = suggest([table(roundRobin("X", "abcd"), "Lượt đi"), table(roundRobin("Y", "adbc"), "Lượt về")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 d", "4 c"])
  assert.equal(reasonOf(suggestions, "a"), "Hạng 1 ở Lượt đi và Lượt về")
})

test("a league without a bracket is ranked by its table", () => {
  assert.deepEqual(places(suggest([table(roundRobin("G", "abcd"))])), ["1 a", "2 b", "3 c", "4 d"])
})

test("a match played to part two level teams parts them", () => {
  const level = roundRobin("G", "abcd", ["da"])
  const suggestions = suggest([table([...level, "D 2: d 3-1 c"]), knockout("F 1: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 d", "4 c"])
})

test("a match beyond the schedule between teams the points already part leaves the table unread", () => {
  const suggestions = suggest([table([...roundRobin("G", "abcd"), "D 2: a 3-1 d"])])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Các đội ở Vòng bảng không gặp nhau số lần như nhau")
})

test("a draw that changes no order leaves the table readable", () => {
  const suggestions = suggest([table(["G1 1: a 2-0 b", "G2 1: a 2-0 c", "G3 1: b 1-1 c"])])

  assert.deepEqual(places(suggestions), ["1 a", "2-3 b", "2-3 c"])
})

test("a draw that could change the order leaves the table unread", () => {
  const suggestions = suggest([table(["G1 1: a 2-0 b", "G2 1: c 2-0 a", "G3 1: b 1-1 c"])])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Vòng bảng có trận hòa mà giai đoạn chưa có điểm cho trận hòa")
})

test("a table that ranks a team above one that went on is not read", () => {
  const suggestions = suggest([table(roundRobin("G", "abcd")), knockout("F 1: a 3-1 d")])

  assert.deepEqual(places(suggestions), ["1 a", "2 d"])
  assert.deepEqual(open(suggestions), [
    "b: Vòng bảng không khớp với các đội đi tiếp: B, C xếp trên mà không đá tiếp",
    "c: Vòng bảng không khớp với các đội đi tiếp: B, C xếp trên mà không đá tiếp",
  ])
})

test("a match without a score leaves the table unread", () => {
  const lines = roundRobin("G", "abcd").map((line) => (line.startsWith("Gcd") ? "Gcd 1: c - d" : line))
  const suggestions = suggest([table(lines), knockout("F 1: a 3-1 b")])

  assert.deepEqual(open(suggestions), [
    "c: Vòng bảng còn 1 trận chưa có tỷ số",
    "d: Vòng bảng còn 1 trận chưa có tỷ số",
  ])
})

test("a team none of whose matches has a score stays open while the others are ranked", () => {
  const lines = roundRobin("G", "abcd").map((line) => (line.includes("d") ? line.replace("2-0", "-") : line))
  const suggestions = suggest([table(lines), knockout("F 1: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c"])
  assert.deepEqual(open(suggestions), ["d: Không trận nào ở Vòng bảng có tỷ số"])
})

test("teams that met a different number of times are not ranked", () => {
  const suggestions = suggest([
    table(["G1 1: a 2-0 b", "G2 1: a 2-0 c", "G3 1: b 2-0 d", "G4 1: c 2-0 d"]),
    knockout("F 1: a 3-1 b"),
  ])

  assert.deepEqual(open(suggestions), [
    "c: Các đội ở Vòng bảng không gặp nhau số lần như nhau",
    "d: Các đội ở Vòng bảng không gặp nhau số lần như nhau",
  ])
})

const swiss = [
  "R1a 1: a 2-0 b",
  "R1b 1: c 2-0 d",
  "R1c 1: e 2-0 f",
  "R1d 1: g 2-0 h",
  "R2a 2: a 2-0 c",
  "R2b 2: e 2-0 g",
  "R2c 2: b 2-0 d",
  "R2d 2: f 2-0 h",
  "R3a 3: c 2-0 f",
  "R3b 3: g 2-0 b",
]

test("a Swiss stage ranks those out by the matches they won", () => {
  const suggestions = suggest([
    stage("Vòng Thụy Sĩ", "CUSTOM", swiss),
    knockout("SF1 1: a 3-1 g", "SF2 1: e 3-1 c", "F 2: a 3-1 e"),
  ])

  assert.deepEqual(places(suggestions).slice(4), ["5-6 b", "5-6 f", "7-8 d", "7-8 h"])
  assert.equal(reasonOf(suggestions, "b"), "Thắng 1, thua 2 ở Vòng Thụy Sĩ")
})

test("a Swiss stage planned as a table is read by its table", () => {
  const suggestions = suggest([
    table(swiss, "Vòng Thụy Sĩ"),
    knockout("SF1 1: a 3-1 g", "SF2 1: e 3-1 c", "F 2: a 3-1 e"),
  ])

  assert.deepEqual(places(suggestions).slice(4), ["5-6 b", "5-6 f", "7-8 d", "7-8 h"])
  assert.equal(reasonOf(suggestions, "b"), "Đồng hạng 5 ở Vòng Thụy Sĩ")
})

test("a team entered under another record halfway leaves both halves unread", () => {
  const suggestions = suggest([table(roundRobin("X", "abcd"), "Lượt đi"), table(roundRobin("Y", "xbcd"), "Lượt về")])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Lượt đi và Lượt về không cùng các đội (A, X)")
})

test("stages are read in the order they are played, whatever their order in the plan", () => {
  const suggestions = suggest([
    knockout("F 1: a 3-1 b @2026-11-01T12:00Z"),
    table(roundRobin("G", "abcd").map((line) => `${line} @2026-10-01T12:00Z`)),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
})

test("a bracket that knows only its day is read after the groups played on that day", () => {
  const groups = [...roundRobin("A", "abcd"), ...roundRobin("B", "efgh")].map((line) => `${line} @2017-01-08T07:15Z`)
  const bracket = ["SF1 1: a 1-0 f", "SF2 1: e 1-0 b", "F 2: a 2-0 e"].map((line) => `${line} @2017-01-08T00:00Z`)
  const suggestions = suggest([knockout(...bracket), table(groups)])

  assert.deepEqual(places(suggestions).slice(0, 4), ["1 a", "2 e", "3-4 f", "3-4 b"])
})

test("a stage that knows only its day stays before the stages of a later day", () => {
  const first = roundRobin("G", "abcd").map((line) => `${line} @2017-01-07T00:00Z`)
  const suggestions = suggest([knockout("F 1: a 3-1 b @2017-01-08T07:00Z"), table(first)])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
})

test("a stage with a real hour among its midnights is read by its first hour, as it was played", () => {
  const qualifier = stage("Vòng loại", "SINGLE_ELIMINATION", [
    "Q1 1: a 2-0 e @2017-01-08T00:00Z",
    "Q2 1: b 2-0 f @2017-01-08T03:00Z",
  ])
  const suggestions = suggest([qualifier, knockout("F 2: a 3-1 b @2017-01-08T07:00Z")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 e", "3-4 f"])
})

test("an unscored last match of a qualifier with a side nobody knows yet holds every place", () => {
  const suggestions = suggest(
    [knockout("A1 1: a 2-0 b", "A2 1: c 2-1 d", "A3 2: a 2-0 c", "B1 1: e 2-0 f", "B3 2: e - ?")],
    { competitionType: "QUALIFIER" },
  )

  assert.deepEqual(places(suggestions), [])
})

test("an unscored last match of a qualifier leaves only its two teams without a place", () => {
  const suggestions = suggest(
    [knockout("A1 1: a 2-0 b", "A2 1: c 2-1 d", "A3 2: a 2-0 c", "B1 1: e 2-0 f", "B2 1: g 2-1 h", "B3 2: e - g")],
    { competitionType: "QUALIFIER" },
  )

  assert.deepEqual(places(suggestions), ["1-2 a", "1-2 ?", "3-4 c", "3-4 ?", "5-8 b", "5-8 d", "5-8 f", "5-8 h"])
  assert.deepEqual(suggestions.waiting.sort(), ["e", "g"])
})

test("matches nobody scored are read by whom each team met next, as in the wildcard of the TEPL 2026", () => {
  const suggestions = suggest(
    [
      knockout(
        "U1 1: a 1-2 b @2026-06-06T00:00Z",
        "U2 1: c 0-2 d @2026-06-06T00:00Z",
        "U3 1: e - f @2026-06-06T00:00Z",
        "U4 1: g 0-2 h @2026-06-06T00:00Z",
        "U5 2: b 1-3 d @2026-06-06T00:00Z",
        "U6 2: f 3-1 h @2026-06-06T00:00Z",
        "L1 1: a 1-2 c @2026-06-07T00:00Z",
        "L2 1: e - g @2026-06-07T00:00Z",
        "L3 2: b 3-0 c @2026-06-07T00:00Z",
        "L4 2: h 3-0 g @2026-06-07T00:00Z",
      ),
    ],
    { competitionType: "QUALIFIER" },
  )

  assert.deepEqual(places(suggestions), ["1-4 d", "1-4 f", "1-4 b", "1-4 h", "5-6 c", "5-6 g", "7-8 a"])
  assert.deepEqual(open(suggestions), ["e: Trận vòng 1 nhánh thua chưa có tỷ số"])
})

test("a match of two losers whose loser plays on is no match for a place, and the bracket is not read", () => {
  const suggestions = suggest([
    knockout("SF1 1: a 2-0 b", "SF2 1: c 2-0 d", "F 2: W:SF1 2-0 W:SF2", "P3 2: L:SF1 2-0 L:SF2", "P5 3: L:P3 2-0 e"),
  ])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Kết quả ở Playoffs không tạo thành một nhánh đấu")
})

test("three stages in a sentence are named by the first and the last", () => {
  const legs = ["X", "Y", "Z"].map((code, at) => table(roundRobin(code, "abcd"), `Lượt ${at + 1}`))
  const suggestions = suggest(legs, { finished: false })

  assert.equal(suggestions.open[0]?.reason, "Giải có thể còn trận sau Lượt 1 đến Lượt 3")
})

test("a plan that ends the day before the tournament did is whole", () => {
  const lines = roundRobin("G", "abcd").map((line) => `${line} @2026-10-01T12:00Z`)

  assert.deepEqual(places(suggest([table(lines)], { endsOn: "2026-10-02" })), ["1 a", "2 b", "3 c", "4 d"])
})

test("a bracket whose teams play in no other stage is kept apart", () => {
  const suggestions = suggest([
    stage("Vòng loại", "SINGLE_ELIMINATION", ["Q 1: x 2-0 y"]),
    table(roundRobin("G", "abcd")),
    knockout("F 1: a 3-1 b"),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
  assert.deepEqual(open(suggestions), [
    "x: Đá ở Vòng loại, tách khỏi các giai đoạn khác",
    "y: Đá ở Vòng loại, tách khỏi các giai đoạn khác",
  ])
})

test("a group nobody goes on from is left out of the places of the others", () => {
  const suggestions = suggest([table([...roundRobin("A", "abcd"), ...roundRobin("B", "xy")]), knockout("F 1: a 3-1 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d"])
  assert.deepEqual(open(suggestions), [
    "x: Không đội nào cùng bảng ở Vòng bảng đi tiếp",
    "y: Không đội nào cùng bảng ở Vòng bảng đi tiếp",
  ])
})

test("groups with no match between their winners name no champion", () => {
  const suggestions = suggest([table([...roundRobin("A", "abc"), ...roundRobin("B", "def")])])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Vòng bảng chia 2 bảng, chưa có trận quyết định nhà vô địch")
})

test("the groups of a qualifier share their places rank by rank", () => {
  const suggestions = suggest([table([...roundRobin("A", "ab"), ...roundRobin("B", "cd")])], {
    competitionType: "QUALIFIER",
  })

  assert.deepEqual(places(suggestions), ["1-2 a", "1-2 c", "3-4 b", "3-4 d"])
})

test("a match for third place in a stage of its own gives the third and the fourth place", () => {
  const suggestions = suggest([
    stage("Bán kết", "SINGLE_ELIMINATION", ["SF1 1: a 3-1 c", "SF2 1: b 3-1 d"]),
    stage("Tranh hạng ba", "SINGLE_ELIMINATION", ["P3 1: d 3-1 c"]),
    stage("Chung kết", "SINGLE_ELIMINATION", ["F 1: a 4-2 b"]),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 d", "4 c"])
  assert.equal(reasonOf(suggestions, "d"), "Thắng trận ở Tranh hạng ba")
})

test("a match for third place in a later stage does not make a champion", () => {
  const suggestions = suggest([
    knockout("SF1 1: a 3-1 c", "SF2 1: b 3-1 d", "F 2: a 4-2 b"),
    stage("Tranh hạng ba", "SINGLE_ELIMINATION", ["P3 1: d 3-1 c"]),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 d", "4 c"])
})

test("stages for the fifth to eighth place order the teams that shared those places", () => {
  const suggestions = suggest([
    knockout(...eightTeams, "F 3: a 4-2 b"),
    stage("Hạng 5 đến 8", "SINGLE_ELIMINATION", ["L1 1: h 2-0 e", "L2 1: g 2-0 f"]),
    stage("Hạng 5", "SINGLE_ELIMINATION", ["L3 1: h 2-1 g"]),
  ])

  assert.deepEqual(places(suggestions).slice(0, 4), ["1 a", "2 b", "3-4 d", "3-4 c"])
  assert.deepEqual(places(suggestions).slice(4), ["5 h", "6 g", "7-8 e", "7-8 f"])
})

test("a table of those the first table left behind orders their places", () => {
  const suggestions = suggest([
    table(roundRobin("G", "abcdef")),
    knockout("F 1: a 3-1 b"),
    table(roundRobin("C", "fedc"), "Nhóm phân hạng", { teamIds: ["c", "d", "e", "f"] }),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 f", "4 e", "5 d", "6 c"])
})

test("a later match between teams with others between them leaves all their places open", () => {
  const suggestions = suggest([
    table(roundRobin("G", "abcdefg")),
    knockout("F 1: a 3-1 b"),
    stage("Tranh suất", "SINGLE_ELIMINATION", ["X 1: e 3-1 c"]),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "6 f", "7 g"])
  assert.deepEqual(open(suggestions), [
    "c: Tranh suất đá thêm, chưa rõ tranh hạng nào",
    "d: Tranh suất đá thêm, chưa rõ tranh hạng nào",
    "e: Tranh suất đá thêm, chưa rõ tranh hạng nào",
  ])
})

test("two last stages with new teams in one of them name no champion", () => {
  const suggestions = suggest([
    table(roundRobin("G", "abcd")),
    knockout("F 1: a 3-1 b"),
    stage("Thăng hạng", "SINGLE_ELIMINATION", ["X 1: x 3-1 d"]),
  ])

  assert.deepEqual(places(suggestions), [])
  assert.equal(
    suggestions.open[0]?.reason,
    "Playoffs và Thăng hạng cùng là giai đoạn cuối, chưa rõ giai đoạn nào tranh vô địch",
  )
})

test("a table ranks nobody while the stage after it waits for its teams", () => {
  const suggestions = suggest([table(roundRobin("G", "abcd")), knockout("F 1: #1 - #2")], { finished: false })

  assert.deepEqual(openTeams(suggestions), ["a", "b", "c", "d"])
  assert.equal(suggestions.open[0]?.reason, "Chưa rõ hết các đội ở Playoffs")
})

test("a table ranks those the linked playoffs after it leave out while they are played", () => {
  const suggestions = suggest(
    [table(roundRobin("G", "abcdefg")), knockout("SF1 1: a - d", "SF2 1: b 3-2 c", "F 2: W:SF1 - W:SF2")],
    { finished: false },
  )

  assert.deepEqual(places(suggestions).slice(-3), ["5 e", "6 f", "7 g"])
})

test("a table ranks nobody while the matches after it name no links", () => {
  const suggestions = suggest([table(roundRobin("G", "abcd")), knockout("F 1: a - b")], { finished: false })

  assert.deepEqual(openTeams(suggestions), ["a", "b", "c", "d"])
})

test("a group that has not played yet has not withdrawn", () => {
  const later = roundRobin("B", "efgh").map((line) => line.replace("2-0", "-"))
  const suggestions = suggest(
    [table([...roundRobin("A", "abcd"), ...later]), knockout("SF1 1: a - b", "F 2: W:SF1 - e")],
    { finished: false },
  )

  assert.deepEqual(open(suggestions).slice(0, 1), ["c: Vòng bảng còn 6 trận chưa có tỷ số"])
})

test("a stage without matches keeps every place open, whether the tournament is over or not", () => {
  const stages = [table(roundRobin("G", "abcd")), knockout()]

  for (const finished of [true, false]) {
    const suggestions = suggest(stages, { finished })
    assert.deepEqual(places(suggestions), [])
    assert.equal(suggestions.open[0]?.reason, "Chưa biết ai đá ở Playoffs")
  }
})

test("the table of a league that still goes on names no champion", () => {
  const suggestions = suggest([table(roundRobin("G", "abcd"))], { finished: false })

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Giải có thể còn trận sau Vòng bảng")
})

test("a plan that stops days before the tournament ended names no champion", () => {
  const lines = roundRobin("G", "abcd").map((line) => `${line} @2026-10-01T12:00Z`)

  assert.deepEqual(places(suggest([table(lines)], { endsOn: "2026-10-01" })).slice(0, 1), ["1 a"])
  assert.deepEqual(places(suggest([table(lines)], { endsOn: "2026-10-11" })), [])
})

test("a match for third place in round one, at the hour of all others, is read where the plan lists it", () => {
  const hour = "@2026-07-01T00:00Z"
  const suggestions = suggest([
    knockout(
      `QF1 1: a 2-1 e ${hour}`,
      `QF2 1: d 2-0 f ${hour}`,
      `QF3 1: c 2-1 g ${hour}`,
      `QF4 1: b 2-1 h ${hour}`,
      `SF1 2: a 3-0 d ${hour}`,
      `SF2 2: b 3-0 c ${hour}`,
      `F 3: a 3-0 b ${hour}`,
      `P3 1: c 3-0 d ${hour}`,
    ),
  ])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3 c", "4 d", "5-8 e", "5-8 f", "5-8 g", "5-8 h"])
})

test("a bracket that lacks a match of a round is not read", () => {
  const lines = [...eightTeams.filter((line) => !line.startsWith("SF1")), "F 3: a 4-2 b"]

  assert.deepEqual(places(suggest([knockout(...lines)])), [])
})

test("a bracket that lacks a whole round is not read", () => {
  assert.deepEqual(places(suggest([knockout("M1 1: c 3-0 d", "M3 3: a 4-2 c")])), [])
})

test("a bracket whose matches all stand in one round is read by the teams that go on", () => {
  const suggestions = suggest([knockout("SF1 1: a 3-1 c", "SF2 1: b 3-1 d", "F 1: a 4-2 b")])

  assert.deepEqual(places(suggestions), ["1 a", "2 b", "3-4 c", "3-4 d"])
})

test("a double elimination where one loser of a round does not play on is not read", () => {
  const suggestions = suggest([
    double(
      "U1 1: a 3-0 b",
      "U2 1: c 3-0 d",
      "U3 1: e 3-0 f",
      "U4 1: g 3-0 h",
      "US1 2: a 3-1 c",
      "US2 2: e 3-1 g",
      "L1 1: f 3-1 h",
      "L2 2: g 3-1 b",
      "L3 2: c 3-1 f",
      "L4 3: c 3-1 g",
      "UF 3: a 3-1 e",
      "LF 4: e 3-1 c",
      "GF 5: a 3-1 e",
    ),
  ])

  assert.deepEqual(places(suggestions), [])
})

test("a bracket planned as two stages its teams go between is not read", () => {
  const suggestions = suggest([
    stage("Nhánh thắng", "SINGLE_ELIMINATION", [
      "U1 1: a 3-0 b @2026-10-01T12:00Z",
      "U2 1: c 3-0 d @2026-10-01T15:00Z",
      "UF 2: a 3-1 c @2026-10-02T12:00Z",
      "GF 3: a 3-1 c @2026-10-05T12:00Z",
    ]),
    stage("Nhánh thua", "SINGLE_ELIMINATION", ["L1 1: b 3-2 d @2026-10-03T12:00Z", "LF 2: c 3-2 b @2026-10-04T12:00Z"]),
  ])

  assert.deepEqual(places(suggestions), [])
  assert.equal(suggestions.open[0]?.reason, "Nhánh thắng và Nhánh thua đá xen kẽ nhau")
})

const entrant = (teamId: string, status = "REGISTERED") => ({ teamId, status, note: "" })

test("an entrant in no match is listed as one that may not have taken part", () => {
  const suggestions = suggest([knockout("F 1: a 3-1 b")], { entrants: ["a", "b", "z"].map((id) => entrant(id)) })

  assert.deepEqual(
    suggestions.open.map(({ teamId, idle }) => [teamId, idle]),
    [["z", true]],
  )
})

test("an entrant that withdrew is not listed", () => {
  const suggestions = suggest([knockout("F 1: a 3-1 b")], {
    entrants: [entrant("a"), entrant("b"), entrant("z", "WITHDRAWN")],
  })

  assert.deepEqual(suggestions.open, [])
})
