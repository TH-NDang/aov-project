import assert from "node:assert/strict"
import { test } from "node:test"
import { placeAt } from "../src/lib/watch-place.ts"
import { first, hka, onNow, sgp, stand, video, type Kept } from "./fixtures/watch-stand.ts"

/** The matches that are kept, the newest last. */
const ids = ({ text }: Kept) => JSON.parse(text!).matches.map(([id]: [string]) => id)

test("the place is remembered every 5 s of play", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.pass(5.5)
  assert.equal(s.saved().matches[0][1].second, 6155)
})

test("the place is not remembered before 5 s of play", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.pass(4.75)
  assert.equal(s.kept.text, null)
})

test("the place is remembered on a pause", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.pass(2)
  s.reports("PAUSED")
  assert.equal(s.saved().matches[0][1].second, 6152)
})

test("the place is remembered at the end of the video", () => {
  const s = stand()
  s.open(sgp, 13400)
  s.pass(2)
  s.reports("ENDED")
  assert.equal(s.saved().matches[0][1].second, 13402)
})

test("a place that was remembered is the one a later visit finds", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.reports("PAUSED")
  const again = stand({ kept: s.kept })
  assert.equal(placeAt(sgp.story, video, again.watch.remembered("sgp")!.second).chapter!.number, 3)
})

test("a match nobody has opened is not remembered", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.pass(6)
  assert.equal(s.watch.remembered("hka"), null)
})

test("opening another match remembers the place of the one before it", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.watch.remembered("sgp")!.second, 6208)
})

test("closing remembers the place", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.pass(4)
  s.watch.close()
  assert.equal(s.watch.remembered("sgp")!.second, 6154)
})

test("a page left on a phone remembers the place before the player says that it is paused", () => {
  const s = stand()
  s.player.prompt = false
  s.open(sgp, 6150)
  s.pass(2)
  s.watch.pause()
  assert.equal(s.watch.remembered("sgp")!.second, 6152)
})

test("a video that could not be played leaves what was remembered of its match", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.pass(6)
  s.watch.close()
  s.watch.open(sgp, { video, second: 662 }, "whole")
  s.fails("FAILED")
  s.watch.keep()
  s.watch.close()
  assert.equal(s.watch.remembered("sgp")!.second, 6214)
})

test("what was reached before is known when a match is opened again", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.pass(10)
  s.watch.close()
  const again = stand({ kept: s.kept })
  again.open(sgp, 662)
  assert.equal(again.view().reached, 3211)
})

test("a match that was seen to its end is known as seen when it is opened again", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.close()
  const again = stand({ kept: s.kept })
  again.open(sgp, 662)
  assert.equal(again.view().done, true)
})

test("a match that was seen to its end and is begun again can be gone on with", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.close()
  s.open(sgp, 662)
  s.pass(60)
  s.watch.close()
  const { done, second } = s.watch.remembered("sgp")!
  assert.deepEqual([done, second], [false, 722])
})

test("a stream that is on is not remembered", () => {
  const s = stand()
  s.open(onNow("now"), 0, "all")
  s.read(9000)
  s.pass(20)
  s.watch.close()
  assert.equal(s.watch.remembered("now"), null)
})

test("what was played of a stream is not counted to the match after it", () => {
  const s = stand()
  s.open(onNow("now"), 0, "all")
  s.read(9000)
  s.pass(20)
  s.watch.close()
  s.open(sgp, 700)
  s.pass(2)
  assert.equal(s.kept.text, null)
})

test("a match that is on whose games are timed is remembered", () => {
  const s = stand()
  s.open({ ...sgp, live: true }, 6208)
  s.pass(10)
  s.watch.close()
  assert.equal(s.watch.remembered("sgp")!.second, 6218)
})

// ---------- the length and the shortcuts

test("the length that was chosen is remembered", () => {
  const s = stand()
  s.open(sgp, 5600)
  s.watch.setLength("games")
  assert.equal(s.saved().length, "games")
  assert.equal(s.watch.kept(), "games")
})

test("the quick cut is not remembered as the length", () => {
  const s = stand()
  s.open(sgp, 5600)
  s.watch.setLength("games")
  s.watch.setLength("quick")
  assert.equal(s.saved().length, "games")
  assert.equal(s.watch.kept(), "games")
})

test("after closing the length is the one that is remembered", () => {
  const s = stand()
  s.open(sgp, 5600)
  s.watch.setLength("games")
  s.watch.setLength("quick")
  s.watch.close()
  assert.equal(s.view().length, "games")
})

test("shortcuts that were turned off stay so", () => {
  const s = stand()
  s.watch.setKeys(false)
  assert.equal(s.view().keys, false)
  assert.equal(stand({ kept: s.kept }).view().keys, false)
})

test("shortcuts that were turned off stay so when a match is closed", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.setKeys(false)
  s.watch.close()
  assert.equal(s.view().keys, false)
})

// ---------- two tabs of a browser

/** A tab that has watched SGP–BME, and another that then watched HKA–LIT. */
function twoTabs() {
  const kept: Kept = { text: null }
  const [one, two] = [stand({ kept }), stand({ kept })]
  one.open(sgp, 6208)
  one.pass(6)
  two.open(hka, 6400)
  two.pass(6)
  return { kept, one, two }
}

test("a match that another tab has remembered stays so when this one remembers its own", () => {
  const { kept, one } = twoTabs()
  one.watch.keep()
  assert.deepEqual(ids(kept), ["hka", "sgp"])
})

test("a match that another tab has remembered stays so when a length is chosen", () => {
  const { kept, one } = twoTabs()
  one.watch.setLength("games")
  assert.deepEqual(ids(kept), ["sgp", "hka"])
})

test("a match that another tab has remembered stays so when the shortcuts are turned off", () => {
  const { kept, one } = twoTabs()
  one.watch.setKeys(false)
  assert.deepEqual(ids(kept), ["sgp", "hka"])
})

test("shortcuts that are turned off in one tab stay so while another plays on", () => {
  const { kept, one, two } = twoTabs()
  one.watch.setKeys(false)
  two.pass(6)
  assert.equal(stand({ kept }).view().keys, false)
})

test("a length that is chosen in one tab stays so while another plays on", () => {
  const { kept, one, two } = twoTabs()
  one.watch.setLength("games")
  two.pass(6)
  assert.equal(stand({ kept }).view().length, "games")
})

test("a place that another tab has remembered is found in this one", () => {
  const { one } = twoTabs()
  assert.equal(one.watch.remembered("hka")!.second, 6405)
})

test("the length that was chosen last in another tab is the one that counts here", () => {
  const { one, two } = twoTabs()
  two.watch.setLength("all")
  assert.equal(one.watch.kept(), "all")
})

test("what another tab has reached of a match is known when it is opened here", () => {
  const { one, two } = twoTabs()
  two.watch.close()
  one.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(one.view().reached, 1910)
})

test("closing in one tab takes over what another has chosen", () => {
  const { one, two } = twoTabs()
  two.watch.setKeys(false)
  one.watch.close()
  assert.equal(one.view().keys, false)
})

test("closing a stream, which is not remembered, takes over what another tab has chosen", () => {
  const { one, two } = twoTabs()
  one.open(onNow("now"), 0, "all")
  two.watch.setKeys(false)
  one.watch.close()
  assert.equal(one.view().keys, false)
})

test("what is stored counts, also where it is what was stored before", () => {
  const { kept, one } = twoTabs()
  const before = kept.text
  one.watch.setLength("games")
  kept.text = before
  assert.equal(one.watch.kept(), "whole")
})

// ---------- a storage that fails

test("a storage that takes nothing more leaves what this tab remembers", () => {
  const { kept, one } = twoTabs()
  kept.refuses = true
  one.pass(6)
  one.watch.close()
  assert.equal(one.watch.remembered("sgp")!.second, 6220)
})

test("a storage that takes nothing more leaves the length that was chosen in this tab", () => {
  const { kept, one } = twoTabs()
  kept.refuses = true
  one.watch.setLength("games")
  assert.equal(one.watch.kept(), "games")
})

test("a storage that is emptied leaves what this tab remembers", () => {
  const { kept, one } = twoTabs()
  kept.text = null
  assert.equal(one.watch.remembered("sgp")!.second, 6213)
})

test("without a storage a tab remembers by itself", () => {
  const s = stand({ kept: { text: null, refuses: true } })
  s.open(sgp, 6208)
  s.watch.close()
  assert.equal(s.watch.remembered("sgp")!.second, 6208)
})

test("memory that cannot be read starts afresh", () => {
  assert.equal(stand({ kept: { text: "{broken" } }).view().length, "whole")
})

test("sixty matches are kept, the oldest are dropped", () => {
  const s = stand()
  for (let index = 0; index < 70; index++) {
    s.watch.open({ ...sgp, seriesId: `s${index}` }, { video, second: 700 }, "whole")
    s.watch.keep()
  }
  assert.equal(ids(s.kept).length, 60)
  assert.equal(ids(s.kept).at(-1), "s69")
})
