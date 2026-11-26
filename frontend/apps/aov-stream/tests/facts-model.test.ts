import assert from "node:assert/strict"
import { test } from "node:test"
import type { Side } from "@aov/community-contracts"
import {
  byLength,
  comebacks,
  laneHeroes,
  leaders,
  lengthColumns,
  likelihood,
  pairRecords,
  periodLine,
  pickedOnce,
  sidesOf,
  strengths,
  teamHeroRecords,
  trends,
} from "../src/lib/facts-model.ts"
import { feedScope } from "../src/lib/game-feed.ts"
import { heroRecords } from "../src/lib/hero-model.ts"
import { on, stage } from "./fixtures/competition.ts"
import { feedOf, five, roundRobinView, twoStages, type TestGame } from "./fixtures/lineups.ts"

type Extra = Partial<Omit<TestGame, "blue" | "red">> & {
  a?: string[]
  b?: string[]
  teams?: [string, string]
  bans?: [string[], string[]]
  players?: string[]
}
let next = 0
/**
 * A game of X (blue) against Y (red) with the first seats of each side given; the others are played by nobodies. Both
 * sides ban heroes nobody plays unless the game says otherwise.
 */
const game = (
  winner: Side,
  { a = ["m1"], b = ["n1"], teams = ["x", "y"], bans = [["k1"], ["k2"]], players, ...extra }: Extra = {},
) => {
  next += 1
  return {
    id: `g${next}`,
    series: "s1",
    number: next,
    winner,
    blue: { team: teams[0], picks: [...a, ...five("c").slice(a.length)], bans: bans[0], players },
    red: { team: teams[1], picks: [...b, ...five("d").slice(b.length)], bans: bans[1] },
    ...extra,
  } satisfies TestGame
}
const times = (count: number, make: (index: number) => TestGame) => Array.from({ length: count }, (_, i) => make(i))
/** A game whose bans nobody wrote down. */
const unseen: Extra = { bans: [[], []] }
/** A game in which everybody but the heroes given plays for the only time. */
const lone = (winner: Side, { a = [], b = [], ...extra }: Extra = {}) => {
  const others = (letter: string) => five(`${letter}${next}-`)
  return game(winner, { a: [...a, ...others("p")].slice(0, 5), b: [...b, ...others("q")].slice(0, 5), ...extra })
}

/**
 * Twenty games. "seen" is banned in the first ten and picked by X in the nine after them, Y bans "feared" in the last
 * sixteen, "busy" is picked by X in the first fourteen, and "sure" by Y in the last eight.
 */
const season = (winner: (index: number) => Side) =>
  feedOf(
    times(20, (index) =>
      lone(winner(index), {
        a: [...(index < 14 ? ["busy"] : []), ...(index >= 10 && index < 19 ? ["seen"] : [])],
        b: index >= 12 ? ["sure"] : [],
        bans: [index < 10 ? ["seen"] : [], index >= 4 ? ["feared"] : []],
      }),
    ),
  )
const ledBy = (feed: ReturnType<typeof feedOf>) =>
  leaders(heroRecords(feed).values(), feed.games.length).map(({ kind, line }) => [kind, line.hero.key])

test("the leaders are three different heroes, each for a reason of its own", () => {
  // X wins seven of its fourteen games with "busy" and none with "seen"; Y wins all eight with "sure".
  assert.deepEqual(ledBy(season((index) => (index < 7 ? "BLUE" : "RED"))), [
    ["PRESENT", "seen"],
    ["PICKED", "busy"],
    ["WINNING", "sure"],
  ])
})

test("where no record is sure enough the hero banned most comes third", () => {
  assert.deepEqual(ledBy(season((index) => (index < 7 || index % 2 ? "BLUE" : "RED"))), [
    ["PRESENT", "seen"],
    ["PICKED", "busy"],
    ["BANNED", "feared"],
  ])
})

test("a hero without enough wins to speak of leads nothing by winning", () => {
  const feed = feedOf([game("BLUE"), game("RED")])
  assert.equal(
    leaders(heroRecords(feed).values(), 2).some(({ kind }) => kind === "WINNING"),
    false,
  )
})

test("who was seen most is told by the games that show their bans", () => {
  // "busy" is in twelve games, but only two of them say who was banned; "feared" is banned in all six that do.
  const feed = feedOf([
    ...times(6, (index) => lone("BLUE", { a: index < 2 ? ["busy"] : [], bans: [["feared"], []] })),
    ...times(10, () => lone("BLUE", { a: ["busy"], ...unseen })),
  ])
  assert.deepEqual(ledBy(feed).slice(0, 2), [
    ["PRESENT", "feared"],
    ["PICKED", "busy"],
  ])
})

test("without a game that shows its bans nobody leads by being seen or banned", () => {
  const feed = feedOf(times(12, () => game("BLUE", { a: ["busy"], ...unseen })))
  assert.deepEqual(
    ledBy(feed).map(([kind]) => kind),
    ["PICKED", "WINNING"],
  )
})

test("a team's best records name each team and each hero once", () => {
  const feed = feedOf([
    ...times(6, () => game("BLUE", { a: ["star", "second"], players: ["ann"] })),
    ...times(5, () => game("BLUE", { a: ["star"], teams: ["z", "y"] })),
  ])
  const [first, ...rest] = teamHeroRecords(feed)
  assert.deepEqual([first!.teamId, first!.wins, first!.losses], ["x", 6, 0])
  assert.equal(
    rest.some(({ teamId }) => teamId === "x"),
    false,
  )
})

test("a record is that of a player who played four fifths of its games, else of nobody", () => {
  const behind = (byAnn: number) => {
    const won = times(10, (index) => game("BLUE", { a: ["star"], players: [index < byAnn ? "ann" : "bob"] }))
    const lost = times(3, () => game("RED", { a: ["other"] }))
    return teamHeroRecords(feedOf([...won, ...lost])).find(({ hero }) => hero.key === "star")!.playerId
  }
  assert.deepEqual([behind(8), behind(7)], ["ann", null])
})

test("two heroes need as many games together as a win rate does", () => {
  const few = heroRecords(feedOf(times(4, () => game("BLUE", { a: ["left", "right"] }))))
  assert.deepEqual(pairRecords(few, "with", 4), [])
})

test("of the records of pairs each hero is told of once", () => {
  const many = heroRecords(feedOf(times(6, () => game("BLUE", { a: ["left", "right"], b: ["prey"] }))))
  const together = pairRecords(many, "with", 6, 100)
  assert.ok(together.length > 1)
  assert.equal(new Set(together.flatMap(({ heroes }) => heroes.map(({ key }) => key))).size, together.length * 2)
})

test("a pair that won no more than it lost has no record", () => {
  const level = heroRecords(feedOf(times(6, (index) => game(index % 2 ? "BLUE" : "RED", { a: ["left", "right"] }))))
  assert.deepEqual(pairRecords(level, "with", 6, 100), [])
})

test("a hero has a record only against those it beat more often", () => {
  const records = heroRecords(feedOf(times(6, () => game("BLUE", { a: ["hunter"], b: ["prey"] }))))
  const duels = pairRecords(records, "against", 6, 100)
  assert.ok(duels.length > 0)
  assert.equal(
    duels.every(({ heroes: [winner], wins, losses }) => wins > losses && !winner.key.startsWith("d")),
    true,
  )
})

test("a pair of one team is named in one order, whoever was picked first", () => {
  const records = heroRecords(feedOf(times(6, () => game("BLUE", { a: ["right", "left"] }))))
  const pairs = pairRecords(records, "with", 6, 100).map(({ heroes }) => heroes.map(({ key }) => key))
  assert.deepEqual(
    pairs,
    pairs.map((pair) => [...pair].sort()),
  )
})

test("each lane lists the heroes played most in it", () => {
  const records = heroRecords(
    feedOf([game("BLUE", { a: ["star"] }), game("RED", { a: ["star"] }), game("BLUE", { a: ["other"] })]),
  )
  const [first, second] = laneHeroes(records.values()).get("TOP")!
  assert.deepEqual([first!.hero.key, first!.games], ["n1", 3])
  assert.deepEqual([second!.hero.key, second!.wins, second!.losses], ["star", 1, 1])
})

test("two sides as close as chance makes them are even", () => {
  const { blue, red, verdict } = sidesOf(feedOf([...times(6, () => game("BLUE")), ...times(5, () => game("RED"))]))
  assert.deepEqual([blue, red, verdict], [6, 5, "EVEN"])
})

test("a side that wins because the stronger team sat there is told so", () => {
  // X wins whichever side it plays; it only sat on blue more often.
  const games = [...times(30, () => game("BLUE")), ...times(5, () => game("RED", { teams: ["y", "x"] }))]
  assert.equal(sidesOf(feedOf(games)).verdict, "TEAMS")
})

test("a side that wins whoever plays it is the side's doing", () => {
  const games = [...times(30, () => game("BLUE")), ...times(30, () => game("BLUE", { teams: ["y", "x"] }))]
  assert.equal(sidesOf(feedOf(games)).verdict, "SIDE")
})

test("strength is drawn towards half while a team played little", () => {
  const strength = strengths(feedOf([game("BLUE"), game("BLUE")]))
  assert.deepEqual([strength.get("x"), strength.get("y")], [4 / 6, 2 / 6])
})

test("the stronger team is the likelier one to win, and two alike are even", () => {
  assert.equal(likelihood(0.5, 0.5), 0.5)
  assert.ok(likelihood(0.7, 0.4) > 0.7)
})

test("lengths fall into whole minutes from the shortest to the longest", () => {
  const { games } = feedOf([game("BLUE", { seconds: 371 }), game("BLUE", { seconds: 490 }), game("BLUE")])
  assert.deepEqual(
    lengthColumns(games).map(({ minute, games: own }) => [minute, own.length]),
    [
      [6, 1],
      [7, 0],
      [8, 1],
    ],
  )
})

test("games whose length nobody knows fall into no minute", () => {
  assert.deepEqual(lengthColumns(feedOf([game("BLUE")]).games), [])
})

test("games go by length, those of unknown length left out", () => {
  const { games } = feedOf([game("BLUE", { seconds: 371 }), game("BLUE", { seconds: 490 }), game("BLUE")])
  const lengths = (order: "short" | "long") => byLength(games, order).map(({ seconds }) => seconds)
  assert.deepEqual(
    [lengths("short"), lengths("long")],
    [
      [371, 490],
      [490, 371],
    ],
  )
})

/** The games of a match in order, by the side X won or lost them on; null is a game nobody knows the winner of. */
const match = (series: string, results: (Side | null)[]) =>
  results.map((winner, index) => game("BLUE", { series, number: index + 1, winner }))

test("a match won after being two games behind is a comeback", () => {
  const feed = feedOf([...match("s1", ["RED", "RED", "BLUE", "BLUE", "BLUE"]), ...match("s2", ["RED", "BLUE", "BLUE"])])
  const [told, ...rest] = comebacks(feed)
  assert.equal(rest.length, 0)
  assert.deepEqual([told!.winnerId, told!.loserId, told!.marks], ["x", "y", [false, false, true, true, true]])
})

test("a match that is still being played is no comeback yet", () => {
  const open = { key: "m1", seriesId: "s1", a: "x", b: "y", bestOf: 7, scheduledAt: on(1) }
  const feed = feedOf(match("s1", ["RED", "RED", "BLUE", "BLUE", "BLUE"]), roundRobinView([open]))
  assert.deepEqual(comebacks(feed), [])
})

test("a comeback is the winner's of the score, also while games of the match are missing", () => {
  const played = { key: "m1", seriesId: "s1", a: "x", b: "y", bestOf: 5, scheduledAt: on(1) }
  const told = (score: [number, number]) =>
    comebacks(feedOf(match("s1", ["RED", "RED", "BLUE", "BLUE"]), roundRobinView([{ ...played, score }]))).map(
      ({ winnerId }) => winnerId,
    )
  assert.deepEqual(told([3, 2]), ["x"])
  assert.deepEqual(told([2, 3]), [])
})

test("a match with a game nobody knows the winner of is no comeback", () => {
  assert.deepEqual(comebacks(feedOf(match("s1", ["RED", "RED", null, "BLUE", "BLUE", "BLUE"]))), [])
})

test("the comeback of the match played last is told first", () => {
  const results: Side[] = ["RED", "RED", "BLUE", "BLUE", "BLUE"]
  assert.deepEqual(
    comebacks(feedOf([...match("s1", results), ...match("s2", results)])).map(({ seriesId }) => seriesId),
    ["s2", "s1"],
  )
})

test("a match the sides were swapped in is followed by its teams", () => {
  const feed = feedOf([
    game("RED", { number: 1 }),
    game("BLUE", { number: 2, teams: ["y", "x"] }),
    game("BLUE", { number: 3 }),
    game("RED", { number: 4, teams: ["y", "x"] }),
    game("BLUE", { number: 5 }),
  ])
  assert.deepEqual(comebacks(feed)[0]!.marks, [false, false, true, true, true])
})

/** What changed from the round robin to the knockout after it, where X picks one hero and then another. */
const changes = (early: TestGame[], late: TestGame[]) => trends(feedOf([...early, ...late], twoStages()))
const first = (a: string, extra: Extra = {}) => game("BLUE", { a: [a], ...extra })
const second = (a: string, extra: Extra = {}) => game("BLUE", { a: [a], series: "s2", ...extra })

test("a hero seen more and more is a trend", () => {
  const told = changes(
    times(20, () => first("old")),
    times(20, () => second("new")),
  )!
  assert.deepEqual(
    told.periods.map(({ key }) => key),
    ["RR", "KO"],
  )
  assert.deepEqual([told.up[0]!.hero.key, told.up[0]!.shares], ["new", [0, 1]])
  assert.deepEqual([told.down[0]!.hero.key, told.down[0]!.shares], ["old", [1, 0]])
})

test("shares are read from twenty games of a period on", () => {
  const late = (count: number) => times(count, () => second("new"))
  const early = times(20, () => first("old"))
  assert.equal(changes(early, late(19)), null)
  assert.notEqual(changes(early, late(20)), null)
})

test("a period needs twenty games that show their bans", () => {
  const early = [...times(10, () => first("old")), ...times(20, () => first("old", unseen))]
  assert.equal(
    changes(
      early,
      times(20, () => second("new")),
    ),
    null,
  )
})

test("one period alone has no trend", () => {
  assert.equal(
    changes(
      times(20, () => first("old")),
      [],
    ),
    null,
  )
})

test("a feed narrowed to one period has no trend", () => {
  const games = [...times(20, () => first("old")), ...times(20, () => second("new"))]
  assert.equal(trends(feedScope(feedOf(games, twoStages()), "KO").feed), null)
})

test("a change chance could have made is no trend", () => {
  // From 6 to 13 of 20 games is more than twice what chance makes, which some hero of a hundred always reaches.
  assert.equal(
    changes(
      times(20, (index) => first(index < 6 ? "steady" : "m1")),
      times(20, (index) => second(index < 13 ? "steady" : "m1")),
    ),
    null,
  )
})

test("games that do not show their bans say nothing of who was seen more", () => {
  // "kept" is banned in every game, of which the first twenty did not write it down.
  const banned: Extra = { bans: [["kept"], []] }
  assert.equal(
    changes(
      times(20, () => first("m1", unseen)),
      times(20, () => second("m1", banned)),
    ),
    null,
  )
})

test("the shares of a period are out of its games that show their bans", () => {
  const told = changes(
    [...times(20, () => first("old")), ...times(5, () => first("old", unseen))],
    times(20, () => second("new")),
  )!
  assert.deepEqual(
    told.periods.map(({ games, shown }) => [games, shown]),
    [
      [25, 20],
      [20, 20],
    ],
  )
  assert.deepEqual([told.down[0]!.hero.key, told.down[0]!.shares], ["old", [1, 0]])
})

test("a stage with several patches is followed patch by patch", () => {
  const patches = [
    { label: "Tuần 1", releasedOn: "2026-10-01" },
    { label: "Tuần 2", releasedOn: "2026-10-08" },
  ]
  const view = roundRobinView(
    [
      { key: "m1", seriesId: "s1", a: "x", b: "y", scheduledAt: on(1) },
      { key: "m2", seriesId: "s2", a: "x", b: "y", scheduledAt: on(8) },
      { key: "m3", seriesId: "s3", a: "x", b: "y", scheduledAt: on(20), stageCode: "KO" },
    ],
    { stages: [stage("RR", { format: "ROUND_ROBIN", patches }), stage("KO")] as never },
  )
  const feed = feedOf(
    ["s1", "s2", "s3"].map((series) => game("BLUE", { series })),
    view,
  )
  assert.deepEqual(
    periodLine(feed).map(({ key }) => key),
    ["RR.1", "RR.2", "KO"],
  )
})

test("a hero picked in a single game is told with that game", () => {
  const feed = feedOf([game("RED", { a: ["once"] }), game("BLUE"), game("BLUE")])
  assert.deepEqual(
    pickedOnce(heroRecords(feed))
      .filter(({ hero }) => hero.key === "once")
      .map(({ won, teamId }) => [won, teamId]),
    [[false, "x"]],
  )
})

test("of the heroes picked in a single game the newest comes first", () => {
  const feed = feedOf([
    game("BLUE", { a: ["early"] }),
    game("BLUE", { a: ["late"], series: "s3" }),
    game("BLUE", { a: ["middle"], series: "s2" }),
  ])
  assert.deepEqual(
    pickedOnce(heroRecords(feed)).map(({ hero }) => hero.key),
    ["late", "middle", "early"],
  )
})
