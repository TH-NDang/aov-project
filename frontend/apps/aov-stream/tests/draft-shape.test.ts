import assert from "node:assert/strict"
import { test } from "node:test"
import { draftScript, draftShape, heroTurns, orderKnown, shapedGames } from "../src/lib/draft-shape.ts"
import { heroByKey } from "../src/lib/game-feed.ts"
import { orderedGames } from "../src/lib/hero-page-model.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

/** Two bans, then five picks a side, blue picking first. */
const ORDER = ["BB", "RB", "BP", "RP", "RP", "BP", "BP", "RP", "RP", "BP", "BP", "RP"]
const game = (id: string, extra: Partial<TestGame> = {}): TestGame => ({
  id,
  series: "s1",
  number: Number(id.slice(1)),
  blue: { team: "x", picks: five("a"), bans: ["feared"] },
  red: { team: "y", picks: five("b"), bans: ["hated"] },
  draft: ORDER,
  ...extra,
})

test("the shape most drafts share groups its turns into acts", () => {
  const shape = draftShape(feedOf([game("g1"), game("g2"), game("g3", { draft: [...ORDER].reverse() })]).games)!
  assert.equal(shape.games.length, 2)
  assert.deepEqual(
    shape.acts.map(({ kind, nth, turns }) => [kind, nth, turns.length]),
    [
      ["BAN", 1, 2],
      ["PICK", 1, 10],
    ],
  )
})

test("a draft with an unknown turn has no say in the shape", () => {
  assert.equal(draftShape(feedOf([game("g1", { draft: ORDER.slice(0, 5) }), game("g2", { draft: [] })]).games), null)
})

test("a draft that counts a turn twice has no say in the shape", () => {
  const { games } = feedOf([game("g1")])
  const [blue, red] = games[0]!.sides
  const again = { ...red!, picks: red!.picks.map((pick) => (pick.turn === 12 ? { ...pick, turn: 11 } : pick)) }
  assert.equal(draftShape([{ ...games[0]!, sides: [blue!, again] }]), null)
})

test("a script lists what each side took in an act, the hero taken most often first", () => {
  const feed = feedOf([
    game("g1"),
    game("g2", { blue: { team: "x", picks: five("a"), bans: ["hated"] } }),
    game("g3", { blue: { team: "x", picks: five("a"), bans: ["hated"] } }),
  ])
  const script = draftScript(draftShape(feed.games)!, (_, side) => (side.side === "BLUE" ? 0 : 1))
  assert.equal(script.games, 3)
  // Both sides ban "hated": what each of them does is listed as it is.
  assert.deepEqual(
    script.acts[0]!.taken.map((list) => list.map(({ hero, games }) => [hero.key, games])),
    [
      [
        ["hated", 2],
        ["feared", 1],
      ],
      [["hated", 3]],
    ],
  )
})

test("the script of a team sets it against whoever it met", () => {
  const feed = feedOf([
    game("g1"),
    game("g2", {
      blue: { team: "y", picks: five("b"), bans: ["hated"] },
      red: { team: "x", picks: five("a"), bans: ["feared"] },
    }),
  ])
  const script = draftScript(draftShape(feed.games)!, (_, side) => (side.teamId === "x" ? 0 : 1))
  assert.deepEqual(script.acts[0]!.taken[0][0], { hero: heroByKey(feed, "feared"), games: 2 })
})

test("a side that is neither party has no part in a script", () => {
  const feed = feedOf([game("g1")])
  const script = draftScript(draftShape(feed.games)!, (_, side) => (side.teamId === "x" ? 0 : null))
  assert.deepEqual(
    script.acts[0]!.taken.map((list) => list.map(({ hero }) => hero.key)),
    [["feared"], []],
  )
})

/** A draft nobody saw the red ban of; its other turns keep their numbers. */
const missed = game("g2", {
  red: { team: "y", picks: five("b"), bans: [] },
  draft: ORDER.map((turn, index) => (index === 1 ? "--" : turn)),
})
/** A draft in which each side took the turns of the other. */
const turned = game("g3", { draft: ORDER.map((turn) => (turn[0] === "B" ? "R" : "B") + turn[1]!) })
/** A draft that ends with the bans. */
const reversed = game("g4", { draft: [...ORDER].reverse() })
const unordered = game("g5", { draft: [] })

const shaped = (...extra: TestGame[]) => {
  const { games } = feedOf([game("g1"), game("g6"), ...extra])
  const shape = draftShape(games)!
  return { shape, games, own: shapedGames(shape, games) }
}

test("a draft with a missed ban counts in a script at the turns it does have", () => {
  const { shape, own } = shaped(missed)
  const script = draftScript({ ...shape, games: own }, (_, side) => (side.teamId === "x" ? 0 : 1))
  assert.equal(script.games, 3)
  assert.deepEqual(
    script.acts[0]!.taken.map((list) => list.map(({ hero, games }) => [hero.key, games])),
    [[["feared", 3]], [["hated", 2]]],
  )
})

test("a draft in which the sides took each other's turns follows the shape", () => {
  assert.equal(shaped(turned).own.length, 3)
})

test("a draft that picks where the others ban does not follow the shape", () => {
  assert.equal(shaped(reversed).own.length, 2)
})

test("a draft without a known turn follows no shape", () => {
  assert.equal(shaped(unordered).own.length, 2)
})

test("the drafts a team's script counts are those a hero's page says record an order", () => {
  const { games, own } = shaped(missed, turned, unordered)
  assert.equal(own.length, orderedGames(games))
})

test("the order is known once most of the games have it", () => {
  const shape = draftShape(feedOf([game("g1"), game("g2"), game("g3")]).games)
  assert.equal(orderKnown(shape, 5), true)
  assert.equal(orderKnown(shape, 6), false)
  assert.equal(orderKnown(null, 0), false)
})

test("the turns of a hero count the games it was taken in", () => {
  const feed = feedOf([game("g1"), game("g2")])
  const shape = draftShape(feed.games)!
  const taken = heroTurns(shape, heroByKey(feed, "a1")!).filter(({ games }) => games > 0)
  assert.deepEqual(
    taken.map(({ turn, games }) => [turn.turn, turn.side, games]),
    [[3, "BLUE", 2]],
  )
})
