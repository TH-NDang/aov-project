import assert from "node:assert/strict"
import { test } from "node:test"
import { act, type ComponentProps } from "react"
import type { DOMWindow } from "jsdom"
import type { Transport } from "../src/features/esports/components/game/transport"
import type { Sound } from "../src/features/esports/components/game/use-video-settings"
import { createPlayhead } from "../src/features/esports/model/playhead"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import { choose, click, type } from "./fixtures/dom"
import { chapter, game, inPage, lookups, onAxis, popoverGlobals } from "./fixtures/esports-ui"

type Props = ComponentProps<typeof Transport>

const second: GameChapter = {
  ...chapter(3718, 4520),
  gameId: "g2",
  number: 2,
  from: 3154,
  draft: { start: 3154, locked: 3490, turns: [] },
}
const third: GameChapter = { ...chapter(5875, 6471), gameId: "g3", number: 3, from: 5363 }
const CHAPTERS = [second, third]

/** The row over a match of two placed games, and what it asked for. */
async function transportOf(at: number, changes: Partial<Props> = {}) {
  const { Transport } = await import("../src/features/esports/components/game/transport")
  const asked: unknown[][] = []
  const tell =
    (name: string) =>
    (...values: unknown[]) =>
      asked.push([name, ...values])
  const playhead = createPlayhead(at)
  const props: Props = {
    playhead,
    chapters: CHAPTERS,
    duration: 13504,
    live: false,
    playing: false,
    canPlay: true,
    sound: { volume: 80, muted: false },
    onSound: tell("sound"),
    rate: 1,
    onRate: tell("rate"),
    youtubeControls: false,
    onYoutubeControls: tell("row"),
    youtubeUrl: (value) => `https://www.youtube.com/watch?v=x&t=${value}s`,
    fullscreen: false,
    onFullscreen: tell("fullscreen"),
    onToggle: tell("toggle"),
    onSeek: tell("seek"),
    onStep: tell("step"),
    ...changes,
  }
  return { node: (more: Partial<Props> = {}) => <Transport {...props} {...more} />, asked, playhead }
}

const named = (document: Document, name: string) => document.querySelector<HTMLElement>(`[aria-label="${name}"]`)
const key = (field: Element, name: string) =>
  act(async () => field.dispatchEvent(new window.KeyboardEvent("keydown", { key: name, bubbles: true })))

/** A row of a width, measured the way the component measures itself. */
const rowOf = (width: number) => (window: DOMWindow) => {
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, value: width })
  class ResizeObserver {
    constructor(private readonly tell: (entries: unknown[]) => void) {}
    observe() {
      this.tell([])
    }
    unobserve() {}
    disconnect() {}
  }
  return { ...popoverGlobals(), ResizeObserver }
}

test("the row plays, skips from the shown second, walks the marks and goes full screen", async () => {
  await inPage(async (document, render) => {
    const { node, asked, playhead } = await transportOf(4158)
    await render(node())
    const bar = document.querySelector('[role="toolbar"]')!
    assert.equal(bar.getAttribute("aria-label"), "Điều khiển video")
    await click(named(document, "Phát"))
    await click(named(document, "Lùi 10 giây"))
    await act(async () => playhead.set(13500))
    await click(named(document, "Tới 10 giây"))
    await act(async () => playhead.set(4))
    await click(named(document, "Lùi 10 giây"))
    await click(named(document, "Mốc trước"))
    await click(named(document, "Mốc sau"))
    await click(named(document, "Toàn màn hình"))
    await click(named(document, "Hàng nút của YouTube"))
    assert.deepEqual(
      asked.map(([name, value]) => [name, value].filter((part) => part !== undefined && typeof part !== "object")),
      [
        ["toggle"],
        ["seek", 4148],
        ["seek", 13504],
        ["seek", 0],
        ["step", -1],
        ["step", 1],
        ["fullscreen"],
        ["row", true],
      ],
    )

    await render(node({ playing: true, fullscreen: true, youtubeControls: true }))
    assert.ok(named(document, "Tạm dừng"))
    assert.ok(named(document, "Thoát toàn màn hình"))
    assert.equal(named(document, "Hàng nút của YouTube")!.getAttribute("aria-pressed"), "true")

    await render(node({ canPlay: false, onFullscreen: null }))
    assert.equal((named(document, "Phát") as HTMLButtonElement).disabled, true)
    assert.equal(named(document, "Toàn màn hình"), null, "where the browser has none")
  })
})

test("sound and speed change on the row", async () => {
  await inPage(async (document, render) => {
    const { node, asked } = await transportOf(0)
    const sounds = () => asked.filter(([name]) => name === "sound").map(([, sound]) => sound as Sound)
    await render(node())
    await click(named(document, "Tắt tiếng"))
    assert.deepEqual(sounds().at(-1), { volume: 80, muted: true })
    await render(node({ sound: { volume: 80, muted: true } }))
    const volume = named(document, "Âm lượng") as HTMLInputElement
    assert.equal(volume.value, "0")
    await click(named(document, "Bật tiếng"))
    assert.deepEqual(sounds().at(-1), { volume: 80, muted: false })
    await type(volume, "30")
    assert.deepEqual(sounds().at(-1), { volume: 30, muted: false }, "moving the volume gives the sound back")
    await render(node({ sound: { volume: 0, muted: false } }))
    await click(named(document, "Bật tiếng"))
    assert.deepEqual(sounds().at(-1), { volume: 100, muted: false })
    const speeds = named(document, "Tốc độ phát") as HTMLSelectElement
    assert.deepEqual(
      [...speeds.options].map((option) => option.value),
      ["2", "1.5", "1.25", "1", "0.75", "0.5"],
      "the fastest speed comes first",
    )
    await act(async () => speeds.focus())
    await choose(speeds, "1.5")
    assert.notEqual(document.activeElement, speeds, "the keys go back to the desk once a speed is chosen")
    assert.deepEqual(asked.at(-1), ["rate", 1.5])
  })
})

test("the speed list opened with the mouse and closed unchanged gives the next key to the desk", async () => {
  await inPage(async (document, render) => {
    const { node, asked } = await transportOf(0)
    await render(node())
    const speeds = named(document, "Tốc độ phát") as HTMLSelectElement
    await act(async () => speeds.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })))
    await act(async () => speeds.focus())
    const two = new window.KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true })
    await act(async () => speeds.dispatchEvent(two))
    assert.equal(two.defaultPrevented, true, "the list does not pick 2× by its name")
    assert.notEqual(document.activeElement, speeds)
    assert.equal(asked.length, 0)
  })
})

test("a press on the time takes a time to go to; Enter goes there and Esc returns", async () => {
  await inPage(async (document, render) => {
    const { node, asked } = await transportOf(4158)
    await render(node())
    const time = () => document.querySelector<HTMLElement>('[aria-label^="Vị trí"]')
    assert.equal(time()!.getAttribute("aria-label"), "Vị trí 1:09:18, bấm để gõ mốc cần tới")
    assert.equal(time()!.textContent, "1:09:18/ 3:45:04")

    await click(time())
    const field = () => named(document, "Mốc cần tới") as HTMLInputElement
    assert.equal(document.activeElement, field())
    await type(field(), "1:99")
    await key(field(), "Enter")
    assert.deepEqual(asked, [], "what is no time goes nowhere")
    assert.equal(field().getAttribute("aria-invalid"), "true")
    await type(field(), "52:34")
    await key(field(), "Enter")
    assert.deepEqual(asked, [["seek", 3154]])
    assert.equal(field(), null)

    await click(time())
    await type(field(), "9:99:99")
    await key(field(), "Escape")
    assert.equal(field(), null)
    await click(time())
    await type(field(), "9:00:00")
    await key(field(), "Enter")
    assert.deepEqual(asked.at(-1), ["seek", 13504], "not past the end of the video")
  })
})

test("the row says where the video is", async () => {
  await inPage(async (document, render) => {
    const { node, playhead } = await transportOf(4158)
    await render(node())
    const place = async (at: number) => {
      await act(async () => playhead.set(at))
      return document.querySelector(".esp-transport-place")!.textContent
    }
    assert.equal(await place(4158), "Ván 2 7:20")
    assert.equal(await place(3331), "Ván 2 cấm chọn")
    assert.equal(await place(3600), "Ván 2 chờ vào trận")
    assert.equal(await place(4800), "Ngoài ván, ván 3 sau 9:23")
    assert.equal(await place(9000), "Ngoài ván")
    const paused = { ...second, sync: { ...second.sync, pauses: [{ atSeconds: 440, durationSeconds: 95 }] } }
    await render(node({ chapters: [paused] }))
    assert.equal(await place(4200), "Ván 2 tạm dừng")
    const unplaced = { ...second, synced: false, live: false, draft: null, from: 0, start: 0, end: 0 }
    await render(node({ chapters: [unplaced, third], focusedGameId: "g2" }))
    assert.equal(await place(100), "Ván 2 chưa đặt mốc")
    await render(node({ chapters: [unplaced, third], focusedGameId: "g3" }))
    assert.equal(await place(100), "Ngoài ván, ván 3 sau 1:27:43")
    await render(node({ chapters: [] }))
    assert.equal(await place(100), "", "nothing is recorded yet")
    await render(node({ live: true }))
    assert.match(document.querySelector('[aria-label^="Vị trí"]')!.textContent!, /Trực tiếp$/)
  })
})

test("the link to YouTube names the second it opens at", async () => {
  await inPage(async (document, render) => {
    const { node, playhead } = await transportOf(4158)
    await render(node())
    assert.equal(
      named(document, "Mở trên YouTube lúc 1:09:18")!.getAttribute("href"),
      "https://www.youtube.com/watch?v=x&t=4158s",
    )
    await act(async () => playhead.set(4159.4))
    assert.ok(named(document, "Mở trên YouTube lúc 1:09:19"))
  })
})

for (const [width, inRow, inMenu] of [
  [760, ["Mốc trước", "Âm lượng", "Tốc độ phát", "Hàng nút của YouTube", "Toàn màn hình"], null],
  [660, ["Mốc trước", "Tắt tiếng", "Tốc độ phát", "Hàng nút của YouTube", "Toàn màn hình"], null],
  [
    500,
    ["Mốc trước", "Tắt tiếng", "Tốc độ phát", "Điều khiển khác"],
    ["Hàng nút của YouTube", "Mở trên YouTube lúc 1:09:18", "Toàn màn hình"],
  ],
  [
    390,
    ["Lùi 10 giây", "Phát", "Tới 10 giây", "Điều khiển khác"],
    [
      "Mốc trước",
      "Mốc sau",
      "Tắt tiếng",
      "Tốc độ phát 1×",
      "Hàng nút của YouTube",
      "Mở trên YouTube lúc 1:09:18",
      "Toàn màn hình",
    ],
  ],
] as const)
  test(`a row of ${width} px has each control once, in the row or in its menu`, async () => {
    await inPage(async (document, render) => {
      const { node, asked } = await transportOf(4158)
      await render(node())
      for (const label of inRow) assert.ok(named(document, label), `${label} in the row`)
      assert.equal(!!named(document, "Âm lượng"), width >= 700)
      if (!inMenu) return assert.equal(named(document, "Điều khiển khác"), null)

      for (const label of inMenu) assert.equal(named(document, label), null, `${label} not in the row`)
      await key(named(document, "Điều khiển khác")!, "Enter")
      const items = [...document.querySelectorAll('[role^="menuitem"]')]
      assert.deepEqual(
        items.map((item) => item.textContent?.trim()),
        [...inMenu],
      )
      await click(items.find((item) => item.textContent?.includes("Toàn màn hình")))
      assert.equal(asked.at(-1)![0], "fullscreen")
    }, rowOf(width))
  })

test("the strip seeks where it is pressed and dragged, not on every step", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await import("../src/features/esports/components/series/timeline/match-timeline")
    const seeks: number[] = []
    await render(
      <MatchTimeline
        playhead={createPlayhead(0)}
        duration={13504}
        chapters={CHAPTERS}
        events={onAxis([])}
        views={{ g2: game, g3: game }}
        focusedGameId="g2"
        activeId={null}
        lookups={lookups}
        onSeek={(value) => seeks.push(value)}
        onSelect={() => {}}
      />,
    )
    const strip = document.querySelector<HTMLElement>("[data-strip]")!
    strip.getBoundingClientRect = () => ({ left: 100, top: 0, width: 1000, height: 28 }) as DOMRect
    const pointer = (name: string, clientX: number) =>
      act(async () => strip.dispatchEvent(new window.MouseEvent(name, { bubbles: true, clientX, button: 0 })))
    await pointer("pointermove", 300)
    assert.deepEqual(seeks, [], "passing over it goes nowhere")
    await pointer("pointerdown", 600)
    assert.deepEqual(seeks, [6752])
    await pointer("pointermove", 610)
    await pointer("pointermove", 620)
    await pointer("pointermove", 650)
    assert.deepEqual(seeks, [6752], "the steps of a drag wait for each other")
    await pointer("pointerup", 700)
    assert.deepEqual(seeks, [6752, 8102], "the place it was let go at is the one")
    await pointer("pointerdown", 100)
    await pointer("pointerup", 100)
    assert.deepEqual(seeks, [6752, 8102, 0], "a press is one seek")
  })
})

test("a video of a whole day shows the match on the strip until all of it is asked for", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await import("../src/features/esports/components/series/timeline/match-timeline")
    const seeks: number[] = []
    await render(
      <MatchTimeline
        playhead={createPlayhead(4158)}
        duration={38200}
        chapters={CHAPTERS}
        events={onAxis([])}
        views={{ g2: game, g3: game }}
        focusedGameId="g2"
        activeId={null}
        lookups={lookups}
        onSeek={(value) => seeks.push(value)}
        onSelect={() => {}}
      />,
    )
    const strip = document.querySelector<HTMLElement>("[data-strip]")!
    strip.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 28 }) as DOMRect
    const press = (clientX: number) =>
      act(async () => {
        strip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX, button: 0 }))
        strip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX, button: 0 }))
      })
    const part = () =>
      [...document.querySelectorAll("button")].find(
        (entry) =>
          /^(Trận này|Cả video)$/.test(entry.textContent!) && entry.getAttribute("aria-label")!.startsWith("Thanh"),
      )!
    assert.equal(part().textContent, "Trận này")
    await press(0)
    assert.deepEqual(seeks, [3154 - 900], "fifteen minutes before the first game")
    await click(part())
    assert.equal(part().textContent, "Cả video")
    await press(1000)
    assert.equal(seeks.at(-1), 38200)
  })
})

test("the sound and the speed of a viewer are remembered", async () => {
  await inPage(async (document, render) => {
    const { useVideoSettings } = await import("../src/features/esports/components/game/use-video-settings")
    function Settings() {
      const { sound, setSound, rate, setRate } = useVideoSettings()
      return (
        <button type="button" onClick={() => (setSound({ volume: 35, muted: true }), setRate(1.25))}>
          {`${sound.volume} ${sound.muted} ${rate}`}
        </button>
      )
    }
    localStorage.setItem("esports:studio:sound", "{not json")
    await render(<Settings key="first" />)
    const text = () => document.querySelector("button")!.textContent
    assert.equal(text(), "100 false 1")
    await click(document.querySelector("button"))
    await render(<Settings key="second" />)
    assert.equal(text(), "35 true 1.25")
  })
})

test("the playhead of a match starts from a shared link, else from where this browser left it", async () => {
  await inPage(async (document, render) => {
    const { useMatchPlayhead, usePlayhead } = await import("../src/features/esports/components/game/use-playhead")
    function At({ link, video = "main" }: { link: number | null; video?: string }) {
      const playhead = useMatchPlayhead("s1", video, "main", link, 667)
      return <output>{usePlayhead(playhead)}</output>
    }
    const shown = () => document.querySelector("output")!.textContent
    await render(<At key="a" link={null} />)
    assert.equal(shown(), "667", "the first game when nothing is remembered")
    localStorage.setItem("aov-esports:playhead:v1:series:s1", "4158")
    localStorage.setItem("aov-esports:playhead:v1:series:s1:other", "12")
    await render(<At key="b" link={null} />)
    assert.equal(shown(), "4158")
    await render(<At key="c" link={90} />)
    assert.equal(shown(), "90")
    await render(<At key="d" link={null} video="other" />)
    assert.equal(shown(), "12", "another video of the match has its own place")
  })
})
