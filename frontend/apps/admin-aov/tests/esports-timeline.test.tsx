import assert from "node:assert/strict"
import { test } from "node:test"
import { act, type ReactNode } from "react"
import type { DOMWindow } from "jsdom"
import type { GameView } from "../src/features/esports/model/game-view"
import { createPlayhead } from "../src/features/esports/model/playhead"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import type { TimingIssue } from "../src/features/esports/model/timing-issues"
import { waitFor } from "./fixtures/dom"
import { inPage, game, lookups, events, chapter, onAxis } from "./fixtures/esports-ui"

const VIEWS = { g1: game }
const CHAPTERS: GameChapter[] = [chapter(0, 900)]
const timelineModule = () => import("../src/features/esports/components/series/timeline/match-timeline")

/** The span the track shows, which is the text of the button that turns to the whole video and back. */
const spanButton = (document: Document) => document.querySelector<HTMLButtonElement>('[aria-label^="Khoảng đang xem"]')!
const press = (element: HTMLElement) => act(async () => element.click())

/** A page whose boxes all have one size, which the track measures itself with. */
const sized = (width: number, height: number) => (window: DOMWindow) => {
  for (const [name, value] of Object.entries({ clientWidth: width, clientHeight: height }))
    Object.defineProperty(window.HTMLElement.prototype, name, { configurable: true, value })
  class ResizeObserver {
    constructor(private readonly tell: () => void) {}
    observe() {
      this.tell()
    }
    unobserve() {}
    disconnect() {}
  }
  return { ResizeObserver }
}

test("the timeline places markers by side, describes them for screen readers and seeks on selection", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const selected: string[] = []
    await render(
      <MatchTimeline
        duration={900}
        playhead={createPlayhead(300)}
        chapters={CHAPTERS}
        events={onAxis(events)}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.id)}
      />,
    )
    const markers = [...document.querySelectorAll<HTMLButtonElement>("[data-marker]")]
    assert.equal(markers.length, 3)
    const kill = markers.find((marker) => marker.dataset.kind === "KILL")!
    assert.equal(kill.dataset.side, "BLUE")
    assert.equal(kill.dataset.at, "120")
    assert.match(
      kill.getAttribute("aria-label") ?? "",
      /^2:00, Hạ gục: Nakroth \(Jg A\) hạ Tulen \(Mid B\), hỗ trợ: Mid A/,
    )
    assert.equal(kill.dataset.past, "true")
    assert.equal(markers.find((marker) => marker.dataset.kind === "OBJECTIVE")?.dataset.past, "false")
    await press(kill)
    assert.deepEqual(selected, ["g1|k1"])
    assert.equal(document.querySelector('[role="slider"]')?.getAttribute("aria-valuetext"), "5:00")
  })
})

test("two marks that would lie on each other share one that seeks to the first", async () => {
  await inPage(
    async (document, render) => {
      const { MatchTimeline } = await timelineModule()
      const selected: number[] = []
      await render(
        <MatchTimeline
          duration={900}
          playhead={createPlayhead(0)}
          chapters={CHAPTERS}
          events={onAxis([
            { id: "early-item", kind: "ITEM", at: 110, seat: "BLUE:MID", action: "BUY", slot: 1 },
            events[0],
          ])}
          views={VIEWS}
          focusedGameId="g1"
          activeId={null}
          lookups={lookups}
          editing={{ gameId: "g1", canCreate: true, onCreate: () => {}, onRetime: () => {} }}
          onSeek={() => {}}
          onSelect={(event) => selected.push(event.at)}
        />,
      )
      const markers = document.querySelectorAll<HTMLButtonElement>("[data-marker]")
      assert.equal(markers.length, 1)
      const marker = markers[0]!
      assert.match(marker.getAttribute("aria-label")!, /^1:50, .*, và 1 mốc nữa$/)
      assert.equal(marker.textContent, "2", "it says how many it holds")
      assert.equal(marker.hasAttribute("data-movable"), false, "several moments have no single second to move")
      await press(marker)
      assert.deepEqual(selected, [110], "the marker seeks to 1:50, not the later kill at 2:00")
    },
    sized(200, 100),
  )
})

test("the full video timeline exposes its actual duration and seeks chapters in video seconds", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const seeks: number[] = []
    await render(
      <MatchTimeline
        duration={20144}
        playhead={createPlayhead(640)}
        chapters={[]}
        flags={[{ id: "g2", at: 1800, label: "Vào trận ván 2" }]}
        events={[]}
        views={{}}
        focusedGameId={null}
        activeId={null}
        lookups={lookups}
        onSeek={(second) => seeks.push(second)}
        onSelect={() => {}}
      />,
    )
    const slider = document.querySelector<HTMLElement>('[role="slider"]')!
    assert.equal(slider.getAttribute("aria-valuemax"), "20144")
    assert.equal(slider.getAttribute("aria-valuetext"), "10:40")
    const range = () => spanButton(document).textContent
    assert.equal(range(), "1,5 giờ", "a long video without a game opens on about a quarter of it")
    assert.match(slider.style.width, /^calc\(373\.0\d*% - 28px\)$/)
    await press(document.querySelector<HTMLButtonElement>('[data-chapter="g2"]')!)
    assert.deepEqual(seeks, [1800])
    await press(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng ngắn hơn"]')!)
    assert.equal(range(), "1 giờ", "the span steps through round lengths of video")
    assert.equal(slider.getAttribute("aria-valuemax"), "20144", "zoom changes the width, never the video duration")
    await press(spanButton(document))
    assert.equal(slider.style.width, "calc(100% - 28px)")
    assert.equal(range(), "Cả video")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng dài hơn"]')!.disabled, true)
    const ticks = [...document.querySelectorAll("[data-tick]")]
    assert.equal(ticks.at(-1)?.textContent, "5:35:44")
    assert.ok(ticks.length <= 10)
    slider.getBoundingClientRect = () => ({ left: -200, width: 4000 }) as DOMRect
    await act(async () => slider.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 800 })))
    assert.deepEqual(seeks, [1800, 5036], "a scrolled timeline uses the track's actual position and width")
    await press(spanButton(document))
    assert.equal(range(), "1,5 giờ", "the same button leads back")
  })
})

test("the timeline names its rows and only an editor who is recording can record or move on the bar", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const created: [string, number][] = []
    const moved: [string, number][] = []
    const seeks: number[] = []
    const selected: string[] = []
    const stored = events.filter((event) => event.kind !== "ITEM")
    const chapters: GameChapter[] = [{ ...chapter(0, 900), events: stored }]
    const onVideo = onAxis(stored)
    const playhead = createPlayhead(300)
    const timeline = (editing: boolean, canCreate = true) => (
      <MatchTimeline
        duration={900}
        playhead={playhead}
        chapters={chapters}
        events={onVideo}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        editing={
          editing
            ? {
                gameId: "g1",
                canCreate,
                onCreate: (row, second) => created.push([row, second]),
                onRetime: (target, second) => moved.push([target.kind === "event" ? target.id : "turn", second]),
              }
            : undefined
        }
        onSeek={(second) => seeks.push(second)}
        onSelect={(event) => selected.push(event.id)}
      />
    )
    const pointer = (type: string, clientX: number, clientY = 0) =>
      new window.MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 })
    const slider = () => document.querySelector<HTMLElement>('[role="slider"]')!
    const measure = () => {
      slider().getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 158 }) as DOMRect
      return slider()
    }
    const hint = () => document.getElementById(slider().getAttribute("aria-describedby")!)!.textContent ?? ""

    await render(timeline(false))
    assert.deepEqual(
      [...document.querySelectorAll("[data-timeline-lanes] [data-row]")].map((lane) => lane.getAttribute("data-row")),
      ["BLUE", "SPINE", "RED"],
    )
    assert.match(document.querySelector('[data-row="BLUE"]')!.textContent ?? "", /AZU/)
    assert.match(document.querySelector('[data-row="RED"]')!.textContent ?? "", /CRI/)
    assert.match(hint(), /^Bấm để tua/)
    assert.doesNotMatch(hint(), /ghi|kéo/, "reading says nothing of recording")
    assert.equal(document.querySelectorAll("[data-movable]").length, 0)
    await act(async () => measure().dispatchEvent(pointer("dblclick", 450, 84)))
    assert.deepEqual(created, [], "a double click records nothing outside recording")

    await render(timeline(true))
    assert.match(hint(), /bấm đúp.*để ghi.*kéo mốc/)
    await act(async () => measure().dispatchEvent(pointer("dblclick", 450, 84)))
    await act(async () => measure().dispatchEvent(pointer("dblclick", 200, 40)))
    await act(async () => measure().dispatchEvent(pointer("dblclick", 600, 130)))
    assert.deepEqual(created, [
      ["SPINE", 450],
      ["BLUE", 200],
      ["RED", 600],
    ])

    // A press that barely moves is still a click; a real drag moves the marker and does not select it.
    const kill = document.querySelector<HTMLButtonElement>('[data-marker][data-kind="KILL"]')!
    assert.equal(kill.hasAttribute("data-movable"), true)
    await act(async () => kill.dispatchEvent(pointer("pointerdown", 120)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 122)))
    await act(async () => window.dispatchEvent(pointer("pointerup", 122)))
    await press(kill)
    assert.deepEqual(moved, [])
    assert.deepEqual(selected, ["g1|k1"])

    await act(async () => kill.dispatchEvent(pointer("pointerdown", 120)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 200)))
    assert.match(document.querySelector("[data-moving]")!.textContent ?? "", /2:00 → 3:20/)
    await act(async () => window.dispatchEvent(pointer("pointerup", 5000)))
    await press(kill)
    assert.deepEqual(moved, [["k1", 900]], "a drop past the end of the game lands on its last second")
    assert.deepEqual(selected, ["g1|k1"], "the click that ends a drag selects nothing")
    assert.equal(kill.style.left.includes("100%"), true, "the marker waits where it was dropped")

    // Alt and an arrow go on from where the marker waits, and write once the presses stop.
    await act(async () =>
      kill.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
    )
    assert.deepEqual(seeks, [200, 900, 899], "the video follows a marker while it moves and stays where it lands")
    await waitFor(() => moved.length === 2)
    assert.deepEqual(moved.at(-1), ["k1", 899])

    created.length = 0
    await render(timeline(true, false))
    await act(async () => measure().dispatchEvent(pointer("dblclick", 200, 40)))
    assert.deepEqual(created, [], "nothing is recorded before the game is live")
  })
})

test("a mark held at its edge moves with the pointer instead of jumping under it", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const moved: number[] = []
    await render(
      <MatchTimeline
        duration={900}
        playhead={createPlayhead(0)}
        chapters={[{ ...chapter(0, 900), events }]}
        events={onAxis(events)}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        editing={{ gameId: "g1", canCreate: true, onCreate: () => {}, onRetime: (_, second) => moved.push(second) }}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    document.querySelector<HTMLElement>('[role="slider"]')!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 900, height: 158 }) as DOMRect
    const kill = document.querySelector<HTMLButtonElement>('[data-kind="KILL"]')!
    const pointer = (type: string, clientX: number) =>
      new window.MouseEvent(type, { bubbles: true, clientX, button: 0 })
    await act(async () => kill.dispatchEvent(pointer("pointerdown", 130)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 150)))
    await act(async () => window.dispatchEvent(pointer("pointerup", 150)))
    assert.deepEqual(moved, [140], "gripped ten seconds after its own, it lands ten seconds before the pointer")
  })
})

/** Game 1 played from 5:00 to 15:00 of a video of 20 minutes, the video following the track, recording on. */
async function recordingTrack(document: Document, render: (node: ReactNode) => Promise<unknown>) {
  const { MatchTimeline } = await timelineModule()
  const playhead = createPlayhead(320)
  const moved: number[] = []
  const created: [string, number][] = []
  await render(
    <MatchTimeline
      duration={1200}
      playhead={playhead}
      chapters={[{ ...chapter(300, 900), events }]}
      events={onAxis(events).map((event) => ({ ...event, at: event.at + 300 }))}
      views={VIEWS}
      focusedGameId="g1"
      activeId={null}
      lookups={lookups}
      editing={{
        gameId: "g1",
        canCreate: true,
        onCreate: (row, second) => created.push([row, second]),
        onRetime: (_, second) => moved.push(second),
      }}
      onSeek={(second) => playhead.set(second)}
      onSelect={() => {}}
    />,
  )
  const slider = document.querySelector<HTMLElement>('[role="slider"]')!
  const measure = (left: number, width: number) =>
    (slider.getBoundingClientRect = () => ({ left, top: 0, width, height: 158 }) as DOMRect)
  measure(0, 1200)
  const pointer = (type: string, clientX: number, clientY = 0) =>
    new window.MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 })
  const scale = () => [spanButton(document).textContent, slider.style.width]
  return { playhead, moved, created, slider, measure, pointer, scale }
}

test("an edge dragged into another phase keeps the scale of the track until it is let go", async () => {
  await inPage(async (document, render) => {
    const { playhead, moved, pointer, scale } = await recordingTrack(document, render)
    const before = scale()
    const end = document.querySelector<HTMLElement>('[data-edge="gameEnd"]')!
    await act(async () => end.dispatchEvent(pointer("pointerdown", 900)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 1000)))
    assert.equal(playhead.get(), 1000, "the video follows the edge past the end of the game")
    assert.deepEqual(scale(), before, "the stretch after the game waits while the edge is held")
    await act(async () => window.dispatchEvent(pointer("pointerup", 1000)))
    assert.deepEqual(moved, [1000], "the edge lands on the second under the pointer")
    assert.notDeepEqual(scale(), before, "once let go, the track fits the stretch the video is in")
  })
})

test("a double click records at the second of its first press, though the track was fitted between the presses", async () => {
  await inPage(async (document, render) => {
    const { playhead, created, slider, measure, pointer } = await recordingTrack(document, render)
    await act(async () => slider.dispatchEvent(pointer("pointerdown", 1000, 130)))
    await act(async () => slider.dispatchEvent(pointer("pointerup", 1000, 130)))
    assert.equal(playhead.get(), 1000)
    // The first press took the video out of the game; the track now shows the stretch after it on another scale.
    measure(-400, 2400)
    await act(async () => slider.dispatchEvent(pointer("pointerdown", 1000, 130)))
    await act(async () => slider.dispatchEvent(pointer("pointerup", 1000, 130)))
    await act(async () => slider.dispatchEvent(pointer("dblclick", 1000, 130)))
    assert.deepEqual(created, [["RED", 1000]])
    assert.equal(playhead.get(), 1000, "the second press does not take the video elsewhere")
  })
})

test("a slow double click the browser still counts as one records at the second of its first press", async () => {
  await inPage(async (document, render) => {
    const { created, slider, measure, pointer } = await recordingTrack(document, render)
    // A person may set a slower double click than the usual half second; the browser pairs the presses all the same.
    const at = (event: MouseEvent, timeStamp: number) => Object.defineProperty(event, "timeStamp", { value: timeStamp })
    await act(async () => slider.dispatchEvent(at(pointer("pointerdown", 1000, 130), 1000)))
    await act(async () => slider.dispatchEvent(at(pointer("pointerup", 1000, 130), 1050)))
    measure(-400, 2400)
    await act(async () => slider.dispatchEvent(at(pointer("pointerdown", 1000, 130), 1800)))
    await act(async () => slider.dispatchEvent(at(pointer("pointerup", 1000, 130), 1850)))
    await act(async () => slider.dispatchEvent(at(pointer("dblclick", 1000, 130), 1860)))
    assert.deepEqual(created, [["RED", 1000]])
  })
})

test("a press on the track lands where it is let go, though the track fits the stretch it led into right after", async () => {
  await inPage(async (document, render) => {
    const { flushSync } = await import("react-dom")
    const { playhead, slider, pointer } = await recordingTrack(document, render)
    // The track measures itself, so a fit drawn before the release is read would put the pointer over another second.
    const width = () => (Number.parseFloat(slider.style.width.slice("calc(".length)) / 100) * 1200
    slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: width(), height: 158 }) as DOMRect
    const x = (second: number) => (second / 1200) * width()
    // A browser draws what one listener changed before it calls the next one; this listener draws the page there.
    const draw = () => flushSync(() => {})
    document.addEventListener("pointerup", draw, true)
    const pressed = x(1000)
    await act(async () => slider.dispatchEvent(pointer("pointerdown", pressed, 130)))
    await act(async () => slider.dispatchEvent(pointer("pointermove", pressed + 2, 130)))
    const released = Math.round(((pressed + 2) / width()) * 1200)
    await act(async () => slider.dispatchEvent(pointer("pointerup", pressed + 2, 130)))
    document.removeEventListener("pointerup", draw, true)
    assert.equal(playhead.get(), released)
  })
})

test("where the clocks of two games run over each other the texts of their ticks do not cover each other", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const second: GameChapter = { ...chapter(330, 1230), gameId: "g2", number: 2 }
    await render(
      <MatchTimeline
        duration={3600}
        playhead={createPlayhead(600)}
        chapters={[chapter(300, 1500), second]}
        events={[]}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    // Unmeasured, the track is drawn 800 px wide; the plane is that many times wider as the span is shorter.
    const slider = document.querySelector<HTMLElement>('[role="slider"]')!
    const zoom = Number.parseFloat(slider.style.width.slice("calc(".length)) / 100
    const plane = zoom * 800 - 28
    const texts = [...document.querySelectorAll<HTMLElement>("[data-tick]:not([data-end])")]
      .map((tick) => ({
        x: (Number.parseFloat(tick.style.left) / 100) * plane,
        half: tick.dataset.clock === "game" ? 18 : 28,
      }))
      .sort((a, b) => a.x - b.x)
    assert.ok(texts.length > 2)
    for (const [index, text] of texts.slice(1).entries())
      assert.ok(text.x - text.half >= texts[index]!.x + texts[index]!.half, "two texts of ticks overlap")
  })
})

test("where a game begins before the one before it ends, the later one names what follows", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const second: GameChapter = { ...chapter(900, 1800), gameId: "g2", number: 2 }
    await render(
      <MatchTimeline
        duration={3600}
        playhead={createPlayhead(1000)}
        chapters={[chapter(300, 1500), second]}
        events={[]}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    // A band stands at the share of the video it begins at, and is as wide as the share it runs for.
    const seconds = [...document.querySelectorAll<HTMLElement>(".esp-band")].map((band) => {
      const [left, width] = [band.style.left, band.style.width].map((share) => Number.parseFloat(share) * 36)
      return [band.querySelector("b")?.textContent, Math.round(left!), Math.round(left! + width!)]
    })

    assert.deepEqual(seconds, [
      ["Ván 1", 300, 900],
      ["Ván 2", 900, 1800],
    ])
  })
})

test("Alt and an arrow pressed three times move a mark three seconds with one write", async () => {
  await inPage(async (document, render) => {
    const { playhead, moved } = await recordingTrack(document, render)
    const kill = document.querySelector<HTMLButtonElement>('[data-marker][data-kind="KILL"]')!
    const nudge = () =>
      act(async () =>
        kill.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true })),
      )
    await nudge()
    await nudge()
    await nudge()
    assert.equal(playhead.get(), 423, "the video follows each press")
    assert.deepEqual(moved, [], "nothing is written while the presses go on")
    await waitFor(() => moved.length > 0)
    assert.deepEqual(moved, [423])
  })
})

test("the track shows the phase the video is in, and a span chosen by hand until the chosen game is asked for", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const drafted: GameChapter = {
      ...chapter(3718, 4520),
      from: 3154,
      draft: { start: 3154, locked: 3490, turns: [] },
    }
    const playhead = createPlayhead(3200)
    const chapters = [drafted]
    const onVideo = onAxis([])
    const timeline = (fit: number) => (
      <MatchTimeline
        duration={13504}
        playhead={playhead}
        chapters={chapters}
        events={onVideo}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        fit={fit}
        onSeek={() => {}}
        onSelect={() => {}}
      />
    )
    const span = () => spanButton(document).textContent
    await render(timeline(0))
    assert.equal(span(), "6 phút", "the draft with a little air around it")
    await act(async () => playhead.set(3600))
    assert.equal(span(), "10 phút", "the draft and the wait for the game")
    await act(async () => playhead.set(4158))
    assert.equal(span(), "14 phút", "the game")
    await act(async () => playhead.set(5000))
    assert.equal(span(), "22 phút", "ten minutes before and after between games")

    await act(async () => playhead.set(4158))
    await press(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng dài hơn"]')!)
    assert.equal(span(), "15 phút")
    await act(async () => playhead.set(5000))
    assert.equal(span(), "15 phút", "a span chosen by hand stays")
    await render(timeline(1))
    assert.equal(span(), "14 phút", "until the chosen game is asked for, wherever the video is")
  })
})

test("only games with a place in the video are on the timeline", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const unplaced: GameChapter = {
      ...chapter(0, 0),
      synced: false,
      live: false,
      draft: null,
      sync: { url: "", startSecond: null, pauses: [] },
      events,
    }
    await render(
      <MatchTimeline
        duration={13504}
        playhead={createPlayhead(700)}
        chapters={[unplaced]}
        events={[]}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    assert.equal(document.querySelectorAll("[data-marker], [data-part], [data-edge]").length, 0)
    assert.match(document.querySelector('[data-row="BLUE"]')!.textContent ?? "", /AZU/, "the lanes are still its sides")
    assert.equal(spanButton(document).textContent, "22 phút", "the track shows ten minutes around the playhead")
  })
})

test("the spine says what was played, paused and drafted, what is only a guess and what clashes", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const open: GameChapter = {
      ...chapter(300, 1200),
      from: 100,
      ended: false,
      draft: { start: 100, locked: 250, turns: [] },
      sync: { url: "", startSecond: 300, pauses: [{ atSeconds: 60, durationSeconds: 40 }] },
    }
    const playhead = createPlayhead(700)
    const chapters = [open]
    const timeline = (issues: TimingIssue[]) => (
      <MatchTimeline
        duration={2000}
        playhead={playhead}
        chapters={chapters}
        events={[]}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        issues={issues}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />
    )
    const part = (name: string) => {
      const found = document.querySelector<HTMLElement>(`[data-part="${name}"]`)
      const second = (share: string) => Math.round((Number.parseFloat(share) / 100) * 2000)
      return found && [second(found.style.left), second(found.style.left) + second(found.style.width)]
    }
    await render(timeline([]))
    assert.deepEqual(part("draft"), [100, 250])
    assert.deepEqual(part("wait"), [250, 300])
    assert.deepEqual(part("play"), [300, 700], "played as far as the video got")
    assert.deepEqual(part("guess"), [700, 1200], "the rest of the length it may have")
    assert.deepEqual(part("pause"), [360, 400])
    assert.equal(part("clash"), null)
    assert.equal(document.querySelector('[data-edge="gameEnd"]'), null, "a game without an end has none to drag")
    await act(async () => playhead.set(1500))
    assert.deepEqual(part("play"), [300, 1500], "a game longer than the guess plays on")
    assert.equal(part("guess"), null)

    await render(timeline([{ gameId: "g1", kind: "length", from: 1900, to: 2000, text: "Ván 1 dài hơn video." }]))
    assert.deepEqual(part("clash"), [1900, 2000])
  })
})

test("another game in view carries its own two teams, whichever side they play", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const { BLUE, RED } = game.sides
    const swapped: GameView = {
      ...game,
      id: "g2",
      number: 2,
      sides: { BLUE: { ...RED, side: "BLUE" }, RED: { ...BLUE, side: "RED" } },
    }
    const chapters: GameChapter[] = [chapter(0, 900), { ...chapter(1200, 2000), gameId: "g2", number: 2 }]
    const views = { g1: game, g2: swapped }
    const timeline = (focusedGameId: string) => (
      <MatchTimeline
        duration={2400}
        playhead={createPlayhead(100)}
        chapters={chapters}
        events={[]}
        views={views}
        focusedGameId={focusedGameId}
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />
    )
    const logos = (selector: string) =>
      [...document.querySelector(selector)!.querySelectorAll('[aria-label^="Logo"]')].map((logo) =>
        logo.getAttribute("aria-label"),
      )
    await render(timeline("g1"))
    assert.deepEqual(logos("[data-timeline-lanes]"), ["Logo Azure", "Logo Crimson"], "blue above, red below")
    assert.deepEqual(logos('[role="slider"]'), ["Logo Crimson", "Logo Azure"], "game 2 has them the other way round")
    await render(timeline("g2"))
    assert.deepEqual(logos("[data-timeline-lanes]"), ["Logo Crimson", "Logo Azure"])
    assert.deepEqual(logos('[role="slider"]'), ["Logo Azure", "Logo Crimson"])
  })
})

test("Tab stops once in a lane at what is nearest to the playhead, and up and down walk the lane", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const playhead = createPlayhead(290)
    await render(
      <MatchTimeline
        duration={900}
        playhead={playhead}
        chapters={CHAPTERS}
        events={onAxis(events)}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    const stops = () =>
      [...document.querySelectorAll<HTMLElement>('[data-walk][tabindex="0"]')].map(
        (mark) => mark.dataset.kind ?? mark.dataset.edge,
      )
    assert.deepEqual(stops().sort(), ["ITEM", "OBJECTIVE", "gameEnd"], "one in each lane and one on the spine")
    await act(async () => playhead.set(100))
    assert.ok(stops().includes("KILL"), "the stop follows the playhead")

    const item = document.querySelector<HTMLElement>('[data-kind="ITEM"]')!
    await act(async () => item.focus())
    assert.match(document.body.textContent ?? "", /Mid A mua Sách thánh 5:00/, "the band says what has the focus")
    const key = (name: string) => new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })
    await act(async () => document.activeElement!.dispatchEvent(key("ArrowUp")))
    assert.equal((document.activeElement as HTMLElement).dataset.kind, "KILL")
    await act(async () => document.activeElement!.dispatchEvent(key("ArrowDown")))
    assert.equal(document.activeElement, item)
  })
})

/** A page where the track is 800 px wide and as long as its zoom makes it, and scrolls like one. */
const scrolling = (window: DOMWindow) => {
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      const share = /calc\(([\d.]+)%/.exec(this.style.width)
      return share ? (Number(share[1]) / 100) * 800 - 28 : 800
    },
  })
  Object.defineProperty(window.HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value(this: HTMLElement, { left }: { left: number }) {
      this.scrollLeft = left
      this.dispatchEvent(new window.Event("scroll"))
    },
  })
  return {}
}

test("the view turns a page when the video plays out of it, but not after the editor scrolled away", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    const playhead = createPlayhead(3800)
    const chapters: GameChapter[] = [chapter(3718, 4520)]
    const timeline = (playing: boolean) => (
      <MatchTimeline
        duration={13504}
        playhead={playhead}
        chapters={chapters}
        events={[]}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        playing={playing}
        onSeek={() => {}}
        onSelect={() => {}}
      />
    )
    await render(timeline(true))
    const viewport = document.querySelector<HTMLElement>("[data-timeline-viewport]")!
    const plane = document.querySelector<HTMLElement>('[role="slider"]')!
    /** The first second in view, give or take what the margins of the track add. */
    const begins = (expected: number, message: string) => {
      const from = ((viewport.scrollLeft - 14) / plane.clientWidth) * 13504
      assert.ok(Math.abs(from - expected) <= 2, `${message}: ${from}, not ${expected}`)
    }
    const scroll = (second: number) =>
      act(async () => viewport.scrollTo({ left: 14 + (second / 13504) * plane.clientWidth }))
    const play = async (...seconds: number[]) => {
      for (const second of seconds) await act(async () => playhead.set(second))
    }
    begins(3686, "the game stands in the middle of its span")

    await press(document.querySelector<HTMLButtonElement>('[aria-label="Xem khoảng ngắn hơn"]')!)
    assert.equal(spanButton(document).textContent, "10 phút")
    begins(3500, "a span chosen by hand stands around the playhead")
    await play(4098, 4099)
    begins(3500, "nothing moves while the playhead is in view")
    await play(4099.8, 4100.6)
    begins(4071, "a new page begins a little before the playhead")

    await scroll(0)
    await play(4101, 4670, 4671, 4672)
    begins(4370, "a jump out of view brings the playhead back")
    await scroll(0)
    await play(4673, 4674)
    begins(0, "where the editor scrolled to, the view stays while the video plays")

    await scroll(4100)
    await render(timeline(false))
    await play(4699.5, 4701)
    begins(4100, "a paused video turns no page")
  }, scrolling)
})

test("the band names what has the focus until it leaves the view or the wheel is turned", async () => {
  await inPage(async (document, render) => {
    const { MatchTimeline } = await timelineModule()
    await render(
      <MatchTimeline
        duration={13504}
        playhead={createPlayhead(3800)}
        chapters={[chapter(3718, 4618)]}
        events={onAxis([{ ...events[0]!, at: 3838 }])}
        views={VIEWS}
        focusedGameId="g1"
        activeId={null}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
      />,
    )
    const band = () => document.querySelector(".esp-band-line")?.textContent ?? null
    const viewport = document.querySelector<HTMLElement>("[data-timeline-viewport]")!
    const mark = document.querySelector<HTMLElement>("[data-marker]")!
    const here = viewport.scrollLeft
    assert.equal(band(), null)
    await act(async () => mark.focus())
    assert.match(band()!, / 2:00$/)
    await act(async () => viewport.scrollTo({ left: here + 4000 }))
    assert.equal(band(), null, "what is out of the view has no place in the band")
    await act(async () => viewport.scrollTo({ left: here }))
    assert.match(band()!, / 2:00$/)
    const wheel = new document.defaultView!.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 })
    await act(async () => mark.dispatchEvent(wheel))
    assert.equal(band(), null, "what was pointed at is not under the pointer any more")
  }, scrolling)
})
