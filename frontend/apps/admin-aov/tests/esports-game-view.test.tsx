import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import { inPage, popoverGlobals, settle, game, lookups, events } from "./fixtures/esports-ui"

/** What the board of line-ups is given beside the game. */
const board = {
  game,
  events,
  lookups: { itemIcon: () => null, itemTier: () => null },
  locks: { decider: false, byTeam: new Map() },
  roster: () => [],
  picks: () => [],
}

test("the line-ups show kills, deaths, assists and items as of the playhead", async () => {
  await inPage(async (document, render) => {
    const { LineupBoard } = await import("../src/features/esports/components/game/lineup-board")
    await render(<LineupBoard {...board} at={100} />)
    const kda = (seat: string) => document.querySelector(`[data-seat="${seat}"] .esp-seat-kda`)?.textContent
    assert.equal(kda("BLUE:JUNGLE"), "0/0/0")
    await render(<LineupBoard {...board} at={200} />)
    assert.deepEqual([kda("BLUE:JUNGLE"), kda("BLUE:MID"), kda("RED:MID")], ["1/0/0", "0/0/1", "0/1/0"])
    assert.equal(document.querySelectorAll('[aria-label="Sách thánh"]').length, 0, "item bought later is not shown yet")
    await render(<LineupBoard {...board} at={310} />)
    const item = document.querySelector('[aria-label="Sách thánh"]')
    assert.ok(item)
    assert.equal(item.getAttribute("data-changed"), "true", "a purchase in the last 20 seconds is outlined")
    await render(<LineupBoard {...board} at={600} />)
    assert.equal(document.querySelector('[aria-label="Sách thánh"]')?.getAttribute("data-changed"), null)
  }, popoverGlobals)
})

const named = (document: Document, label: string) =>
  [...document.querySelectorAll("button")].filter((entry) => entry.textContent?.trim() === label).length

test("the list of moments hides edit controls in read-only mode", async () => {
  await inPage(async (document, render) => {
    const { MomentList } = await import("../src/features/esports/components/game/moment-list")
    const props = {
      game,
      events: [...events, { ...events[2], id: "equipment:BLUE:MID:0" }],
      now: 300,
      activeId: "k1",
      lookups,
      onSelect: () => {},
      youtubeLink: () => "https://www.youtube.com/watch?v=R5rCsGqDJIg&t=420s",
    }
    await render(<MomentList {...props} />)
    assert.equal(named(document, "Sửa") + named(document, "Xóa"), 0)
    assert.match(document.querySelector("a")?.getAttribute("href") ?? "", /t=420s$/)
    await render(<MomentList {...props} onEdit={() => {}} onDelete={() => {}} />)
    assert.deepEqual([named(document, "Sửa"), named(document, "Xóa")], [1, 1], "only the selected row can be changed")
    assert.equal(
      document.querySelector('[data-current="true"]')?.getAttribute("data-group"),
      "equipment:BLUE:MID:0",
      "the two purchases at 5:00 form the current block",
    )
    assert.equal(document.querySelector('[data-current="true"]')?.querySelectorAll("[data-event]").length, 2)
  }, popoverGlobals)
})

test("a moment shows its game time alone and is read out with both its clocks", async () => {
  await inPage(async (document, render) => {
    const { MomentList } = await import("../src/features/esports/components/game/moment-list")
    await render(
      <MomentList
        game={game}
        events={[events[0]]}
        now={300}
        activeId={null}
        lookups={lookups}
        onSelect={() => {}}
        videoAt={(event) => 3600 + event.at}
      />,
    )
    const row = document.querySelector('[data-event="k1"]')!
    assert.equal(row.querySelector(".esp-moment-time")?.textContent, "2:00")
    assert.doesNotMatch(row.textContent ?? "", /1:02:00/)
    assert.match(row.querySelector("button")?.getAttribute("aria-label") ?? "", /lúc 2:00 trong ván, ▸1:02:00$/)
  }, popoverGlobals)
})

test("the kills of one fight are counted over them", async () => {
  await inPage(async (document, render) => {
    const { MomentList } = await import("../src/features/esports/components/game/moment-list")
    const fight: TimelineEvent[] = [
      { id: "a", kind: "KILL", at: 120, killer: "BLUE:JUNGLE", victim: "RED:MID", assists: [] },
      { id: "b", kind: "KILL", at: 123, killer: "RED:JUNGLE", victim: "BLUE:MID", assists: [] },
      { id: "c", kind: "KILL", at: 126, killer: "BLUE:JUNGLE", victim: "RED:JUNGLE", assists: [] },
    ]
    await render(
      <MomentList game={game} events={fight} now={null} activeId={null} lookups={lookups} onSelect={() => {}} />,
    )
    assert.equal(document.querySelector(".esp-fight")?.textContent, "Giao tranh 2–1")
  }, popoverGlobals)
})

test("hero cards are the wiki reference card: wiki description and entry link, or a plain card when unknown", async () => {
  await inPage(async (document, render) => {
    const { LineupBoard } = await import("../src/features/esports/components/game/lineup-board")
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
        <LineupBoard {...board} at={200} />
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
