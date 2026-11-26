import assert from "node:assert/strict"
import { test } from "node:test"
import type { TimelineEvent } from "@aov/community-contracts"
import { cutsOf, leftOf, nextPiece, pushesOf, quickOf } from "../src/lib/watch-cuts.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { Cut, Story, TimedChapter } from "../src/lib/watch-types.ts"
import { clock } from "../src/lib/tournament-model.ts"
import { BRU_EA, FPL_1S, HKA_LIT, SGP_BME, UNTIMED, watchGames, type TestGame } from "./fixtures/watch.ts"

const of = (games: TestGame[], bestOf = 7) => storyOf(watchGames(games, bestOf))
const video = "j8AvYygkzm4"
const sgp = of(SGP_BME)
const cuts = cutsOf(sgp)
const bru = of(BRU_EA)
const pieces = (cut: Cut) => cut.pieces.map(({ from, to }) => `${from}–${to}`).join(", ")
const quick = (story: Story) =>
  quickOf(story.chapters[0] as TimedChapter)
    .map(([from, to]) => `${from}–${to}`)
    .join(", ")
const withEvents = (game: Partial<TestGame>, events: Omit<TimelineEvent, "id">[]) => {
  const [published] = watchGames([{ ...SGP_BME[2]!, number: 1, ...game }], 7)
  published!.content.timeline!.events = events.map((event, index) => ({ ...event, id: `e${index}` }))
  return storyOf([published!])
}
const kill = (atSeconds: number) => ({ kind: "KILL", atSeconds, killer: { side: "RED", lane: "MID" } }) as const

test("the match is its drafts and games without breaks", () => {
  assert.equal(
    pieces(cuts.whole),
    "662–990, 1541–2444, 3149–3505, 3713–4535, 5358–6486, 7035–8181, 8777–10486, 11234–12249",
  )
  assert.equal(cuts.whole.seconds, 7407)
  assert.equal(cuts.whole.offered, true)
})

test("the games alone begin 5 s before 0:00", () => {
  assert.equal(pieces(cuts.games), "1541–2444, 3713–4535, 5870–6486, 7485–8181, 9270–10486, 11612–12249")
  assert.equal(cuts.games.seconds, 4890)
})

test("the short cut is the locked line-ups, the pushes and the ends", () => {
  assert.equal(
    pieces(cuts.quick),
    [
      "967–979, 1795–1851, 2061–2099, 2350–2435",
      "3482–3494, 4122–4155, 4217–4250, 4474–4526",
      "5803–5815, 6225–6285, 6408–6477",
      "7392–7404, 7892–7982, 8108–8172",
      "9199–9211, 9791–9836, 9897–9942, 10425–10477",
      "11538–11550, 11882–11942, 11959–12004, 12188–12240",
    ].join(", "),
  )
  assert.equal(cuts.quick.pieces.length, 22)
  assert.equal(cuts.quick.seconds, 951)
  assert.equal(cuts.quick.offered, true)
})

test("the pieces of every length are in order and apart", () => {
  for (const story of [sgp, bru, of(FPL_1S, 5)])
    for (const cut of [cutsOf(story).quick, cutsOf(story).games, cutsOf(story).whole])
      cut.pieces.forEach((piece, index) => {
        assert.ok(piece.to > piece.from)
        const before = cut.pieces[index - 1]
        assert.ok(!before || piece.from > before.to, `${before?.to} and ${piece.from}`)
      })
})

const leads = (cut: Cut) => [...new Set(cut.pieces.map(({ lead }) => lead))]

test("a break and a wait are counted from 10", () => {
  assert.deepEqual(leads(cuts.whole), [10])
})

test("nothing is counted in the short cut", () => {
  assert.deepEqual(leads(cuts.quick), [0])
})

test("a pause is counted from 5, and what comes before an untimed game is held", () => {
  assert.deepEqual(
    cutsOf(bru).whole.pieces.map(({ from, to, lead, hold }) => `${from}–${to} ${lead}${hold ? " hold" : ""}`),
    [
      "31139–33009 10",
      "33575–35239 10",
      "36499–37765 10",
      "38300–38758 10",
      "38884–40038 10",
      "40561–41786 5",
      "41955–42743 10 hold",
    ],
  )
})

test("only the match is offered where a game is not timed", () => {
  const { whole, games, quick: short, missing } = cutsOf(bru)
  assert.equal(whole.seconds, 8425)
  assert.deepEqual(missing, [6])
  assert.deepEqual([whole.offered, games.offered, short.offered], [true, false, false])
})

test("quick is not offered where a game is not timed", () => {
  assert.equal(cutsOf(of(FPL_1S, 5)).quick.offered, false)
})

test("quick is offered where half of the games have something to show", () => {
  const bare = (game: TestGame) => ({ ...game, moments: "" })
  const [a, b, c, d] = SGP_BME as [TestGame, TestGame, TestGame, TestGame]
  assert.equal(cutsOf(of([a, b, bare(c), bare(d)])).quick.offered, true)
  assert.equal(cutsOf(of([a, bare(b), bare(c), bare(d)])).quick.offered, false)
  assert.equal(cutsOf(of(SGP_BME.map(bare))).quick.offered, false)
})

test("the games alone are offered only where a draft can be left out", () => {
  const draftless = SGP_BME.map((game) => ({ ...game, draft: null }))
  assert.equal(cutsOf(of(draftless)).games.offered, false)
  assert.equal(cutsOf(of([...draftless.slice(0, 5), SGP_BME[5]!])).games.offered, true)
})

test("a match without a clock has no lengths", () => {
  for (const story of [of(HKA_LIT, 5), of(UNTIMED, 5), storyOf([])]) {
    const { whole, games, quick: short } = cutsOf(story)
    assert.deepEqual([whole.offered, games.offered, short.offered], [false, false, false])
    assert.equal(whole.pieces.length, 0)
  }
})

test("towers of one side within 30 s are one push", () => {
  const pushes = pushesOf(sgp.chapters[0]!.moments).map(
    ({ side, from, to, count }) => `${side} ${clock(from)}–${clock(to)} ${count}`,
  )
  assert.deepEqual(
    pushes.filter((push) => push.endsWith("2")),
    ["BLUE 4:39–5:02 2", "RED 9:05–9:10 2", "RED 13:54–14:00 2"],
  )
  assert.equal(pushes.length, 10)
})

test("towers that fall together count to their push", () => {
  const [chapter] = of([{ ...SGP_BME[0]!, moments: "300Bt 310Bt 310Bt" }]).chapters
  assert.deepEqual(pushesOf(chapter!.moments), [{ side: "BLUE", from: 300, to: 310, count: 3 }])
})

test("recorded fights take the place of the pushes", () => {
  const towers = [100, 110, 200, 205].map(
    (atSeconds) => ({ kind: "OBJECTIVE", objective: "TURRET", side: "RED", atSeconds }) as const,
  )
  const fights = [kill(300), kill(310), kill(322), kill(400), kill(405)]
  // 5875 is 0:00, the game ends at 6471; the two kills at 400 are no fight.
  assert.equal(quick(withEvents({}, towers)), "5803–5815, 5945–5988, 6045–6083, 6425–6477")
  assert.equal(quick(withEvents({}, [...towers, ...fights])), "5803–5815, 6167–6202, 6425–6477")
})

test("what is taken from 14:00 on is shown, and what comes before it is not", () => {
  const taken = (atSeconds: number) =>
    ({ kind: "OBJECTIVE", objective: "DARK_SLAYER", side: "RED", atSeconds }) as const
  const long = { seconds: 1200, draft: null }
  assert.equal(quick(withEvents(long, [taken(839)])), "7000–7081")
  assert.equal(quick(withEvents(long, [taken(840)])), "6700–6730, 7029–7081")
})

test("a late tower alone is not shown", () => {
  const tower = { kind: "OBJECTIVE", objective: "TURRET", side: "RED", atSeconds: 900 } as const
  assert.equal(quick(withEvents({ seconds: 1200, draft: null }, [tower])), "7000–7081")
})

test("pieces at most 10 s apart are joined", () => {
  const note = (atSeconds: number) => ({ kind: "NOTE", atSeconds, title: "Quét sạch" }) as const
  const notes = (apart: number) => quick(withEvents({ draft: null }, [note(100), note(122 + apart)])).split(", ").length
  assert.deepEqual([notes(10), notes(10.5)], [2, 3])
})

test("a note is shown from 10 s before it to 12 s after", () => {
  const note = { kind: "NOTE", atSeconds: 300, title: "Quét sạch" } as const
  assert.equal(quick(withEvents({ draft: null }, [note])), "6165–6187, 6425–6477")
})

test("a game with nothing else shows more of its end", () => {
  assert.equal(quick(withEvents({ draft: null }, [])), "6396–6477")
})

test("single towers before 9:00 fill a game until two pieces stand before its end", () => {
  const single = (atSeconds: number, side: "BLUE" | "RED" = "RED") =>
    ({ kind: "OBJECTIVE", objective: "TURRET", side, atSeconds }) as const
  assert.equal(
    quick(withEvents({ draft: null }, [single(100), single(200), single(300)])),
    "6045–6078, 6145–6178, 6425–6477",
  )
  assert.equal(quick(withEvents({ draft: null, seconds: 900 }, [single(541)])), "6700–6781")
})

test("a single tower of the ninth minute still fills a game, and one at 9:00 does not", () => {
  const single = { kind: "OBJECTIVE", objective: "TURRET", side: "RED" } as const
  const pieces = (atSeconds: number) =>
    quick(withEvents({ draft: null, seconds: 900 }, [{ ...single, atSeconds }])).split(", ").length
  assert.deepEqual([pieces(539), pieces(540)], [2, 1])
})

test("a push within the end of a game does not stand before it", () => {
  const towers = [585, 590].map(
    (atSeconds) => ({ kind: "OBJECTIVE", objective: "TURRET", side: "RED", atSeconds }) as const,
  )
  assert.equal(quick(withEvents({ draft: null }, towers)), "6396–6477")
})

test("a long pause is cut out of a piece", () => {
  const paused = { draft: null, pauses: [[580, 25]] as [number, number][] }
  // The pause holds from 6455 to 6480, the game ends at 6496.
  assert.equal(quick(withEvents(paused, [])), "6421–6458, 6477–6502")
})

test("a short pause is left in a piece", () => {
  const paused = { draft: null, pauses: [[580, 19]] as [number, number][] }
  assert.equal(quick(withEvents(paused, [])), "6415–6496")
})

test("what a pause leaves of a piece is dropped where it is no more than 4 s", () => {
  // The end is shown from 6456 on and the pause holds from 6457 to 6517: four seconds are left before it.
  const paused = { draft: null, pauses: [[582, 60]] as [number, number][] }
  assert.equal(quick(withEvents(paused, [])), "6514–6537")
})

test("a piece is never longer than 90 s", () => {
  const kills = Array.from({ length: 13 }, (_, index) => kill(300 + index * 10))
  assert.equal(quick(withEvents({ draft: null }, kills)), "6210–6300, 6425–6477")
})

test("a piece is never shorter than 12 s", () => {
  assert.equal(quick(withEvents({ draft: [5363, 5873] }, [])).split(", ")[0], "5863–5875")
})

test("the short cut of a game never begins before its draft does", () => {
  assert.equal(quick(withEvents({ zero: 300, draft: [2, 5] }, [])).split(", ")[0], "0–9")
})

test("the short cut of a game ends where the next game begins", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, zero: 2500, draft: [2400, 2450] }])
  const own = cutsOf(story).quick.pieces.filter(({ chapter }) => chapter === 0)
  assert.equal(own.at(-1)!.to, 2395)
})

test("what is left of a length is counted from the place of the video", () => {
  const left = (second: number) =>
    [cuts.whole, cuts.games, cuts.quick].map((cut) => leftOf(cut, sgp, video, second)).join(" ")
  assert.equal(left(0), "7407 4890 951")
  assert.equal(left(4228), "5305 3472 704")
  assert.equal(left(6208), "4148 2827 618")
  assert.equal(left(13000), "0 0 0")
})

test("what is left counts the later games of another video whole", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  const { whole } = cutsOf(story)
  assert.equal(whole.seconds, 2409)
  assert.equal(leftOf(whole, story, video, 1541), 903 + 1178)
  assert.equal(leftOf(whole, story, "IHQBJayxnLM", 3713), 822)
})

test("the next piece is the first that begins after a place", () => {
  assert.equal(nextPiece(cuts.whole, sgp, video, 2444)!.from, 3149)
  assert.equal(nextPiece(cuts.quick, sgp, video, 4000)!.from, 4122)
  assert.equal(nextPiece(cuts.games, sgp, video, 5600)!.from, 5870)
  assert.equal(nextPiece(cuts.whole, sgp, video, 12000), null)
})

test("the next piece of another video comes by the order of the games", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  const next = nextPiece(cutsOf(story).whole, story, video, 2500)!
  assert.deepEqual([next.video, next.from], ["IHQBJayxnLM", 3149])
})

test("the next piece of another video may be at an earlier second of it", () => {
  const early: TestGame = { ...SGP_BME[1]!, zero: 500, draft: [300, 450], link: "https://youtu.be/IHQBJayxnLM" }
  const story = of([SGP_BME[0]!, early])
  const next = nextPiece(cutsOf(story).whole, story, video, 2500)!
  assert.deepEqual([next.video, next.from], ["IHQBJayxnLM", 295])
})

test("the next piece is not the one that begins at the place", () => {
  assert.equal(nextPiece(cuts.whole, sgp, video, 3149)!.from, 3713)
})
