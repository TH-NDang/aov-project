import assert from "node:assert/strict"
import { test } from "node:test"
import { SGP_BME, UNTIMED, watchMatch, type TestGame } from "./fixtures/watch.ts"
import { apart, bru, first, hka, middle, other, plain, sgp, stand, unknown, video } from "./fixtures/watch-stand.ts"

// ---------- opening a match

test("a press opens one player at the first second of the story", () => {
  const s = stand()
  s.watch.open(sgp, first(sgp, "whole"), "whole")
  assert.deepEqual(s.log, [`open ${video} 662`])
})

test("a match that is opened has its place before its player answers", () => {
  const s = stand()
  s.watch.open(sgp, first(sgp, "whole"), "whole")
  assert.equal(s.view().match, sgp)
  assert.equal(s.view().player, "OPENING")
  assert.equal(s.view().place!.state, "DRAFT")
})

test("a match of another video is loaded by the player that is there", () => {
  const s = stand()
  s.open(sgp, 700)
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.last(), `load ${hka.story.videos[0]} 2776`)
  assert.equal(s.player.made, 1)
  assert.equal(s.view().match!.seriesId, "hka")
})

test("the next match of the same video only seeks", () => {
  const s = stand()
  s.open(sgp, 700)
  s.watch.open(watchMatch(SGP_BME.slice(0, 2), 3, { seriesId: "twin" }), { video, second: 3149 }, "whole")
  assert.equal(s.last(), "seek 3149")
  assert.equal(s.view().match!.seriesId, "twin")
})

test("what was reached of one match is not known of another", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(4)
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.view().reached, 0)
})

test("opening the match that is open goes to the place", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.watch.open(sgp, { video, second: 9270 }, "whole")
  assert.equal(s.last(), "seek 9270")
})

test("opening the match that is open brings its room back", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.watch.shrink()
  s.watch.open(sgp, { video, second: 9270 }, "whole")
  assert.equal(s.view().shrunk, false)
})

test("opening the match that is open keeps what was reached of it", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(4)
  s.watch.open(sgp, { video, second: 9270 }, "whole")
  assert.equal(s.view().reached, 391)
})

test("opening the match that is open keeps that its end was told", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.go({ video, second: 6208 })
  s.pass(6)
  s.watch.open(sgp, { video, second: 662 }, "whole")
  assert.equal(s.view().done, true)
})

test("opening a match closes the panel that was open", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.watch.show("LENGTH")
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.view().panel, null)
})

test("a match asked for before there is an element opens with it", () => {
  const s = stand({ attached: false })
  s.watch.open(sgp, { video, second: 700 }, "whole")
  assert.deepEqual(s.log, [])
  s.watch.attach(s.host)
  assert.deepEqual(s.log, [`open ${video} 700`])
})

test("an element that comes again opens nothing anew", () => {
  const s = stand({ attached: false })
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.watch.attach(s.host)
  s.watch.attach(s.host)
  assert.deepEqual(s.log, [`open ${video} 700`])
})

test("a match that was closed before there is an element does not open with it", () => {
  const s = stand({ attached: false })
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.watch.close()
  s.watch.attach(s.host)
  assert.deepEqual(s.log, [])
})

// ---------- going to a place

test("another game of the same video seeks", () => {
  const s = stand()
  s.open(sgp, 700)
  s.watch.go({ video, second: 9270 })
  assert.equal(s.last(), "seek 9270")
  assert.equal(s.player.made, 1)
})

test("a seek shows its target until the video has come there", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.player.late = 6
  s.watch.go({ video, second: 9930 })
  s.pass(1)
  assert.equal(s.view().second, 9930)
  assert.equal(s.view().place!.chapter!.number, 5)
})

test("a video that has come where it was sent is followed from there", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.player.late = 6
  s.watch.go({ video, second: 9930 })
  s.pass(3)
  assert.equal(s.view().place!.chapter!.number, 5)
  assert.ok(s.view().second >= 9931)
})

test("a video that begins a few seconds before where it was sent has come there", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.go({ video, second: 9930 })
  s.read(9923)
  assert.equal(s.view().second, 9923)
})

test("a place well past where the video was sent is not where it was sent", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.go({ video, second: 9930 })
  s.read(9960)
  assert.equal(s.view().second, 9930)
})

test("what the player before it answered says nothing of a new one", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.close()
  s.open(sgp, 662)
  s.watch.go({ video, second: 2003 })
  s.read(2001.5)
  assert.equal(s.view().second, 2001)
})

test("seeks that come faster than the video add up", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.player.late = 6
  for (let press = 0; press < 3; press++) s.watch.seekBy(10)
  assert.equal(s.view().second, 2031)
})

test("a short seek is not undone by the time the player still answers from before it", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.toggle()
  s.player.late = 3
  s.watch.seekBy(-5)
  s.pass(0.5)
  assert.equal(s.view().second, 1996)
  s.pass(0.5)
  assert.equal(s.view().second, 1996)
})

test("short seeks one after another add up while the player still answers from before them", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  for (let press = 0; press < 4; press++) {
    s.player.late = 2
    s.watch.seekBy(5)
    s.pass(0.25)
  }
  assert.equal(s.view().second, 2021)
})

test("a seek by seconds is counted from where the video is, and not from the second that is shown", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(0.75)
  s.watch.seekBy(10)
  assert.equal(s.last(), "seek 2010.75")
})

test("a seek by seconds never goes to before the video", () => {
  const s = stand()
  s.open(plain, 4)
  s.watch.seekBy(-10)
  assert.equal(s.last(), "seek 0")
})

test("a seek by the keys leaves a paused video paused", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.toggle()
  s.watch.seekBy(-5)
  assert.equal(s.last(), "seek 1996")
  assert.equal(s.player.playing, false)
})

test("a press on a place plays a paused video", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.toggle()
  s.watch.go({ video, second: 4228 })
  assert.equal(s.player.playing, true)
})

test("an advertisement that runs from its own 0 does not move the place", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.player.second = 0
  s.pass(20)
  assert.equal(s.view().second, 2000)
  s.player.second = 2000
  s.pass(1)
  assert.equal(s.view().second, 2001)
})

test("near the beginning of a video nothing is taken for an advertisement", () => {
  const s = stand()
  s.open(plain, 60)
  s.player.second = 5
  s.pass(3)
  assert.equal(s.view().second, 8)
})

test("a hand on YouTube's bar right after a press is followed after 2 s", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.go({ video, second: 9930 })
  s.player.second = 4000
  s.pass(3)
  assert.ok(s.view().second > 4000 && s.view().second < 4010)
})

test("a video that stands still elsewhere is not yet followed there", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  s.watch.go({ video, second: 9930 })
  s.player.second = 4000
  s.pass(1.75)
  s.player.playing = false
  s.pass(0.25)
  s.player.playing = true
  s.pass(1.5)
  assert.equal(s.view().second, 9930)
})

test("the game an address names is the one whose line-ups are shown", () => {
  const s = stand()
  s.watch.open(plain, { video: plain.story.videos[0]!, second: 0, game: 4 }, "whole")
  assert.equal(s.view().chosen, 3)
  s.watch.go({ video: plain.story.videos[0]!, second: 60, game: 2 })
  assert.equal(s.view().chosen, 1)
})

test("an address that names no game shows the line-ups of the game of its place", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 6208 }, "whole")
  assert.equal(s.view().chosen, 2)
})

test("a video of another game shows the line-ups of that game", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.go({ video: other, second: 3149 })
  assert.equal(s.view().chosen, 1)
})

// ---------- games, steps and lengths

test("the game keys go to the start of the game first and to the one before from there", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.watch.game(-1)
  assert.equal(s.last(), "seek 5358")
  s.watch.game(-1)
  assert.equal(s.last(), "seek 3149")
})

test("the game keys go on to the next game", () => {
  const s = stand()
  s.open(sgp, 3149)
  s.watch.game(1)
  assert.equal(s.last(), "seek 5358")
})

test("the game keys stop at the first game", () => {
  const s = stand()
  s.open(sgp, 662)
  s.watch.game(-1)
  assert.equal(s.log.length, 1)
})

test("the game keys stop at the last game", () => {
  const s = stand()
  s.open(sgp, 12000)
  s.watch.game(1)
  assert.equal(s.log.length, 1)
})

test("before a match the game keys go to its first game", () => {
  const s = stand()
  s.open(sgp, 300)
  s.watch.game(1)
  assert.equal(s.last(), "seek 662")
})

test("in a break the game keys go to the games around", () => {
  const s = stand()
  s.open(sgp, 4900)
  s.watch.game(1)
  assert.equal(s.last(), "seek 5358")
  s.watch.go({ video, second: 4900 })
  s.watch.game(-1)
  assert.equal(s.last(), "seek 3149")
})

test("before a later game of another video the game keys go back to the game before it", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.go({ video: other, second: 3000 })
  s.watch.game(-1)
  assert.equal(s.last(), `load ${video} 662`)
})

test("the game keys go on into a stretch without times", () => {
  const s = stand()
  s.open(bru, 42000)
  s.watch.game(1)
  assert.equal(s.last(), "seek 42743")
})

test("the game keys go back out of a stretch without times", () => {
  const s = stand()
  s.open(bru, 42744)
  s.watch.game(-1)
  assert.equal(s.last(), "seek 40561")
})

test("the game keys leave a stretch that holds several games without a time", () => {
  const [untimed, timed] = [middle.story.chapters[1]!, middle.story.chapters[2]!]
  const two = watchMatch(
    [
      SGP_BME[0]!,
      { ...SGP_BME[1]!, zero: null, draft: null },
      { ...SGP_BME[1]!, number: 3, zero: null, draft: null },
      { ...SGP_BME[2]!, number: 4 },
    ],
    7,
  )
  const s = stand()
  s.open(two, untimed.span!.from + 100)
  s.watch.game(1)
  assert.equal(s.last(), `seek ${timed.from}`)
})

test("without a clock the game keys choose whose line-ups are shown and leave the video alone", () => {
  const s = stand()
  s.open(plain, 0)
  s.watch.game(1)
  s.watch.game(1)
  assert.equal(s.view().chosen, 2)
  s.watch.game(-1)
  assert.equal(s.view().chosen, 1)
  assert.equal(s.log.length, 1)
})

test("in a video the story knows nothing of, the game keys choose as well", () => {
  const s = stand()
  s.open(unknown, 1600)
  s.watch.choose(1)
  s.watch.game(-1)
  assert.equal(s.last(), `load ${video} 662`)
  assert.equal(s.view().chosen, 0)
})

test("a step goes to the mark before or after the place", () => {
  const s = stand()
  s.open(sgp, 4228)
  s.watch.step(-1)
  assert.equal(s.last(), "seek 4211")
  s.watch.go({ video, second: 4228 })
  s.watch.step(1)
  assert.equal(s.last(), "seek 4275")
})

test("choosing a game that has a video of its own plays it", () => {
  const games: TestGame[] = UNTIMED.slice(0, 2).map((game, index) => ({
    ...game,
    link: `https://youtu.be/abcdefghij${index}`,
  }))
  const s = stand()
  s.open(watchMatch(games, 3), 0)
  s.watch.choose(1)
  assert.equal(s.last(), "load abcdefghij1 0")
  assert.equal(s.view().chosen, 1)
})

test("choosing a game of which only the second of its link is known plays from there", () => {
  const second: TestGame = { ...UNTIMED[1]!, seconds: null, zero: 500, link: `https://youtu.be/${other}?t=480` }
  const s = stand()
  s.open(watchMatch([UNTIMED[0]!, second], 3), 0)
  s.watch.choose(1)
  assert.equal(s.last(), `load ${other} 480`)
})

test("choosing the later of two games of another video shows the line-ups of that one", () => {
  const link = `https://youtu.be/${other}`
  const s = stand()
  s.open(watchMatch([UNTIMED[0]!, { ...UNTIMED[1]!, link }, { ...UNTIMED[2]!, link }], 5), 0)
  s.watch.choose(2)
  assert.equal(s.view().chosen, 2)
})

test("a game that is not there cannot be chosen", () => {
  const s = stand()
  s.open(plain, 0)
  s.watch.choose(7)
  assert.equal(s.view().chosen, 0)
})

test("choosing the quick cut inside one of its pieces stays there", () => {
  const s = stand()
  s.open(sgp, 4228)
  s.pass(1)
  s.watch.setLength("quick")
  assert.equal(s.log.length, 1)
})

test("choosing the quick cut outside its pieces goes to the next one", () => {
  const s = stand()
  s.open(sgp, 4000)
  s.pass(1)
  s.watch.setLength("quick")
  assert.equal(s.last(), "seek 4122")
})

test("the end of a piece is outside of it", () => {
  const s = stand()
  s.open(sgp, 4250)
  s.watch.setLength("quick")
  assert.equal(s.last(), "seek 4474")
})

test("choosing only the games in a draft goes to 5 s before 0:00", () => {
  const s = stand()
  s.open(sgp, 5600)
  s.pass(1)
  s.watch.setLength("games")
  assert.equal(s.last(), "seek 5870")
})

test("the way into a game of only the games follows the length", () => {
  const s = stand()
  s.open(sgp, 4900, "games")
  s.watch.skip()
  assert.equal(s.last(), "seek 5870")
})

// ---------- skipping

test("skipping a draft leads to 5 s before 0:00", () => {
  const s = stand()
  s.open(sgp, 700)
  s.watch.skip()
  assert.equal(s.last(), "seek 1541")
})

test("skipping a wait leads to 5 s before 0:00", () => {
  const s = stand()
  s.open(sgp, 1100)
  s.watch.skip()
  assert.equal(s.last(), "seek 1541")
})

test("skipping a break leads to the next game", () => {
  const s = stand()
  s.open(sgp, 4900)
  s.watch.skip()
  assert.equal(s.last(), "seek 5358")
})

test("skipping a pause leads to its end, counted from where the video is", () => {
  const s = stand()
  s.open(bru, 41800)
  s.pass(0.75)
  s.watch.skip()
  assert.equal(s.last(), "seek 41955")
})

test("skipping what comes before a match leads to its first game", () => {
  const s = stand()
  s.open(sgp, 300)
  s.watch.skip()
  assert.equal(s.last(), "seek 662")
})

test("skipping an untimed stretch leads to the game after it", () => {
  const s = stand()
  s.open(middle, 3000)
  s.watch.skip()
  assert.equal(s.last(), "seek 5358")
})

test("a linked game is not skipped before it is over", () => {
  const s = stand()
  s.open(hka, 4100)
  s.watch.skip()
  assert.equal(s.log.length, 1)
})

test("skipping what follows a linked game leads to the next one", () => {
  const s = stand()
  s.open(hka, 4200)
  s.watch.skip()
  assert.equal(s.last(), "seek 5869")
})

test("a game that plays is never skipped", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.watch.skip()
  assert.equal(s.log.length, 1)
})

// ---------- what is told to the page

test("what is drawn changes at most once a second while the video plays", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  let changes = 0
  s.watch.subscribe(() => (changes += 1))
  s.pass(10)
  assert.ok(changes <= 11, `${changes} changes in 10 s`)
})

test("the place changes at most once a second while the video plays", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  const places = new Set()
  s.watch.subscribe(() => places.add(s.view().place))
  s.pass(10)
  assert.ok(places.size <= 11, `${places.size} places in 10 s`)
})

test("a count changes once a second", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  const counts = new Set()
  s.watch.subscribe(() => counts.add(s.view().count))
  s.pass(5)
  assert.ok(counts.size <= 6, `${counts.size} counts in 5 s`)
})

test("a count of the same seconds before another break is another count", () => {
  const s = stand()
  s.open(sgp, 4528)
  assert.equal(s.view().count!.until, 4535)
  s.watch.go({ video, second: 6479 })
  assert.equal(s.view().count!.until, 6486)
})

test("a linked game that nothing follows is told to be over", () => {
  const s = stand()
  s.open(hka, 13271)
  s.pass(1)
  assert.equal(s.view().place!.over, false)
  s.pass(2)
  assert.equal(s.view().place!.over, true)
})

test("every reading is told to what moves without a render", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.pass(1)
  const seconds: number[] = []
  s.watch.onTime((second) => seconds.push(second))
  s.pass(1)
  assert.deepEqual(seconds, [2001.25, 2001.5, 2001.75, 2002])
})

test("what has left is not told the time any more", () => {
  const s = stand()
  s.open(sgp, 2000)
  let told = 0
  const leave = s.watch.onTime(() => (told += 1))
  leave()
  s.pass(1)
  assert.equal(told, 0)
})

test("a change is heard once, when it is whole", () => {
  const s = stand()
  s.open(sgp, 6208)
  const heard: string[] = []
  s.watch.subscribe(() => {
    const { match, place, video: own } = s.view()
    heard.push(`${match!.seriesId} ${own} ${place!.chapter!.game.content.sourceUrl!.includes(own!)}`)
  })
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.deepEqual(heard, ["hka WgQTfXMV13A true"])
})

test("a listener that has left is not told", () => {
  const s = stand()
  let heard = 0
  const leave = s.watch.subscribe(() => (heard += 1))
  s.watch.show("KEYS")
  leave()
  s.watch.show(null)
  assert.equal(heard, 1)
})

test("an updated match takes the place of the open one, at the same second", () => {
  const s = stand()
  s.open(sgp, 6208)
  const later = watchMatch([...SGP_BME.slice(0, 2), { ...SGP_BME[2]!, zero: 5880 }], 7, { seriesId: "sgp" })
  s.watch.update(later)
  assert.equal(s.view().match, later)
  assert.equal(s.view().place!.clock, 328)
})

test("the place of an updated match is one of its own games, though it reads as before", () => {
  const s = stand()
  s.open(sgp, 12000)
  const again = watchMatch(SGP_BME, 7, { seriesId: "sgp" })
  s.watch.update(again)
  assert.equal(s.view().place!.chapter, again.story.chapters[5])
})

test("an update of another match changes nothing", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.watch.update(hka)
  assert.equal(s.view().match, sgp)
})

// ---------- panels and sizes

test("a panel that is asked for again closes", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.show("KEYS")
  assert.equal(s.view().panel, "KEYS")
  s.watch.show("KEYS")
  assert.equal(s.view().panel, null)
})

test("a panel takes the place of the one that is open", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.show("LENGTH")
  s.watch.show("KEYS")
  assert.equal(s.view().panel, "KEYS")
})

test("a chosen length closes its panel", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.show("LENGTH")
  s.watch.setLength("all")
  assert.equal(s.view().panel, null)
})

test("the room is left for the small player, with the panel that was open in it", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.show("KEYS")
  s.watch.shrink()
  assert.deepEqual([s.view().shrunk, s.view().panel], [true, null])
})

test("the room is come back to from the small player", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.shrink()
  s.watch.expand()
  assert.equal(s.view().shrunk, false)
})

test("nothing happens while no video is open", () => {
  const s = stand()
  const { watch } = s
  for (const press of [
    watch.skip,
    watch.stay,
    watch.toggle,
    watch.mute,
    watch.pause,
    watch.retry,
    watch.keep,
    watch.focus,
    () => watch.step(1),
    () => watch.game(1),
    () => watch.choose(0),
    () => watch.seekBy(5),
    () => watch.go({ video, second: 5 }),
    watch.close,
  ])
    press()
  assert.deepEqual(s.log, [])
  assert.equal(s.view().match, null)
  assert.equal(s.kept.text, null)
})
