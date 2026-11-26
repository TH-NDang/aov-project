import assert from "node:assert/strict"
import { test } from "node:test"
import type { TimelineEvent } from "@aov/community-contracts"
import { gameAlone, gameWatch, storyOf, timedGame } from "../src/lib/watch-story.ts"
import type { Chapter, Story } from "../src/lib/watch-types.ts"
import {
  BRU_EA,
  FPL_1S,
  HKA_LIT,
  SGP_BME,
  UNTIMED,
  UNTIMED_MIDDLE,
  watchGames,
  type TestGame,
} from "./fixtures/watch.ts"

const of = (games: TestGame[], bestOf = 7) => storyOf(watchGames(games, bestOf))
const one = (game: Partial<TestGame>) => of([{ ...SGP_BME[2]!, number: 1, ...game }]).chapters[0]!
const parts = (chapter: Chapter) => chapter.parts.map(({ from, to }) => `${from}–${to}`).join(", ")
const timings = ({ chapters }: Story) => chapters.map(({ timing }) => timing).join(" ")
const withEvents = (events: Omit<TimelineEvent, "id">[], game: Partial<TestGame> = {}) => {
  const [published] = watchGames([{ ...SGP_BME[2]!, number: 1, ...game }], 7)
  published!.content.timeline!.events = events.map((event, index) => ({ ...event, id: `e${index}` }))
  return storyOf([published!]).chapters[0]!
}

test("the story of a match has no breaks", () => {
  const story = of(SGP_BME)
  assert.equal(story.level, "TIMED")
  assert.equal(story.seconds, 7407)
  assert.deepEqual(story.videos, ["j8AvYygkzm4"])
  assert.deepEqual(story.chapters.map(parts), [
    "662–990, 1541–2444",
    "3149–3505, 3713–4535",
    "5358–5875, 5875–6486",
    "7035–7490, 7490–8181",
    "8777–9275, 9275–10486",
    "11234–11617, 11617–12249",
  ])
  assert.deepEqual(
    story.chapters.map(({ parts: [first] }) => first!.at),
    [0, 1231, 2409, 3537, 4683, 6392],
  )
})

test("a game ends at its length", () => {
  assert.deepEqual(
    of(SGP_BME).chapters.map(({ end }) => end),
    [2429, 4520, 6471, 8166, 10471, 12234],
  )
})

test("a game is won by the team of the side that won it", () => {
  const winners = of(SGP_BME).chapters.map(({ winner }) => winner)
  assert.equal(winners.join(" "), "A B A A B A")
})

test("a game knows the side of the map each team plays", () => {
  assert.deepEqual(of(SGP_BME).chapters[0]!.sides, { A: "RED", B: "BLUE" })
})

test("the parts say what comes after them", () => {
  const after = (chapter: Chapter) => chapter.parts.map((part) => part.after)
  assert.deepEqual(after(of(SGP_BME).chapters[0]!), ["WAIT", "BREAK"])
  assert.deepEqual(after(of(SGP_BME).chapters[2]!), [null, "BREAK"])
  assert.deepEqual(after(of(BRU_EA).chapters[4]!), [null, "PAUSE", "BREAK"])
})

test("games are told in their order, whatever the order they come in", () => {
  const { chapters } = storyOf(watchGames(SGP_BME, 7).reverse())
  assert.deepEqual(
    chapters.map(({ number }) => number),
    [1, 2, 3, 4, 5, 6],
  )
})

test("a wait of two minutes is cut and one of 119 s is not", () => {
  assert.equal(parts(one({ draft: [5363, 5756] })), "5358–5875, 5875–6486")
  assert.equal(parts(one({ draft: [5363, 5755] })), "5358–5770, 5870–6486")
})

test("a pause of 20 s cuts a game and one of 19 s does not", () => {
  assert.equal(parts(one({ pauses: [[300, 19]] })), "5358–5875, 5875–6505")
  assert.equal(parts(one({ pauses: [[300, 20]] })), "5358–5875, 5875–6183, 6192–6506")
})

test("two pauses that hold the same second are one", () => {
  const twice: TestGame["pauses"] = [
    [300, 15],
    [300, 25],
  ]
  assert.equal(parts(one({ pauses: twice })), parts(one({ pauses: [[300, 40]] })))
})

test("a pause at the end of a game does not cut it", () => {
  assert.equal(parts(one({ pauses: [[596, 60]] })), "5358–5875, 5875–6486")
})

test("a draft that does not come before the game is not told", () => {
  for (const draft of [
    [5900, 5950],
    [5363, 5900],
    [5363, 5300],
  ] as [number, number][])
    assert.equal(parts(one({ draft })), "5870–6486")
})

test("a draft that starts after the game has begun is not told, locked or not", () => {
  const [game] = watchGames([SGP_BME[2]!], 7)
  Object.assign(game!.content.draft!, { startSecond: 5900, lockedSecond: null })
  assert.equal(parts(storyOf([game!]).chapters[0]!), "5870–6486")
})

test("a draft that is locked as the game begins is told", () => {
  assert.equal(parts(one({ draft: [5363, 5875] })), "5358–5875, 5875–6486")
})

test("nothing is told from before a video begins", () => {
  assert.equal(parts(one({ zero: 300, draft: [2, 240] })), "0–300, 300–911")
  assert.equal(parts(one({ zero: 3, draft: null })), "0–614")
})

test("a draft without a lock lasts until the game begins", () => {
  const [game] = watchGames([SGP_BME[2]!], 7)
  game!.content.draft!.lockedSecond = null
  const [chapter] = storyOf([game!]).chapters
  assert.equal(parts(chapter!), "5358–5875, 5875–6486")
  assert.equal(chapter!.lock, null)
})

test("a game whose length nobody recorded lasts a minute past its last moment", () => {
  const chapter = one({ seconds: null })
  assert.equal(chapter.length, 641)
  assert.equal(chapter.end, 6516)
})

test("a game of no known length that nothing is recorded of has no time", () => {
  assert.equal(one({ seconds: null, moments: "" }).timing, "NONE")
})

test("a game whose 0:00 is known but not its length is not placed by its link", () => {
  const link = "https://youtu.be/j8AvYygkzm4?t=5360"
  assert.equal(one({ seconds: null, moments: "", link }).timing, "NONE")
})

test("a game known by its link alone lasts its length and a minute", () => {
  const story = of(HKA_LIT, 5)
  assert.equal(story.level, "LINKED")
  assert.equal(story.seconds, 5194)
  assert.deepEqual(story.chapters.map(parts), ["2776–4149", "5869–7139", "8548–9406", "10563–11486", "12503–13273"])
})

test("a game known by its link alone whose length nobody recorded lasts 16 minutes", () => {
  assert.equal(parts(of([{ ...HKA_LIT[0]!, seconds: null }]).chapters[0]!), "2776–3736")
})

test("a link without a second gives the video alone", () => {
  const story = of(UNTIMED, 5)
  assert.equal(story.level, "PLAIN")
  assert.equal(story.seconds, 0)
  assert.equal(timings(story), "NONE NONE NONE NONE NONE")
  assert.ok(story.chapters.every(({ span }) => span === null))
})

test("a first game without a time stands before the next one", () => {
  const first = of(FPL_1S, 5).chapters[0]!
  assert.equal(first.timing, "NONE")
  assert.deepEqual(first.span, { from: 0, to: 2378 })
})

test("a last game without a time stands after the one before it", () => {
  assert.deepEqual(of(BRU_EA).chapters[5]!.span, { from: 42743, to: null })
})

test("a game without a time stands between its neighbours", () => {
  const story = of(UNTIMED_MIDDLE)
  assert.equal(timings(story), "CLOCK NONE CLOCK")
  assert.deepEqual(story.chapters[1]!.span, { from: 2444, to: 5358 })
})

test("a pause cuts the game it holds in two", () => {
  assert.equal(parts(of(BRU_EA).chapters[4]!), "40561–41057, 41057–41786, 41955–42743")
})

test("a game that begins before the last one ended cuts it", () => {
  const [first, second] = of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 2500, draft: [2400, 2450] }]).chapters
  assert.equal(parts(first!), "662–990, 1541–2395")
  assert.equal(first!.end, 2395)
  assert.equal(parts(second!), "2395–2500, 2500–3317")
})

test("what would come after the next game has begun is not told", () => {
  const paused = { ...SGP_BME[0]!, pauses: [[600, 300]] as [number, number][] }
  const [first, second] = of([paused, { ...SGP_BME[1]!, zero: 2300, draft: [2205, 2250] }]).chapters
  assert.equal(parts(first!), "662–990, 1541–2154")
  assert.equal(first!.parts.at(-1)!.after, "BREAK")
  assert.equal(second!.from, 2200)
})

test("a game out of order loses its times", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 500, draft: [300, 450] }])
  const lost = story.chapters[1]!
  assert.equal(lost.timing, "NONE")
  assert.deepEqual(lost.span, { from: 2444, to: null })
  assert.ok(lost.moments.every(({ second }) => second === null))
  assert.ok(lost.turns.every(({ second, own }) => second === null && !own))
  assert.equal(timings(of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 1400, draft: [1300, 1350] }])), "CLOCK NONE")
})

test("a game that begins at the very 0:00 of the one before it loses its times", () => {
  assert.equal(timings(of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 1900, draft: [1551, 1800] }])), "CLOCK NONE")
  assert.equal(timings(of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 1900, draft: [1552, 1800] }])), "CLOCK CLOCK")
})

test("games of several videos do not cut one another", () => {
  const other = {
    ...SGP_BME[1]!,
    zero: 500,
    draft: [300, 450] as [number, number],
    link: "https://youtu.be/IHQBJayxnLM",
  }
  const story = of([SGP_BME[0]!, other])
  assert.equal(timings(story), "CLOCK CLOCK")
  assert.deepEqual(story.videos, ["j8AvYygkzm4", "IHQBJayxnLM"])
})

test("the series' link stands in only when no game has a video", () => {
  const link = "https://www.youtube.com/watch?v=abcdefghijk"
  const without = SGP_BME.map((game) => ({ ...game, link: "https://liquipedia.net/x" }))
  const story = storyOf(watchGames(without, 7), link)
  assert.equal(story.level, "PLAIN")
  assert.deepEqual(story.videos, ["abcdefghijk"])
  assert.equal(timings(story), "NONE NONE NONE NONE NONE NONE")
  assert.equal(storyOf(watchGames(without, 7, { sourceUrl: link })).videos[0], "abcdefghijk")
  assert.deepEqual(storyOf(watchGames(SGP_BME, 7), link).videos, ["j8AvYygkzm4"])
  assert.equal(storyOf(watchGames(without, 7)).level, "NONE")
})

test("a game without a video of its own has none where another game has one", () => {
  const games = watchGames([SGP_BME[0]!, { ...SGP_BME[1]!, link: "" }], 7)
  assert.equal(storyOf(games, "https://youtu.be/abcdefghijk").chapters[1]!.video, null)
})

test("a match without games has the video of its own link", () => {
  assert.deepEqual(storyOf([], "https://youtu.be/j8AvYygkzm4"), {
    level: "PLAIN",
    chapters: [],
    seconds: 0,
    bestOf: 0,
    teams: null,
    videos: ["j8AvYygkzm4"],
  })
})

test("a match without games and without a link to a video has none", () => {
  assert.equal(storyOf([], "https://liquipedia.net/x").level, "NONE")
  assert.equal(storyOf([]).level, "NONE")
})

test("two marks of one second are one", () => {
  const { moments } = of(SGP_BME).chapters[0]!
  assert.equal(moments.length, 20)
  assert.deepEqual(
    moments
      .filter(({ count }) => count > 1)
      .map(({ at, second, team, kind, count }) => [at, second, team, kind, count]),
    [[503, 2049, "A", "DARK_SLAYER", 2]],
  )
  assert.equal(moments.filter(({ at }) => at === 279).length, 2)
})

const seat = (side: "BLUE" | "RED") => ({ side, lane: "MID" as const })
const read = (events: Omit<TimelineEvent, "id">[]) =>
  withEvents(events).moments.map(({ kind, side, team, title }) => [kind, side, team, title])

test("a kill belongs to the side of its killer", () => {
  const kill = { kind: "KILL", atSeconds: 40, killer: seat("RED"), victim: seat("BLUE") } as const
  assert.deepEqual(read([kill]), [["KILL", "RED", "A", null]])
})

test("two kills of one second are two", () => {
  const kill = { kind: "KILL", atSeconds: 40, killer: seat("RED"), victim: seat("BLUE") } as const
  assert.equal(read([kill, kill]).length, 2)
})

test("an objective that names no side belongs to the side of who took it", () => {
  assert.deepEqual(read([{ kind: "OBJECTIVE", atSeconds: 50, by: seat("BLUE") }]), [["OTHER", "BLUE", "B", null]])
})

test("a note belongs to nobody and has its words", () => {
  assert.deepEqual(read([{ kind: "NOTE", atSeconds: 60, title: "Sân đấu đổi" }]), [["NOTE", null, null, "Sân đấu đổi"]])
})

test("moments stand in the video behind the pauses before them", () => {
  const { moments } = withEvents(
    [
      { kind: "OBJECTIVE", atSeconds: 400, side: "RED", objective: "TURRET" },
      { kind: "OBJECTIVE", atSeconds: 200, side: "RED", objective: "TURRET" },
    ],
    { pauses: [[300, 60]] },
  )
  assert.deepEqual(
    moments.map(({ second }) => second),
    [6075, 6335],
  )
})

test("a turn without a second comes with the next one, and the last with the lock", () => {
  const blank = (places: number[]) =>
    SGP_BME[1]!
      .turns!.split(" ")
      .map((turn, index) => (places.includes(index + 1) ? turn.slice(0, 2) : turn))
      .join(" ")
  const { turns } = of([{ ...SGP_BME[1]!, turns: blank([8, 9, 18]) }]).chapters[0]!
  assert.deepEqual(
    [7, 8, 9, 10, 18].map((order) => [turns[order - 1]!.second, turns[order - 1]!.own]),
    [
      [3277, true],
      [3323, false],
      [3323, false],
      [3323, true],
      [3490, false],
    ],
  )
})

const lead = (game: Partial<TestGame>, series: object = {}) =>
  gameWatch(watchGames([{ ...SGP_BME[0]!, ...game }], 7, series)[0]!)

test("the page of a game with a time leads to the game", () => {
  assert.equal(lead({}), "GAME")
  assert.equal(lead({ zero: null, link: "https://youtu.be/j8AvYygkzm4?t=1540" }), "GAME")
})

test("the page of a game without a time leads to the video alone", () => {
  assert.equal(lead({ zero: null }), "VIDEO")
})

test("the page of a game without a video leads nowhere", () => {
  assert.equal(lead({ link: "" }), null)
})

test("the page of a game without a video leads to that of its series", () => {
  assert.equal(lead({ link: "" }, { sourceUrl: "https://youtu.be/j8AvYygkzm4" }), "VIDEO")
})

test("a game without a time leads to its stretch of the video once its match is known", () => {
  const games = watchGames(FPL_1S, 5)
  assert.equal(gameWatch(games[0]!), "VIDEO")
  assert.equal(gameWatch(games[0]!, games), "GAME")
})

test("a game without a time that shares its video leads to the video alone", () => {
  const games = watchGames(UNTIMED, 5)
  assert.equal(gameWatch(games[1]!, games), "VIDEO")
})

test("a game without a time whose video is its own leads to the game", () => {
  const games = watchGames(
    UNTIMED.map((game) => ({ ...game, link: `https://youtu.be/IHQBJayxnL${game.number}` })),
    5,
  )
  assert.equal(gameWatch(games[1]!, games), "GAME")
})

test("what a game's page shows can be watched where every second of the game is known", () => {
  const [known, linked] = [watchGames(SGP_BME, 7)[2]!, watchGames(HKA_LIT, 5)[2]!]
  assert.equal(timedGame(known)!.zero, 5875)
  assert.equal(timedGame(linked), null)
  assert.equal(timedGame(watchGames([{ ...SGP_BME[2]!, link: "" }], 7)[0]!), null)
})

const ownVideos = of(UNTIMED.map((game) => ({ ...game, link: `https://youtu.be/IHQBJayxnL${game.number}` }))).chapters

test("a video that shows one game of several is that game's own", () => {
  assert.equal(gameAlone(ownVideos, "IHQBJayxnL2")!.number, 2)
})

test("a video that shows several games is the own of none", () => {
  assert.equal(gameAlone(of(UNTIMED).chapters, "WgQTfXMV13A"), null)
})

test("a video that shows the only game that is recorded may show others", () => {
  assert.equal(gameAlone(of(UNTIMED.slice(0, 1)).chapters, "WgQTfXMV13A"), null)
})

test("a video that shows no game of the match is the own of none", () => {
  assert.equal(gameAlone(ownVideos, "abcdefghijk"), null)
  assert.equal(gameAlone(of([UNTIMED[0]!, { ...UNTIMED[1]!, link: "" }]).chapters, null), null)
})
