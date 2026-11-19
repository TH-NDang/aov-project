import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { VIDEO_MARK } from "../src/features/esports/model/vod"
import { waitFor } from "./fixtures/dom"
import { inPage, game, lookups, events, chapter, onAxis, popoverGlobals } from "./fixtures/esports-ui"

test("the timeline places markers by side, describes them for screen readers and seeks on selection", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const selected: string[] = []
    await render(
      <BroadcastTimeline
        duration={900}
        current={300}
        chapters={[chapter(0, 900)]}
        events={onAxis(events)}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.id)}
        onOpen={() => {}}
      />,
    )
    const markers = [...document.querySelectorAll<HTMLButtonElement>("[data-marker]")]
    assert.equal(markers.length, 3)
    const kill = markers.find((marker) => marker.dataset.kind === "KILL")!
    assert.equal(kill.dataset.side, "BLUE")
    assert.equal(kill.dataset.at, "120")
    assert.match(
      kill.getAttribute("aria-label") ?? "",
      /2:00 · Hạ gục: Nakroth \(Jg A\) hạ Tulen \(Mid B\) · hỗ trợ: Mid A/,
    )
    assert.equal(markers.find((marker) => marker.dataset.kind === "OBJECTIVE")?.dataset.past, "false")
    await act(async () => kill.click())
    assert.deepEqual(selected, ["g1|k1"])
    assert.equal(document.querySelector('[role="slider"]')?.getAttribute("aria-valuetext"), "5:00")
  })
})

test("a timeline cluster seeks to its displayed start even when a later kill represents it", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const selected: number[] = []
    await render(
      <BroadcastTimeline
        duration={900}
        current={0}
        chapters={[chapter(0, 900)]}
        events={onAxis([
          { id: "early-item", kind: "ITEM", at: 110, seat: "BLUE:MID", action: "BUY", slot: 1 },
          events[0],
        ])}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.at)}
        onOpen={() => {}}
      />,
    )
    const marker = document.querySelector<HTMLButtonElement>("[data-marker]")!
    assert.equal(document.querySelectorAll("[data-marker]").length, 1)
    assert.equal(marker.dataset.kind, "KILL")
    assert.match(marker.getAttribute("aria-label")!, /^1:50 ·/)
    await act(async () => marker.click())
    assert.deepEqual(selected, [110], "the marker seeks to 1:50, not the later kill at 2:00")
  })
})

test("the full video timeline exposes its actual duration and seeks chapters in video seconds", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const seeks: number[] = []
    await render(
      <BroadcastTimeline
        duration={20144}
        current={640}
        chapters={[]}
        flags={[{ id: "g2", at: 1800, label: "Bắt đầu ván 2" }]}
        events={[]}
        views={{}}
        chapterTitle={() => ""}
        focusedGameId={null}
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={(second) => seeks.push(second)}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    )
    const slider = document.querySelector('[role="slider"]')!
    assert.equal(slider.getAttribute("aria-valuemax"), "20144")
    assert.equal(slider.getAttribute("aria-valuetext"), "10:40")
    const range = () => document.querySelector('[aria-label="Phạm vi đang xem"]')?.textContent
    assert.equal(range(), "1,5 giờ", "a long video without a game opens on about a quarter of it")
    assert.match((slider as HTMLElement).style.width, /^calc\(373\.0\d*% - 28px\)$/)
    assert.equal(document.querySelector(".esp-track-ticks")?.lastElementChild?.textContent, "5:35:44")
    assert.ok(document.querySelectorAll(".esp-track-ticks > span").length <= 10)
    await act(async () => document.querySelector<HTMLButtonElement>('[data-chapter="g2"]')!.click())
    assert.deepEqual(seeks, [1800])
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Phóng to timeline"]')!.click())
    assert.equal(range(), "1 giờ", "the span steps through round lengths of video")
    assert.equal(slider.getAttribute("aria-valuemax"), "20144", "zoom changes the width, never the video duration")
    const fit = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Toàn video",
    )!
    await act(async () => fit.click())
    assert.equal((slider as HTMLElement).style.width, "calc(100% - 28px)")
    assert.equal(range(), "Cả video")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Thu nhỏ timeline"]')!.disabled, true)
    slider.getBoundingClientRect = () => ({ left: -200, width: 4000 }) as DOMRect
    await act(async () => slider.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 800 })))
    assert.deepEqual(seeks, [1800, 5036], "a scrolled timeline uses the track's actual position and width")
  })
})

test("the timeline names its rows and only an editor who is recording can record or move on the bar", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const created: [string, number | undefined][] = []
    const moved: [string, number][] = []
    const seeks: number[] = []
    const selected: string[] = []
    const stored = events.filter((event) => event.kind !== "ITEM")
    const live = { ...chapter(0, 900), events: stored }
    const timeline = (editing: boolean, canCreate = true) => (
      <BroadcastTimeline
        duration={900}
        current={300}
        chapters={[live]}
        events={onAxis(stored)}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
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
        onOpen={() => {}}
      />
    )
    const pointer = (type: string, clientX: number, clientY = 0) =>
      new window.MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 })
    const measure = () => {
      const slider = document.querySelector<HTMLElement>('[role="slider"]')!
      slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 158 }) as DOMRect
      return slider
    }

    await render(timeline(false))
    assert.deepEqual(
      [...document.querySelectorAll("[data-timeline-lanes] [data-row]")].map((lane) => lane.getAttribute("data-row")),
      ["BLUE", "MID", "RED"],
    )
    assert.match(document.querySelector("[data-timeline-lanes]")!.textContent ?? "", /Mục tiêu/)
    assert.match(document.querySelector("[data-timeline-hint]")!.textContent ?? "", /Bấm vào thanh để tua/)
    assert.equal(document.querySelectorAll("[data-add]").length, 0, "reading shows no way to record")
    assert.equal(document.querySelectorAll("[data-movable]").length, 0)
    await act(async () => measure().dispatchEvent(pointer("dblclick", 450, 84)))
    assert.deepEqual(created, [], "a double click records nothing outside recording")

    await render(timeline(true))
    assert.match(
      document.querySelector("[data-timeline-hint]")!.textContent ?? "",
      /bấm đúp.*kéo mốc hoặc mép vùng cấm chọn của ván 1.*video tua theo/,
    )
    assert.equal(document.querySelectorAll("[data-add]").length, 3)
    await act(async () => document.querySelector<HTMLButtonElement>('[data-add="RED"]')!.click())
    await act(async () => measure().dispatchEvent(pointer("dblclick", 450, 84)))
    await act(async () => measure().dispatchEvent(pointer("dblclick", 200, 40)))
    assert.deepEqual(created, [
      ["RED", undefined],
      ["MID", 450],
      ["BLUE", 200],
    ])

    // A press that barely moves is still a click; a real drag moves the marker and does not select it.
    const kill = document.querySelector<HTMLButtonElement>('[data-marker][data-kind="KILL"]')!
    assert.equal(kill.hasAttribute("data-movable"), true)
    await act(async () => kill.dispatchEvent(pointer("pointerdown", 120)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 122)))
    await act(async () => window.dispatchEvent(pointer("pointerup", 122)))
    await act(async () => kill.click())
    assert.deepEqual(moved, [])
    assert.deepEqual(selected, ["g1|k1"])

    await act(async () => kill.dispatchEvent(pointer("pointerdown", 120)))
    await act(async () => window.dispatchEvent(pointer("pointermove", 200)))
    assert.match(document.querySelector("[data-moving]")!.textContent ?? "", /2:00 → 3:20/)
    await act(async () => window.dispatchEvent(pointer("pointerup", 5000)))
    await act(async () => kill.click())
    assert.deepEqual(moved, [["k1", 900]], "a drop past the end of the game lands on its last second")
    assert.deepEqual(selected, ["g1|k1"], "the click that ends a drag selects nothing")
    assert.equal(kill.style.left.includes("100%"), true, "the marker waits where it was dropped")

    await act(async () =>
      kill.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })),
    )
    assert.deepEqual(moved.at(-1), ["k1", 119])
    assert.deepEqual(seeks, [200, 900, 119], "the video follows a marker while it moves and stays where it lands")

    await render(timeline(true, false))
    assert.equal(document.querySelector<HTMLButtonElement>('[data-add="BLUE"]')!.disabled, true)
    assert.match(document.querySelector("[data-timeline-hint]")!.textContent ?? "", /vào trận rồi mới ghi/)
  })
})

test("the track names each game and its turns, follows the pointer and seeks from the overview", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const window = document.defaultView!
    const seeks: number[] = []
    const drafted = {
      ...chapter(100, 1000),
      from: 0,
      draft: {
        start: 0,
        locked: 80,
        turns: [
          { order: 1, kind: "BAN" as const, side: "BLUE" as const, hero: { id: "aoi", name: "Aoi" }, atSecond: 20 },
          { order: 2, kind: "PICK" as const, side: "RED" as const, hero: { name: "Murad" }, atSecond: 40 },
        ],
      },
    }
    await render(
      <BroadcastTimeline
        duration={1200}
        current={400}
        chapters={[drafted]}
        events={[]}
        views={{ g1: game }}
        chapterTitle={() => "AZU thắng"}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={(second) => seeks.push(second)}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    )
    assert.equal(document.querySelector(".esp-bt-band-label")?.textContent, "Ván 1⏱ 15:00AZU thắng")
    const turns = [...document.querySelectorAll<HTMLButtonElement>(".esp-bt-turn")]
    assert.deepEqual(
      turns.map((turn) => turn.getAttribute("aria-label")),
      ["Ván 1 · lượt 1 · cấm · Azure · Aoi · 0:20", "Ván 1 · lượt 2 · chọn · Crimson · Murad · 0:40"],
    )
    assert.ok(turns[0]!.querySelector(".esp-bt-turn-ban"), "a ban carries its mark")
    assert.equal(turns[1]!.querySelector(".esp-bt-turn-ban"), null)
    assert.equal(document.querySelector(".esp-bt-playhead")?.textContent, "V1 ⏱ 5:00")

    const track = document.querySelector<HTMLElement>('[role="slider"]')!
    track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 158 }) as DOMRect
    await act(async () => track.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 600 })))
    assert.equal(document.querySelector(".esp-bt-scrub")?.textContent, `${VIDEO_MARK} 10:00 · V1 ⏱ 8:20`)
    await act(async () =>
      track.dispatchEvent(new window.MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })),
    )
    assert.equal(document.querySelectorAll(".esp-bt-scrub").length, 0, "the pointer label leaves with the pointer")

    const overview = document.querySelector<HTMLElement>(".esp-bt-overview")!
    overview.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 20 }) as DOMRect
    await act(async () => overview.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 150 })))
    assert.deepEqual(seeks, [300], "a quarter of the overview is a quarter of the video")
  })
})

test("the span follows the focused game until another is picked, and fitting the game brings it back", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    await render(
      <BroadcastTimeline
        duration={20000}
        current={1000}
        chapters={[chapter(600, 1500)]}
        events={[]}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    )
    const range = () => document.querySelector('[aria-label="Phạm vi đang xem"]')?.textContent
    const named = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((entry) => entry.textContent?.trim() === label)!
    assert.equal(range(), "20 phút", "a fifteen-minute game opens on twenty minutes")
    await act(async () => named("Toàn video").click())
    assert.equal(range(), "Cả video")
    await act(async () => named("Vừa ván 1").click())
    assert.equal(range(), "20 phút")
  })
})

test("a marker's card opens on hover, goes to the moment and opens its details", async () => {
  await inPage(async (document, render) => {
    const { BroadcastTimeline } = await import("../src/features/esports/components/series/broadcast-timeline")
    const window = document.defaultView!
    const selected: string[] = []
    const opened: string[][] = []
    await render(
      <BroadcastTimeline
        duration={900}
        current={0}
        chapters={[chapter(0, 900)]}
        events={onAxis(events)}
        views={{ g1: game }}
        chapterTitle={() => ""}
        focusedGameId="g1"
        activeId={null}
        isDimmed={() => false}
        lookups={lookups}
        onSeek={() => {}}
        onSelect={(event) => selected.push(event.id)}
        onOpen={(cluster) => opened.push(cluster.events.map((event) => event.id))}
      />,
    )
    const kill = document.querySelector<HTMLButtonElement>('[data-marker][data-kind="KILL"]')!
    await act(async () =>
      kill.dispatchEvent(new window.MouseEvent("pointerover", { bubbles: true, relatedTarget: document.body })),
    )
    const inCard = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((entry) => entry.textContent?.includes(label))
    await waitFor(() => inCard("Tới mốc này"), "the card of the kill opens")
    await act(async () => inCard("Tới mốc này")!.click())
    await act(async () => inCard("Xem chi tiết")!.click())
    assert.deepEqual(selected, ["g1|k1"])
    assert.deepEqual(opened, [["g1|k1"]])
  }, popoverGlobals)
})
