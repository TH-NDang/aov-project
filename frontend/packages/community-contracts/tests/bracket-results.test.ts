import assert from "node:assert/strict"
import { test } from "node:test"
import { byPlan, byRound, matchResult, readBracket } from "../src/bracket-results.ts"
import {
  doubleElimination,
  find,
  game,
  keys,
  knockout,
  lanes,
  linked,
  loserOf,
  pagePlayoffForTwo,
  pagePlayoffWithExtra,
  seed,
  winnerOf,
} from "./fixtures/bracket.ts"

test("a result names its winner and counts the games from the winner's side", () => {
  const { winner, loser, score } = game("F", 1, "a 2-4 b")

  assert.deepEqual({ winner, loser, score }, { winner: "b", loser: "a", score: [4, 2] })
})

test("a draw decides nothing", () => {
  assert.equal(game("F", 1, "a 1-1 b").winner, null)
})

test("a score the plan contradicts decides nothing", () => {
  const { match } = game("F", 1, "a 3-1 b")

  assert.equal(
    matchResult(match, { key: "F", teamAId: "a", teamBId: "b", scoreA: 3, scoreB: 1, consistent: false }).winner,
    null,
  )
})

test("a match without a resolved row still has the teams the plan names", () => {
  const { teamA, teamB, winner } = matchResult(game("F", 1, "a 3-1 b").match, undefined)

  assert.deepEqual([teamA, teamB, winner], ["a", "b", null])
})

test("a side without a link comes from the match its team played before", () => {
  const bracket = readBracket(knockout)

  assert.deepEqual(find(bracket, "F").a, { key: "SF1", type: "WINNER" })
  assert.deepEqual(find(bracket, "F").b, { key: "SF2", type: "WINNER" })
})

test("a side without a link goes the loser's way where its team lost the match before", () => {
  const bracket = readBracket([game("S1", 1, "a 3-1 b"), game("S2", 1, "c 0-3 d"), game("F", 2, "a - c")])

  assert.deepEqual(
    [find(bracket, "F").a, find(bracket, "F").b],
    [
      { key: "S1", type: "WINNER" },
      { key: "S2", type: "LOSER" },
    ],
  )
})

test("a team whose match before has no winner comes from nowhere", () => {
  const bracket = readBracket([game("S1", 1, "a - b"), game("S2", 1, "c 0-3 d"), game("F", 2, "a 3-1 d")])

  assert.equal(find(bracket, "F").a, null)
})

test("a team that beat nobody known goes the winner's way", () => {
  const won = { ...game("S1", 1, "a - b"), teamB: null, winner: "a", loser: null }
  const bracket = readBracket([won, game("M", 2, "a - c")])

  assert.deepEqual(find(bracket, "M").a, { key: "S1", type: "WINNER" })
})

test("a team that lost to nobody known goes the loser's way", () => {
  const beaten = { ...game("S1", 1, "a - b"), teamB: null, winner: null, loser: "a" }
  const bracket = readBracket([beaten, game("M", 2, "a - c")])

  assert.deepEqual(find(bracket, "M").a, { key: "S1", type: "LOSER" })
})

test("a link the plan gives is kept whatever the results say", () => {
  const bracket = readBracket([
    game("S1", 1, "a 3-1 b"),
    game("S2", 1, "c 0-3 d"),
    linked("F", 2, winnerOf("S2"), winnerOf("S1")),
  ])

  assert.deepEqual(find(bracket, "F").a, { key: "S2", type: "WINNER" })
})

test("a side the plan links keeps its link while the match is open", () => {
  const bracket = readBracket([
    game("SF1", 1, "a 3-1 b"),
    game("SF2", 1, "c - d"),
    linked("F", 2, winnerOf("SF1"), winnerOf("SF2")),
  ])

  assert.deepEqual(find(bracket, "F").b, { key: "SF2", type: "WINNER" })
  assert.equal(find(bracket, "SF2").winnerTo, "F")
})

test("a match for third place the plan links is one before the semifinals are played", () => {
  const bracket = readBracket([
    game("SF1", 1, "a - b"),
    game("SF2", 1, "c - d"),
    linked("P3", 2, loserOf("SF1"), loserOf("SF2")),
    linked("F", 2, winnerOf("SF1"), winnerOf("SF2")),
  ])

  assert.deepEqual([keys(bracket.places), keys(bracket.ends)], [["P3"], ["F"]])
})

test("two matches at one hour are read by their rounds", () => {
  const scheduledAt = "2026-10-17T12:00:00Z"
  const bracket = readBracket([
    game("F", 2, "a 3-1 b", { scheduledAt }),
    game("SF1", 1, "a 3-0 c", { scheduledAt }),
    game("SF2", 1, "b 3-0 d", { scheduledAt }),
  ])

  assert.deepEqual(keys(bracket.ends), ["F"])
})

test("wrong hours mislead the order by the hour but not the order by the round", () => {
  const results = [
    game("SF1", 1, "a 3-0 c", { scheduledAt: "2026-10-19T12:00:00Z" }),
    game("SF2", 1, "b 3-0 d", { scheduledAt: "2026-10-17T12:00:00Z" }),
    game("F", 2, "a 3-1 b", { scheduledAt: "2026-10-18T12:00:00Z" }),
  ]

  assert.deepEqual(keys(readBracket(results).ends), ["SF1"])
  assert.deepEqual(keys(readBracket(results, { order: byRound }).ends), ["F"])
})

test("a match for third place filed under round one is found in the order of the plan", () => {
  const results = [...knockout, game("P3", 1, "d 3-1 c")]

  assert.deepEqual(keys(readBracket(results).places), [])
  assert.deepEqual(keys(readBracket(results, { order: byPlan }).places), ["P3"])
})

test("a match counts the wins its winner still needs", () => {
  const bracket = readBracket(knockout)

  assert.deepEqual(
    bracket.matches.map(({ toEnd }) => toEnd),
    [2, 2, 2, 2, 1, 1, 0],
  )
})

test("of the matches a winner goes on to, the last one of the plan counts", () => {
  const { winnerTo, lane } = find(readBracket(pagePlayoffWithExtra), "Q")

  assert.deepEqual([winnerTo, lane], ["F", "upper"])
})

test("a match between the losers of two semifinals is for a place and ends nothing", () => {
  const bracket = readBracket([...knockout, game("P3", 3, "d 3-1 c")])

  assert.deepEqual(keys(bracket.places), ["P3"])
  assert.deepEqual(keys(bracket.ends), ["F"])
  assert.equal(find(bracket, "P3").toEnd, null)
})

test("a qualifier ends in as many matches as it sends on teams", () => {
  const bracket = readBracket([
    game("A1", 1, "a 2-0 b"),
    game("A2", 1, "c 2-1 d"),
    game("B1", 2, "a 2-0 c"),
    game("C1", 1, "e 2-0 f"),
    game("C2", 1, "g 2-1 h"),
    game("D1", 2, "e 2-0 g"),
  ])

  assert.deepEqual(keys(bracket.ends), ["B1", "D1"])
})

test("a match nobody goes on from is an end wherever the plan lists it", () => {
  const bracket = readBracket([...pagePlayoffForTwo].reverse(), { order: byRound })

  assert.deepEqual(keys(bracket.ends), ["SF", "Q"])
})

test("a stage no loser plays on in has one lane", () => {
  const bracket = readBracket([
    linked("F", 2, winnerOf("SF1"), winnerOf("SF2")),
    game("SF2", 1, "c - d"),
    game("SF1", 1, "a - b"),
  ])

  assert.deepEqual(lanes(bracket), { F: "rounds", SF2: "rounds", SF1: "rounds" })
})

test("a stage whose losers play on has an upper lane, a lower lane and a final between them", () => {
  assert.deepEqual(lanes(readBracket(doubleElimination)), {
    US1: "upper",
    US2: "upper",
    LQ1: "lower",
    LQ2: "lower",
    UF: "upper",
    LS: "lower",
    LF: "lower",
    GF: "final",
  })
})

test("the lanes of a double elimination the plan links stand before it is played", () => {
  const bracket = readBracket([
    linked("US1", 1, seed(1), seed(3)),
    linked("US2", 1, seed(2), seed(4)),
    linked("LQ1", 2, loserOf("US1"), seed(5)),
    linked("LQ2", 2, loserOf("US2"), seed(6)),
    linked("UF", 2, winnerOf("US1"), winnerOf("US2")),
    linked("LS", 3, winnerOf("LQ1"), winnerOf("LQ2")),
    linked("LF", 4, loserOf("UF"), winnerOf("LS")),
    linked("GF", 5, winnerOf("UF"), winnerOf("LF")),
  ])

  assert.deepEqual(lanes(bracket), {
    US1: "upper",
    US2: "upper",
    LQ1: "lower",
    LQ2: "lower",
    UF: "upper",
    LS: "lower",
    LF: "lower",
    GF: "final",
  })
})

test("a lower lane without a match against the upper one has no final", () => {
  const bracket = readBracket([
    game("U1", 1, "a - b"),
    game("U2", 1, "c - d"),
    linked("UF", 2, winnerOf("U1"), winnerOf("U2")),
    linked("L1", 2, loserOf("U1"), loserOf("U2")),
    linked("LF", 3, winnerOf("L1"), loserOf("UF")),
  ])

  assert.deepEqual(lanes(bracket), { U1: "upper", U2: "upper", UF: "upper", L1: "lower", LF: "lower" })
})

const withThirdPlace = [
  game("SF1", 1, "a - b"),
  game("SF2", 1, "c - d"),
  linked("P3", 2, loserOf("SF1"), loserOf("SF2")),
  linked("F", 2, winnerOf("SF1"), winnerOf("SF2")),
]

test("a match for third place makes no lower lane", () => {
  const bracket = readBracket(withThirdPlace)

  assert.deepEqual(lanes(bracket), { SF1: "rounds", SF2: "rounds", P3: "place", F: "rounds" })
})

test("a match for third place makes no lower lane where no other match follows", () => {
  const bracket = readBracket(withThirdPlace, { whole: true })

  assert.deepEqual(lanes(bracket), { SF1: "rounds", SF2: "rounds", P3: "place", F: "rounds" })
})

test("a loser of another stage makes no lower lane", () => {
  const bracket = readBracket([
    linked("D", 1, loserOf("GROUP_FINAL"), { type: "TEAM", teamId: "c" }),
    linked("F", 2, winnerOf("D"), { type: "TEAM", teamId: "d" }),
  ])

  assert.deepEqual(lanes(bracket), { D: "rounds", F: "rounds" })
})

test("the lower seeds of a page playoff start in the lower lane", () => {
  const bracket = readBracket([...pagePlayoffForTwo, game("F", 3, "a 3-2 b")])

  assert.deepEqual(lanes(bracket), { Q: "upper", E: "lower", SF: "lower", F: "final" })
})

test("a lower seed plays in the lower lane from its first match on", () => {
  const bracket = readBracket([
    game("Q", 1, "a 3-1 b"),
    game("E1", 1, "d 3-0 e"),
    game("E2", 2, "c 3-2 d"),
    game("SF", 3, "b 3-1 c"),
    game("F", 4, "a 3-2 b"),
  ])

  assert.deepEqual(lanes(bracket), { Q: "upper", E1: "lower", E2: "lower", SF: "lower", F: "final" })
})

test("a match between two winners of the lower lane belongs to it", () => {
  const bracket = readBracket([
    game("U1", 1, "a 3-0 b"),
    game("U2", 1, "c 3-0 d"),
    game("U3", 1, "e 3-0 f"),
    game("U4", 1, "g 3-0 h"),
    game("L1", 2, "b 3-0 d"),
    game("L2", 2, "f 3-0 h"),
    game("L3", 3, "b 3-0 f"),
  ])

  assert.equal(find(bracket, "L3").lane, "lower")
})

test("a rematch of the finalists ends the bracket without opening a lower lane of its own", () => {
  const bracket = readBracket([...doubleElimination.slice(0, -1), game("GF1", 5, "b 2-4 c"), game("GF2", 6, "b 4-1 c")])

  assert.deepEqual(keys(bracket.ends), ["GF2"])
  assert.deepEqual([find(bracket, "GF1").lane, find(bracket, "GF2").lane], ["final", "final"])
})

test("two teams that meet twice in a row make no lower lane", () => {
  const bracket = readBracket([
    game("SF1", 1, "a 2-1 c"),
    game("SF1b", 2, "a 2-0 c"),
    game("SF2", 1, "b 2-0 d"),
    game("F", 3, "a 3-2 b"),
  ])

  assert.deepEqual(lanes(bracket), { SF1: "rounds", SF1b: "rounds", SF2: "rounds", F: "rounds" })
})

test("a beaten team let into the final makes no lower lane while other matches may follow", () => {
  assert.deepEqual(lanes(readBracket(pagePlayoffForTwo)), { Q: "rounds", E: "rounds", SF: "rounds" })
})

test("a loser's match that leads nowhere ends a lower lane where no other match follows", () => {
  const bracket = readBracket(pagePlayoffForTwo, { whole: true })

  assert.deepEqual(lanes(bracket), { Q: "upper", E: "lower", SF: "lower" })
})

/** A double elimination in which the beaten teams of the first lower round meet once more. */
const withFifthPlace = [...doubleElimination, game("P5", 3, "e 3-1 d")]

test("two losers of a lower lane play on there while other matches may follow", () => {
  assert.equal(find(readBracket(withFifthPlace), "P5").lane, "lower")
})

test("two losers of a lower lane play for a place where no other match follows", () => {
  assert.equal(find(readBracket(withFifthPlace, { whole: true }), "P5").lane, "place")
})

test("two losers whose winner goes on play in the lower lane where no other match follows", () => {
  const bracket = readBracket(
    [
      game("U1", 1, "a 3-0 b"),
      game("U2", 1, "c 3-0 d"),
      game("UF", 2, "a 3-0 c"),
      game("L", 2, "b 3-0 d"),
      game("GF", 3, "a 3-0 b"),
    ],
    { whole: true },
  )

  assert.deepEqual(lanes(bracket), { U1: "upper", U2: "upper", UF: "upper", L: "lower", GF: "final" })
})

test("what an app hands on with a result stays with its match", () => {
  const { matches } = readBracket(knockout.map((result) => ({ ...result, note: `note ${result.match.key}` })))

  assert.equal(matches[4]!.note, "note SF1")
})
