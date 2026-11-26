import assert from "node:assert/strict"
import { test } from "node:test"
import {
  averageLength,
  banHabits,
  enoughForTeam,
  matchesWith,
  mvpRecords,
  namedSeats,
  playerPools,
  shownGames,
  sideTally,
  teamHeroes,
  teamMatches,
  teamRecords,
  teamTally,
} from "../src/lib/team-draft-model.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

/** X plays "star" on both sides and wins three of four; Y bans "star" in the only game it could not be picked. */
const games: TestGame[] = [
  {
    id: "g1",
    series: "s1",
    number: 1,
    winner: "BLUE",
    seconds: 600,
    mvp: "ann",
    blue: { team: "x", picks: ["star", ...five("a").slice(1)], players: ["ann", "bob"], bans: ["p1"] },
    red: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["q1"] },
  },
  {
    id: "g2",
    series: "s1",
    number: 2,
    winner: "RED",
    seconds: 800,
    mvp: "ann",
    blue: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["q1"] },
    red: { team: "x", picks: ["star", ...five("a").slice(1)], players: ["ann", "bob"], bans: ["p1"] },
  },
  {
    id: "g3",
    series: "s3",
    number: 1,
    winner: "RED",
    seconds: 1000,
    blue: { team: "z", picks: five("c"), bans: ["star"] },
    red: { team: "x", picks: ["spare", ...five("a").slice(1)], players: ["bob", "ann"], bans: ["p1"] },
  },
  {
    id: "g4",
    series: "s3",
    number: 2,
    winner: "BLUE",
    seconds: 1200,
    blue: { team: "z", picks: five("c"), bans: ["q1"] },
    red: { team: "x", picks: ["star", ...five("a").slice(1)], players: ["ann"], bans: ["p2"] },
  },
]
const feed = feedOf(games)
const x = teamRecords(feed).find(({ teamId }) => teamId === "x")!

test("teams come by the share of games they won", () => {
  assert.deepEqual(
    teamRecords(feed).map((record) => [record.teamId, teamTally(record).wins, record.games.length]),
    [
      ["x", 3, 4],
      ["z", 1, 2],
      ["y", 0, 2],
    ],
  )
})

test("a team's games keep the order they were played in", () => {
  assert.deepEqual(
    x.games.map(({ game }) => game.id),
    ["g1", "g2", "g3", "g4"],
  )
})

test("the two sides of the map have records of their own", () => {
  assert.deepEqual(sideTally(x, "BLUE"), { games: 1, wins: 1, losses: 0 })
  assert.deepEqual(sideTally(x, "RED"), { games: 3, wins: 2, losses: 1 })
})

test("games won and lost have an average length of their own", () => {
  assert.equal(averageLength(x, true), 800)
  assert.equal(averageLength(x, false), 1200)
  assert.equal(averageLength({ games: [] }, true), null)
})

test("a team's heroes carry its results", () => {
  const star = teamHeroes(x).find(({ hero }) => hero.key === "star")!
  assert.deepEqual([star.games.length, star.wins, star.losses], [3, 2, 1])
})

test("a hero needs more games with a team that played more of them", () => {
  assert.equal(enoughForTeam(23), 3)
  assert.equal(enoughForTeam(60), 4)
  assert.equal(enoughForTeam(300), 5)
})

test("what a team bans stands against what the others ban", () => {
  const [first] = banHabits(feed, "x", "own")
  assert.deepEqual([first!.hero.key, first!.games, first!.share, first!.elsewhere], ["p1", 3, 0.75, 0])
})

test("the share of a ban elsewhere is out of what the other teams played", () => {
  // Y bans "q1" in both its games; of the six sides that are not Y's one bans it too.
  const [first] = banHabits(feed, "y", "own")
  assert.deepEqual([first!.hero.key, first!.share, first!.elsewhere], ["q1", 1, 1 / 6])
})

/** The four games and two more of X and Y, whose bans nobody wrote down. */
const partly = feedOf([
  ...games,
  ...["g5", "g6"].map((id): TestGame => ({
    id,
    series: "s5",
    winner: "BLUE",
    blue: { team: "x", picks: five("a") },
    red: { team: "y", picks: five("b") },
  })),
])

test("the games a team banned in are those that show their bans", () => {
  const [record] = teamRecords(partly).filter(({ teamId }) => teamId === "x")
  assert.deepEqual([record!.games.length, shownGames(record!)], [6, 4])
})

test("the share of a ban leaves out the games that do not show their bans, here and elsewhere", () => {
  for (const whose of ["own", "against"] as const)
    for (const team of ["x", "y"]) assert.deepEqual(banHabits(partly, team, whose), banHabits(feed, team, whose))
})

test("what others ban against a team stands against what they ban otherwise", () => {
  const against = banHabits(feed, "x", "against")
  assert.equal(against.find(({ hero }) => hero.key === "star")!.games, 1)
  assert.equal(
    against.some(({ hero }) => hero.key === "p1"),
    false,
  )
})

test("a pool lists the heroes of a player in lane order of the players", () => {
  const pools = playerPools(x)
  assert.deepEqual(
    pools.map(({ playerId, lane, games: played }) => [playerId, lane, played]),
    [
      ["ann", "TOP", 4],
      ["bob", "JUNGLE", 3],
    ],
  )
  assert.deepEqual(
    pools[0]!.heroes.map(({ hero, games: played }) => [hero.key, played.length]),
    [
      ["star", 3],
      ["a2", 1],
    ],
  )
})

test("a game names its MVP, whether or not a seat does", () => {
  const unnamed = feedOf(games.map((game) => ({ ...game, blue: { ...game.blue, players: [] } })))
  assert.deepEqual(
    mvpRecords(unnamed).map(({ playerId, teamId, games: named }) => [playerId, teamId, named.length]),
    [["ann", "x", 2]],
  )
})

test("a player who was the best for two teams belongs to the one of the last game", () => {
  const moved = feedOf(games.map((game) => (game.id === "g4" ? { ...game, mvp: "ann" } : game)))
  assert.equal(mvpRecords(moved)[0]!.teamId, "z")
})

test("a hero of a team is counted in matches, since it may be picked once in each", () => {
  const star = teamHeroes(x).find(({ hero }) => hero.key === "star")!
  assert.deepEqual([matchesWith(star), teamMatches(x)], [2, 2])
})

test("a team knows how many of its seats name their player", () => {
  assert.deepEqual(namedSeats(x), { named: 7, seats: 20 })
})
