import assert from "node:assert/strict"
import { test } from "node:test"
import {
  countsAt,
  draftAt,
  placeAt,
  scoreAfter,
  scoreAt,
  told,
  toStory,
  toVideo,
  usedBefore,
} from "../src/lib/watch-place.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { Story } from "../src/lib/watch-types.ts"
import { BRU_EA, FPL_1S, HKA_LIT, matchOf, SGP_BME, UNTIMED, watchGames, type TestGame } from "./fixtures/watch.ts"

const of = (games: TestGame[], bestOf = 7, series: object = {}) => storyOf(watchGames(games, bestOf, series))
const sgp = of(SGP_BME)
const bru = of(BRU_EA)
const fpl = of(FPL_1S, 5)
const hka = of(HKA_LIT, 5)

const at = (story: Story, second: number) => placeAt(story, story.videos[0]!, second)
const score = (story: Story, second: number) => {
  const { A, B } = scoreAt(matchOf(story), at(story, second))
  return `${A}–${B}`
}
/** The state, the game, the game clock, the seconds left, and the game that comes next. */
const read = (story: Story, second: number) => {
  const { state, chapter, clock, left, next } = at(story, second)
  return [state, chapter?.number ?? null, clock, left, next?.number ?? null]
}

test("before the first draft it counts to the draft", () => {
  assert.deepEqual(read(sgp, 300), ["BEFORE", null, null, 367, 1])
  assert.deepEqual(read(hka, 100), ["BEFORE", null, null, 2676, 1])
})

test("a draft counts to 0:00", () => {
  assert.deepEqual(read(sgp, 685), ["DRAFT", 1, null, 861, 2])
  assert.deepEqual(read(sgp, 5600), ["DRAFT", 3, null, 275, 4])
  assert.deepEqual(read(sgp, 11430), ["DRAFT", 6, null, 187, null])
})

test("a draft lasts until the lock", () => {
  assert.equal(at(sgp, 974.9).state, "DRAFT")
  assert.equal(at(sgp, 975).state, "WAIT")
})

test("a draft that was never locked lasts until 0:00", () => {
  const [game] = watchGames([SGP_BME[2]!], 7)
  game!.content.draft!.lockedSecond = null
  const story = storyOf([game!])
  assert.equal(at(story, 5874.9).state, "DRAFT")
  assert.equal(at(story, 5875).state, "PLAY")
})

test("between the lock and 0:00 it waits", () => {
  assert.deepEqual(read(sgp, 980), ["WAIT", 1, null, 566, 2])
  assert.deepEqual(read(sgp, 1200), ["WAIT", 1, null, 346, 2])
})

test("a game that plays has its clock", () => {
  assert.deepEqual(read(sgp, 1546), ["PLAY", 1, 0, null, 2])
  assert.deepEqual(read(sgp, 4158), ["PLAY", 2, 440, null, 3])
  assert.deepEqual(read(sgp, 6208), ["PLAY", 3, 333, null, 4])
  assert.deepEqual(read(sgp, 9930), ["PLAY", 5, 655, null, 6])
})

test("the clock is held at the length of the game", () => {
  assert.deepEqual(read(sgp, 12234), ["PLAY", 6, 617, null, null])
  assert.deepEqual(read(sgp, 12236), ["PLAY", 6, 617, null, null])
})

test("a pause holds the clock and counts to its end", () => {
  assert.deepEqual(read(bru, 41780), ["PAUSE", 5, 721, 178, null])
  assert.deepEqual(read(bru, 41957), ["PAUSE", 5, 721, 1, null])
})

test("a game plays on at the very second its pause ends", () => {
  assert.equal(at(bru, 41778).state, "PLAY")
  assert.deepEqual(read(bru, 41958), ["PLAY", 5, 721, null, null])
  assert.deepEqual(read(bru, 41959), ["PLAY", 5, 722, null, null])
})

test("a break counts to the next draft", () => {
  assert.deepEqual(read(sgp, 2500), ["BREAK", 1, 883, 654, 2])
  assert.deepEqual(read(sgp, 4900), ["BREAK", 2, 802, 463, 3])
})

test("after the last game the match is over", () => {
  assert.deepEqual(read(sgp, 12237), ["AFTER", 6, 617, null, null])
  assert.deepEqual(read(sgp, 13400), ["AFTER", 6, 617, null, null])
})

test("a stretch with an untimed game counts to the game after it", () => {
  assert.deepEqual(read(fpl, 1200), ["SPAN", 1, null, 1178, 2])
  assert.deepEqual(read(fpl, 2378), ["DRAFT", 2, null, 614, 3])
  assert.deepEqual(read(bru, 42800), ["SPAN", 6, null, null, null])
  assert.deepEqual(read(bru, 60000), ["SPAN", 6, null, null, null])
})

test("a linked game lasts until the next begins", () => {
  assert.deepEqual(read(hka, 4100), ["GAME", 1, null, 1769, 2])
  assert.deepEqual(read(hka, 5868), ["GAME", 1, null, 1, 2])
  assert.deepEqual(read(hka, 5869), ["GAME", 2, null, 2679, 3])
})

test("a linked game is over a minute after its length", () => {
  assert.equal(at(hka, 4148).over, false)
  assert.equal(at(hka, 4149).over, true)
})

test("the last linked game ends four minutes after its length", () => {
  assert.deepEqual(read(hka, 13452), ["GAME", 5, null, null, null])
  assert.deepEqual(read(hka, 13453), ["AFTER", 5, null, null, null])
})

test("a match with an untimed game left is in a break, not over", () => {
  assert.equal(at(bru, 42730).state, "PLAY")
  assert.deepEqual(read(bru, 42731), ["BREAK", 5, 1491, null, null])
})

test("a video without a clock or link seconds has no places", () => {
  assert.deepEqual(read(of(UNTIMED, 5), 3000), ["UNKNOWN", null, null, null, null])
})

test("a video that shows no game of the match has no places", () => {
  assert.equal(placeAt(sgp, "another", 3000).state, "UNKNOWN")
  assert.equal(placeAt(sgp, null, 0).state, "UNKNOWN")
})

test("a break before a game of another video counts to nothing", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  assert.deepEqual(read(story, 2500), ["BREAK", 1, 883, null, 2])
})

test("another video begins before its own first game", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  const { state, next } = placeAt(story, "IHQBJayxnLM", 3000)
  assert.deepEqual([state, next!.number], ["BEFORE", 2])
})

test("an untimed game stands only in its own video", () => {
  const story = of([FPL_1S[0]!, FPL_1S[1]!, { ...FPL_1S[2]!, link: "https://youtu.be/IHQBJayxnLM" }], 5)
  assert.equal(at(story, 100).state, "SPAN")
  assert.equal(placeAt(story, "IHQBJayxnLM", 100).state, "BEFORE")
})

test("the score tells a game three seconds after its end", () => {
  assert.equal(score(sgp, 2431), "0–0")
  assert.equal(score(sgp, 2432), "1–0")
  assert.equal(score(sgp, 4525), "1–1")
  assert.equal(score(sgp, 9930), "3–1")
  assert.equal(score(sgp, 12234), "3–2")
  assert.equal(score(sgp, 12237), "4–2")
})

test("the score counts an untimed game once the next one is on", () => {
  assert.equal(score(fpl, 1200), "0–0")
  assert.equal(score(fpl, 2378), "1–0")
})

test("the score counts a linked game once the next one is on", () => {
  assert.equal(score(hka, 5868), "0–0")
  assert.equal(score(hka, 5869), "0–1")
})

test("the score counts the last linked game once it is over", () => {
  assert.equal(score(hka, 13453), "2–3")
})

test("before a game of another video the games before it count", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  assert.deepEqual(scoreAt(matchOf(story), placeAt(story, "IHQBJayxnLM", 3000)), { A: 1, B: 0 })
})

test("without a place no game has been won", () => {
  assert.deepEqual(scoreAt(matchOf(sgp), null), { A: 0, B: 0 })
})

test("what was won before the first published game counts from the beginning", () => {
  const story = of(SGP_BME.slice(1))
  const match = matchOf(story, { before: { A: 1, B: 0 } })
  const told = (second: number) => {
    const { A, B } = scoreAt(match, at(story, second))
    return `${A}–${B}`
  }
  assert.deepEqual([300, 4000, 4525, 12237].map(told), ["1–0", "1–0", "1–1", "4–2"])
})

test("the score after so many games counts those that are published", () => {
  const match = matchOf(of(SGP_BME.slice(1)), { before: { A: 1, B: 0 } })
  assert.deepEqual(scoreAfter(match, 0), { A: 1, B: 0 })
  assert.deepEqual(scoreAfter(match, 2), { A: 2, B: 1 })
})

test("the score that a match begins with is not changed by counting on from it", () => {
  const match = matchOf(sgp)
  scoreAfter(match, 6)
  assert.deepEqual(match.before, { A: 0, B: 0 })
})

test("a second of the video has its second of the story", () => {
  const story = (second: number) => toStory(sgp, "j8AvYygkzm4", second)
  assert.equal(story(300).at, 0)
  assert.equal(story(300).chapter, null)
  assert.equal(story(6208).at, 3259)
  assert.equal(story(6208).inside, true)
  assert.equal(story(4900).at, 2409)
  assert.equal(story(4900).inside, false)
  assert.equal(story(4900).chapter!.number, 2)
  assert.equal(story(13000).at, 7407)
})

test("a second of the story has its second of the video", () => {
  const video = (second: number) => toVideo(sgp, second)!
  assert.equal(video(0).second, 662)
  assert.equal(video(328).second, 1541)
  assert.equal(video(3259).second, 6208)
  assert.equal(video(3259).part.kind, "PLAY")
  assert.equal(video(9999).second, 12249)
  assert.equal(toVideo(of(UNTIMED, 5), 0), null)
})

test("the story goes on from one video to the next", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  assert.equal(toStory(story, "IHQBJayxnLM", 10).at, 1231)
  assert.equal(toStory(story, "IHQBJayxnLM", 3149).at, 1231)
  assert.equal(toStory(story, "j8AvYygkzm4", 9999).at, 1231)
  assert.equal(toVideo(story, 1231)!.video, "IHQBJayxnLM")
})

test("a draft shows what has been made", () => {
  const made = (second: number, index: number) =>
    draftAt(sgp.chapters[index]!, second).filter((turn) => turn.made).length
  assert.equal(made(660, 0), 0)
  assert.equal(made(685, 0), 1)
  assert.equal(made(3290, 1), 7)
  assert.equal(made(5600, 2), 12)
  assert.equal(made(975, 0), 18)
})

test("two turns of one team are open together", () => {
  const open = (second: number, index: number) =>
    draftAt(sgp.chapters[index]!, second)
      .filter((turn) => turn.open)
      .map(({ order, kind, team }) => `${order} ${kind} ${team}`)
  assert.deepEqual(open(3290, 1), ["8 PICK A", "9 PICK A"])
  assert.deepEqual(open(5600, 2), ["13 BAN A"])
  assert.deepEqual(open(975, 0), [])
})

test("a ban and a pick of one team are not open together", () => {
  const [chapter] = of([{ ...SGP_BME[0]!, turns: "BB685 BR700 PR720 PR720" }]).chapters
  const open = draftAt(chapter!, 690).filter((turn) => turn.open)
  assert.deepEqual(
    open.map(({ order, kind }) => `${order} ${kind}`),
    ["2 BAN"],
  )
})

test("a turn without a second comes with the next", () => {
  const turns = SGP_BME[1]!.turns!.replace("PB3309 PB3309", "PB PB")
  const [chapter] = of([{ ...SGP_BME[1]!, turns }]).chapters
  const made = (second: number) => draftAt(chapter!, second).filter((turn) => turn.made).length
  assert.equal(made(3322), 7)
  assert.equal(made(3323), 10)
})

test("counts hold what each team has taken up to a second", () => {
  const counts = (game: number, clock: number) => {
    const { A, B } = countsAt(sgp.chapters[game - 1]!, clock)
    return [A, B].map((team) => [team.TURRET, team.ABYSSAL_DRAGON, team.DARK_SLAYER].join(" ")).join(" | ")
  }
  assert.equal(counts(2, 510), "1 2 0 | 3 1 3")
  assert.equal(counts(3, 333), "1 2 0 | 0 0 1")
  assert.equal(counts(1, 503), "3 1 2 | 3 1 1")
  assert.deepEqual(countsAt(sgp.chapters[1]!, 510).kinds, ["TURRET", "ABYSSAL_DRAGON", "DARK_SLAYER"])
})

test("counts stop at the last record", () => {
  const fifth = sgp.chapters[4]!
  assert.deepEqual(countsAt(fifth, 875).A, { TURRET: 6, ABYSSAL_DRAGON: 1, DARK_SLAYER: 3 })
  assert.deepEqual(countsAt(fifth, 875).B, { TURRET: 2, ABYSSAL_DRAGON: 3, DARK_SLAYER: 0 })
  assert.equal(countsAt(fifth, 875).upTo, 753)
  assert.equal(countsAt(fifth, 843).upTo, null)
  assert.equal(countsAt(sgp.chapters[1]!, 802).upTo, null)
})

test("a game that is recorded to its end is never counted behind", () => {
  assert.equal(countsAt(sgp.chapters[1]!, 900).upTo, null)
})

test("a game without moments has nothing to count", () => {
  const [chapter] = of([{ ...SGP_BME[0]!, moments: "" }]).chapters
  assert.deepEqual(countsAt(chapter!, 500), { kinds: [], A: {}, B: {}, upTo: null })
})

test("used heroes are those of the earlier games, a team each", () => {
  assert.equal(usedBefore(sgp, sgp.chapters[0]!).A.length, 0)
  assert.equal(usedBefore(sgp, sgp.chapters[2]!).A.length, 10)
  assert.equal(usedBefore(sgp, sgp.chapters[5]!).B.length, 25)
  // Team A played red in game 1.
  const [first] = usedBefore(sgp, sgp.chapters[1]!).A
  assert.equal(first!.hero.id, "g1t6")
  assert.equal(first!.game.content.number, 1)
})

const NOBODY = { A: [], B: [] }

test("used heroes stop at the last possible game", () => {
  const seven = of([...SGP_BME, { ...SGP_BME[5]!, number: 7, zero: 14000, draft: [13500, 13900] }])
  assert.deepEqual(usedBefore(seven, seven.chapters[6]!), NOBODY)
})

test("used heroes are told where nobody knows which game would be the last", () => {
  const open = of(SGP_BME, 0)
  assert.equal(usedBefore(open, open.chapters[2]!).A.length, 10)
})

test("no hero is used where repeats are allowed", () => {
  const free = of(SGP_BME, 7, { repeatPicksAllowed: true })
  assert.deepEqual(usedBefore(free, free.chapters[3]!), NOBODY)
})

test("a seat whose hero nobody recorded is no used hero", () => {
  const games = watchGames(SGP_BME, 7)
  games[0]!.content.sides[0]!.participants[0]!.hero = { id: null }
  const story = storyOf(games)
  assert.equal(usedBefore(story, story.chapters[1]!).B.length, 4)
})

test("after a game that is not published no used heroes are told", () => {
  const late = of(SGP_BME.slice(1))
  assert.deepEqual(usedBefore(late, late.chapters[2]!), NOBODY)
})

test("the used heroes of the games before one that is not published are still told", () => {
  const hole = of([SGP_BME[0]!, SGP_BME[1]!, SGP_BME[3]!])
  assert.equal(usedBefore(hole, hole.chapters[1]!).A.length, 5)
  assert.deepEqual(usedBefore(hole, hole.chapters[2]!), NOBODY)
})

test("a result is told only when its end was reached", () => {
  const ends = [1219, 2397, 3525, 4671, 6380, 7395]
  sgp.chapters.forEach((chapter, index) => {
    assert.equal(told(sgp, chapter, ends[index]! - 1, false), false)
    assert.equal(told(sgp, chapter, ends[index]!, false), true)
  })
})

test("every result is told once the end of the match was seen", () => {
  for (const chapter of sgp.chapters) assert.equal(told(sgp, chapter, 0, true), true)
})

test("the result of a linked game is told once the next is on", () => {
  assert.equal(told(hka, hka.chapters[0]!, 1373, false), false)
  assert.equal(told(hka, hka.chapters[0]!, 1374, false), true)
})

test("the result of an untimed game is told once the next is on", () => {
  assert.equal(told(fpl, fpl.chapters[0]!, 0, false), false)
  assert.equal(told(fpl, fpl.chapters[0]!, 1, false), true)
})

test("the result of a last game without a clock is told by the end of the match alone", () => {
  assert.equal(told(hka, hka.chapters[4]!, 5194, false), false)
  assert.equal(told(bru, bru.chapters[5]!, 9999, false), false)
})
