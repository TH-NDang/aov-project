import assert from "node:assert/strict"
import { test } from "node:test"
import {
  enoughPicks,
  heroLine,
  heroLines,
  heroMates,
  heroRecords,
  heroShelves,
  heroTeams,
  laneCounts,
  leastRate,
  lineFate,
  percent,
  sortLines,
  tally,
  type HeroLine,
} from "../src/lib/hero-model.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

/** X plays "star" and meets "rival"; blue wins unless the game says otherwise. */
const game = (id: string, extra: Partial<TestGame> = {}): TestGame => ({
  id,
  series: "s1",
  number: Number(id.slice(1)),
  blue: { team: "x", picks: ["star", ...five("a").slice(1)], players: ["ann"], bans: ["feared"] },
  red: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["hated"] },
  ...extra,
})
const games = [game("g1"), game("g2", { winner: "RED" }), game("g3", { winner: null })]
const record = (key: string) => heroRecords(feedOf(games)).get(key)!

test("a hero is picked in the order its games were played", () => {
  assert.deepEqual(
    record("star").picks.map(({ game: { id }, won }) => [id, won]),
    [
      ["g1", true],
      ["g2", false],
      ["g3", null],
    ],
  )
})

test("a game without a winner is neither won nor lost", () => {
  assert.deepEqual(tally([true, false, null]), { games: 3, wins: 1, losses: 1 })
  const line = heroLine(record("star"))
  assert.deepEqual([line.picks, line.wins, line.losses], [3, 1, 1])
})

test("a hero is present in the games it was picked or banned in", () => {
  assert.equal(heroLine(record("feared")).presence, 3)
  assert.equal(heroLine(record("star")).presence, 3)
})

test("a game both sides banned a hero in is one game it was seen in", () => {
  const both = game("g1", { red: { team: "y", picks: five("b"), bans: ["feared"] } })
  const { bans, presence } = heroLine(heroRecords(feedOf([both])).get("feared")!)
  assert.deepEqual([bans, presence], [2, 1])
})

test("only games that show their bans say how often a hero was seen", () => {
  const unseen = game("g2", {
    blue: { team: "x", picks: ["star", ...five("a").slice(1)] },
    red: { team: "y", picks: five("b") },
  })
  const { presence, seen } = heroLine(heroRecords(feedOf([game("g1"), unseen])).get("star")!)
  assert.deepEqual([presence, seen], [2, 1])
})

test("a line tells the two sides and the lanes apart", () => {
  const line = heroLine(record("star"))
  assert.deepEqual([line.blue.games, line.red.games], [3, 0])
  assert.deepEqual(line.lanes, [{ lane: "TOP", games: 3 }])
})

test("the teams of a hero say who played it and who banned it against whom", () => {
  const [x] = heroTeams(record("star"))
  assert.deepEqual([x!.teamId, x!.picks.length, x!.players], ["x", 3, [{ playerId: "ann", games: 3 }]])
  const feared = heroTeams(record("feared"))
  assert.deepEqual(
    feared.map(({ teamId, bans, bannedAgainst }) => [teamId, bans, bannedAgainst]),
    [
      ["x", 3, 0],
      ["y", 0, 3],
    ],
  )
})

test("a team that played a hero comes before those that only banned it or had it banned against them", () => {
  const banned = (id: string) =>
    game(id, { blue: { team: "y", picks: five("a"), bans: ["star"] }, red: { team: "z", picks: five("b") } })
  const feed = feedOf([game("g1"), banned("g2"), banned("g3")])
  assert.deepEqual(
    heroTeams(heroRecords(feed).get("star")!).map(({ teamId }) => teamId),
    ["x", "y", "z"],
  )
})

test("of lanes played as often the one listed first in a lineup comes first", () => {
  const picks = (["SUPPORT", "TOP"] as const).map((lane) => ({ pick: { lane } }))
  assert.deepEqual(
    laneCounts(picks).map(({ lane }) => lane),
    ["TOP", "SUPPORT"],
  )
})

test("the heroes beside and against one another keep the results of the hero asked about", () => {
  const [beside] = heroMates(record("star"), "with")
  assert.deepEqual([beside!.games.length, beside!.wins, beside!.losses], [3, 1, 1])
  const rival = heroMates(record("star"), "against").find((mate) => mate.hero.key === "rival")!
  assert.deepEqual([rival.wins, rival.losses], [1, 1])
  assert.equal(
    heroMates(record("star"), "with").some((mate) => mate.hero.key === "star"),
    false,
  )
})

test("a rival of the same lane is one who played that lane in the game", () => {
  const lanes = heroMates(record("star"), "lane")
  assert.deepEqual(
    lanes.map(({ hero, games: met }) => [hero.key, met.length]),
    [["rival", 3]],
  )
})

test("heroes whose lanes nobody recorded met in no lane", () => {
  const games = feedOf([game("g1")]).games.map((item) => ({
    ...item,
    sides: item.sides.map((side) => ({ ...side, picks: side.picks.map((pick) => ({ ...pick, lane: null })) })),
  }))
  assert.deepEqual(heroMates(heroRecords({ games }).get("star")!, "lane"), [])
})

test("a share is a whole percent, and nothing of nothing is none", () => {
  assert.equal(percent(1, 3), 33)
  assert.equal(percent(0, 0), 0)
})

test("a rate needs one game in twenty, and five at least", () => {
  assert.equal(enoughPicks(12), 5)
  assert.equal(enoughPicks(327), 17)
})

test("a long record says more than a short one with the same rate", () => {
  assert.ok(leastRate({ wins: 18, losses: 2 }) > leastRate({ wins: 9, losses: 1 }))
  assert.ok(leastRate({ wins: 9, losses: 1 }) > leastRate({ wins: 2, losses: 0 }))
  assert.equal(leastRate({ wins: 0, losses: 0 }), 0)
})

const line = (name: string, picks: number, wins: number, bans: number): HeroLine => ({
  hero: { key: name, id: name, code: name, name, iconUrl: null },
  picks,
  wins,
  losses: picks - wins,
  bans,
  presence: picks + bans,
  seen: picks + bans,
  blue: tally([]),
  red: tally([]),
  lanes: [],
})
const all = (games: number) => ({ games, shown: games })
/** Of 100 games: one hero everyone bans, one everyone picks, one that wins and one that won its only game. */
const lines = [line("Lucky", 1, 1, 0), line("Banned", 2, 1, 95), line("Picked", 80, 40, 5), line("Winner", 20, 15, 10)]
const names = (list: HeroLine[]) => list.map(({ hero }) => hero.name)

test("heroes go from the most to the fewest by what is asked", () => {
  assert.deepEqual(names(sortLines(lines, "presence", 100)), ["Banned", "Picked", "Winner", "Lucky"])
  assert.deepEqual(names(sortLines(lines, "picks", 100)), ["Picked", "Winner", "Banned", "Lucky"])
  assert.deepEqual(names(sortLines(lines, "bans", 100)), ["Banned", "Winner", "Picked", "Lucky"])
})

test("by presence the games that do not show their bans do not count", () => {
  const picked = { ...line("Often", 60, 30, 0), seen: 10 }
  const feared = { ...line("Feared", 5, 2, 25), seen: 30 }
  assert.deepEqual(names(sortLines([picked, feared], "presence", 100)), ["Feared", "Often"])
})

test("by win rate a hero with too few picks comes after the others", () => {
  assert.deepEqual(names(sortLines(lines, "wins", 100)), ["Winner", "Picked", "Banned", "Lucky"])
})

test("shelves hold the heroes between two shares, the empty ones left out", () => {
  assert.deepEqual(
    heroShelves(lines, "presence", all(100)).map(({ from, below, lines: held }) => [from, below, names(held)]),
    [
      [90, null, ["Banned"]],
      [50, 90, ["Picked"]],
      [25, 50, ["Winner"]],
      [0, 5, ["Lucky"]],
    ],
  )
})

/** A hero picked in 30 of 100 games and banned in 20; 40 games show their bans, 16 of those that picked it among them. */
const partly = { games: 100, shown: 40 }
const known = { ...line("Known", 30, 15, 20), presence: 50, seen: 36 }

test("shelves of presence and of bans are shares of the games that show their bans", () => {
  const shelf = (by: "presence" | "bans" | "picks") => heroShelves([known], by, partly)[0]!.from
  assert.deepEqual([shelf("presence"), shelf("bans")], [90, 50])
})

test("a shelf of picks is a share of every game", () => {
  assert.equal(heroShelves([{ ...known, picks: 8 }], "picks", partly)[0]!.from, 3)
})

test("what nobody knows of a hero are the games that neither picked it nor show their bans", () => {
  assert.deepEqual(lineFate(known, partly), { games: 100, picks: 30, wins: 15, losses: 15, bans: 20, unknown: 46 })
})

test("by wins the heroes with too few picks stand on a shelf of their own", () => {
  const shelves = heroShelves(lines, "wins", all(100))
  assert.deepEqual(
    shelves.map(({ from, lines: held }) => [from, names(held)]),
    [
      [60, ["Winner"]],
      [40, ["Picked"]],
      [null, ["Banned", "Lucky"]],
    ],
  )
})

test("by wins a hero without a decided game is none to compare", () => {
  const line = (key: string, wins: number, losses: number): HeroLine => ({
    ...heroLine({ hero: { key, id: key, code: key, name: key, iconUrl: null }, picks: [], bans: [] }),
    picks: 9,
    wins,
    losses,
    presence: 9,
    seen: 9,
  })
  const shelves = heroShelves([line("won", 6, 3), line("open", 0, 0)], "wins", all(20))
  assert.deepEqual(
    shelves.map(({ from, lines }) => [from, lines.map(({ hero }) => hero.key)]),
    [
      [60, ["won"]],
      [null, ["open"]],
    ],
  )
})

test("a hero nobody picked stands on no shelf of picks", () => {
  const shelves = heroShelves([line("Feared", 0, 0, 12)], "picks", all(100))
  assert.deepEqual(shelves, [])
})

test("every hero picked or banned is listed once", () => {
  assert.equal(heroLines(heroRecords(feedOf(games)), games.length).length, 12)
})
