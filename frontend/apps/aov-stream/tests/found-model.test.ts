import assert from "node:assert/strict"
import { test } from "node:test"
import { findGames, NOTHING_ASKED, writeQuestion, type Question } from "../src/lib/finder-model.ts"
import {
  examples,
  filtered,
  foundTally,
  hasScore,
  inMatchOrder,
  lengthCounts,
  lengthOf,
  playerChoices,
  playerTeams,
  SEATLESS_NOTHING,
  sideWins,
  suggestions,
  turnedAround,
  UNFILTERED,
  unseenBans,
  unseenMvps,
} from "../src/lib/found-model.ts"
import { heroByKey } from "../src/lib/game-feed.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

/** X met Y twice and Z once; "star" and "mate" are X's, "rival" was Y's in the first game and Z's in the third. */
const games: TestGame[] = [
  {
    id: "g1",
    series: "s1",
    number: 1,
    winner: "BLUE",
    seconds: 590,
    blue: { team: "x", picks: ["star", "mate", "a3", "a4", "a5"], players: ["ann", "bob"], bans: ["feared"] },
    red: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["hated"] },
  },
  {
    id: "g2",
    series: "s1",
    number: 2,
    winner: "BLUE",
    seconds: 899,
    blue: { team: "y", picks: ["star", ...five("b").slice(1)], players: ["cat"], bans: ["feared"] },
    red: { team: "x", picks: ["mate", "a2", "a3", "a4", "a5"], players: ["bob"], bans: ["rival"] },
  },
  {
    id: "g3",
    series: "s3",
    number: 1,
    winner: "RED",
    seconds: 1200,
    blue: { team: "z", picks: ["rival", ...five("c").slice(1)], bans: ["mate"] },
    red: { team: "x", picks: ["star", "a2", "a3", "a4", "a5"], players: ["ann"], bans: ["feared"] },
  },
]
const feed = feedOf(games)
const hero = (key: string) => heroByKey(feed, key)!
const asked = (question: Partial<Question>): Question => ({ ...NOTHING_ASKED, ...question })
const found = (question: Partial<Question>) => findGames(feed.games, asked(question))
const address = (question: Question) => String(new URLSearchParams(writeQuestion(question)))

test("the score of the games found is that of the side asked about", () => {
  assert.deepEqual(foundTally(found({ pick: [hero("star")] })), { games: 3, wins: 3, losses: 0 })
  assert.deepEqual(foundTally(found({ team: "x" })), { games: 3, wins: 2, losses: 1 })
})

test("a question has a score when it says who played", () => {
  assert.equal(hasScore(asked({ pick: [hero("star")] })), true)
  assert.equal(hasScore(asked({ opp: "x" })), true)
  assert.equal(hasScore(asked({ ban: [hero("feared")] })), false)
  assert.equal(hasScore(asked({ banA: [hero("feared")] })), false)
  assert.equal(hasScore(asked({ side: "BLUE" })), false)
})

test("a question that asks for the result has no score left to give", () => {
  assert.equal(hasScore(asked({ pick: [hero("star")], won: true })), false)
  assert.equal(hasScore(asked({ player: "ann", mvp: true })), false)
})

test("the sides of the map are counted by who won", () => {
  assert.deepEqual(sideWins(feed.games), { BLUE: 2, RED: 1 })
})

test("a list about neither side shows the first team of a match first", () => {
  const turned = found({}).map(inMatchOrder)
  assert.deepEqual(
    turned.map(({ game, a, won }) => [game.id, a.teamId, won]),
    [
      ["g3", "z", false],
      ["g2", "x", false],
      ["g1", "x", true],
    ],
  )
})

test("a game neither side of which is the first team of its match stays as it was found", () => {
  const [last] = found({}).filter(({ game }) => game.id === "g1")
  const strangers = { ...last!, a: { ...last!.a, teamId: "v" }, b: { ...last!.b!, teamId: "w" } }
  assert.equal(inMatchOrder(strangers), strangers)
})

/** The first game with nobody's bans written down, the second and the third as they are. */
const partly = feedOf([
  { ...games[0]!, blue: { ...games[0]!.blue, bans: [] }, red: { ...games[0]!.red, bans: [] } },
  ...games.slice(1),
])
const unseen = (question: Partial<Question>) => unseenBans(partly.games, asked(question))

test("games that do not show their bans may answer a question about one", () => {
  assert.equal(unseen({ ban: [hero("hated")] }), 1)
  assert.equal(unseen({ banA: [hero("hated")], side: "RED" }), 1)
})

test("of the games that do not show their bans only those that answer the rest of a question count", () => {
  assert.equal(unseen({ ban: [hero("hated")], team: "x", opp: "y" }), 1)
  assert.equal(unseen({ ban: [hero("hated")], team: "z" }), 0)
})

test("a game that picked the hero asked banned did not ban it", () => {
  assert.equal(unseen({ ban: [hero("star")] }), 0)
})

test("a question that asks for no ban misses no game for its bans", () => {
  assert.equal(unseen({ pick: [hero("star")] }), 0)
  assert.equal(unseen({}), 0)
})

/** X wins three games whose MVP is "ann": one names her on a seat, one names nobody, and one names only "bob". */
const seatless = feedOf([
  { ...games[0]!, mvp: "ann" },
  { ...games[0]!, id: "g4", number: 3, mvp: "ann", blue: { ...games[0]!.blue, players: [] } },
  { ...games[0]!, id: "g5", number: 4, mvp: "ann", blue: { ...games[0]!.blue, players: [null, "bob"] } },
])
const unseenBest = (question: Partial<Question>) => unseenMvps(seatless.games, asked(question))

test("a question about a player leaves out the games whose MVP the player was and no seat names", () => {
  assert.equal(findGames(seatless.games, asked({ player: "ann" })).length, 1)
  assert.equal(unseenBest({ player: "ann" }), 2)
})

test("of the games that name the player their MVP only those that answer the rest of the question are left out", () => {
  assert.equal(unseenBest({ player: "ann", team: "x", min: 5 }), 2)
  assert.equal(unseenBest({ player: "ann", team: "y" }), 0)
  assert.equal(unseenBest({ player: "ann", won: false }), 0)
})

test("a question that asks for the MVP, for one hero or for nobody leaves out no game for its MVP", () => {
  assert.equal(unseenBest({ player: "ann", mvp: true }), 0)
  assert.equal(unseenBest({ player: "ann", pick: [hero("star")] }), 0)
  assert.equal(unseenBest({ team: "x" }), 0)
})

test("the games left out and those found are together all the player is known to have been part of", () => {
  const { player, pick } = asked({ player: "ann", pick: ["star", "mate"].map(hero) })
  assert.equal(findGames(seatless.games, asked({ player, pick })).length + unseenBest({ player, pick }), 3)
})

test("the players of a filter come with the games each leaves, most first", () => {
  assert.deepEqual(playerChoices(feed.games, asked({ team: "x" })), [
    ["ann", 2],
    ["bob", 2],
  ])
})

test("the player asked about stands among the choices also where no seat names the player", () => {
  const unnamed = feedOf([{ ...games[0]!, mvp: "dan" }])
  assert.deepEqual(playerChoices(unnamed.games, asked({ player: "dan", mvp: true })), [
    ["dan", null],
    ["ann", 1],
    ["bob", 1],
  ])
})

test("a question is turned around with everything both sides were asked for", () => {
  const question = asked({
    team: "x",
    pick: [hero("star")],
    vs: [hero("rival")],
    banA: [hero("feared")],
    side: "BLUE",
    won: true,
    duel: true,
    max: 9,
  })
  const turned = turnedAround(question)
  assert.equal(address(turned), "pick=rival&vs=star&banB=feared&opp=x&duel=1&side=RED&result=loss&max=9")
  assert.equal(address(turnedAround(turned)), address(question))
})

test("a question turned around leaves what was asked of one player or one seat", () => {
  const turned = turnedAround(asked({ pick: [hero("star")], player: "ann", mvp: true, lane: "TOP", turn: 3 }))
  assert.equal(address(turned), "vs=star")
  assert.equal(turnedAround(asked({ banA: [hero("feared")], turn: 1 })).turn, 1)
})

test("a turn asked of a pick does not pass on to the hero it met", () => {
  assert.equal(turnedAround(asked({ pick: [hero("star")], vs: [hero("rival")], turn: 3 })).turn, null)
})

test("a choice of a filter asks for it, and the choice of all lets go of it", () => {
  const question = asked({ pick: [hero("star")] })
  const asks = (key: string, value: string) => address(filtered(question, key, value))
  assert.equal(asks("won", "loss"), "pick=star&result=loss")
  assert.equal(asks("side", "RED"), "pick=star&side=RED")
  assert.equal(asks("lane", "TOP"), "pick=star&lane=TOP")
  assert.equal(asks("length", "10"), "pick=star&min=10&max=14")
  assert.equal(asks("length", "20"), "pick=star&min=20")
  const met = asked({ pick: [hero("star")], vs: [hero("rival")] })
  assert.equal(address(filtered(met, "duel", "on")), "pick=star&vs=rival&duel=1")
  const full = asked({
    pick: [hero("star")],
    vs: [hero("rival")],
    duel: true,
    won: true,
    side: "BLUE",
    lane: "TOP",
    player: "ann",
    mvp: true,
    max: 9,
  })
  for (const key of ["won", "side", "lane", "player", "length", "duel"]) {
    const left = filtered(full, key, "all")
    assert.equal(address(left).length < address(full).length, true, key)
  }
  assert.equal(filtered(full, "player", "all").mvp, false)
})

test("the filters of the finder are let go of at once, what stands on the board stays", () => {
  const question = asked({
    pick: [hero("star")],
    vs: [hero("rival")],
    duel: true,
    won: true,
    lane: "TOP",
    turn: 3,
    max: 9,
  })
  assert.equal(address({ ...question, ...UNFILTERED }), "pick=star&vs=rival&turn=3")
})

test("what has no seat on the board is let go of at once", () => {
  const question = asked({
    pick: [hero("star")],
    vs: [hero("rival")],
    duel: true,
    turn: 3,
    won: true,
    side: "RED",
    player: "ann",
    mvp: true,
    lane: "TOP",
    from: "2026-11-01",
    max: 9,
  })
  assert.equal(address({ ...question, ...SEATLESS_NOTHING }), "pick=star&vs=rival")
})

test("a player's team is the one they sat for", () => {
  assert.deepEqual([...playerTeams(feed.games)].sort(), [
    ["ann", "x"],
    ["bob", "x"],
    ["cat", "y"],
  ])
})

test("a player who changed teams belongs to the one sat for last", () => {
  const before = { ...games[0]!, red: { ...games[0]!.red, players: ["dan"] } }
  const after = { ...games[2]!, blue: { ...games[2]!.blue, players: ["dan"] } }
  assert.equal(playerTeams(feedOf([before, after]).games).get("dan"), "z")
})

test("lengths are counted in the four a reader asks about", () => {
  assert.deepEqual(
    lengthCounts(found({})).map(({ key, games: count }) => [key, count]),
    [
      ["9", 1],
      ["10", 1],
      ["15", 0],
      ["20", 1],
    ],
  )
  assert.equal(lengthOf({ min: 10, max: 14 })?.key, "10")
  assert.equal(lengthOf({ min: 11, max: 14 }), null)
  assert.equal(lengthOf({ min: null, max: null }), null)
})

/** The three games twice over, enough to be narrowed. */
const season = feedOf([...games, ...games.map((game) => ({ ...game, id: `${game.id}b`, number: 3 }))])

test("a suggestion narrows the games found and says how side A did there", () => {
  const question = asked({ pick: [hero("star")] })
  const { teams, mates, rivals } = suggestions(season, question, 6, 20)
  assert.deepEqual(
    teams.map((item) => [item.teamId, item.games, item.wins, item.losses]),
    [
      ["x", 4, 4, 0],
      ["y", 2, 2, 0],
    ],
  )
  assert.equal(address(teams[0]!.question), "pick=star&team=x")
  assert.equal(address(mates.find((item) => item.hero.key === "mate")!.question), "pick=star.mate")
  assert.deepEqual(
    rivals.slice(0, 1).map((item) => [item.hero.key, item.games, address(item.question)]),
    [["rival", 4, "pick=star&vs=rival"]],
  )
})

test("what every game found already has is not suggested", () => {
  const { teams, mates } = suggestions(season, asked({ team: "x" }), 6)
  assert.deepEqual(teams, [])
  assert.equal(
    mates.some((item) => item.hero.key === "a3"),
    false,
  )
})

test("a single game is not worth a suggestion", () => {
  const question = asked({ pick: [hero("star")] })
  assert.equal(suggestions(season, question, 6).teams.length, 2)
  assert.equal(suggestions(feed, question, 6).teams.length, 1)
})

test("five games are worth narrowing, four are not", () => {
  const question = asked({ pick: [hero("star")] })
  assert.equal(suggestions(season, question, 5).teams.length, 2)
  assert.deepEqual(suggestions(season, question, 4), { teams: [], mates: [], rivals: [] })
})

test("a question about neither side suggests heroes whoever picked them", () => {
  const { teams, mates, rivals } = suggestions(season, asked({ ban: [hero("feared")] }), 6, 20)
  assert.deepEqual(
    teams.map((item) => [item.teamId, item.games]),
    [
      ["y", 4],
      ["z", 2],
    ],
  )
  assert.equal(mates.find((item) => item.hero.key === "rival")!.games, 4)
  assert.deepEqual(rivals, [])
})

test("a side whose seats are taken is suggested no further hero", () => {
  const question = asked({ pick: ["star", "mate", "a3", "a4", "a5"].map(hero) })
  assert.deepEqual(suggestions(season, question, 6).mates, [])
})

test("the examples are questions of the competition's own games", () => {
  assert.deepEqual(
    examples(feed.games).map(({ question, games: count }) => [address(question), count]),
    [
      ["pick=star&vs=rival", 2],
      ["max=9", 1],
    ],
  )
})

/** Some games of X and Y, in which each side bans a hero of its own. */
const banning = (count: number, bans: [string[], string[]] = [["feared"], ["hated"]]) =>
  Array.from({ length: count }, (_, index): TestGame => ({
    id: `g${index}`,
    series: "s1",
    number: index + 1,
    blue: { team: "x", picks: five("a"), bans: bans[0] },
    red: { team: "y", picks: five("b"), bans: bans[1] },
  }))
const exampleAddresses = (list: TestGame[]) => examples(feedOf(list).games).map(({ question }) => address(question))

test("a ban one team makes more than the others is an example", () => {
  const addresses = exampleAddresses(banning(3))
  assert.equal(addresses.length, 2)
  assert.equal(addresses[1]!.startsWith("banA="), true)
})

test("the ban that tells a team is read from the games that show their bans", () => {
  // X bans "feared" in every game that says so and Y in half of them; the games that do not say make no difference.
  const said = banning(4).map((item, index) => (index % 2 ? { ...item, red: { ...item.red, bans: ["feared"] } } : item))
  const silent = banning(20, [[], []]).map((item) => ({ ...item, id: `${item.id}-silent`, series: "s2" }))
  const [, example] = exampleAddresses([...said, ...silent])
  assert.equal(example, "banA=feared&team=x")
})

test("two heroes who met once are no example", () => {
  assert.deepEqual(exampleAddresses(banning(1, [[], []])), [])
})

test("a length all games share is no example", () => {
  const short = banning(3).map((item) => ({ ...item, seconds: 500 }))
  assert.equal(
    exampleAddresses(short).some((example) => example.includes("max=")),
    false,
  )
})

test("a competition whose games tell nothing has no examples", () => {
  assert.deepEqual(examples(feedOf([]).games), [])
})
