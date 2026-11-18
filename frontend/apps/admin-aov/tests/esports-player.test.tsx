import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act } from "react"
import type { VodPlayerHandle } from "../src/features/esports/components/game/vod-player"
import { waitFor } from "./fixtures/dom"
import { inPage, mockYouTube, type } from "./fixtures/esports-ui"

test("video seeks wait for readiness and apply the latest requested second without starting playback", async () => {
  await inPage(async (_document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    const ref = React.createRef<VodPlayerHandle>()
    const readings: number[] = []
    await render(
      <VodPlayer
        ref={ref}
        videoId="R5rCsGqDJIg"
        startAt={95}
        title="Game"
        onTime={(time) => readings.push(time)}
        onPlayingChange={() => {}}
      />,
    )

    await act(async () => ref.current!.seek(335))
    const player = instances[0]
    assert.equal(player.vars.start, 95)
    assert.equal(player.vars.autoplay, 0)
    assert.equal(ref.current!.currentTime(), null, "an unready player must not report the default zero time")
    await act(async () => ref.current!.seek(830))
    assert.deepEqual(player.seeks, [], "API methods can exist before YouTube accepts commands")

    await act(async () => player.events.onReady({ target: player }))
    assert.deepEqual(player.seeks, [830])
    assert.equal(player.plays, 0)
    assert.equal(player.pauses, 1)
    player.time = 830
    assert.equal(ref.current!.currentTime(), 830)

    await act(async () => ref.current!.seek(550))
    assert.deepEqual(player.seeks, [830, 550])
    assert.equal(player.plays, 0, "seeking a paused player keeps it paused")
    assert.equal(player.pauses, 1)

    // A video that was never played draws nothing when paused at once: it starts muted and stops on its first frame.
    player.state = 5
    await act(async () => ref.current!.seek(600))
    await act(async () => ref.current!.seek(610))
    assert.deepEqual([player.plays, player.pauses, player.muted], [0, 1, true])
    await act(async () => player.events.onStateChange({ data: 1 }))
    assert.deepEqual(
      [player.pauses, player.muted],
      [2, false],
      "the frame is shown, the video waits, the sound is back",
    )
    await act(async () => player.events.onStateChange({ data: 1 }))
    assert.equal(player.pauses, 2, "playing later is not stopped again")
    assert.deepEqual(readings, [], "a requested time must not be reported as an observed video position")
  })
})

test("seeking while the video starts keeps the latest time and the pending play request", async () => {
  await inPage(async (_document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    const ref = React.createRef<VodPlayerHandle>()
    await render(
      <VodPlayer
        ref={ref}
        videoId="R5rCsGqDJIg"
        startAt={95}
        title="Game"
        onTime={() => {}}
        onPlayingChange={() => {}}
      />,
    )
    await act(async () => ref.current!.toggle())
    await act(async () => ref.current!.seek(550))
    const player = instances[0]
    await act(async () => player.events.onReady({ target: player }))
    assert.deepEqual(player.seeks, [550])
    assert.equal(player.plays, 1)
    assert.equal(player.pauses, 0)
  })
})

test("the player reports duration and floats without replacing or seeking the active video", async () => {
  await inPage(async (document, render) => {
    const previous = globalThis.IntersectionObserver
    let visibility: IntersectionObserverCallback
    let disconnected = false
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        visibility = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    } as unknown as typeof IntersectionObserver
    try {
      const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
      const instances = mockYouTube()
      const durations: number[] = []
      await render(
        <VodPlayer
          videoId="R5rCsGqDJIg"
          startAt={95}
          title="Game"
          onTime={() => {}}
          onPlayingChange={() => {}}
          onDuration={(second) => durations.push(second)}
        />,
      )
      const player = instances[0]
      await act(async () => player.events.onReady({ target: player }))
      assert.deepEqual(durations, [20144])
      assert.equal(player.plays, 0)
      const host = document.querySelector('[title="Game"]')!
      const changeVisibility = async (isIntersecting: boolean, bottom: number) =>
        act(async () => {
          visibility!(
            [{ isIntersecting, boundingClientRect: { bottom } } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          )
        })
      await changeVisibility(false, 600)
      assert.equal(document.querySelector("[data-floating]"), null, "a video below the viewport does not float")
      await changeVisibility(false, -1)
      assert.ok(document.querySelector("[data-floating]"))
      assert.equal(document.querySelector('[title="Game"]'), host)
      assert.equal(instances.length, 1)
      assert.deepEqual(player.seeks, [])

      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng video nổi"]')!.click())
      assert.equal(document.querySelector("[data-floating]"), null)
      await changeVisibility(true, 300)
      await changeVisibility(false, -1)
      assert.ok(document.querySelector("[data-floating]"), "floating resumes after returning to the main video")
      let returned = false
      document.querySelector<HTMLElement>("[data-video-placeholder]")!.scrollIntoView = () => {
        returned = true
      }
      await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Quay về video lớn"]')!.click())
      assert.equal(returned, true)
      await changeVisibility(true, 300)
      assert.equal(document.querySelector("[data-floating]"), null)
      assert.equal(document.querySelector('[title="Game"]'), host)
      await render(null)
      assert.equal(disconnected, true)
    } finally {
      if (previous) globalThis.IntersectionObserver = previous
      else Reflect.deleteProperty(globalThis, "IntersectionObserver")
    }
  })
})

test("the player uses its own controls below the video instead of YouTube's", async () => {
  await inPage(async (document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    await render(
      <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
    )
    const player = instances[0]
    assert.equal(player.vars.controls, 0, "YouTube's control bar is hidden")
    await act(async () => player.events.onReady({ target: player }))

    const bar = document.querySelector('[aria-label="Điều khiển video"]')!
    assert.equal(bar.closest('[title="Game"]'), null, "controls sit beside the video frame, never over it")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Phát"]')!.click())
    assert.equal(player.plays, 1)

    const seek = document.querySelector<HTMLInputElement>('[aria-label="Vị trí video"]')!
    assert.equal(seek.max, "20144", "the seek bar spans the real video")
    type(seek, "600")
    assert.deepEqual(player.seeks, [], "dragging the bar does not seek on every step")
    await act(async () => seek.dispatchEvent(new document.defaultView!.Event("pointerup", { bubbles: true })))
    assert.deepEqual(player.seeks, [600])

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Tới 10 giây"]')!.click())
    assert.deepEqual(player.seeks, [600, 105], "skips from the shown position")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Tắt tiếng"]')!.click())
    assert.equal(player.muted, true)
    const speed = document.querySelector<HTMLSelectElement>('[aria-label="Tốc độ phát"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(document.defaultView!.HTMLSelectElement.prototype, "value")!.set!.call(
        speed,
        "1.5",
      )
      speed.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }))
    })
    assert.deepEqual(player.rates, [1.5])
  })
})

test("the floating player can be dragged anywhere in the window and keeps its place", async () => {
  await inPage(async (document, render) => {
    const previous = globalThis.IntersectionObserver
    let visibility: IntersectionObserverCallback
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        visibility = callback
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver
    try {
      const window = document.defaultView!
      window.localStorage.removeItem("esports:mini-player-position")
      const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
      mockYouTube()
      await render(
        <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
      )
      await act(async () =>
        visibility!(
          [{ isIntersecting: false, boundingClientRect: { bottom: -1 } } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      )
      const floating = document.querySelector<HTMLElement>("[data-floating]")!
      const handle = floating.querySelector<HTMLElement>('[role="toolbar"]')!
      const pointer = (type: string, x: number, y: number) =>
        act(async () => {
          handle.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
        })
      await pointer("pointerdown", 10, 10)
      await pointer("pointermove", 300, 200)
      await pointer("pointerup", 300, 200)
      assert.equal(floating.style.left, "290px")
      assert.equal(floating.style.top, "190px")
      assert.deepEqual(JSON.parse(window.localStorage.getItem("esports:mini-player-position")!), { x: 290, y: 190 })

      await act(async () =>
        handle.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })),
      )
      assert.equal(floating.style.left, "290px", "plain arrows stay video shortcuts")
      await act(async () =>
        handle.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
      )
      assert.equal(floating.style.left, "266px", "Alt + arrows move it")
      await pointer("pointerdown", 0, 0)
      await pointer("pointermove", -500, 5000)
      await pointer("pointerup", -500, 5000)
      assert.equal(floating.style.left, "8px", "it never leaves the window")
      assert.equal(floating.style.top, `${window.innerHeight - 8}px`)
    } finally {
      if (previous) globalThis.IntersectionObserver = previous
      else Reflect.deleteProperty(globalThis, "IntersectionObserver")
    }
  })
})

test("clicking into the video hands keyboard focus back so page shortcuts keep working", async () => {
  await inPage(async (document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    mockYouTube()
    await render(
      <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
    )
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

test("the captions button brings back YouTube's own controls, where captions are switched, and hides them again", async () => {
  await inPage(async (document, render) => {
    const { VodPlayer } = await import("../src/features/esports/components/game/vod-player")
    const instances = mockYouTube()
    await render(
      <VodPlayer videoId="R5rCsGqDJIg" startAt={95} title="Game" onTime={() => {}} onPlayingChange={() => {}} />,
    )
    const first = instances[0]
    await act(async () => first.events.onReady({ target: first }))
    const button = () => document.querySelector<HTMLButtonElement>("[aria-pressed]")!
    assert.equal(button().getAttribute("aria-label"), "Phụ đề: hiện điều khiển của YouTube")
    assert.equal(button().getAttribute("aria-pressed"), "false")

    // Only a new player can show YouTube's bar; it continues at the same second and stays paused.
    await act(async () => button().click())
    const second = instances[1]
    assert.equal(first.destroyed, true)
    assert.equal(second.vars.controls, 1)
    assert.equal(second.vars.start, 95)
    await act(async () => second.events.onReady({ target: second }))
    assert.deepEqual(second.seeks, [95])
    assert.equal(second.plays, 0)
    assert.equal(button().getAttribute("aria-label"), "Ẩn điều khiển của YouTube")
    assert.match(document.querySelector('[aria-label="Điều khiển video"]')!.textContent ?? "", /hàng nút trên video/)

    await act(async () => button().click())
    assert.equal(instances[2].vars.controls, 0)
    assert.doesNotMatch(
      document.querySelector('[aria-label="Điều khiển video"]')!.textContent ?? "",
      /hàng nút trên video/,
    )
  })
})
