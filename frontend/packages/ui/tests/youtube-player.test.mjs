import assert from "node:assert/strict"
import test from "node:test"

import { openPage } from "./fixtures/youtube-page.mjs"

const VIDEO = "j8AvYygkzm4"
const OTHER = "gXaAhaCcfo8"

test("nothing of YouTube is asked for before a video is opened", async () => {
  const page = await openPage()
  assert.deepEqual(page.scripts, [])
})

test("a video that is opened asks for YouTube's script", async () => {
  const page = await openPage()
  page.open()
  assert.deepEqual(
    page.scripts.map(({ src }) => src),
    ["https://www.youtube.com/iframe_api"],
  )
})

test("the script is asked for once, however many videos are opened", async () => {
  const page = await openPage()
  page.open()
  page.open()
  await page.load()
  page.open()
  await page.settle()
  assert.equal(page.scripts.length, 1)
  assert.equal(page.players.length, 3)
})

test("a script that is there already is not asked for", async () => {
  const page = await openPage()
  page.begin()
  await page.finish()
  page.open()
  await page.settle()
  assert.equal(page.scripts.length, 0)
  assert.equal(page.players.length, 1)
})

test("another part of the page that waits for the script is told as well", async () => {
  const page = await openPage()
  let told = 0
  page.page.onYouTubeIframeAPIReady = () => (told += 1)
  page.open()
  await page.load()
  assert.equal(told, 1)
  assert.equal(page.players.length, 1)
})

test("a script that is refused is told at once", async () => {
  const page = await openPage()
  const { heard } = page.open()
  await page.refuse()
  assert.deepEqual(heard, ["BLOCKED"])
})

test("a script that was refused is asked for again by the next try", async () => {
  const page = await openPage()
  page.open()
  await page.refuse()
  const { heard } = page.open()
  assert.equal(page.scripts.length, 2)
  await page.load()
  assert.deepEqual(heard, [])
  assert.equal(page.players.length, 1)
})

test("a script that was refused leaves nothing of itself in the page", async () => {
  const page = await openPage()
  page.open()
  await page.refuse()
  assert.equal(page.scripts[0].removed, true)
})

test("a script that says it is there without a player is told", async () => {
  const page = await openPage()
  const { heard } = page.open()
  page.begin()
  page.page.onYouTubeIframeAPIReady()
  await page.settle()
  assert.deepEqual(heard, ["BLOCKED"])
})

test("a script that begins but never comes to its end is told after 12 s", async () => {
  const page = await openPage()
  const { heard } = page.open()
  page.begin()
  page.pass(11_999)
  assert.deepEqual(heard, [])
  page.pass(1)
  assert.deepEqual(heard, ["BLOCKED"])
})

test("a script that never comes to its end is told before anything is done about it", async () => {
  const page = await openPage()
  const { heard } = page.open()
  Object.defineProperty(page.page, "YT", { value: { loading: 1 }, writable: false })
  assert.throws(() => page.pass(12_000))
  assert.deepEqual(heard, ["BLOCKED"])
})

test("a script that never came to its end begins afresh with the next try", async () => {
  const page = await openPage()
  const given = page.open()
  page.begin()
  page.pass(12_000)
  given.player.destroy()
  const { heard } = page.open()
  assert.equal(page.scripts.length, 2)
  await page.load()
  assert.equal(page.begun, 2)
  assert.equal(page.players.length, 1)
  assert.deepEqual(heard, [])
})

test("a script that comes to its end after its try was given up brings no player by itself", async () => {
  const page = await openPage()
  const { player } = page.open()
  page.begin()
  page.pass(12_000)
  player.destroy()
  page.begin()
  await page.finish()
  assert.equal(page.players.length, 0)
})

test("a player that is not ready after 12 s is told, and the script that brought it is kept", async () => {
  const page = await openPage()
  const { heard } = page.open()
  await page.load()
  page.pass(12_000)
  assert.deepEqual(heard, ["BLOCKED"])
  page.open()
  await page.settle()
  assert.equal(page.scripts.length, 1)
  assert.equal(page.players.length, 2)
})

test("a player that is ready is no longer waited for", async () => {
  const page = await openPage()
  const { heard } = await page.play()
  page.pass(60_000)
  assert.deepEqual(heard, [])
  assert.equal(page.waiting(), 0)
})

test("the player is made without cookies, with YouTube's own controls", async () => {
  const page = await openPage()
  const { own } = await page.play()
  const { videoId, host, playerVars } = own.options
  assert.equal(videoId, VIDEO)
  assert.equal(host, "https://www.youtube-nocookie.com")
  assert.deepEqual(playerVars, {
    autoplay: 1,
    controls: 1,
    rel: 0,
    playsinline: 1,
    iv_load_policy: 3,
    origin: "https://stream.test",
  })
})

test("the player begins at a whole second and speaks the language of the app", async () => {
  const page = await openPage()
  const { own } = await page.play({ second: 662.8, language: "vi" })
  assert.equal(own.options.playerVars.start, 662)
  assert.equal(own.options.playerVars.hl, "vi")
})

test("the frame is named where YouTube's script does not write", async () => {
  const page = await openPage()
  const { own } = await page.play({ title: "Video: SGP gặp BME" })
  own.frame.setAttribute("title", "the video's own name")
  assert.deepEqual(own.frame.attributes, {
    "aria-label": "Video: SGP gặp BME",
    title: "the video's own name",
  })
})

test("a player that is ready is opening", async () => {
  const page = await openPage()
  const { heard } = page.open()
  await page.load()
  page.players[0].ready()
  assert.deepEqual(heard, ["OPENING"])
})

test("a player that plays before it is ready says so when it is", async () => {
  const page = await openPage()
  const { heard } = page.open()
  await page.load()
  page.players[0].ready(1)
  assert.deepEqual(heard, ["OPENING", "PLAYING"])
})

test("every state of YouTube's player has its word, and an unknown one none", async () => {
  const page = await openPage()
  const { own, heard } = await page.play()
  for (const state of [-1, 5, 1, 2, 3, 0, 9]) own.says(state)
  assert.deepEqual(heard, ["OPENING", "OPENING", "PLAYING", "PAUSED", "WAITING", "ENDED"])
})

test("a video that is gone, one that may not be shown here and one that fails are told apart", async () => {
  const page = await openPage()
  const { own, heard } = await page.play()
  for (const code of [100, 101, 150, 153, 2, 5, 999]) own.fails(code)
  assert.deepEqual(heard, ["GONE", "FORBIDDEN", "FORBIDDEN", "FORBIDDEN", "FAILED", "FAILED", "FAILED"])
})

test("a video that fails before it is ready is not told to be blocked later", async () => {
  const page = await openPage()
  const { heard } = page.open()
  await page.load()
  page.players[0].fails(150)
  page.pass(12_000)
  assert.deepEqual(heard, ["FORBIDDEN"])
})

test("a browser that blocks the start is passed on", async () => {
  const page = await openPage()
  const { own, heard } = await page.play()
  own.events.onAutoplayBlocked()
  assert.deepEqual(heard, ["AUTOPLAY BLOCKED"])
})

test("what is asked of a player that is ready is done at once", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  player.seek(700.5)
  player.pause()
  player.play()
  player.mute(true)
  player.mute(false)
  assert.deepEqual(own.log, ["seek 700.5", "pause", "play", "mute", "unmute"])
})

test("a video is loaded from its second", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  player.load(OTHER, 828.4)
  assert.deepEqual(own.log, [`load ${OTHER} from 828.4`])
})

test("a video that is loaded from second 0 is given none, which is the live edge of a stream", async () => {
  const page = await openPage()
  const { own, player } = await page.play({ second: 900 })
  player.load(VIDEO, 0)
  assert.deepEqual(own.log, [`load ${VIDEO}`])
})

/** What a player does once it is ready, after what was asked of it before. */
async function caughtUp(ask, options) {
  const page = await openPage()
  const { player } = page.open(options)
  ask(player)
  await page.load()
  page.players[0].ready()
  return page.players[0].log
}

test("a player that nothing was asked of does nothing by itself", async () => {
  assert.deepEqual(await caughtUp(() => {}), [])
})

test("of the places asked for before a player is ready the last one counts", async () => {
  const log = await caughtUp((player) => {
    player.seek(700)
    player.seek(5358)
  })
  assert.deepEqual(log, ["seek 5358"])
})

test("a video asked for before a player is ready is loaded once it is", async () => {
  assert.deepEqual(await caughtUp((player) => player.load(OTHER, 828)), [`load ${OTHER} from 828`])
})

test("a place in a video asked for before a player is ready is gone to in that video", async () => {
  const log = await caughtUp((player) => {
    player.load(OTHER, 828)
    player.seek(900)
  })
  assert.deepEqual(log, [`load ${OTHER} from 900`])
})

test("a stream that is joined before its player is ready is joined at its live edge", async () => {
  assert.deepEqual(await caughtUp((player) => player.load(VIDEO, 0)), [`load ${VIDEO}`])
})

test("of play and pause before a player is ready the last one counts", async () => {
  const played = await caughtUp((player) => {
    player.pause()
    player.play()
  })
  const paused = await caughtUp((player) => {
    player.play()
    player.pause()
  })
  assert.deepEqual([played, paused], [["play"], ["pause"]])
})

test("the sound that was turned off before a player is ready is off when it is", async () => {
  assert.deepEqual(await caughtUp((player) => player.mute(true)), ["mute"])
})

test("a player that is let go of as it says that it is ready is asked for nothing", async () => {
  const page = await openPage()
  const { player } = page.open({ onState: () => player.destroy() })
  player.seek(700)
  await page.load()
  page.players[0].ready()
  assert.deepEqual(page.players[0].log, ["destroy"])
})

test("there is no time before a player is ready, and none of a video that has not begun", async () => {
  const page = await openPage()
  const { player } = page.open()
  assert.equal(player.time(), null)
  await page.load()
  const [own] = page.players
  own.second = 662
  own.ready()
  for (const state of [-1, 5]) {
    own.says(state)
    assert.equal(player.time(), null)
  }
})

test("a video that has begun answers its second, playing or not", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  own.second = 662.4
  for (const state of [1, 2, 3, 0]) {
    own.says(state)
    assert.equal(player.time(), 662.4)
  }
})

test("the speed is 1 before a player is ready, and then its own", async () => {
  const page = await openPage()
  const { player } = page.open()
  assert.equal(player.rate(), 1)
  await page.load()
  page.players[0].speed = 1.5
  page.players[0].ready()
  assert.equal(player.rate(), 1.5)
})

test("the sound is on before a player is ready, unless it was turned off", async () => {
  const page = await openPage()
  const { player } = page.open()
  assert.equal(player.muted(), false)
  player.mute(true)
  assert.equal(player.muted(), true)
})

test("the sound is as the player has it once it is ready", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  own.quiet = true
  assert.equal(player.muted(), true)
})

test("the focus goes into the frame", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  player.focus()
  assert.equal(own.frame.focused, 1)
})

test("the frame stands alone in its host, in the place of what was there", async () => {
  const page = await openPage()
  const { own, host } = await page.play()
  assert.deepEqual(host.children, [own.frame])
})

test("a player that is let go of leaves its host empty", async () => {
  const page = await openPage()
  const { own, player, host } = await page.play()
  player.destroy()
  assert.deepEqual(own.log, ["destroy"])
  assert.deepEqual(host.children, [])
})

test("a player that is let go of twice is destroyed once", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  player.destroy()
  player.destroy()
  assert.deepEqual(own.log, ["destroy"])
})

test("nothing is heard of a player that was let go of", async () => {
  const page = await openPage()
  const { own, player, heard } = await page.play()
  player.destroy()
  own.says(1)
  own.fails(100)
  own.events.onAutoplayBlocked()
  assert.deepEqual(heard, [])
})

test("a player that was let go of answers no time", async () => {
  const page = await openPage()
  const { own, player } = await page.play()
  own.says(1)
  player.destroy()
  assert.equal(player.time(), null)
})

test("a player that was let go of and is ready after that answers no time", async () => {
  const page = await openPage()
  const { player } = page.open()
  await page.load()
  player.destroy()
  page.players[0].ready(1)
  assert.equal(player.time(), null)
})

test("a player that was let go of is no longer waited for", async () => {
  const page = await openPage()
  const { player } = page.open()
  player.destroy()
  assert.equal(page.waiting(), 0)
})

test("a video that is let go of before the script is there gets no player", async () => {
  const page = await openPage()
  const { player, heard, host } = page.open()
  player.destroy()
  await page.load()
  page.pass(12_000)
  assert.equal(page.players.length, 0)
  assert.deepEqual(heard, [])
  assert.deepEqual(host.children, [])
})
