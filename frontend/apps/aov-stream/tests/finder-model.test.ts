import assert from "node:assert/strict"
import { test } from "node:test"
import {
  asksAnything,
  asksSame,
  asksSides,
  choices,
  conditions,
  duelGames,
  findGames,
  gameOrder,
  heroChoices,
  movedHero,
  namesSide,
  NOTHING_ASKED,
  ordersByLength,
  readQuestion,
  releasedHero,
  roleChoices,
  settled,
  sortFound,
  withHero,
  withoutHero,
  writeQuestion,
  type Question,
} from "../src/lib/finder-model.ts"
import { heroByKey, type FeedGame } from "../src/lib/game-feed.ts"
import { feedOf, five, roundRobinView, type TestGame } from "./fixtures/lineups.ts"

/** X met Y twice and Z once; "star" and "mate" are X's, "rival" was Y's in the first game and Z's in the third. */
const games: TestGame[] = [
  {
    id: "g1",
    series: "s1",
    number: 1,
    winner: "BLUE",
    seconds: 600,
    mvp: "ann",
    blue: { team: "x", picks: ["star", "mate", "a3", "a4", "a5"], players: ["ann", "bob"], bans: ["feared"] },
    red: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["hated"] },
    draft: ["BB", "RB", "BP", "RP", "RP", "BP", "BP", "RP", "RP", "BP", "BP", "RP"],
  },
  {
    id: "g2",
    series: "s1",
    number: 2,
    winner: "RED",
    seconds: 1260,
    mvp: "cat",
    blue: { team: "y", picks: ["star", ...five("b").slice(1)], players: ["cat"], bans: ["feared"] },
    red: { team: "x", picks: ["mate", "a2", "a3", "a4", "a5"], players: ["bob"], bans: ["rival"] },
  },
  {
    id: "g3",
    series: "s3",
    number: 1,
    winner: "RED",
    blue: { team: "z", picks: ["rival", ...five("c").slice(1)], bans: ["mate"] },
    red: { team: "x", picks: ["star", "a2", "a3", "a4", "a5"], players: ["ann"], bans: ["feared"] },
  },
]
const feed = feedOf(games)
/** The games with nothing recorded of the lanes of their seats. */
const withoutLanes = feed.games.map((game): FeedGame => ({
  ...game,
  sides: game.sides.map((side) => ({ ...side, picks: side.picks.map((pick) => ({ ...pick, lane: null })) })),
}))
const hero = (key: string) => heroByKey(feed, key)!
const ask = (question: Partial<Question>) =>
  findGames(feed.games, { ...NOTHING_ASKED, ...question })
    .map(({ game, a, won }) => `${game.id}:${a.teamId}${won ? "+" : "-"}`)
    .sort()

test("without a question every game counts once, blue against red", () => {
  assert.deepEqual(ask({}), ["g1:x+", "g2:y-", "g3:z-"])
  assert.equal(asksAnything(NOTHING_ASKED), false)
})

test("a picked hero gives the games and the result of the side that picked it", () => {
  assert.deepEqual(ask({ pick: [hero("star")] }), ["g1:x+", "g2:y-", "g3:x+"])
})

test("several picked heroes were on one team", () => {
  assert.deepEqual(ask({ pick: [hero("star"), hero("mate")] }), ["g1:x+"])
})

test("heroes against each other were on two teams", () => {
  assert.deepEqual(ask({ pick: [hero("star")], vs: [hero("rival")] }), ["g1:x+", "g3:x+"])
  assert.deepEqual(ask({ pick: [hero("rival")], vs: [hero("star")] }), ["g1:y-", "g3:z-"])
})

test("a ban counts by either side, by the side asked about, or by the other", () => {
  assert.deepEqual(ask({ ban: [hero("feared")] }), ["g1:x+", "g2:y-", "g3:z-"])
  assert.deepEqual(ask({ team: "x", banA: [hero("feared")] }), ["g1:x+", "g3:x+"])
  assert.deepEqual(ask({ team: "x", banB: [hero("feared")] }), ["g2:x+"])
})

test("a team is met by its opponents", () => {
  assert.deepEqual(ask({ team: "x", opp: "y" }), ["g1:x+", "g2:x+"])
  assert.deepEqual(ask({ opp: "x" }), ["g1:y-", "g2:y-", "g3:z-"])
})

test("a player next to one hero is the one who played it", () => {
  assert.deepEqual(ask({ pick: [hero("star")], player: "ann" }), ["g1:x+", "g3:x+"])
  assert.deepEqual(ask({ pick: [hero("star")], player: "bob" }), [])
  assert.deepEqual(ask({ player: "bob" }), ["g1:x+", "g2:x+"])
})

test("a player may be asked about as the best of the game", () => {
  assert.deepEqual(ask({ player: "ann", mvp: true }), ["g1:x+"])
})

test("the MVP of a game counts where no seat names the player", () => {
  const unnamed = feedOf([{ ...games[0]!, blue: { ...games[0]!.blue, players: [] } }])
  assert.equal(findGames(unnamed.games, { ...NOTHING_ASKED, player: "ann", mvp: true }).length, 1)
  assert.equal(findGames(unnamed.games, { ...NOTHING_ASKED, player: "ann" }).length, 0)
})

test("the best player of a game is asked about with the hero its seat names", () => {
  assert.deepEqual(ask({ player: "ann", mvp: true, pick: [hero("star")] }), ["g1:x+"])
  assert.deepEqual(ask({ player: "ann", mvp: true, pick: [hero("mate")] }), [])
})

test("next to a hero the MVP counts only where the seat names the player", () => {
  const unnamed = feedOf([{ ...games[0]!, blue: { ...games[0]!.blue, players: [] } }])
  const question = { ...NOTHING_ASKED, player: "ann", mvp: true, pick: [hero("star")] }
  assert.deepEqual(findGames(unnamed.games, question), [])
})

test("a hero no seat names anyone on is not the MVP's while another seat names the MVP", () => {
  // Ann sat on "star"; who had "a3" in that game nobody wrote down.
  assert.deepEqual(ask({ player: "ann", mvp: true, pick: [hero("a3")] }), [])
})

test("the MVP of a game counts while nobody knows who won it", () => {
  const open = feedOf([{ ...games[0]!, winner: null }])
  assert.equal(findGames(open.games, { ...NOTHING_ASKED, player: "ann", mvp: true }).length, 1)
})

test("a game without a winner is neither won nor lost", () => {
  const open = feedOf([{ ...games[0]!, winner: null }])
  for (const won of [true, false])
    assert.deepEqual(findGames(open.games, { ...NOTHING_ASKED, pick: [hero("star")], won }), [])
})

test("a side, a result and a lane narrow the side asked about", () => {
  assert.deepEqual(ask({ pick: [hero("star")], side: "RED" }), ["g3:x+"])
  assert.deepEqual(ask({ pick: [hero("star")], won: false }), ["g2:y-"])
  assert.deepEqual(ask({ pick: [hero("mate")], lane: "TOP" }), ["g2:x+"])
  assert.deepEqual(ask({ side: "BLUE", won: true }), ["g1:x+"])
})

test("a duel is fought in one lane", () => {
  assert.deepEqual(ask({ pick: [hero("star")], vs: [hero("rival")], duel: true }), ["g1:x+", "g3:x+"])
  assert.deepEqual(ask({ pick: [hero("mate")], vs: [hero("rival")], duel: true }), [])
})

test("heroes whose lanes nobody recorded fought no duel", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star")], vs: [hero("rival")], duel: true }
  assert.deepEqual(findGames(withoutLanes, question), [])
})

test("a lane without a hero or a player asks nothing", () => {
  assert.deepEqual(ask({ lane: "TOP" }), ["g1:x+", "g2:y-", "g3:z-"])
})

test("a turn is the turn of the only hero asked about", () => {
  assert.deepEqual(ask({ pick: [hero("star")], turn: 3 }), ["g1:x+"])
  assert.deepEqual(ask({ ban: [hero("hated")], turn: 2 }), ["g1:x+"])
  assert.deepEqual(ask({ ban: [hero("hated")], turn: 1 }), [])
})

test("length is counted in whole minutes, and a game of unknown length is out", () => {
  assert.deepEqual(ask({ max: 10 }), ["g1:x+"])
  assert.deepEqual(ask({ min: 11, max: 21 }), ["g2:y-"])
  assert.deepEqual(ask({ min: 1 }), ["g1:x+", "g2:y-"])
})

test("days are counted where the event is played, both ends included", () => {
  assert.deepEqual(ask({ from: "2026-11-01", to: "2026-11-01" }), ["g1:x+", "g2:y-"])
  assert.deepEqual(ask({ from: "2026-11-02" }), ["g3:z-"])
})

test("a game without a day is on none of the days asked for", () => {
  const undated = feedOf([games[0]!], roundRobinView([{ key: "m1", seriesId: "s1", a: "x", b: "y" }]))
  assert.deepEqual(findGames(undated.games, { ...NOTHING_ASKED, from: "2026-11-01" }), [])
  assert.deepEqual(findGames(undated.games, { ...NOTHING_ASKED, to: "2026-11-30" }), [])
})

test("an address says a question and reads it back", () => {
  const question: Question = {
    ...NOTHING_ASKED,
    team: "x",
    pick: [hero("star"), hero("mate")],
    banB: [hero("feared")],
    player: "ann",
    mvp: true,
    lane: "MID",
    side: "BLUE",
    won: false,
    from: "2026-11-01",
    min: 10,
    max: 20,
  }
  const params = new URLSearchParams(writeQuestion(question))
  assert.equal(params.get("pick"), "star.mate")
  assert.equal(params.get("result"), "loss")
  assert.deepEqual(readQuestion(feed, params), question)
})

test("what an address names and the competition does not know is dropped", () => {
  const params = new URLSearchParams("team=nobody&pick=star.ghost&lane=ROOF&min=x&from=soon&result=maybe&mvp=1")
  assert.deepEqual(readQuestion(feed, params), { ...NOTHING_ASKED, pick: [hero("star")] })
})

test("an address that names more heroes than a role has seats keeps the first of them", () => {
  const params = new URLSearchParams("pick=star.mate.rival.a2.a3.a4.a5")
  assert.deepEqual(
    readQuestion(feed, params).pick.map(({ key }) => key),
    ["star", "mate", "rival", "a2", "a3"],
  )
})

test("a duel is asked of one hero against one", () => {
  const read = (search: string) => readQuestion(feed, new URLSearchParams(search)).duel
  assert.equal(read("pick=star&vs=rival&duel=1"), true)
  assert.equal(read("pick=star.mate&vs=rival&duel=1"), false)
  assert.equal(read("pick=star&duel=1"), false)
})

test("only a question about one side tells the sides apart", () => {
  assert.equal(asksSides({ ...NOTHING_ASKED, ban: [hero("feared")], max: 10 }), false)
  assert.equal(asksSides({ ...NOTHING_ASKED, vs: [hero("rival")] }), true)
})

test("two questions are the same when they ask the same", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star")], max: 9 }
  assert.equal(asksSame(question, { ...NOTHING_ASKED, max: 9, pick: [hero("star")] }), true)
  assert.equal(asksSame(question, { ...question, max: null }), false)
})

test("the choice of a hero counts the games it would leave", () => {
  const counts = heroChoices(feed.games, { ...NOTHING_ASKED, pick: [hero("star")] }, "vs")
  assert.equal(counts.get("rival"), 2)
  assert.equal(counts.get("mate"), 1)
  assert.equal(counts.has("star"), false)
})

test("a hero asked about already is not offered again", () => {
  const picked = { ...NOTHING_ASKED, pick: [hero("star")] }
  assert.equal(heroChoices(feed.games, picked, "pick").has("star"), false)
  assert.equal(heroChoices(feed.games, picked, "pick").has("mate"), true)
})

test("the choice of a hero with no side asked counts either side once", () => {
  const counts = heroChoices(feed.games, NOTHING_ASKED, "pick")
  assert.equal(counts.get("star"), 3)
  assert.equal(heroChoices(feed.games, NOTHING_ASKED, "ban").get("feared"), 3)
})

test("the values of a condition are counted as if it were not asked", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star")], team: "y" }
  assert.deepEqual([...choices(feed.games, question, "team")].sort(), [
    ["x", 2],
    ["y", 1],
  ])
  assert.deepEqual([...choices(feed.games, question, "won")], [["loss", 1]])
  assert.deepEqual([...choices(feed.games, { ...NOTHING_ASKED, pick: [hero("star")] }, "player")].sort(), [
    ["ann", 2],
    ["cat", 1],
  ])
})

test("the turns of the only hero asked about are counted where they are known", () => {
  const turns = (question: Partial<Question>) => [...choices(feed.games, { ...NOTHING_ASKED, ...question }, "turn")]
  assert.deepEqual(turns({ pick: [hero("star")] }), [["3", 1]])
  assert.deepEqual(turns({ ban: [hero("hated")] }), [["2", 1]])
  assert.deepEqual(turns({ pick: [hero("star")], turn: 9 }), [["3", 1]])
  assert.deepEqual(turns({ pick: [hero("star"), hero("mate")] }), [])
})

test("the players of a lane are counted where they played it", () => {
  const players = (question: Partial<Question>) => [...choices(feed.games, { ...NOTHING_ASKED, ...question }, "player")]
  assert.deepEqual(players({ team: "x", player: "bob", lane: "TOP" }).sort(), [
    ["ann", 2],
    ["bob", 1],
  ])
  assert.deepEqual(players({ team: "x", player: "bob", lane: "JUNGLE" }), [["bob", 1]])
})

test("the lanes of a player are counted, whoever else the hero asked about was played by", () => {
  const lanes = (question: Partial<Question>) => [...choices(feed.games, { ...NOTHING_ASKED, ...question }, "lane")]
  assert.deepEqual(lanes({ player: "bob" }).sort(), [
    ["JUNGLE", 1],
    ["TOP", 1],
  ])
})

test("only a question that names someone of a side names one", () => {
  assert.equal(namesSide({ ...NOTHING_ASKED, side: "BLUE", won: true }), false)
  assert.equal(namesSide({ ...NOTHING_ASKED, banB: [hero("feared")] }), true)
})

test("a hero joins, changes and leaves its role", () => {
  const roles = (question: Question) => writeQuestion(question).map((pair) => pair.join("="))
  const two = withHero({ ...NOTHING_ASKED, pick: [hero("star")] }, "pick", hero("mate"))
  assert.deepEqual(roles(two), ["pick=star.mate"])
  assert.deepEqual(roles(withHero(two, "pick", hero("star"))), ["pick=mate.star"])
  assert.deepEqual(roles(movedHero(two, hero("star"), "pick", "ban")), ["pick=mate", "ban=star"])
  assert.deepEqual(roles(withoutHero(two, "pick", hero("star"))), ["pick=mate"])
})

/** The question that is left when a hero of it is let go of, and the games that answer that one. */
const releasing = (question: Partial<Question>, key: string) => {
  const left = releasedHero(feed.games, { ...NOTHING_ASKED, ...question }, "pick", hero(key))
  return [writeQuestion(left).map((pair) => pair.join("=")), ask(left)]
}

test("a hero let go of takes the player with it where the hero left was not the player's", () => {
  // Ann had "star" in the game she and "mate" were in.
  const question = { pick: [hero("star"), hero("mate")], player: "ann" }
  assert.deepEqual(releasing(question, "star"), [["pick=mate"], ["g1:x+", "g2:x+"]])
})

test("a hero let go of leaves the player while games remain", () => {
  const question = { pick: [hero("star"), hero("mate")], player: "ann" }
  assert.deepEqual(releasing(question, "mate"), [
    ["pick=star", "player=ann"],
    ["g1:x+", "g3:x+"],
  ])
})

test("the lane asked of a player goes with the player, and does not become that of the hero left", () => {
  const question = { pick: [hero("star"), hero("mate")], player: "ann", mvp: true, lane: "TOP" as const }
  assert.deepEqual(ask(question), ["g1:x+"])
  assert.deepEqual(releasing(question, "star"), [["pick=mate"], ["g1:x+", "g2:x+"]])
})

test("the player stays where letting go of the player as well would find nothing either", () => {
  const question = { team: "z", pick: [hero("star"), hero("mate")], player: "ann" }
  assert.deepEqual(releasing(question, "star"), [["pick=mate", "team=z", "player=ann"], []])
})

test("what the last hero was asked for goes with it", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star")], lane: "TOP" as const, turn: 3, won: true }
  assert.deepEqual(withoutHero(question, "pick", hero("star")), NOTHING_ASKED)
  const two = withHero(question, "pick", hero("mate"))
  assert.deepEqual([two.lane, two.turn, two.won], [null, null, true])
})

test("a turn stays with the hero it was asked of, and with a ban or a pick", () => {
  const banned = { ...NOTHING_ASKED, ban: [hero("feared")], turn: 1 }
  assert.equal(withHero(banned, "pick", hero("star")).turn, null)
  assert.equal(movedHero(banned, hero("feared"), "ban", "banA").turn, 1)
  assert.equal(movedHero(banned, hero("feared"), "ban", "pick").turn, null)
  assert.equal(withoutHero({ ...banned, pick: [hero("star")], turn: 3 }, "pick", hero("star")).turn, null)
})

test("a choice of a hero counts the games without what it would end", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star")], turn: 3 }
  assert.equal(heroChoices(feed.games, question, "vs").get("rival"), 1)
  assert.equal(heroChoices(feed.games, { ...NOTHING_ASKED, pick: [hero("mate")], lane: "TOP" }, "pick").get("a3"), 2)
})

test("the heroes offered beside a player are those the player sat with", () => {
  const counts = heroChoices(feed.games, { ...NOTHING_ASKED, player: "ann" }, "pick")
  assert.deepEqual([...counts], [["star", 2]])
  const two = heroChoices(feed.games, { ...NOTHING_ASKED, player: "ann", pick: [hero("star")] }, "pick")
  assert.equal(two.get("mate"), 1)
  assert.equal(two.get("a3"), 2)
})

test("the heroes offered to a player of a lane leave the games the player had that lane in", () => {
  // Bob's seat beside "star" was the jungle; alone, the question would ask him to have played "star" there.
  const question = { ...NOTHING_ASKED, player: "bob", pick: [hero("star")], lane: "JUNGLE" as const }
  assert.deepEqual(findGames(feed.games, question), [])
  assert.equal(heroChoices(feed.games, question, "pick").get("mate"), 1)
})

test("a condition without anyone to stand on is let go", () => {
  assert.deepEqual(settled({ ...NOTHING_ASKED, lane: "TOP", mvp: true, duel: true, turn: 2 }), NOTHING_ASKED)
  assert.deepEqual(settled({ ...NOTHING_ASKED, side: "BLUE" }), NOTHING_ASKED)
  assert.equal(settled({ ...NOTHING_ASKED, side: "BLUE", won: true }).side, "BLUE")
  assert.equal(settled({ ...NOTHING_ASKED, player: "ann", lane: "TOP" }).lane, "TOP")
})

test("the other roles of a hero count the games they would leave", () => {
  const question = { ...NOTHING_ASKED, team: "x", pick: [hero("star")] }
  assert.deepEqual(
    [...roleChoices(feed.games, question, hero("star"), "pick")],
    [
      ["pick", 2],
      ["vs", 1],
    ],
  )
  assert.deepEqual(
    [...roleChoices(feed.games, { ...NOTHING_ASKED, ban: [hero("rival")] }, hero("rival"), "ban")],
    [
      ["pick", 2],
      ["vs", 2],
      ["ban", 1],
      ["banA", 1],
      ["banB", 1],
    ],
  )
})

test("a role whose seats are taken is no other role of a hero", () => {
  const banning: TestGame = {
    id: "g9",
    series: "s1",
    blue: { team: "x", picks: five("a"), bans: ["b1", "b2", "b3", "b4", "b5"] },
    red: { team: "y", picks: five("c"), bans: [] },
  }
  const season = feedOf([banning])
  const named = (key: string) => heroByKey(season, key)!
  const asked = { ...NOTHING_ASKED, banA: ["b1", "b2", "b3"].map(named), ban: [named("b5")] }
  assert.equal(roleChoices(season.games, asked, named("b5"), "ban").get("banA"), 1)
  const full = { ...asked, banA: ["b1", "b2", "b3", "b4"].map(named) }
  assert.equal(roleChoices(season.games, full, named("b5"), "ban").has("banA"), false)
})

test("found games are ordered by length, those of unknown length last", () => {
  const found = findGames(feed.games, NOTHING_ASKED)
  const ids = (order: "new" | "short" | "long") => sortFound(found, order).map(({ game }) => game.id)
  assert.deepEqual(ids("short"), ["g1", "g2", "g3"])
  assert.deepEqual(ids("long"), ["g2", "g1", "g3"])
  assert.deepEqual(ids("new"), ["g3", "g2", "g1"])
})

test("games come newest first unless the address asks for an order it knows", () => {
  assert.deepEqual(["short", "long", "longest", null].map(gameOrder), ["short", "long", "new", "new"])
})

test("an order by length needs two games whose length is known", () => {
  const found = findGames(feed.games, NOTHING_ASKED)
  assert.equal(ordersByLength(found), true)
  assert.equal(ordersByLength(found.filter(({ game }) => game.id !== "g1")), false)
  assert.equal(ordersByLength([]), false)
})

test("the duels of two heroes are the games they played in one lane", () => {
  const duels = (question: Partial<Question>) => duelGames(feed.games, { ...NOTHING_ASKED, ...question })
  assert.equal(duels({ pick: [hero("star")], vs: [hero("rival")] }), 2)
  assert.equal(duels({ pick: [hero("star")], vs: [hero("rival")], team: "x", opp: "y" }), 1)
  assert.equal(duels({ pick: [hero("mate")], vs: [hero("rival")] }), 0)
})

test("a duel is only offered to one hero on each side", () => {
  const duels = (question: Partial<Question>) => duelGames(feed.games, { ...NOTHING_ASKED, ...question })
  assert.equal(duels({ pick: [hero("star")] }), null)
  assert.equal(duels({ vs: [hero("rival")] }), null)
  assert.equal(duels({ pick: [hero("star"), hero("mate")], vs: [hero("rival")] }), null)
})

test("each condition can be let go on its own", () => {
  const question = { ...NOTHING_ASKED, pick: [hero("star"), hero("mate")], team: "x", max: 10 }
  const list = conditions(question)
  assert.deepEqual(
    list.map(({ key, hero: named }) => named?.key ?? key),
    ["star", "mate", "team", "length"],
  )
  assert.deepEqual(list[0]!.without.pick, [hero("mate")])
  assert.equal(list[3]!.without.max, null)
})

test("a duel and the best player are conditions of their own", () => {
  const question = {
    ...NOTHING_ASKED,
    pick: [hero("star")],
    vs: [hero("rival")],
    duel: true,
    player: "ann",
    mvp: true,
    from: "2026-11-01",
  }
  const list = conditions(question)
  assert.deepEqual(
    list.map(({ key }) => key),
    ["pick", "vs", "player", "duel", "mvp", "days"],
  )
  assert.equal(list[1]!.without.duel, false)
  assert.equal(list[2]!.without.mvp, false)
})
