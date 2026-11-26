import assert from "node:assert/strict"
import { mock, test } from "node:test"
import React, { act, type ComponentProps } from "react"
import type { MatchPlayer } from "../src/features/esports/components/game/match-player"
import type { MatchPlayerHandle, VideoProblem } from "../src/features/esports/components/game/match-video"
import { waitFor } from "./fixtures/dom"
import { holdPoll, inPage, mockYouTube } from "./fixtures/esports-ui"

type Props = ComponentProps<typeof MatchPlayer>

const UNSTARTED = -1
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3
const CUED = 5

/** The player of the match, as the page draws it before anything was changed. */
async function playerOf() {
  const { MatchPlayer } = await import("../src/features/esports/components/game/match-player")
  const usual: Props = {
    videoId: "R5rCsGqDJIg",
    startAt: 95,
    title: "Game",
    sound: { volume: 100, muted: false },
    rate: 1,
    youtubeControls: false,
    onTime: () => {},
    onPlayingChange: () => {},
  }
  return (props: Partial<Props> & { ref?: React.Ref<MatchPlayerHandle> } = {}) => <MatchPlayer {...usual} {...props} />
}

type Players = ReturnType<typeof mockYouTube>
const makeReady = (player: Players[number]) => act(async () => player.events.onReady({ target: player }))
const report = (player: Players[number], ...states: number[]) =>
  act(async () => states.forEach((state) => player.report(state)))

/** One player on a page, ready, with what it told the page and a way to take its readings, a quarter of a second apart. */
async function inPlayer(
  run: (player: {
    first: Players[number]
    players: Players
    handle: MatchPlayerHandle
    /** Seconds told, and whether the video runs, as they were told. */
    told: { times: number[]; playing: boolean[] }
    read: (times?: number) => Promise<void>
    /** Lets time pass in which nothing is read. */
    wait: (ms: number) => void
    /** Draws the player again with other wishes. */
    show: (props: Partial<Props>) => Promise<unknown>
  }) => Promise<void>,
) {
  let now = 1_000_000
  const clock = mock.method(Date, "now", () => now)
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const players = mockYouTube()
    const readOne = holdPoll()
    const read = async (times = 1) => {
      for (let reading = 0; reading < times; reading++) {
        now += 250
        await readOne()
      }
    }
    const ref = React.createRef<MatchPlayerHandle>()
    const told = { times: [] as number[], playing: [] as boolean[] }
    const told_ = {
      onTime: (second: number) => void told.times.push(second),
      onPlayingChange: (playing: boolean) => void told.playing.push(playing),
    }
    const show = (props: Partial<Props>) => render(player_({ ref, ...told_, ...props }))
    await show({})
    await makeReady(players[0]!)
    const wait = (ms: number) => void (now += ms)
    await run({ first: players[0]!, players, handle: ref.current!, told, read, wait, show })
  }).finally(() => clock.mock.restore())
}

test("seeks wait until the player is ready, and only the latest one counts", async () => {
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    const ref = React.createRef<MatchPlayerHandle>()
    await render(player_({ ref }))

    await act(async () => ref.current!.seek(335))
    const player = instances[0]
    assert.equal(player.vars.start, 95)
    assert.equal(player.vars.autoplay, 0)
    assert.equal(ref.current!.currentTime(), null, "an unready player must not report the default zero time")
    await act(async () => ref.current!.seek(830))
    assert.deepEqual([player.seeks, player.loaded], [[], []], "API methods can exist before YouTube accepts commands")

    await makeReady(player)
    assert.deepEqual(player.loaded, [{ videoId: "R5rCsGqDJIg", startSeconds: 830 }])
    assert.deepEqual([player.seeks, player.pauses], [[], 0])
  })
})

test("a video that was never played shows the frame it is sent to and waits there, without a sound until then", async () => {
  await inPlayer(async ({ first, handle, told }) => {
    await act(async () => handle.seek(600.4))
    assert.deepEqual(first.loaded, [{ videoId: "R5rCsGqDJIg", startSeconds: 600 }])
    assert.deepEqual([first.seeks, first.pauses, first.muted], [[], 0, true], "either would leave the player black")

    await report(first, UNSTARTED, BUFFERING, PLAYING)
    assert.deepEqual([first.seeks, first.pauses, first.muted], [[600.4], 1, false])
    await report(first, PAUSED)
    assert.ok(!told.playing.includes(true), "it never ran for the viewer")

    await report(first, PLAYING)
    assert.equal(first.pauses, 1, "playing later is not stopped again")
  })
})

test("a video that was never played is only asked to play where it was made to start", async () => {
  await inPlayer(async ({ first, handle }) => {
    await act(async () => handle.seek(95.6, true))
    assert.deepEqual([first.plays, first.loaded, first.seeks, first.muted], [1, [], [], false])
    await report(first, PLAYING)
    assert.deepEqual([first.seeks, first.pauses], [[], 0], "a part of a second is not worth loading again")
  })
})

test("what is asked of a video before its first frame is done at that frame", async () => {
  await inPlayer(async ({ first, handle }) => {
    await act(async () => handle.seek(600))
    await act(async () => handle.seek(610))
    assert.deepEqual([first.loaded.length, first.seeks], [1, []])
    await report(first, PLAYING)
    assert.deepEqual([first.seeks, first.pauses], [[610], 1])
  })
})

test("a video that is asked to play before its first frame runs on from there, with its sound", async () => {
  await inPlayer(async ({ first, handle, told }) => {
    await act(async () => handle.seek(600))
    await act(async () => handle.toggle())
    assert.equal(first.muted, false)
    await report(first, PLAYING)
    assert.equal(first.pauses, 0)
    assert.equal(told.playing.at(-1), true)
  })
})

test("seeking while the video starts keeps the latest time and the pending play request", async () => {
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    const ref = React.createRef<MatchPlayerHandle>()
    await render(player_({ ref }))
    await act(async () => ref.current!.toggle())
    await act(async () => ref.current!.seek(550))
    const player = instances[0]
    await makeReady(player)
    assert.deepEqual(player.loaded, [{ videoId: "R5rCsGqDJIg", startSeconds: 550 }])
    await report(player, PLAYING)
    assert.equal(player.pauses, 0)
  })
})

test("seeking a paused video keeps it paused", async () => {
  await inPlayer(async ({ first, handle, told, read }) => {
    await report(first, PLAYING, PAUSED)
    first.time = 830
    assert.equal(handle.currentTime(), 830)
    await act(async () => handle.seek(550))
    assert.deepEqual([first.seeks, first.plays, first.pauses], [[550], 0, 0])
    assert.deepEqual(told.times, [], "a requested time must not be reported as an observed video position")
    await read()
    assert.deepEqual(told.times, [830])
  })
})

test("a video that starts slowly tells no time before its first frame", async () => {
  await inPlayer(async ({ first, handle, told, read }) => {
    await act(async () => handle.seek(95, true))
    await report(first, UNSTARTED)
    await read()
    await report(first, BUFFERING)
    await read(4)
    assert.deepEqual(told.times, [], "it answers zero, which would throw the playhead to the start of the video")
    assert.equal(handle.currentTime(), null)

    await report(first, PLAYING)
    first.time = 95.3
    await read()
    await report(first, BUFFERING)
    first.time = 400
    await read()
    assert.deepEqual(told.times, [95.3, 400], "afterwards it tells its time also while it waits for data")
  })
})

test("a video that is sent elsewhere while it runs keeps running, however long it waits for data", async () => {
  await inPlayer(async ({ first, handle, told }) => {
    await act(async () => handle.seek(95, true))
    await report(first, PLAYING, BUFFERING, PLAYING, BUFFERING)
    assert.deepEqual(told.playing, [true, true], "the button must not flip with every seek")
    await act(async () => handle.toggle())
    assert.deepEqual([first.pauses, first.plays], [1, 1], "a press while it waits for data pauses it")
  })
})

test("a paused video that is sent elsewhere stays paused while it waits for data", async () => {
  await inPlayer(async ({ first, handle, told }) => {
    await report(first, PLAYING, PAUSED, BUFFERING)
    assert.deepEqual(told.playing, [true, false])
    await act(async () => handle.toggle())
    assert.deepEqual([first.pauses, first.plays], [0, 1])
  })
})

test("the player reports its duration without playing or seeking", async () => {
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    const read = holdPoll()
    const durations: number[] = []
    await render(player_({ onDuration: (seconds) => durations.push(seconds) }))
    const player = instances[0]
    assert.equal(player.vars.controls, 0, "YouTube's control bar is hidden")
    await makeReady(player)
    await read(3)
    assert.deepEqual(durations, [20144], "once, until it changes")
    player.duration = 20146
    await read()
    assert.deepEqual(durations, [20144, 20146], "a live video grows")
    assert.deepEqual([player.plays, player.seeks, player.loaded], [0, [], []])
  })
})

test("clicking into the video hands keyboard focus back so page shortcuts keep working", async () => {
  await inPage(async (document, render) => {
    const player_ = await playerOf()
    mockYouTube()
    await render(player_())
    const window = document.defaultView!
    const frame = document.createElement("iframe")
    document.querySelector('[title="Game"]')!.append(frame)
    frame.focus()
    assert.equal(document.activeElement, frame)
    await act(async () => {
      window.dispatchEvent(new window.Event("blur"))
    })
    await waitFor(() => document.activeElement !== frame, "Leaving for the video returns focus to the page")
  })
})

test("YouTube's own controls come with a new player", async () => {
  await inPage(async (document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    await render(player_())
    assert.equal(instances[0].vars.controls, 0)
    await makeReady(instances[0])
    await render(player_({ youtubeControls: true }))
    assert.equal(instances[0].destroyed, true)
    assert.equal(instances[1].vars.controls, 1)
    assert.equal(instances[1].vars.start, 95)
    assert.equal(document.querySelector('[title="Game"]')!.textContent, "", "nothing of ours stands over the video")
  })
})

test("a player made again while the video is paused draws the frame it stood on", async () => {
  await inPlayer(async ({ first, players, told, read, show }) => {
    await report(first, PLAYING, PAUSED)
    first.time = 4158.6
    await read()
    await show({ youtubeControls: true })
    const second = players[1]!
    assert.equal(second.vars.start, 4158)
    await makeReady(second)
    assert.deepEqual([second.plays, second.muted], [1, true])
    assert.deepEqual([second.seeks, second.pauses], [[], 0], "either would leave the new player black")

    await report(second, UNSTARTED, BUFFERING, PLAYING)
    assert.deepEqual([second.seeks, second.pauses, second.muted], [[4158.6], 1, false])
    await report(second, PAUSED)
    assert.equal(told.playing.at(-1), false)
    assert.equal(told.playing.filter(Boolean).length, 1, "it never ran for the viewer")
  })
})

test("a player made again while the video runs goes on playing", async () => {
  await inPlayer(async ({ first, players, told, read, show }) => {
    await report(first, PLAYING)
    first.time = 4158.6
    await read()
    await show({ youtubeControls: true })
    const second = players[1]!
    assert.equal(second.vars.start, 4158)
    await makeReady(second)
    assert.deepEqual([second.plays, second.muted, second.seeks], [1, false, []])
    await report(second, UNSTARTED, BUFFERING)
    assert.deepEqual(told.playing, [true], "the button stays while the new player starts")
    await report(second, PLAYING)
    assert.equal(second.pauses, 0)
  })
})

test("a player made again before its first frame keeps what was asked of it", async () => {
  await inPlayer(async ({ handle, players, show }) => {
    await act(async () => handle.seek(600, true))
    await show({ youtubeControls: true })
    const second = players[1]!
    assert.equal(second.vars.start, 600)
    await makeReady(second)
    assert.deepEqual([second.plays, second.muted], [1, false])
  })
})

test("a player that draws nothing although it was started is made again", async () => {
  await inPlayer(async ({ first, handle, players, read }) => {
    await read(60)
    assert.equal(players.length, 1, "nothing was asked of it yet")
    await act(async () => handle.seek(600, true))
    await report(first, UNSTARTED, BUFFERING, UNSTARTED)
    await read(23)
    assert.equal(players.length, 1)
    await read()
    assert.equal(players.length, 2)
    assert.equal(first.destroyed, true)

    const second = players[1]!
    assert.equal(second.vars.start, 600)
    await makeReady(second)
    assert.deepEqual([second.plays, second.muted], [1, false], "what was asked is asked again")
  })
})

test("where a new player draws nothing either, the poster takes the place of a black picture", async () => {
  await inPlayer(async ({ handle, players, told, read }) => {
    await act(async () => handle.seek(600))
    await read(24)
    const second = players[1]!
    await makeReady(second)
    await read(24)
    assert.equal(players.length, 2)
    assert.deepEqual(second.cued, [{ videoId: "R5rCsGqDJIg", startSeconds: 600 }])
    await report(second, CUED)
    assert.deepEqual([second.muted, told.playing.at(-1)], [false, false])
    await read(60)
    assert.equal(second.cued.length, 1)

    await act(async () => handle.seek(600, true))
    assert.equal(second.plays, 2, "a press on play tries again")
    await read(24)
    assert.equal(players.length, 3)
  })
})

test("a player that is stuck on one video may be made again for the next one", async () => {
  await inPlayer(async ({ first, handle, players, read, show }) => {
    await act(async () => handle.seek(600, true))
    await report(first, UNSTARTED)
    await read(24)
    const second = players[1]!
    await makeReady(second)
    await show({ videoId: "abcdefghijk" })
    assert.deepEqual(second.loaded, [{ videoId: "abcdefghijk", startSeconds: 95 }], "what was to play plays on")
    await report(second, UNSTARTED)
    await read(60)
    assert.equal(players.length, 3)
  })
})

test("a page too busy to read its player does not take it for stuck", async () => {
  await inPlayer(async ({ first, handle, players, read, wait }) => {
    await act(async () => handle.seek(600))
    wait(20_000)
    await read(3)
    assert.equal(players.length, 1, "the frame may be drawn and not told yet")
    await report(first, PLAYING, PAUSED)
    await read(60)
    assert.equal(players.length, 1)
  })
})

test("a player is found stuck as soon where the browser reads it once a second only", async () => {
  await inPlayer(async ({ handle, players, read, wait }) => {
    await act(async () => handle.seek(600))
    for (let second = 0; second < 6; second++) {
      wait(750)
      await read()
    }
    assert.equal(players.length, 2)
  })
})

test("a player whose data is arriving is given its time", async () => {
  await inPlayer(async ({ first, handle, players, read }) => {
    first.loadedFraction = 0.0004
    await act(async () => handle.seek(600))
    await read(60)
    assert.equal(players.length, 1)
  })
})

test("a player is not made again while the browser is offline", async () => {
  await inPlayer(async ({ handle, players, read }) => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false })
    await act(async () => handle.seek(600))
    await read(60)
    assert.equal(players.length, 1, "its page could not be loaded")
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true })
    await read()
    assert.equal(players.length, 2)
  })
})

test("sound and speed are kept through every new player and every other video", async () => {
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    await render(player_({ sound: { volume: 40, muted: true }, rate: 1.5 }))
    const first = instances[0]
    await makeReady(first)
    assert.deepEqual([first.volume, first.muted, first.rates], [40, true, [1.5]])

    await render(player_({ sound: { volume: 70, muted: false }, rate: 1.5 }))
    assert.deepEqual([first.volume, first.muted], [70, false])
    await render(player_({ sound: { volume: 70, muted: false }, rate: 2 }))
    assert.deepEqual(first.rates, [1.5, 2])

    await render(player_({ sound: { volume: 70, muted: false }, rate: 2, videoId: "abcdefghijk" }))
    await report(first, CUED)
    assert.deepEqual(first.rates, [1.5, 2, 2], "loading a video puts YouTube's speed back to 1")

    await render(player_({ sound: { volume: 70, muted: false }, rate: 2, youtubeControls: true }))
    const second = instances[1]
    await makeReady(second)
    assert.deepEqual([second.volume, second.rates], [70, [2]])
  })
})

test("a video that was loaded for its first frame gets its speed back there", async () => {
  await inPlayer(async ({ first, handle, show }) => {
    await show({ rate: 1.5 })
    await act(async () => handle.seek(600, true))
    await report(first, PLAYING)
    assert.deepEqual(first.rates, [1.5, 1.5])
  })
})

test("another video loads into the same player, waiting on its picture when the one before it waited", async () => {
  await inPlayer(async ({ first, players, handle, told, read, show }) => {
    await show({ videoId: "abcdefghijk", startAt: 667.6 })
    assert.equal(players.length, 1)
    assert.deepEqual(first.cued, [{ videoId: "abcdefghijk", startSeconds: 667 }])
    first.time = 95
    await read()
    assert.deepEqual(told.times, [], "the old video's time is not the new one's")
    assert.equal(handle.currentTime(), null)

    await report(first, CUED)
    assert.deepEqual([first.plays, first.muted], [1, true], "the picture at its second, not YouTube's poster")
    await report(first, PLAYING)
    assert.deepEqual([first.seeks, first.pauses, first.muted], [[667.6], 1, false])

    await show({ videoId: "abcdefghijk", startAt: 900 })
    assert.equal(first.cued.length, 1, "the same video is never loaded again")
  })
})

test("another video plays on at once when the one before it was playing", async () => {
  await inPlayer(async ({ first, handle, told, show }) => {
    await report(first, PLAYING)
    await show({ videoId: "abcdefghijk", startAt: 3154 })
    assert.deepEqual(first.loaded, [{ videoId: "abcdefghijk", startSeconds: 3154 }])
    assert.deepEqual(first.cued, [])

    await report(first, PAUSED, UNSTARTED)
    await act(async () => handle.seek(3200))
    await report(first, BUFFERING)
    assert.deepEqual(first.seeks, [], "a seek waits until the player shows that video")
    await report(first, PLAYING)
    assert.deepEqual([first.seeks, first.pauses, first.muted], [[3200], 0, false])
    assert.ok(!told.playing.includes(false), "it ran all the way")
  })
})

test("another video that draws nothing although it was to play is made again", async () => {
  await inPlayer(async ({ first, players, read, show }) => {
    await report(first, PLAYING)
    await show({ videoId: "abcdefghijk", startAt: 3154 })
    await report(first, PAUSED, UNSTARTED, BUFFERING, UNSTARTED)
    await read(24)
    assert.equal(players.length, 2)
    assert.equal(players[1]!.vars.start, 3154)
  })
})

test("a video that cannot be shown says why, and another one clears it", async () => {
  await inPage(async (_document, render) => {
    const player_ = await playerOf()
    const instances = mockYouTube()
    const problems: (VideoProblem | null)[] = []
    const onProblem = (problem: VideoProblem | null) => problems.push(problem)
    await render(player_({ onProblem }))
    const player = instances[0]
    await makeReady(player)
    for (const code of [101, 150, 100, 5]) await act(async () => player.events.onError({ data: code }))
    assert.deepEqual(problems, [null, "forbidden", "forbidden", "gone", "blocked"])
    await render(player_({ onProblem, videoId: "abcdefghijk" }))
    assert.equal(problems.at(-1), null)
  })
})

test("a video that cannot be shown does not run", async () => {
  await inPlayer(async ({ first, told, show }) => {
    await report(first, PLAYING)
    await show({ videoId: "abcdefghijk" })
    await act(async () => first.events.onError({ data: 150 }))
    assert.equal(told.playing.at(-1), false)
    await show({ videoId: "lmnopqrstuv" })
    assert.deepEqual(first.cued, [{ videoId: "lmnopqrstuv", startSeconds: 95 }], "the next one waits")
  })
})

test("a blocked script is told as a blocked player", async () => {
  await inPage(async (document, render) => {
    const player_ = await playerOf()
    const problems: (VideoProblem | null)[] = []
    await render(player_({ onProblem: (problem) => problems.push(problem) }))
    const script = document.querySelector<HTMLScriptElement>('script[src*="youtube.com/iframe_api"]')!
    await act(async () => script.dispatchEvent(new window.Event("error")))
    assert.deepEqual(problems, ["blocked"])
  })
})

test("a recorded video stops a second before its end, where YouTube would cover the picture; a live one does not", async () => {
  await inPlayer(async ({ first, handle, read, show }) => {
    first.pauseVideo = () => {
      first.pauses++
      first.state = PAUSED
    }
    await report(first, PLAYING)
    first.time = 20143.2
    await read()
    assert.equal(first.pauses, 0, "the edge of a live video looks the same for its first seconds")
    for (let second = 0; second < 8; second++) {
      first.duration += 1
      first.time += 1
      await read(4)
    }
    await read(25)
    assert.equal(first.pauses, 0, "a video that grew is live, however long it stands still afterwards")

    await show({ videoId: "abcdefghijk" })
    await report(first, PLAYING)
    first.time = first.duration - 0.8
    await read(25)
    assert.equal(first.pauses, 1, "a length that stays is the end")
    await act(async () => handle.seek(99999))
    assert.equal(first.seeks.at(-1), first.duration - 1)
  })
})
