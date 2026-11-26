import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, Side } from "@aov/community-contracts"
import {
  gamesOfPair,
  isOverdue,
  meetEveryone,
  meetingOutcome,
  meetingRounds,
  meetingsBetween,
  mostGames,
  openMatches,
  stageMeetings,
  sumMarks,
  sumOutcome,
  usualLegs,
} from "../src/lib/meetings-model.ts"
import { competition, on, stage, type TestMatch } from "./fixtures/competition.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

const league = stage("RR", { format: "ROUND_ROBIN", bestOf: 3 })
const viewOf = (matches: TestMatch[]): CompetitionView =>
  competition(
    matches.map((match) => ({ bestOf: 3, ...match })),
    { stages: [league] },
  )
const met = (view: CompetitionView, games: TestGame[] = []) =>
  stageMeetings(view, "RR", games.length ? feedOf(games, view) : null)
/** Every pair of some teams once, a match a day; `played` of them have a score. */
const roundRobin = (teams: string, played = Infinity): TestMatch[] =>
  [...teams]
    .flatMap((a, index) => [...teams].slice(0, index).map((b) => [a, b] as const))
    .map(([a, b], index) => ({
      key: `${a}${b}`,
      a,
      b,
      seriesId: `s-${a}${b}`,
      scheduledAt: on(index + 1),
      score: index < played ? [2, 0] : undefined,
    }))

/** A game of the match between A and B, won by the team named. */
const game = (number: number, winner: "a" | "b" | null, team = "a"): TestGame => ({
  id: `g${number}`,
  series: "s1",
  number,
  winner: winner && ((winner === "a" ? "BLUE" : "RED") satisfies Side),
  blue: { team, picks: five("h") },
  red: { team: "b", picks: five("k") },
})
const series = (score?: [number, number]): TestMatch[] => [
  { key: "m1", seriesId: "s1", a: "a", b: "b", score, scheduledAt: on(1) },
]
const marksOf = (games: TestGame[], score?: [number, number]) => met(viewOf(series(score)), games).get("a")![0]!.marks

test("a game nobody published stands as unknown where its number puts it", () => {
  assert.deepEqual(marksOf([game(1, "a"), game(3, "a")], [2, 1]), [true, null, true])
})

test("a game missing at the end of a match is unknown", () => {
  assert.deepEqual(marksOf([game(1, "b")], [0, 2]), [false, null])
})

test("games without a number keep their order, and those missing follow them", () => {
  assert.deepEqual(marksOf([game(0, "a"), { ...game(0, "b"), id: "g00" }], [2, 1]), [true, false, null])
})

test("games that repeat a number keep their order", () => {
  assert.deepEqual(marksOf([game(1, "a"), { ...game(1, "b"), id: "g1b" }], [1, 1]), [true, false])
})

test("a game whose winner or whose side of the team is not recorded is unknown", () => {
  assert.deepEqual(marksOf([game(1, null), game(2, "a", "somebody")], [2, 0]), [null, null])
})

test("a match without published games has no marks", () => {
  assert.deepEqual(marksOf([], [2, 0]), [])
})

test("a match without a score shows the games that are published", () => {
  const [meeting] = met(viewOf(series()), [game(1, "a"), game(2, "b")]).get("a")!
  assert.deepEqual([meeting!.own, meeting!.rival, meeting!.marks], [null, null, [true, false]])
})

test("matches come in the order they are played, those without a date last", () => {
  const view = viewOf([
    { key: "open", a: "a", b: "b", round: 1 },
    { key: "late", a: "a", b: "b", round: 2, scheduledAt: on(9) },
    { key: "early", a: "a", b: "b", round: 3, scheduledAt: on(2) },
  ])
  assert.deepEqual(
    met(view)
      .get("b")!
      .map(({ entry }) => entry.match.key),
    ["early", "late", "open"],
  )
})

test("a match between teams nobody knows yet is no meeting", () => {
  assert.equal(met(viewOf([{ key: "m1", a: "a" }])).size, 0)
})

test("the meetings of two teams are seen from the first", () => {
  const meetings = met(viewOf([...roundRobin("abc"), { key: "again", a: "a", b: "b", score: [1, 2] }]))
  assert.deepEqual(
    meetingsBetween(meetings, "a", "b").map(({ own, rival }) => [own, rival]),
    [
      [0, 2],
      [1, 2],
    ],
  )
  assert.deepEqual(meetingsBetween(meetings, "a", "nobody"), [])
})

test("a match reads as won, lost or level, and as nothing while it has no score", () => {
  const outcome = (score?: [number, number]) => meetingOutcome(met(viewOf(series(score))).get("b")![0]!)
  assert.equal(outcome([0, 2]), "won")
  assert.equal(outcome([2, 1]), "lost")
  assert.equal(outcome([1, 1]), "level")
  assert.equal(outcome([1, 0]), "level")
  assert.equal(outcome(), null)
})

test("the games of several matches add up to a side ahead, or to neither", () => {
  assert.deepEqual([sumOutcome({ own: 5, rival: 4 }), sumOutcome({ own: 4, rival: 5 })], ["won", "lost"])
  assert.equal(sumOutcome({ own: 5, rival: 5 }), "level")
})

test("the marks of a sum are the games won, then those lost", () => {
  assert.deepEqual(sumMarks({ own: 2, rival: 1 }), [true, true, false])
  assert.deepEqual(sumMarks({ own: 0, rival: 0 }), [])
})

test("a match without a score is overdue some hours after it should have started", () => {
  const [meeting] = met(viewOf(series())).get("a")!
  const start = Date.parse(on(1))
  const hours = (count: number) => start + count * 60 * 60 * 1000
  assert.deepEqual(
    [isOverdue(meeting!, hours(-1)), isOverdue(meeting!, hours(1)), isOverdue(meeting!, hours(9))],
    [false, false, true],
  )
})

test("a match without a date is never overdue", () => {
  const [meeting] = met(viewOf([{ key: "m1", a: "a", b: "b" }])).get("a")!
  assert.equal(isOverdue(meeting!, Date.parse(on(30))), false)
})

test("the games of two teams are counted in the competition and in one stage", () => {
  const view = competition(
    [...series([2, 1]), { key: "k1", stageCode: "KO", seriesId: "s2", a: "b", b: "a", scheduledAt: on(9) }],
    { stages: [league, stage("KO")] },
  )
  const final = (number: number): TestGame => ({ ...game(number, "a"), id: `f${number}`, series: "s2" })
  const other: TestGame = { ...game(1, "a", "somebody"), id: "o1", series: "s3" }
  const feed = feedOf([game(1, "a"), game(2, "b"), game(3, "a"), final(1), final(2), other], view)
  assert.deepEqual(gamesOfPair(feed, "a", "b", "RR"), { every: 5, here: 3 })
  assert.deepEqual(gamesOfPair(feed, "b", "a", "KO"), { every: 5, here: 2 })
})

test("without published games two teams have none between them", () => {
  assert.deepEqual(gamesOfPair(null, "a", "b", "RR"), { every: 0, here: 0 })
})

test("a round robin under way is a table of every pair", () => {
  const meetings = met(viewOf(roundRobin("abcdef", 1)))
  assert.equal(meetEveryone([..."abcdef"], meetings), true)
})

test("teams that meet only some of the others make no table of pairs", () => {
  // Eight teams of a Swiss stage after its second round.
  const pairs = ["ab", "cd", "ef", "gh", "ac", "eg", "bd", "fh"]
  const meetings = met(viewOf(pairs.map((pair) => ({ key: pair, a: pair[0]!, b: pair[1]!, score: [2, 0] }))))
  assert.equal(meetEveryone([..."abcdefgh"], meetings), false)
})

test("matches planned between teams to be known may still bring two together", () => {
  const meetings = met(viewOf(roundRobin("abcd").slice(0, 2)))
  assert.equal(meetEveryone([..."abcd"], meetings), false)
  assert.equal(meetEveryone([..."abcd"], meetings, 2), true)
})

test("two teams make no table of pairs", () => {
  assert.equal(meetEveryone(["a", "b"], met(viewOf(roundRobin("ab")))), false)
})

test("matches with an open side are counted for the only group of a stage", () => {
  const view = viewOf([...roundRobin("abcd").slice(0, 2), { key: "o1", a: "a" }, { key: "o2" }])
  assert.equal(openMatches(view, "RR", [..."abcd"], met(view)), 2)
})

test("where groups share a stage an open match belongs to neither", () => {
  const view = viewOf([...roundRobin("abc"), ...roundRobin("xyz"), { key: "o1" }])
  assert.equal(openMatches(view, "RR", [..."abc"], met(view)), 0)
})

test("the usual legs are those most pairs play, whatever a tie-break adds", () => {
  const view = viewOf([...roundRobin("abc"), { key: "tie", a: "a", b: "b", score: [2, 1] }])
  assert.equal(usualLegs([..."abc"], met(view)), 1)
})

test("of two schedules as many pairs play the longer one is usual", () => {
  const twice = [
    { key: "ab", a: "a", b: "b" },
    { key: "ac", a: "a", b: "c" },
    { key: "ca", a: "c", b: "a" },
  ]
  assert.equal(usualLegs([..."abc"], met(viewOf(twice))), 2)
})

test("no pair that meets means no legs", () => {
  assert.equal(usualLegs(["a", "b"], new Map()), 0)
})

test("the longest match of a group counts its score or its published games", () => {
  assert.equal(mostGames(["a", "b"], met(viewOf(series([2, 1])))), 3)
  assert.equal(mostGames(["a", "b"], met(viewOf(series()), [game(1, "a"), game(2, "b")])), 2)
  assert.equal(mostGames(["a", "b"], new Map()), 0)
})

const columns = (matches: TestMatch[], teams = "abcd") =>
  meetingRounds([...teams], met(viewOf(matches))).map(({ number, kind, of }) => [
    number,
    kind,
    [...of].map(([team, { opponentId }]) => team + opponentId).join(" "),
  ])

test("the ways of the teams run through the rounds their labels name", () => {
  const rounds: TestMatch[] = [
    { key: "m3", a: "a", b: "c", label: "Vòng 2 · A vs C", scheduledAt: on(2) },
    { key: "m1", a: "a", b: "b", label: "June 18 ― 0-0 (Bo3) · Vòng 1 · A vs B", scheduledAt: on(1) },
    { key: "m2", a: "c", b: "d", label: "Vòng 1 · C vs D", scheduledAt: on(1) },
  ]
  assert.deepEqual(columns(rounds), [
    [1, "ROUND", "ab ba cd dc"],
    [2, "ROUND", "ac ca"],
  ])
})

test("without names the rounds of the plan make the columns", () => {
  const rounds: TestMatch[] = [
    { key: "m1", a: "a", b: "b", round: 1, scheduledAt: on(1) },
    { key: "m2", a: "c", b: "d", round: 3, scheduledAt: on(2) },
  ]
  assert.deepEqual(columns(rounds), [
    [1, null, "ab ba"],
    [3, null, "cd dc"],
  ])
})

test("a team that plays twice in a round makes the columns count the matches of each team", () => {
  const weeks: TestMatch[] = [
    { key: "m1", a: "a", b: "b", label: "Week 1", scheduledAt: on(1) },
    { key: "m2", a: "a", b: "c", label: "Week 1", scheduledAt: on(2) },
    { key: "m3", a: "b", b: "d", label: "Week 2", scheduledAt: on(8) },
  ]
  assert.deepEqual(columns(weeks), [
    [1, null, "ab ba ca db"],
    [2, null, "ac bd"],
  ])
})

test("teams without a match have no way to show", () => {
  assert.deepEqual(columns([], "ab"), [])
})
