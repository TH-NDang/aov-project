import assert from "node:assert/strict"
import { test } from "node:test"
import type { Side } from "@aov/community-contracts"
import { heroRecords } from "../src/lib/hero-model.ts"
import {
  factRoom,
  isTelling,
  lengthExtremes,
  minuteTicks,
  playerTold,
  rarePicks,
  seatsOf,
  seatWords,
  sidesWords,
  splitStacks,
  topMvps,
  winsOf,
} from "../src/lib/highlights.ts"
import { mvpRecords, type MvpRecord } from "../src/lib/team-draft-model.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text

let next = 0
/** A game of X (blue) against Y (red) in which X plays the hero "star" in its first seat. */
const game = (winner: Side, extra: Partial<TestGame> & { seat?: string | null } = {}): TestGame => {
  next += 1
  const { seat, ...rest } = extra
  return {
    id: `g${next}`,
    series: "s1",
    number: next,
    winner,
    blue: { team: "x", picks: ["star", ...five("a").slice(1)], players: [seat ?? null] },
    red: { team: "y", picks: five("b") },
    ...rest,
  }
}
const recordOf = (games: TestGame[]) => heroRecords(feedOf(games)).get("star")!
const nameOf = (id: string) => id.toUpperCase()

test("a long or a clear record is worth telling, and one anybody reaches is not", () => {
  for (const [wins, losses] of [
    [9, 0],
    [12, 1],
    [19, 11],
    [6, 2],
  ] as const)
    assert.equal(isTelling({ wins, losses }), true, `${wins}–${losses}`)
  for (const [wins, losses] of [
    [3, 2],
    [4, 1],
    [6, 3],
    [14, 9],
  ] as const)
    assert.equal(isTelling({ wins, losses }), false, `${wins}–${losses}`)
})

test("the seats of a record name who played it and count the games that do not say", () => {
  const games = [
    game("BLUE", { seat: "ann" }),
    game("BLUE", { seat: "ann" }),
    game("BLUE", { seat: "bob" }),
    game("RED"),
  ]
  assert.deepEqual(seatsOf(recordOf(games), "x"), {
    players: [
      { playerId: "ann", games: 2 },
      { playerId: "bob", games: 1 },
    ],
    unknown: 1,
  })
  assert.deepEqual(seatsOf(recordOf(games), "nobody"), { players: [], unknown: 0 })
})

test("a record is told of its player only while no seat names anybody else", () => {
  assert.equal(playerTold({ playerId: "ann" }, { players: [{ playerId: "ann", games: 9 }], unknown: 1 }), "ann")
  const shared = [
    { playerId: "ann", games: 9 },
    { playerId: "bob", games: 1 },
  ]
  assert.equal(playerTold({ playerId: "ann" }, { players: shared, unknown: 0 }), null)
  assert.equal(playerTold({ playerId: null }, { players: [{ playerId: "ann", games: 2 }], unknown: 7 }), null)
})

test("what the seats leave open is said under a record", () => {
  const ann = { playerId: "ann", games: 9 }
  assert.equal(seatWords({ players: [ann], unknown: 2 }, "ann", nameOf, vi), "chưa rõ ai chơi ở 2 ván")
  assert.equal(seatWords({ players: [ann], unknown: 1 }, "ann", nameOf, en), "1 game does not say who played")
  assert.equal(seatWords({ players: [ann], unknown: 0 }, "ann", nameOf, vi), null)
  const bob = { playerId: "bob", games: 2 }
  assert.equal(seatWords({ players: [ann, bob], unknown: 1 }, null, nameOf, vi), "ANN 9, BOB 2, chưa rõ 1")
  assert.equal(seatWords({ players: [], unknown: 9 }, null, nameOf, vi), null)
})

const words = (blue: number, red: number, verdict: "EVEN" | "TEAMS" | "SIDE") =>
  sidesWords({ blue, red, verdict }, vi, "vi-VN")

test("sides no further apart than chance makes them are nearly level, or too little played", () => {
  assert.equal(words(174, 153, "EVEN"), "Gần như ngang nhau: hơn kém 21 trong 327 ván.")
  assert.equal(words(14, 9, "EVEN"), "Hơn kém 5 trong 23 ván, còn quá ít ván để nói hai bên khác nhau.")
  assert.equal(words(15, 15, "EVEN"), "Hai bên thắng số ván bằng nhau.")
})

test("a side ahead is told with what the teams on it explain", () => {
  assert.equal(
    words(60, 40, "TEAMS"),
    "Bên xanh thắng nhiều hơn 20 ván, nhưng các đội hay thắng cũng ngồi bên đó nhiều hơn.",
  )
  assert.equal(
    words(74, 98, "SIDE"),
    "Bên đỏ thắng nhiều hơn 24 trong 172 ván, kể cả khi đã tính đội nào ngồi bên nào.",
  )
})

test("nothing is said of the sides of a few games", () => {
  assert.equal(words(3, 1, "EVEN"), null)
})

test("a chart writes every fifth minute, and every tenth where they would crowd", () => {
  const columns = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => ({ minute: from + index }))
  assert.deepEqual(minuteTicks(columns(6, 34)), [10, 15, 20, 25, 30])
  assert.deepEqual(minuteTicks(columns(6, 47)), [10, 20, 30, 40])
})

test("the shortest and the longest games stand apart once there are enough of both", () => {
  const lengths = (count: number) =>
    feedOf(Array.from({ length: count }, (_, index) => game("BLUE", { seconds: 600 + 60 * index }))).games
  const { short, long } = lengthExtremes(lengths(7))
  assert.deepEqual(
    [short, long].map((list) => list.map(({ seconds }) => seconds)),
    [
      [600, 660, 720],
      [960, 900, 840],
    ],
  )
  const few = lengthExtremes(lengths(6))
  assert.deepEqual([few.short.length, few.long.length], [6, 0])
})

const mvps = (...counts: number[]): MvpRecord[] =>
  counts.map((count, at) => ({ playerId: `p${at}`, teamId: "x", games: Array(count).fill({}) as MvpRecord["games"] }))
const top = (...counts: number[]) => {
  const { rows, level } = topMvps(mvps(...counts))
  return [rows.map(({ games }) => games.length), level]
}

test("the list of MVPs ends where the next player has fewer", () => {
  assert.deepEqual(top(17, 17, 17, 16, 16, 14), [[17, 17, 17, 16, 16], 0])
})

test("a cut through level players is made above them while three remain", () => {
  assert.deepEqual(top(6, 5, 3, 3, 2, 2, 2), [[6, 5, 3, 3], 0])
})

test("where most players are level the list says how many more there are", () => {
  assert.deepEqual(top(3, 2, 2, 2, 2, 2, 2), [[3, 2, 2, 2, 2], 2])
})

test("one MVP is no record", () => {
  assert.deepEqual(top(1, 1, 1), [[], 0])
})

test("the games a team won are counted with those that name their MVP", () => {
  const { games } = feedOf([game("BLUE", { mvp: "ann" }), game("BLUE"), game("RED", { mvp: "bob" })])
  assert.deepEqual(winsOf(games, "x"), { won: 2, named: 1 })
  assert.deepEqual(winsOf(games, "y"), { won: 1, named: 1 })
  assert.equal(mvpRecords({ games }).length, 2)
})

test("heroes picked once are told while that is rare", () => {
  const often = Array.from({ length: 4 }, () => game("BLUE"))
  const once = game("BLUE", { red: { team: "y", picks: ["once", ...five("b").slice(1)] } })
  const rare = rarePicks(heroRecords(feedOf([...often, once])))
  assert.deepEqual(
    rare.map(({ hero }) => hero.key),
    ["once"],
  )
  assert.deepEqual(rarePicks(heroRecords(feedOf([once]))), [])
})

test("a phone has one column of facts, a wide page two stacks in which lists fit side by side", () => {
  assert.deepEqual([366, 735, 736, 1035, 1036, 1216].map(factRoom), [
    "column",
    "column",
    "narrow",
    "narrow",
    "wide",
    "wide",
  ])
})

test("the second block stays on the left where the stacks would be far apart otherwise", () => {
  assert.deepEqual(splitStacks([499, 164, 310, 378]), [
    [0, 1],
    [2, 3],
  ])
})

test("the second block stays on the right where the stacks come out almost as even", () => {
  // With it on the left they would be 70 apart, with it on the right 130.
  assert.deepEqual(splitStacks([300, 100, 330]), [[0], [1, 2]])
})

test("blocks fall into two stacks as even as they can be, each in its order", () => {
  assert.deepEqual(splitStacks([700, 400, 100, 300, 50]), [
    [0, 4],
    [1, 2, 3],
  ])
  assert.deepEqual(splitStacks([100, 100]), [[0], [1]])
  assert.deepEqual(splitStacks([100]), [[0], []])
  assert.deepEqual(splitStacks([]), [[], []])
})
