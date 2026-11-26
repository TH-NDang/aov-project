import assert from "node:assert/strict"
import { test } from "node:test"
import type { HeroBuilds } from "@aov/community-contracts"
import { draftShape } from "../src/lib/draft-shape.ts"
import { findGames, NOTHING_ASKED } from "../src/lib/finder-model.ts"
import { feedScope, heroByKey, type FeedGame } from "../src/lib/game-feed.ts"
import { heroMates, heroRecords, heroTeams, type HeroMate } from "../src/lib/hero-model.ts"
import {
  buildCounts,
  columnFigure,
  columnQuestion,
  columnWords,
  heroColumns,
  heroFate,
  heroList,
  heroStaff,
  mateRows,
  namedPlayers,
  orderedGames,
  seasonColumns,
  tellsDraft,
  tellsSeason,
  verdict,
  type HeroFate,
} from "../src/lib/hero-page-model.ts"
import { on, stage, type TestMatch } from "./fixtures/competition.ts"
import { feedOf, five, roundRobinView, type TestGame } from "./fixtures/lineups.ts"

let next = 0
/** X plays "star" against Y in the match of a series; blue wins unless the game says otherwise. */
const game = (series: string, extra: Partial<TestGame> = {}): TestGame => {
  next += 1
  return {
    id: `g${next}`,
    series,
    number: next,
    blue: { team: "x", picks: ["star", ...five("a").slice(1)], bans: ["feared"] },
    red: { team: "y", picks: five("b"), bans: ["hated"] },
    ...extra,
  }
}

/* ---------- What became of it ---------- */

test("a game both sides banned a hero in is one game", () => {
  const twice = game("s1", {
    blue: { team: "x", picks: five("a"), bans: ["feared"] },
    red: { team: "y", picks: five("b"), bans: ["feared"] },
  })
  const record = heroRecords(feedOf([twice, game("s1")])).get("feared")!
  assert.deepEqual(heroFate(record, { games: 2, shown: 2 }), {
    games: 2,
    shown: 2,
    picks: 0,
    wins: 0,
    losses: 0,
    bans: 2,
    unknown: 0,
    present: 2,
    seen: 2,
  })
})

test("a game without a winner is picked, and neither won nor lost", () => {
  const record = heroRecords(feedOf([game("s1"), game("s1", { winner: "RED" }), game("s1", { winner: null })])).get(
    "star",
  )!
  const { picks, wins, losses } = heroFate(record, { games: 4, shown: 4 })
  assert.deepEqual([picks, wins, losses], [3, 1, 1])
})

test("what nobody knows of a hero are the games that neither picked it nor show their bans", () => {
  const silent = (extra: Partial<TestGame> = {}) =>
    game("s1", { blue: { team: "x", picks: five("a") }, red: { team: "y", picks: five("b") }, ...extra })
  const picked = silent({ blue: { team: "x", picks: ["star", ...five("a").slice(1)] } })
  const record = heroRecords(feedOf([game("s1"), picked, silent(), silent()])).get("star")!
  const { present, seen, unknown } = heroFate(record, { games: 4, shown: 1 })
  assert.deepEqual([present, seen, unknown], [2, 1, 2])
})

test("a list of a hero opens while it has games", () => {
  assert.equal(heroList("picks", { picks: 1, bans: 0 }), "picks")
  assert.equal(heroList("bans", { picks: 1, bans: 0 }), null)
  assert.equal(heroList("games", { picks: 1, bans: 1 }), null)
  assert.equal(heroList(null, { picks: 1, bans: 1 }), null)
})

/* ---------- The sentence ---------- */

type Say = (vi: string, en: string) => string
const vi: Say = (text) => text
const en: Say = (_, text) => text
const fate = (games: number, bans: number, wins: number, losses: number, open = 0): HeroFate => ({
  games,
  shown: games,
  picks: wins + losses + open,
  wins,
  losses,
  bans,
  unknown: 0,
  present: bans + wins + losses + open,
  seen: bans + wins + losses + open,
})
const said = (item: HeroFate, text = vi) =>
  verdict(item, "Marja", text)
    .map((part) => (typeof part === "string" ? part : part.count))
    .join("")

test("a sentence names the share of games a hero was part of, and how its picks went", () => {
  assert.equal(
    said(fate(327, 136, 49, 56)),
    "Gần ba phần tư số ván có Marja: 136 ván bị cấm, 105 ván được chọn. Chơi thì thắng thua gần ngang nhau: thắng 49, thua 56.",
  )
  assert.equal(
    said(fate(327, 136, 49, 56), en),
    "Marja was part of nearly three quarters of the games: banned in 136, picked in 105. It won about as often as it lost: won 49, lost 56.",
  )
})

test("a number of a sentence says which games it counts", () => {
  const counts = verdict(fate(327, 136, 49, 56), "Marja", vi).filter((part) => typeof part !== "string")
  assert.deepEqual(counts, [
    { count: 136, of: "bans" },
    { count: 105, of: "picks" },
    { count: 49, of: "won" },
    { count: 56, of: "lost" },
  ])
})

test("a hero taken almost whenever it is not banned is told so with the games it was left open in", () => {
  assert.equal(
    said(fate(327, 272, 35, 17)),
    "Không bị cấm thì gần như luôn có đội chọn: 272 trong 327 ván bị cấm, 55 ván còn lại thì 52 ván được chọn. Chơi thì hay thắng: thắng 35, thua 17.",
  )
  assert.equal(
    said(fate(40, 38, 1, 1)),
    "Không bị cấm là có đội chọn: 38 trong 40 ván bị cấm, 2 ván còn lại được chọn. Thắng 1, thua 1.",
  )
})

test("a hero banned almost always, and left alone in the other games, was only part of them", () => {
  assert.equal(
    said(fate(240, 218, 2, 0)),
    "Gần như ván nào cũng có Marja: 218 ván bị cấm, 2 ván được chọn. Thắng cả 2 ván.",
  )
})

test("a share near no fraction, or of few games, reads as its count", () => {
  assert.match(said(fate(327, 3, 10, 15)), /^28 trong 327 ván có Marja: 3 ván bị cấm, 25 ván được chọn\./)
  assert.match(said(fate(8, 2, 1, 1)), /^4 trong 8 ván có Marja:/)
})

test("a hero is part of almost every game from nine in ten on", () => {
  assert.match(said(fate(100, 60, 15, 15)), /^Gần như ván nào cũng có Marja:/)
  assert.match(said(fate(100, 59, 15, 15)), /^89 trong 100 ván có Marja:/)
})

test("a share is called exact only where it is", () => {
  assert.match(said(fate(100, 30, 10, 10)), /^Đúng nửa số ván có Marja:/)
  assert.match(said(fate(100, 31, 10, 10)), /^Hơn nửa số ván có Marja:/)
  assert.match(said(fate(100, 29, 10, 10)), /^Gần nửa số ván có Marja:/)
})

test("a hero nobody banned, or nobody picked, is told so", () => {
  assert.equal(said(fate(327, 0, 3, 1)), "Được chọn 4 trong 327 ván, chưa lần nào bị cấm. Thắng 3, thua 1.")
  assert.equal(said(fate(327, 2, 0, 0)), "Bị cấm 2 trong 327 ván, chưa lần nào được chọn.")
  assert.equal(said(fate(37, 0, 0, 0)), "Trong 37 ván này không đội nào chọn hay cấm Marja.")
  assert.equal(said(fate(1, 0, 0, 0)), "Ván này không đội nào chọn hay cấm Marja.")
})

/** A hero in 327 games of which 303 show their bans, `silent` of its picks in the others. */
const partly = (bans: number, wins: number, losses: number, silent: number): HeroFate => ({
  ...fate(327, bans, wins, losses),
  shown: 303,
  seen: bans + wins + losses - silent,
  unknown: 24 - silent,
})

test("where some games do not show their bans each number says what it is out of", () => {
  assert.equal(
    said(partly(127, 49, 56, 9)),
    "Bị cấm 127 trong 303 ván có ghi lượt cấm, được chọn 105 trong cả 327 ván. Chơi thì thắng thua gần ngang nhau: thắng 49, thua 56.",
  )
  assert.equal(
    said(partly(127, 49, 56, 9), en),
    "Banned in 127 of 303 games that record bans, picked in 105 of all 327. It won about as often as it lost: won 49, lost 56.",
  )
})

test("a hero is picked whenever it is not banned by the games that show their bans", () => {
  assert.match(
    said(partly(252, 35, 17, 4)),
    /^Không bị cấm thì gần như luôn có đội chọn: bị cấm 252 trong 303 ván có ghi lượt cấm, được chọn 52 trong cả 327 ván\./,
  )
  assert.match(said(partly(252, 35, 17, 1)), /^Không bị cấm là có đội chọn: bị cấm 252 trong 303 ván/)
  assert.match(
    said(partly(258, 32, 15, 7)),
    /^Bị cấm 258 trong 303 ván có ghi lượt cấm, được chọn 47 trong cả 327 ván\./,
  )
})

test("a hero banned wherever bans are shown was left open in no game anybody knows", () => {
  assert.match(said(partly(303, 4, 3, 7)), /^Bị cấm 303 trong 303 ván có ghi lượt cấm, được chọn 7 trong cả 327 ván\./)
})

test("a hero nobody is known to have banned, or to have picked, is told so with the games that say it", () => {
  assert.equal(
    said(partly(0, 3, 1, 2)),
    "Được chọn 4 trong 327 ván, chưa lần nào bị cấm trong 303 ván có ghi lượt cấm. Thắng 3, thua 1.",
  )
  assert.equal(
    said(partly(0, 3, 1, 2), en),
    "Picked in 4 of 327 games, never banned in the 303 that record bans. Won 3, lost 1.",
  )
  assert.equal(said(partly(2, 0, 0, 0)), "Bị cấm 2 trong 303 ván có ghi lượt cấm, chưa lần nào được chọn.")
  assert.equal(
    said(partly(0, 0, 0, 0)),
    "Trong 327 ván này không đội nào chọn Marja, 303 ván có ghi lượt cấm cũng không đội nào cấm.",
  )
})

test("of games none of which shows its bans only the picks are told", () => {
  const silent = (games: number, wins: number, losses: number) => ({
    ...fate(games, 0, wins, losses),
    shown: 0,
    seen: 0,
    unknown: games - wins - losses,
  })
  assert.equal(said(silent(327, 3, 1)), "Được chọn 4 trong 327 ván. Thắng 3, thua 1.")
  assert.equal(said(silent(37, 0, 0)), "Trong 37 ván này không đội nào chọn Marja.")
  assert.equal(said(silent(1, 0, 0)), "Ván này không đội nào chọn Marja.")
})

test("a single pick is told by how that game ended", () => {
  assert.equal(said(fate(327, 0, 1, 0)), "Được chọn 1 trong 327 ván, chưa lần nào bị cấm. Ván đó thắng.")
  assert.equal(said(fate(327, 0, 0, 1)), "Được chọn 1 trong 327 ván, chưa lần nào bị cấm. Ván đó thua.")
  assert.equal(said(fate(327, 0, 0, 0, 1)), "Được chọn 1 trong 327 ván, chưa lần nào bị cấm. Chưa rõ thắng hay thua.")
  assert.equal(said(fate(1, 0, 1, 0)), "Được chọn 1 trong 1 ván, chưa lần nào bị cấm. Ván đó thắng.")
})

test("a word for how picks went needs enough of them", () => {
  assert.match(said(fate(327, 0, 11, 5)), /\. Thắng 11, thua 5\.$/)
  assert.match(said(fate(327, 0, 11, 6)), /\. Chơi thì hay thắng: thắng 11, thua 6\.$/)
  assert.match(said(fate(100, 0, 24, 16)), /\. Chơi thì hay thắng: /)
  assert.match(said(fate(100, 0, 23, 17)), /\. Chơi thì thắng nhiều hơn thua: /)
  assert.match(said(fate(100, 0, 20, 20)), /\. Chơi thì thắng thua ngang nhau: /)
  assert.match(said(fate(100, 0, 17, 23)), /\. Chơi thì thua nhiều hơn thắng: /)
  assert.match(said(fate(100, 0, 16, 24)), /\. Chơi thì hay thua: /)
  assert.match(said(fate(100, 0, 30, 0)), /\. Thắng cả 30 ván\.$/)
})

test("in a short competition a word for how picks went needs ten of them all the same", () => {
  assert.match(said(fate(23, 0, 7, 2)), /. Thắng 7, thua 2.$/)
  assert.match(said(fate(23, 0, 7, 3)), /. Chơi thì hay thắng: thắng 7, thua 3.$/)
})

test("games without a recorded result are told beside those won and lost", () => {
  assert.match(said(fate(327, 0, 2, 1, 1)), /\. Thắng 2, thua 1, 1 ván chưa rõ kết quả\.$/)
  assert.match(said(fate(327, 0, 3, 0, 1)), /\. Thắng 3, thua 0, 1 ván chưa rõ kết quả\.$/)
})

/* ---------- Who played it ---------- */

const playedBy = (player: string | null) =>
  game("s1", { blue: { team: "x", picks: ["star", ...five("a").slice(1)], players: [player] } })
const ofX = (...players: (string | null)[]) => heroTeams(heroRecords(feedOf(players.map(playedBy))).get("star")!)[0]!

test("the players of a team are named with their games, and the games without one are counted apart", () => {
  const known = { ann: { nickname: "Ann" }, bo: { nickname: "Bo" } }
  assert.deepEqual(namedPlayers(ofX("ann", "bo", "ann", null), known), {
    named: [
      { playerId: "ann", games: 2 },
      { playerId: "bo", games: 1 },
    ],
    unknown: 1,
  })
})

test("a player the competition does not name is as unknown as a seat without one", () => {
  assert.deepEqual(namedPlayers(ofX("ann", "ghost", "ghost", null), { ann: { nickname: "Ann" } }), {
    named: [{ playerId: "ann", games: 1 }],
    unknown: 3,
  })
  assert.deepEqual(namedPlayers(ofX("ann"), { ann: { nickname: "" } }), { named: [], unknown: 1 })
})

/* ---------- Mates ---------- */

const mate = (name: string, wins: number, losses: number): HeroMate => ({
  hero: { key: name, id: name, code: name, name, iconUrl: null },
  games: Array.from({ length: wins + losses }, (_, index) => ({ game: {} as FeedGame, won: index < wins })),
  wins,
  losses,
})

test("by results the heroes met too rarely to compare follow on their own", () => {
  const mates = [mate("often", 10, 10), mate("good", 12, 6), mate("rare", 3, 0)]
  assert.deepEqual(mateRows(mates, "games", 17), { ranked: mates, few: [] })
  const { ranked, few } = mateRows(mates, "won", 17)
  assert.deepEqual(
    ranked.map(({ hero }) => hero.key),
    ["good", "often"],
  )
  assert.deepEqual(
    few.map(({ hero }) => hero.key),
    ["rare"],
  )
})

test("as many games as it takes to compare are enough", () => {
  const { ranked, few } = mateRows([mate("just", 9, 8), mate("short", 9, 7)], "won", 17)
  assert.deepEqual([ranked.map(({ hero }) => hero.key), few.map(({ hero }) => hero.key)], [["just"], ["short"]])
})

/* ---------- Weeks ---------- */

/** Two weeks of a round robin, then playoffs over two weekends. */
const season: TestMatch[] = [
  { key: "m1", seriesId: "s1", a: "x", b: "y", scheduledAt: on(1) },
  { key: "m2", seriesId: "s2", a: "x", b: "z", scheduledAt: on(2) },
  { key: "m3", seriesId: "s3", a: "y", b: "z", scheduledAt: on(8) },
  { key: "m4", seriesId: "s4", a: "x", b: "y", scheduledAt: on(15), stageCode: "KO" },
  { key: "m5", seriesId: "s5", a: "x", b: "z", scheduledAt: on(22), stageCode: "KO" },
]
const robin = (code: string) => stage(code, { format: "ROUND_ROBIN" })
const seasonView = (matches = season, stages = [robin("RR"), stage("KO")]) =>
  roundRobinView(matches, { stages: stages as never })
const columnsOf = (feed: Parameters<typeof seasonColumns>[0]) =>
  seasonColumns(feed).map(({ key, week, games, from, to }) => [key, week, games.length, from, to])

test("a season has a column for every week of a stage and one for a knockout stage", () => {
  const feed = feedOf(
    ["s1", "s2", "s3", "s4", "s5"].map((series) => game(series)),
    seasonView(),
  )
  assert.deepEqual(columnsOf(feed), [
    ["RR.1", 1, 2, "2026-11-01", "2026-11-02"],
    ["RR.2", 2, 1, "2026-11-08", "2026-11-08"],
    ["KO", null, 2, "2026-11-15", "2026-11-22"],
  ])
})

test("a stage of a single week is one column of its own", () => {
  const feed = feedOf([game("s1"), game("s2"), game("s4")], seasonView())
  assert.deepEqual(columnsOf(feed), [
    ["RR", null, 2, "2026-11-01", "2026-11-02"],
    ["KO", null, 1, "2026-11-15", "2026-11-15"],
  ])
})

test("the weeks of a period keep their numbers", () => {
  const view = seasonView(season, [
    stage("RR", {
      format: "ROUND_ROBIN",
      patches: [{ label: "Tuần 1" }, { label: "Tuần 2–3" }],
    }),
    stage("KO"),
  ])
  const more = season.concat({ key: "m6", seriesId: "s6", a: "x", b: "y", scheduledAt: on(12) })
  view.content.plan.matches = seasonView(more).content.plan.matches
  const feed = feedOf([game("s1"), game("s3"), game("s6")], view)
  assert.deepEqual(columnsOf(feedScope(feed, "RR.2").feed), [
    ["RR.2", 2, 1, "2026-11-08", "2026-11-08"],
    ["RR.3", 3, 1, "2026-11-12", "2026-11-12"],
  ])
})

/** Groups A and B on the same days of two weeks. */
const groups: TestMatch[] = [
  { key: "m1", seriesId: "s1", a: "x", b: "y", scheduledAt: on(1), stageCode: "A" },
  { key: "m2", seriesId: "s2", a: "u", b: "v", scheduledAt: on(2), stageCode: "B" },
  { key: "m3", seriesId: "s3", a: "x", b: "y", scheduledAt: on(8), stageCode: "A" },
  { key: "m4", seriesId: "s4", a: "u", b: "v", scheduledAt: on(9), stageCode: "B" },
]

test("groups that play side by side share their weeks", () => {
  const feed = feedOf(
    ["s1", "s2", "s3", "s4"].map((series) => game(series)),
    seasonView(groups, [robin("A"), robin("B")]),
  )
  assert.deepEqual(columnsOf(feed), [
    ["A+B.1", 1, 2, "2026-11-01", "2026-11-02"],
    ["A+B.2", 2, 2, "2026-11-08", "2026-11-09"],
  ])
})

test("a game of no known match stands in no column", () => {
  assert.deepEqual(columnsOf(feedOf([game("elsewhere")], seasonView())), [])
})

const found = (feed: ReturnType<typeof feedOf>, column: ReturnType<typeof seasonColumns>[number]) => {
  const { from, to, scope } = columnQuestion(feed, column)
  return findGames(feedScope(feed, scope).feed.games, { ...NOTHING_ASKED, from, to }).map((item) => item.game.id)
}

test("a question finds the games of a column and no others", () => {
  const matches = season.concat(
    // A showmatch on a day of the first week.
    { key: "m6", seriesId: "s6", a: "x", b: "y", scheduledAt: on(1), stageCode: "SHOW" },
  )
  const feed = feedOf(
    ["s1", "s2", "s3", "s4", "s6"].map((series) => game(series)),
    seasonView(matches, [robin("RR"), stage("KO"), stage("SHOW")]),
  )
  for (const column of seasonColumns(feed))
    assert.deepEqual(
      found(feed, column),
      column.games.map(({ id }) => id),
    )
})

test("a stage some of whose games name no day is found by its stage", () => {
  const matches = season.map((match) => (match.key === "m5" ? { ...match, scheduledAt: undefined } : match))
  const feed = feedOf([game("s1"), game("s4"), game("s5")], seasonView(matches))
  const column = seasonColumns(feed).at(-1)!
  assert.deepEqual(columnQuestion(feed, column), { from: null, to: null, scope: "KO" })
  assert.equal(found(feed, column).length, 2)
})

test("a hero has a record in every column", () => {
  const feed = feedOf([game("s1"), game("s3", { winner: "RED" }), game("s4")], seasonView())
  const record = heroRecords(feed).get("star")!
  assert.deepEqual(
    heroColumns(seasonColumns(feed), record).map(({ fate: { games, wins, losses, bans } }) => [
      games,
      wins,
      losses,
      bans,
    ]),
    [
      [1, 1, 0, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 0],
    ],
  )
})

test("a column knows how many of its games show their bans", () => {
  const silent = game("s3", { blue: { team: "x", picks: five("a") }, red: { team: "y", picks: five("b") } })
  const feed = feedOf([game("s1"), game("s3"), silent], seasonView())
  assert.deepEqual(
    heroColumns(seasonColumns(feed), heroRecords(feed).get("star")!).map(({ fate: { games, shown } }) => [
      games,
      shown,
    ]),
    [
      [1, 1],
      [2, 1],
    ],
  )
})

/** A hero in a week of 24 games: picked in nine of them, and banned in some of those that show their bans. */
const week = (shown: number, bans: number, seen: number): HeroFate => ({ ...fate(24, bans, 5, 4), shown, seen })

test("a column says how often the hero was seen, won, lost and banned", () => {
  assert.equal(columnWords(week(24, 9, 18), vi), "có mặt 18 trong 24 ván; thắng 5, thua 4, bị cấm 9")
  assert.equal(columnWords(week(24, 9, 18), en), "part of 18 of 24 games; won 5, lost 4, banned 9")
})

test("a column says which of its games tell how often the hero was seen", () => {
  assert.equal(columnWords(week(12, 6, 11), vi), "có mặt 11 trong 12 ván có ghi lượt cấm; thắng 5, thua 4, bị cấm 6")
  assert.equal(columnWords(week(0, 0, 0), vi), "được chọn 9 trong 24 ván; thắng 5, thua 4")
})

test("the figure over a column is a share of the games that show their bans, from ten of them on", () => {
  assert.deepEqual(
    [week(24, 9, 18), week(12, 6, 11), week(9, 3, 8), week(0, 0, 0)].map((item) => columnFigure(item, "vi-VN")),
    ["75%", "92%", "12", "9"],
  )
})

test("a season is drawn from three columns on, once the hero was seen often enough", () => {
  const drawn = (series: string[], times: number) => {
    const feed = feedOf(
      series.flatMap((name) => Array.from({ length: times }, () => game(name))),
      seasonView(),
    )
    return tellsSeason(heroColumns(seasonColumns(feed), heroRecords(feed).get("star")!))
  }
  assert.equal(drawn(["s1", "s3", "s4"], 4), true)
  assert.equal(drawn(["s1", "s4"], 6), false)
  assert.equal(drawn(["s1", "s3", "s4"], 3), false)
})

/* ---------- Turns ---------- */

const ORDER = ["BB", "RB", "BB", "RB", "BP", "RP", "RP", "BP", "BP", "RP", "RP", "BP", "BP", "RP"]
const drafted = (extra: Partial<TestGame> = {}) =>
  game("s1", {
    blue: { team: "x", picks: ["star", ...five("a").slice(1)], bans: ["feared", "k1"] },
    red: { team: "y", picks: five("b"), bans: ["hated", "k2"] },
    draft: ORDER,
    ...extra,
  })

test("a turn counts the games its question finds", () => {
  const feed = feedOf([drafted(), drafted(), game("s1")])
  for (const key of ["star", "feared", "b2"]) {
    const staff = heroStaff(feed.games, draftShape(feed.games)!, heroByKey(feed, key)!)
    assert.equal(staff.length, ORDER.length)
    for (const { games, question } of staff)
      assert.equal(findGames(feed.games, { ...NOTHING_ASKED, ...question }).length, games)
    assert.deepEqual(
      staff.filter(({ games }) => games > 0).map(({ games }) => games),
      [2],
    )
  }
})

test("a draft with a missed ban counts at the turns it does have", () => {
  const short = drafted({
    red: { team: "y", picks: five("b"), bans: ["hated"] },
    draft: ORDER.map((turn, index) => (index === 3 ? "--" : turn)),
  })
  const feed = feedOf([drafted(), short])
  const shape = draftShape(feed.games)!
  assert.equal(shape.games.length, 1)
  const [taken] = heroStaff(feed.games, shape, heroByKey(feed, "star")!).filter(({ games }) => games > 0)
  assert.deepEqual([taken!.turn.turn, taken!.turn.side, taken!.games], [5, "BLUE", 2])
})

test("a draft in which the other side took the turn counts nowhere", () => {
  const turned = drafted({ draft: ORDER.map((turn) => (turn[0] === "B" ? "R" : "B") + turn[1]!) })
  const feed = feedOf([drafted(), drafted(), turned])
  const staff = heroStaff(feed.games, draftShape(feed.games)!, heroByKey(feed, "star")!)
  assert.equal(
    staff.reduce((sum, { games }) => sum + games, 0),
    2,
  )
})

test("a hero needs ten games with an order for a chart of its turns", () => {
  const drawn = (times: number) => {
    const feed = feedOf(Array.from({ length: times }, () => drafted()))
    return tellsDraft(heroStaff(feed.games, draftShape(feed.games)!, heroByKey(feed, "star")!))
  }
  assert.equal(drawn(10), true)
  assert.equal(drawn(9), false)
})

test("the games with an order are those that record a turn", () => {
  assert.equal(orderedGames(feedOf([drafted(), game("s1"), game("s1")]).games), 1)
})

/* ---------- Builds ---------- */

const builds: HeroBuilds = {
  spells: [{ name: "Tốc biến" }, { name: "Trừng trị" }],
  enchantments: [{ name: "Thánh thuẫn", tier: 3 }],
  items: [
    { name: "Thập tự kiếm", tier: 3 },
    { name: "Sách phép", tier: 1 },
    { name: "Giày hộ vệ", tier: 2 },
    { name: "Món lạ" },
  ],
  builds: [
    { gameId: "g1", spell: 0, enchantment: 0, items: [0, 1, 2, 2] },
    { gameId: "g2", spell: 0, items: [0, 3], situational: [1] },
    { gameId: "g3", spell: 1, enchantment: 0, items: [] },
    { gameId: "g4", spell: 1, items: [0] },
  ],
}
const named = ({ of, parts }: ReturnType<typeof buildCounts>["items"]) => [
  of,
  parts.map(({ part, games }) => [part.name, games]),
]

test("items are counted by how many builds hold them, those of the first tier left out", () => {
  const { games, items } = buildCounts(builds, ["g1", "g2", "g3"])
  assert.equal(games, 3)
  assert.deepEqual(named(items), [
    2,
    [
      ["Thập tự kiếm", 2],
      ["Giày hộ vệ", 1],
      ["Món lạ", 1],
    ],
  ])
})

test("only the builds of the games counted are", () => {
  assert.deepEqual(named(buildCounts(builds, ["g4"]).spells), [1, [["Trừng trị", 1]]])
  assert.equal(buildCounts(builds, []).games, 0)
})

test("a game two builds show is one game", () => {
  const both = { ...builds, builds: [...builds.builds, { gameId: "g1", spell: 1, items: [0] }] }
  assert.equal(buildCounts(both, ["g1", "g2"]).games, 2)
})

test("spells and enchantments are counted among the builds that show one", () => {
  const { spells, enchantments } = buildCounts(builds, ["g1", "g2", "g3", "g4"])
  assert.deepEqual(named(spells), [
    4,
    [
      ["Tốc biến", 2],
      ["Trừng trị", 2],
    ],
  ])
  assert.deepEqual(named(enchantments), [2, [["Thánh thuẫn", 2]]])
})

test("items bought for a moment of the game are counted apart, whatever their tier", () => {
  assert.deepEqual(named(buildCounts(builds, ["g1", "g2"]).situational), [1, [["Sách phép", 1]]])
})

test("a hero's mates are the rows the wings are drawn from", () => {
  const record = heroRecords(feedOf([game("s1"), game("s1", { winner: "RED" })])).get("star")!
  const [first] = mateRows(heroMates(record, "against"), "games", 5).ranked
  assert.deepEqual([first!.hero.key, first!.wins, first!.losses], ["b1", 1, 1])
})
