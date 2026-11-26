import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { GameContent } from "@aov/community-contracts"
import { readTimeline } from "../src/features/esports/model/timeline-io"
import { click, flush, render, type, waitFor, withDom } from "./fixtures/dom"
import { deskOf, recordedGame, selection, type DeskOptions } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })

const { MomentsTool } = await import("../src/features/esports/pages/tools/moments-tool")
const { deleteMoment, moveMoment, saveMoment } = await import("../src/features/esports/pages/tools/moment-actions")

const objective = (
  id: string,
  atSeconds: number,
  side: "BLUE" | "RED",
  kind: "TURRET" | "ABYSSAL_DRAGON" = "TURRET",
) => ({
  id,
  atSeconds,
  kind: "OBJECTIVE" as const,
  side,
  objective: kind,
})
const withMoments = (...events: NonNullable<GameContent["timeline"]>["events"]) =>
  recordedGame({ timeline: { pauses: [], events } })

async function tool(options: DeskOptions = {}) {
  const desk = deskOf(options)
  await render(<desk.kept.Host>{(current) => <MomentsTool desk={current} />}</desk.kept.Host>)
  return desk.kept
}
const key = (objective: string, side: "BLUE" | "RED") =>
  document.querySelector<HTMLButtonElement>(`.esp-pad-key[data-objective="${objective}"][data-side="${side}"]`)!
const named = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("button, a")].find(
    (entry) => entry.textContent?.trim() === label || entry.getAttribute("aria-label") === label,
  )
const row = (id: string) => document.querySelector<HTMLElement>(`[data-event="${id}"]`)!

test("a key records the objective of its side at the second on screen, and says so", async () => {
  const kept = await tool({ at: 4158.9 })
  await click(key("TURRET", "RED"))
  const [event] = readTimeline(kept.content())
  assert.deepEqual(
    { ...event, id: "" },
    { id: "", kind: "OBJECTIVE", at: 440, side: "RED", objective: "TURRET", by: undefined, note: undefined },
    "1:09:18 of the video is 7:20 of game 2",
  )
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi Trụ của CRI lúc 7:20")
})

test("the count of a key is the one at the playhead", async () => {
  const kept = await tool({ content: withMoments(objective("a", 100, "BLUE"), objective("b", 600, "BLUE")) })
  assert.equal(key("TURRET", "BLUE").querySelector("b")?.textContent, "1")
  await act(async () => kept.play(3718 + 700))
  assert.equal(key("TURRET", "BLUE").querySelector("b")?.textContent, "2")
})

test("the same key pressed again at once is one press; another key is another", async () => {
  const kept = await tool()
  await click(key("TURRET", "RED"))
  await click(key("TURRET", "RED"))
  assert.equal(kept.changes.length, 1)
  await click(key("TURRET", "BLUE"))
  assert.equal(kept.changes.length, 2)
})

test("outside the game nothing is recorded and a press says why", async () => {
  const kept = await tool({ at: 4800 })
  assert.equal(key("TURRET", "BLUE").getAttribute("aria-disabled"), "true")
  await click(key("TURRET", "BLUE"))
  assert.equal(kept.changes.length, 0)
  assert.equal(kept.said.at(-1), "Video đang ở ngoài ván 2.")
})

test("before 0:00 a press says that the game has not started", async () => {
  const kept = await tool({ at: 3600 })
  await click(key("ABYSSAL_DRAGON", "RED"))
  assert.equal(kept.said.at(-1), "Ván 2 chưa vào trận.")
  const unplaced = deskOf({ content: recordedGame({ sourceTimestampSeconds: undefined }) })
  const { momentRefusal } = await import("../src/features/esports/pages/tools/moment-actions")
  assert.equal(momentRefusal(unplaced), "Ván 2 chưa vào trận.")
})

test("a recorded objective is taken back by the undo", async () => {
  const kept = await tool()
  await click(key("TURRET", "RED"))
  await act(async () => kept.undo())
  assert.deepEqual(readTimeline(kept.content()), [])
})

test("the selected moment moves a second at a time, and presses add up", async () => {
  const kept = await tool({ content: withMoments(objective("a", 381, "BLUE", "ABYSSAL_DRAGON")), activeId: "a" })
  await act(async () => {
    named("+1 giây")!.click()
    named("+1 giây")!.click()
  })
  await flush()
  assert.equal(readTimeline(kept.content())[0]?.at, 383)
  assert.equal(kept.changes[0]?.text, "Đã dời Rồng của AZU: 6:21 → 6:22")
  await click(named("−1 giây"))
  assert.equal(readTimeline(kept.content())[0]?.at, 382)
})

test("a moment never moves past the end of its game", async () => {
  const desk = deskOf({ content: withMoments(objective("a", 800, "BLUE")) })
  moveMoment(desk, readTimeline(desk.entry.content)[0]!, 900)
  await flush()
  assert.equal(readTimeline(desk.kept.content())[0]?.at, 802)
})

test("a deleted moment is gone at once and comes back with the undo", async () => {
  const kept = await tool({ content: withMoments(objective("a", 381, "BLUE", "ABYSSAL_DRAGON")), activeId: "a" })
  await click(named("Xóa"))
  assert.deepEqual(readTimeline(kept.content()), [])
  assert.equal(kept.changes.at(-1)?.text, "Đã xóa Rồng của AZU lúc 6:21")
  await act(async () => kept.undo())
  assert.equal(readTimeline(kept.content())[0]?.id, "a")
})

test("an item that comes back never takes the place of the player's next one", async () => {
  const buy = (name: string, atSeconds: number) => ({
    atSeconds,
    type: "BUY" as const,
    item: selection(name),
    toSlot: 1,
  })
  const content = recordedGame()
  content.sides[0]!.participants[0]!.equipmentEvents = [buy("Kiếm ngắn", 60), buy("Gươm Loki", 300)]
  const desk = deskOf({ content })
  const [first] = readTimeline(desk.entry.content)
  deleteMoment(desk, first!)
  await flush()
  await desk.kept.undo()
  assert.deepEqual(
    desk.kept.content().sides[0]!.participants[0]!.equipmentEvents.map((event) => event.item?.name),
    ["Kiếm ngắn", "Gươm Loki"],
  )
})

test("the form of a purchase keeps what it does not ask for", async () => {
  const content = recordedGame()
  const bought = {
    atSeconds: 60,
    type: "UPGRADE" as const,
    item: selection("Gươm Loki"),
    replacedItem: selection("Kiếm ngắn"),
    fromSlot: 2,
    toSlot: 1,
  }
  content.sides[0]!.participants[0]!.equipmentEvents = [bought]
  const [editing] = readTimeline(content)
  const kept = await tool({ content, form: { editing: editing! } })
  await type(document.querySelector<HTMLInputElement>('input[aria-label="Ghi chú"]')!, "Nhìn từ bảng đồ")
  await click(named("Cập nhật"))
  await flush()
  assert.deepEqual(kept.content().sides[0]!.participants[0]!.equipmentEvents, [{ ...bought, note: "Nhìn từ bảng đồ" }])
})

test("pressing a moment goes there and selects it", async () => {
  const kept = await tool({ content: withMoments(objective("a", 381, "BLUE")) })
  await click(row("a").querySelector("button"))
  assert.deepEqual(kept.seeks, [3718 + 381])
  assert.equal(row("a").dataset.active, "true")
})

test("viewing, the counts stand as a table and a moment only offers its links", async () => {
  await tool({ content: withMoments(objective("a", 381, "BLUE")), activeId: "a", editable: false })
  assert.equal(document.querySelectorAll(".esp-pad-key").length, 0)
  const cells = [...document.querySelectorAll('tr[data-objective="TURRET"] > *')].map((cell) =>
    cell.textContent?.trim(),
  )
  assert.deepEqual(cells, ["1", "Trụ", "0"])
  assert.equal(named("Sửa"), undefined)
  assert.equal(named("Xóa"), undefined)
  assert.ok(named("Chép liên kết"))
  assert.equal(named("Mở trên YouTube")?.getAttribute("href"), "https://www.youtube.com/watch?v=j8AvYygkzm4&t=4099s")
})

test("the filter is offered only where there are two kinds of moments", async () => {
  await tool({ content: withMoments(objective("a", 381, "BLUE")) })
  assert.equal(named("Lọc"), undefined)
})

test("two kinds of moments can be narrowed to one, and its words let go of it again", async () => {
  await tool({
    content: withMoments(objective("a", 381, "BLUE"), {
      id: "n",
      atSeconds: 400,
      kind: "NOTE",
      title: "Pha cướp Rồng",
    }),
  })
  const filter = named("Lọc")!
  await act(async () => filter.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  const kind = await waitFor(() =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((entry) =>
      entry.textContent?.startsWith("Khoảnh khắc"),
    ),
  )
  await click(kind)
  assert.equal(row("a"), null)
  assert.ok(row("n"))
  await click(named("Bỏ lọc Khoảnh khắc"))
  assert.ok(row("a"))
})

test("items of tier 1 and 2 wait behind the filter", async () => {
  const content = withMoments(objective("a", 381, "BLUE"))
  content.sides[0]!.participants[0]!.equipmentEvents = [
    { atSeconds: 60, type: "BUY", item: selection("Kiếm ngắn"), toSlot: 1 },
  ]
  await tool({ content })
  assert.equal(document.querySelectorAll('[data-kind="ITEM"]').length, 0)
  assert.ok(named("Lọc"))
})

test("the line of now stands between what the video has shown and the later moments", async () => {
  const kept = await tool({ content: withMoments(objective("a", 100, "BLUE"), objective("b", 600, "RED")) })
  const order = () =>
    [...document.querySelectorAll<HTMLElement>("[data-event], [data-now]")].map(
      (entry) => entry.dataset.event ?? entry.textContent,
    )
  assert.deepEqual(order(), ["a", "7:20", "b"])
  assert.equal(row("b").dataset.later, "true")
  await act(async () => kept.play(4800))
  assert.deepEqual(order(), ["a", "b"], "outside the game there is no now")
})

test("the form takes the place of the pad, and the list stays", async () => {
  const kept = await tool({ content: withMoments(objective("a", 100, "BLUE")) })
  await click(named("Diễn biến khác"))
  assert.ok(document.querySelector("form.esp-form"))
  assert.equal(document.querySelectorAll(".esp-pad-key").length, 0)
  assert.ok(row("a"))
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  )
  assert.equal(document.querySelector("form.esp-form"), null)
  assert.equal(kept.changes.length, 0)
})

test("Enter saves the form from anywhere but a button", async () => {
  const kept = await tool({ form: { kind: "OBJECTIVE", side: "RED" } })
  const form = document.querySelector<HTMLFormElement>("form.esp-form")!
  assert.equal(document.activeElement, form, "the form has the focus, so the keys of the video keep working")
  await act(async () => form.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await flush()
  assert.equal(readTimeline(kept.content())[0]?.kind, "OBJECTIVE")
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi Tà thần của CRI lúc 7:20")
})

test("a refused save brings back the form with what was typed", async () => {
  const desk = deskOf()
  desk.kept.refuse(true)
  let form: unknown = "closed"
  saveMoment({ ...desk, onForm: (next) => (form = next) }, { id: "n", kind: "NOTE", at: 12, title: "Pha cướp" }, null)
  await flush()
  assert.deepEqual(form, { refused: { id: "n", kind: "NOTE", at: 12, title: "Pha cướp" } })
})

test("a refused edit brings back the form as an edit of the stored moment, with what was typed", async () => {
  const desk = deskOf({ content: withMoments(objective("a", 381, "BLUE")) })
  const [stored] = readTimeline(desk.entry.content)
  desk.kept.refuse(true)
  let form: unknown = "closed"
  saveMoment({ ...desk, onForm: (next) => (form = next) }, { ...stored!, at: 390 }, stored!)
  await flush()
  assert.deepEqual(form, { editing: stored, refused: { ...stored!, at: 390 } })
})

test("an edited moment goes back to what it was", async () => {
  const desk = deskOf({ content: withMoments(objective("a", 381, "BLUE")) })
  const [stored] = readTimeline(desk.entry.content)
  saveMoment(desk, { ...stored!, at: 390 }, stored!)
  await flush()
  assert.equal(readTimeline(desk.kept.content())[0]?.at, 390)
  await desk.kept.undo()
  assert.equal(readTimeline(desk.kept.content())[0]?.at, 381)
})
