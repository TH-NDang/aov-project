import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { inPage, popoverGlobals, settle, game, lookups, events } from "./fixtures/esports-ui"

test("the scoreboard shows score, KDA and items as of the playhead", async () => {
  await inPage(async (document, render) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    await render(
      <Scoreboard game={game} events={events} at={200} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    assert.equal(document.querySelector('[aria-label="1 hạ gục"]')?.textContent, "1")
    assert.equal(document.querySelector('[aria-label="0 hạ gục"]')?.textContent, "0")
    assert.equal(document.querySelectorAll('[aria-label="Sách thánh"]').length, 0, "item bought later is not shown yet")
    await render(
      <Scoreboard game={game} events={events} at={310} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    const item = document.querySelector('[aria-label="Sách thánh"]')
    assert.ok(item)
    assert.equal(item.getAttribute("data-changed"), "true", "a purchase in the last 20 seconds is highlighted")
    await render(
      <Scoreboard game={game} events={events} at={600} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    assert.equal(document.querySelector('[aria-label="Sách thánh"]')?.getAttribute("data-changed"), null)
  })
})

test("the event feed hides edit controls in read-only mode", async () => {
  await inPage(async (document, render) => {
    const { EventFeed } = await import("../src/features/esports/components/game/event-feed")
    const props = {
      game,
      events: [...events, { ...events[2], id: "equipment:BLUE:MID:0" }],
      at: 300,
      activeId: null,
      filter: "ALL" as const,
      onFilter: () => {},
      follow: false,
      lookups,
      onSelect: () => {},
      onOpen: () => {},
      videoLink: () => "https://www.youtube.com/watch?v=R5rCsGqDJIg&t=420s",
    }
    await render(<EventFeed {...props} />)
    assert.equal(document.querySelectorAll('[aria-label="Sửa sự kiện"]').length, 0)
    assert.equal(document.querySelectorAll('[aria-label="Mở trên YouTube"]').length, 4)
    await render(<EventFeed {...props} onEdit={() => {}} onDelete={() => {}} />)
    assert.equal(document.querySelectorAll('[aria-label="Sửa sự kiện"]').length, 4)
    assert.equal(document.querySelectorAll('[aria-label="Xem chi tiết"]').length, 4)
    assert.equal(
      document.querySelector('[data-current="true"]')?.getAttribute("data-group"),
      "equipment:BLUE:MID:0",
      "the two purchases at 5:00 form the current block",
    )
    assert.equal(document.querySelector('[data-current="true"]')?.querySelectorAll("[data-event]").length, 2)
  })
})

test("every moment says which clock it shows: in-game timer and broadcast position", async () => {
  await inPage(async (document, render) => {
    const { EventFeed } = await import("../src/features/esports/components/game/event-feed")
    await render(
      <EventFeed
        game={game}
        events={[events[0]]}
        at={300}
        activeId={null}
        filter="ALL"
        onFilter={() => {}}
        follow={false}
        lookups={lookups}
        onSelect={() => {}}
        onOpen={() => {}}
        videoLink={() => null}
        videoAt={(event) => 3600 + event.at}
      />,
    )
    const row = document.querySelector('[data-event="k1"]')!
    const gameClock = row.querySelector('[data-time="game"]')!
    const videoClock = row.querySelector('[data-time="video"]')!
    assert.equal(gameClock.textContent, "⏱2:00")
    assert.match(gameClock.getAttribute("aria-label")!, /^Giờ trong trận/)
    assert.equal(
      videoClock.textContent,
      `${String.fromCodePoint(0x25b6, 0xfe0e)}1:02:00`,
      "the mark keeps text presentation instead of an emoji tile",
    )
    assert.match(videoClock.getAttribute("aria-label")!, /^Vị trí trên video/)
    assert.match(document.body.textContent ?? "", /giờ trong trận/)
  })
})

test("hero cards are the wiki reference card: wiki description and entry link, or a plain card when unknown", async () => {
  await inPage(async (document, render) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    const { ReferenceSourceProvider } = await import("../src/features/esports/components/game/entity-ref")
    const entities = [
      {
        id: "lauriel",
        kind: "hero" as const,
        translations: [{ locale: "vi-VN", name: "Lauriel", aliases: [], description: "Pháp sư lướt liên tục." }],
        destinations: { admin: "/hero/lauriel" },
      },
    ]
    await render(
      <ReferenceSourceProvider source={{ entities, context: "admin" }}>
        <Scoreboard
          game={game}
          events={events}
          at={200}
          focusSeat={null}
          onFocusSeat={() => {}}
          itemIcon={() => null}
        />
      </ReferenceSourceProvider>,
    )
    const known = document.querySelector<HTMLElement>('[aria-label="Tướng: Lauriel"]')!
    await act(async () => known.focus())
    await settle()
    let card = document.querySelector('[role="dialog"]')!
    assert.match(card.textContent ?? "", /Pháp sư lướt liên tục\./)
    assert.equal(card.querySelector("a")?.getAttribute("href"), "/hero/lauriel")
    assert.doesNotMatch(card.textContent ?? "", /Mid A/, "the card describes the hero, not the match")
    const window = document.defaultView!
    await act(async () => known.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    await settle()
    assert.equal(document.querySelector('[role="dialog"]'), null)

    const unknown = document.querySelector<HTMLElement>('[aria-label="Tướng: Nakroth"]')!
    await act(async () => unknown.focus())
    await settle()
    card = document.querySelector('[role="dialog"]')!
    assert.match(card.textContent ?? "", /Nakroth/)
    assert.match(card.textContent ?? "", /Chưa có mô tả/)
    assert.equal(card.querySelector("a"), null, "an entry missing from the wiki has no link")
  }, popoverGlobals)
})
