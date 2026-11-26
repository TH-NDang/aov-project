import assert from "node:assert/strict"
import { test } from "node:test"
import { readBracket } from "../src/bracket-results.ts"
import {
  columns,
  doubleElimination,
  eightInTwoLanes,
  english,
  game,
  knockout,
  linked,
  loserOf,
  names,
  pagePlayoffWithExtra,
  unscoredQualifier,
  winnerOf,
} from "./fixtures/bracket.ts"

test("a match stands a column after the last of those that feed it", () => {
  assert.deepEqual(columns(readBracket(doubleElimination)), {
    US1: 0,
    US2: 0,
    LQ1: 1,
    LQ2: 1,
    UF: 1,
    LS: 2,
    LF: 3,
    GF: 4,
  })
})

test("a match of a late entry stands next to the one it leads to", () => {
  const bracket = readBracket([
    game("Q1", 1, "a 3-0 b"),
    linked("S1", 2, winnerOf("Q1"), { type: "TEAM", teamId: "c" }),
    game("S2", 2, "d 3-0 e"),
    linked("F", 3, winnerOf("S1"), winnerOf("S2")),
  ])

  assert.deepEqual(columns(bracket), { Q1: 0, S1: 1, S2: 1, F: 2 })
})

test("a match that leads to two others stands next to the nearer one", () => {
  const { Q, X, F } = columns(readBracket(pagePlayoffWithExtra))

  assert.deepEqual({ Q, X, F }, { Q: 0, X: 1, F: 2 })
})

test("matches nobody links stand in the columns of their rounds", () => {
  const bracket = readBracket([game("A", 1, "a - b"), game("B", 3, "c - d"), game("C", 3, "e - f")])

  assert.deepEqual(columns(bracket), { A: 0, B: 1, C: 1 })
})

test("a match nobody scored stands in the column of the round it was played in", () => {
  const { U3, L2 } = columns(readBracket(unscoredQualifier))

  assert.deepEqual({ U3, L2 }, { U3: 0, L2: 1 })
})

test("links that lead in a circle by a wrong hour still leave every match a column", () => {
  const bracket = readBracket([
    game("SF", 1, "a 3-0 b", { scheduledAt: "2026-10-19T12:00:00Z" }),
    game("F", 2, "a 3-1 c", { a: winnerOf("SF"), scheduledAt: "2026-10-18T12:00:00Z" }),
  ])

  assert.deepEqual(columns(bracket), { SF: 2, F: 1 })
})

test("the rounds of a knockout read by how far they are from the final", () => {
  assert.deepEqual(names(readBracket(knockout)), {
    QF1: "Tứ kết",
    QF2: "Tứ kết",
    QF3: "Tứ kết",
    QF4: "Tứ kết",
    SF1: "Bán kết",
    SF2: "Bán kết",
    F: "Chung kết",
  })
})

test("a round before the quarterfinals reads by its number", () => {
  const bracket = readBracket([game("R1", 1, "h 3-2 i"), ...knockout])

  assert.equal(names(bracket).R1, "Vòng 1")
})

test("a match that is the only one before the final is no semifinal", () => {
  const bracket = readBracket([game("M1", 1, "c 3-0 d"), game("M2", 2, "b 3-1 c"), game("F", 3, "a 3-2 b")])

  assert.deepEqual(names(bracket), { M1: "Vòng 1", M2: "Vòng 2", F: "Chung kết" })
})

test("two matches before the semifinals are no quarterfinals", () => {
  const bracket = readBracket([
    game("M1", 1, "c 3-0 f"),
    game("M2", 1, "d 3-1 e"),
    game("SF1", 2, "a 3-1 d"),
    game("SF2", 2, "b 3-2 c"),
    game("F", 3, "a 4-2 b"),
  ])

  assert.deepEqual([names(bracket).M1, names(bracket).SF1], ["Vòng 1", "Bán kết"])
})

test("the last round of a qualifier that sends on several teams is not called a final", () => {
  const bracket = readBracket([game("A", 1, "a 2-0 b"), game("B", 1, "c 2-0 d")])

  assert.deepEqual(names(bracket), { A: "Vòng 1", B: "Vòng 1" })
})

test("the rounds of a double elimination read by their lane", () => {
  assert.deepEqual(names(readBracket(doubleElimination)), {
    US1: "Bán kết nhánh thắng",
    US2: "Bán kết nhánh thắng",
    LQ1: "Vòng 1 nhánh thua",
    LQ2: "Vòng 1 nhánh thua",
    UF: "Chung kết nhánh thắng",
    LS: "Bán kết nhánh thua",
    LF: "Chung kết nhánh thua",
    GF: "Chung kết tổng",
  })
})

test("rounds are named by how far they are from the end of their lane", () => {
  const bracket = readBracket([
    game("U1", 1, "a 3-1 b"),
    game("U2", 1, "c 0-3 d"),
    game("UF", 2, "a 3-2 d"),
    game("L1", 2, "b 3-0 c"),
    game("LF", 3, "d 1-3 b"),
    game("GF", 4, "a 3-2 b"),
  ])

  assert.deepEqual(names(bracket), {
    U1: "Bán kết nhánh thắng",
    U2: "Bán kết nhánh thắng",
    UF: "Chung kết nhánh thắng",
    L1: "Bán kết nhánh thua",
    LF: "Chung kết nhánh thua",
    GF: "Chung kết tổng",
  })
})

test("a first round of four matches in the upper lane is its quarterfinal", () => {
  const { U1, U4, US1, UF } = names(readBracket(eightInTwoLanes))

  assert.deepEqual(
    [U1, U4, US1, UF],
    ["Tứ kết nhánh thắng", "Tứ kết nhánh thắng", "Bán kết nhánh thắng", "Chung kết nhánh thắng"],
  )
})

test("a match that is the only one before the last of the upper lane is no semifinal", () => {
  const bracket = readBracket([
    game("U", 1, "a 3-1 b"),
    game("UF", 2, "a 3-1 c"),
    game("L", 3, "b 3-2 c"),
    game("GF", 4, "a 3-0 b"),
  ])

  assert.deepEqual(names(bracket), {
    U: "Vòng 1 nhánh thắng",
    UF: "Chung kết nhánh thắng",
    L: "Chung kết nhánh thua",
    GF: "Chung kết tổng",
  })
})

test("the two rounds of two matches in the lower lane read by their number", () => {
  const { L1, L3, LS, LF } = names(readBracket(eightInTwoLanes))

  assert.deepEqual(
    [L1, L3, LS, LF],
    ["Vòng 1 nhánh thua", "Vòng 2 nhánh thua", "Bán kết nhánh thua", "Chung kết nhánh thua"],
  )
})

test("a match nobody scored is named with the others of its round", () => {
  const rounds = names(readBracket(unscoredQualifier))

  assert.deepEqual(
    [rounds.U3, rounds.U4, rounds.U5, rounds.L1, rounds.L2, rounds.L3],
    [
      "Vòng 1 nhánh thắng",
      "Vòng 1 nhánh thắng",
      "Vòng 2 nhánh thắng",
      "Vòng 1 nhánh thua",
      "Vòng 1 nhánh thua",
      "Vòng 2 nhánh thua",
    ],
  )
})

test("matches of a lower lane as far from its end share a round, whichever column their feeders put them in", () => {
  // Two teams enter the upper lane late, so the second match of the lower lane is fed from a shorter way.
  const bracket = readBracket([
    game("U1", 1, "a 3-0 b"),
    game("U2", 1, "c 3-1 d"),
    game("L1", 2, "b 3-2 d"),
    game("U3", 2, "a 3-1 c"),
    game("U4", 2, "e 3-0 f"),
    game("L2", 3, "c 3-1 f"),
    game("UF", 3, "a 3-2 e"),
    game("L3", 4, "b 3-1 c"),
    game("LF", 5, "e 3-1 b"),
    game("GF", 6, "a 3-1 e"),
  ])
  const rounds = names(bracket)

  assert.deepEqual(
    [rounds.L1, rounds.L2, rounds.L3, rounds.LF],
    ["Vòng 1 nhánh thua", "Vòng 1 nhánh thua", "Bán kết nhánh thua", "Chung kết nhánh thua"],
  )
})

test("the lower seeds of a playoff start in a semifinal of the lower lane", () => {
  const bracket = readBracket([
    game("U", 1, "a 3-1 b"),
    game("L", 1, "c 3-0 d"),
    game("LF", 2, "b 1-3 c"),
    game("GF", 3, "a 3-2 c"),
  ])

  assert.deepEqual(names(bracket), {
    U: "Chung kết nhánh thắng",
    L: "Bán kết nhánh thua",
    LF: "Chung kết nhánh thua",
    GF: "Chung kết tổng",
  })
})

test("only the match of the beaten semifinalists is the match for third place", () => {
  const bracket = readBracket([...knockout, game("P3", 3, "d 3-1 c"), game("P5", 2, "e 2-0 f")])

  assert.deepEqual([names(bracket).P3, names(bracket).P5], ["Tranh hạng ba", "Trận phân hạng"])
})

test("two losers of an earlier round play for no third place while the final is open", () => {
  const bracket = readBracket([...knockout.slice(0, -1), game("F", 3, "a - b"), game("P5", 2, "e 2-0 f")])

  assert.equal(names(bracket).P5, "Trận phân hạng")
})

test("the beaten semifinalists play for third place while the final is in another stage", () => {
  const bracket = readBracket([
    game("SF1", 1, "a 3-1 c"),
    game("SF2", 1, "b 3-1 d"),
    linked("P3", 2, loserOf("SF1"), loserOf("SF2")),
  ])

  assert.equal(names(bracket).P3, "Tranh hạng ba")
})

test("a match nobody scored takes nothing from the match for third place", () => {
  const bracket = readBracket([
    game("QF1", 1, "a 3-0 b"),
    game("QF2", 1, "c - d"),
    game("SF1", 2, "a 3-1 c"),
    game("SF2", 2, "e 3-1 f"),
    game("P3", 3, "c 3-1 f"),
  ])

  assert.equal(names(bracket).P3, "Tranh hạng ba")
})

test("two losers of a qualifier that sends on more than two teams do not play for third place", () => {
  const bracket = readBracket([
    game("A", 1, "a 2-0 b"),
    game("B", 1, "c 2-0 d"),
    game("C", 1, "e 2-0 f"),
    game("P", 2, "b 2-1 d"),
  ])

  assert.equal(names(bracket).P, "Trận phân hạng")
})

test("rounds read in English as well", () => {
  const rounds = names(readBracket(eightInTwoLanes), english)

  assert.deepEqual(
    [rounds.U1, rounds.US1, rounds.L1, rounds.UF, rounds.LF, rounds.GF],
    [
      "Upper bracket quarterfinal",
      "Upper bracket semifinal",
      "Lower bracket round 1",
      "Upper bracket final",
      "Lower bracket final",
      "Grand final",
    ],
  )
})
