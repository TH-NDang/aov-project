import assert from "node:assert/strict"
import test from "node:test"
import { tracksOf } from "../src/lib/music-catalog.ts"
import { createMusic, MINE_MOST, playOrder, readMusicMemory, type MusicPorts } from "../src/lib/music-store.ts"

type Options = Parameters<MusicPorts["open"]>[1]

/** A browser with one player that is moved by hand, and a store of what it keeps. */
function stand(kept: string | null = null) {
  const log: string[] = []
  const state = { kept, second: 0, made: 0, options: null as Options | null, ticks: null as (() => void) | null }
  const ports: MusicPorts = {
    open(_, options) {
      state.made += 1
      state.options = options
      state.second = options.second
      log.push(`open ${options.video} ${options.second}`)
      return {
        load(video, second) {
          log.push(`load ${video} ${second}`)
          state.second = second
        },
        seek(second) {
          log.push(`seek ${second}`)
          state.second = second
        },
        play: () => log.push("play"),
        pause: () => log.push("pause"),
        time: () => state.second,
        mute: (on) => log.push(`mute ${on}`),
        volume: (level) => log.push(`volume ${level}`),
        destroy: () => log.push("destroy"),
      }
    },
    read: () => state.kept,
    write(text) {
      state.kept = text
    },
    every(_, run) {
      state.ticks = run
      return () => {
        state.ticks = null
      }
    },
    quiet: () => log.push("quiet"),
    random: () => 0.5,
  }
  const music = createMusic(ports)
  music.attach({} as HTMLElement)
  /** What YouTube's player says next. */
  const says = (word: Parameters<Options["onState"]>[0]) => state.options!.onState(word)
  const fails = () => state.options!.onFailure("FORBIDDEN")
  const at = (second: number) => {
    state.second = second
    state.ticks?.()
  }
  return { music, log, state, says, fails, at }
}

const SONGS = tracksOf("SONGS", [])
const ARENA = tracksOf("ARENA", [])

test("a chosen track silences the other sounds, then plays in a frame of its own", () => {
  const { music, log, says } = stand()
  music.play("ARENA", 2)
  assert.deepEqual(log.slice(0, 2), ["quiet", `open ${ARENA[2]!.video} 0`])
  says("PLAYING")
  const view = music.view()
  assert.equal(view.track, ARENA[2])
  assert.equal(view.player, "PLAYING")
  assert.equal(view.open, true)
})

test("the next track follows when one ends, in the one player there is", () => {
  const { music, log, says, state } = stand()
  music.play("SONGS", 0)
  says("PLAYING")
  says("ENDED")
  assert.equal(music.view().track, SONGS[1])
  assert.ok(log.includes(`load ${SONGS[1]!.video} 0`))
  assert.equal(state.made, 1)
})

test("a list that does not repeat stops after its last track", () => {
  const { music, says } = stand()
  music.cycleRepeat()
  music.cycleRepeat()
  assert.equal(music.view().repeat, "OFF")
  music.play("SONGS", SONGS.length - 1)
  says("ENDED")
  assert.equal(music.view().track, SONGS.at(-1))
})

test("a list that repeats goes round to its first track", () => {
  const { music, says } = stand()
  music.play("SONGS", SONGS.length - 1)
  says("ENDED")
  assert.equal(music.view().track, SONGS[0])
})

test("one track repeated starts again when it ends", () => {
  const { music, log, says } = stand()
  music.cycleRepeat()
  assert.equal(music.view().repeat, "ONE")
  music.play("SONGS", 3)
  says("ENDED")
  assert.equal(music.view().track, SONGS[3])
  assert.equal(log.at(-4), `load ${SONGS[3]!.video} 0`)
})

test("shuffled, every track of the list plays once before any plays again", () => {
  const { music, says } = stand()
  music.setShuffle(true)
  music.play("ARENA", 4)
  const heard = [music.view().track!.video]
  for (let step = 1; step < ARENA.length; step++) {
    says("ENDED")
    heard.push(music.view().track!.video)
  }
  assert.equal(new Set(heard).size, ARENA.length)
})

test("a shuffled order begins with the track that plays now", () => {
  const order = playOrder(6, true, 4, () => 0.3)
  assert.equal(order[0], 4)
  assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5])
})

test("previous starts the track again a few seconds in, and goes back at its start", () => {
  const { music, log, at } = stand()
  music.play("SONGS", 2)
  at(40)
  music.previous()
  assert.equal(log.at(-1), "seek 0")
  assert.equal(music.view().track, SONGS[2])
  at(1)
  music.previous()
  assert.equal(music.view().track, SONGS[1])
})

test("a track that will not play is passed over", () => {
  const { music, fails, state } = stand()
  music.play("SONGS", 0)
  fails()
  const view = music.view()
  assert.equal(view.track, SONGS[1])
  assert.equal(view.skipped, SONGS[0])
  assert.equal(state.made, 2)
})

test("folding pauses what is heard, as a playing video has to be seen", () => {
  const { music, log, says } = stand()
  music.play("SONGS", 0)
  says("PLAYING")
  music.fold()
  assert.equal(log.at(-1), "pause")
  assert.equal(music.view().folded, true)
})

test("another sound of the app pauses the music and folds it away", () => {
  const { music, log, says } = stand()
  music.play("SONGS", 0)
  says("PLAYING")
  music.yieldTo()
  assert.equal(log.at(-1), "pause")
  assert.equal(music.view().folded, true)
})

test("the list, the track, its second and the settings come back folded and silent", () => {
  const first = stand()
  first.music.play("ARENA", 5)
  first.says("PLAYING")
  first.music.setVolume(35)
  first.music.setShuffle(true)
  first.at(12)
  first.says("PAUSED")

  const again = stand(first.state.kept)
  const view = again.music.view()
  assert.equal(view.list, "ARENA")
  assert.equal(view.track, ARENA[5])
  assert.equal(view.volume, 35)
  assert.equal(view.shuffle, true)
  assert.equal(view.open, true)
  assert.equal(view.folded, true)
  assert.equal(view.player, "CLOSED")
  assert.equal(again.state.made, 0)
  again.music.toggle()
  assert.ok(again.log.includes(`open ${ARENA[5]!.video} 12`))
})

test("what the browser kept is read with care", () => {
  assert.equal(readMusicMemory("{not json").list, "SONGS")
  const read = readMusicMemory(
    JSON.stringify({ list: "NOPE", volume: 400, repeat: "TWICE", mine: [{ video: "bad" }, { video: "qJn0uACPdG0" }] }),
  )
  assert.equal(read.list, "SONGS")
  assert.equal(read.volume, 100)
  assert.equal(read.repeat, "ALL")
  assert.deepEqual(read.mine, [])
})

test("a link of the reader's own comes first, once, and the oldest go past the most kept", () => {
  const { music } = stand()
  const link = (n: number) => ({ video: `video${String(n).padStart(6, "0")}`, title: `Bài ${n}`, artist: "Ai đó" })
  assert.equal(music.add(link(1)), true)
  assert.equal(music.add(link(2)), true)
  assert.equal(music.add(link(1)), false)
  assert.deepEqual(
    music.view().mine.map(({ video }) => video),
    [link(1).video, link(2).video],
  )
  for (let n = 3; n < MINE_MOST + 5; n++) music.add(link(n))
  assert.equal(music.view().mine.length, MINE_MOST)
  music.remove(link(MINE_MOST + 4).video)
  assert.equal(music.view().mine.length, MINE_MOST - 1)
})

test("closing remembers the second and lets the frame go", () => {
  const { music, log, at, state } = stand()
  music.play("SONGS", 1)
  at(30)
  music.close()
  assert.equal(log.at(-1), "destroy")
  assert.equal(music.view().open, false)
  assert.equal(readMusicMemory(state.kept).second, 30)
})
