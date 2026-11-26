import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { ArcanaAllocation, Catalog, GameContent, Participant, Reference } from "@aov/community-contracts"
import type { ToolTarget } from "../src/features/esports/model/desk"
import { seatsChange, seatWords, seenAt } from "../src/features/esports/model/seat-changes"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import { answerConfirm, button, click, confirmDialog, render, type, waitFor, withDom } from "./fixtures/dom"
import {
  catalog as deskCatalog,
  deskOf,
  recordedGame,
  selection,
  VIDEO,
  type DeskOptions,
} from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"
import { view } from "./fixtures/match-records"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })

const { LineupTool } = await import("../src/features/esports/pages/tools/lineup-tool")

const reference = (id: string, name: string, extra: Partial<Reference>): Reference => ({ id, code: id, name, ...extra })
const catalog: Catalog = {
  ...deskCatalog,
  arcana: [
    reference("r-ad", "Đỏ III Công vật lý/Xuyên giáp", { color: "RED", tier: 3 }),
    reference("r-crit", "Đỏ III Tỉ lệ chí mạng", { color: "RED", tier: 3 }),
    reference("p-hp", "Tím III Máu tối đa", { color: "PURPLE", tier: 3 }),
  ],
  enchantments: [
    reference("light-1", "Sung mãn", { branchCode: "thap-quang-minh", tier: 1 }),
    reference("light-3", "Thần quang", { branchCode: "thap-quang-minh", tier: 3 }),
    reference("abyss-3", "Đấu khí", { branchCode: "vuc-hon-mang", tier: 3 }),
  ],
}
const stone = (id: string, count: number, color: ArcanaAllocation["color"]): ArcanaAllocation => ({
  selection: { id, name: catalog.arcana.find((entry) => entry.id === id)!.name },
  count,
  color,
})

/** The game with the top laner of the blue team changed. */
const withTop = (change: Partial<Participant>): GameContent => {
  const content = recordedGame()
  return {
    ...content,
    sides: content.sides.map((side) =>
      side.side === "BLUE"
        ? { ...side, participants: side.participants.map((entry, at) => (at ? entry : { ...entry, ...change })) }
        : side,
    ),
  }
}

async function editor({ target = { seat: "BLUE:TOP" }, ...options }: DeskOptions & { target?: ToolTarget } = {}) {
  const { kept } = deskOf({ catalog, ...options })
  await render(<kept.Host>{(current) => <LineupTool desk={current} target={target} />}</kept.Host>)
  return kept
}
const top = (kept: Awaited<ReturnType<typeof editor>>) => kept.content().sides[0]!.participants[0]!
const tab = (name: string) => button(name, document.querySelector('nav[aria-label="Phần của tuyển thủ"]')!)
const face = (seat: string) => document.querySelector(`[data-ten-seat="${seat}"]`)
const pressedFace = () => document.querySelector('[data-ten-seat][aria-pressed="true"]')?.getAttribute("data-ten-seat")
const pick = (selector: string) => click(document.querySelector(selector), selector)
const said = (kept: Awaited<ReturnType<typeof editor>>) => kept.changes.at(-1)?.text
const escape = (target: Element | null) =>
  act(async () => {
    target!.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
  })

test("a press on a spell records it, says so and can be taken back", async () => {
  const kept = await editor()
  const spells = document.querySelector('[data-part="spell"]')!
  await click(button("Trừng trị", spells))
  assert.equal(top(kept).spell?.name, "Trừng trị")
  assert.equal(said(kept), "Đã ghi phụ trợ của AZU Top: Trừng trị")
  await act(async () => kept.undo())
  assert.equal(top(kept).spell?.name, "Tốc biến")
})

test("the first spell of a player takes the second the video is at as the second it was seen", async () => {
  const kept = await editor({ content: withTop({ spell: null }) })
  await click(button("Trừng trị"))
  assert.equal(top(kept).spellObservedAtSeconds, 440)
})

test("a press on the recorded spell takes it off", async () => {
  const kept = await editor()
  await click(button("Tốc biến", document.querySelector('[data-part="spell"]')!))
  assert.equal(top(kept).spell?.name, null)
  assert.equal(said(kept), "Đã bỏ phụ trợ của AZU Top")
})

test("a spell the catalog does not have is written by its name and stands among the others", async () => {
  const kept = await editor({ content: withTop({ spell: null }) })
  await click(button("Tên khác"))
  await type(document.querySelector<HTMLInputElement>('[aria-label="Tên phụ trợ"]')!, "Phép cũ")
  await click(button("Ghi", document.querySelector('[data-part="spell"]')!))
  assert.deepEqual(top(kept).spell, { id: null, name: "Phép cũ" })
  assert.equal(button("Phép cũ")?.getAttribute("aria-pressed"), "true")
})

test("another player keeps the part, so one part is recorded down a team", async () => {
  const kept = await editor({ target: { seat: "BLUE:TOP", part: "enchantments" } })
  await pick('[data-enchantment="light-3"]')
  await click(face("BLUE:JUNGLE"))
  assert.equal(tab("Phù hiệu")?.getAttribute("aria-pressed"), "true")
  await pick('[data-enchantment="abyss-3"]')
  const names = kept.content().sides[0]!.participants.map(({ enchantments }) => enchantments.entries[0]?.selection.name)
  assert.deepEqual(names.slice(0, 2), ["Thần quang", "Đấu khí"])
  assert.equal(said(kept), "Đã ghi phù hiệu của AZU Jungle: Đấu khí")
})

test("all five slots stay asked for from one player to the next", async () => {
  await editor({ target: { seat: "BLUE:TOP", part: "enchantments" } })
  assert.equal(document.querySelector('[data-enchantment="light-1"]'), null)
  await click(button("Đủ năm ô"))
  assert.ok(document.querySelector('[data-enchantment="light-1"]'))
  await click(face("RED:MID"))
  assert.ok(document.querySelector('[data-enchantment="light-1"]'))
})

test("edits made before the one before is saved do not undo each other", async () => {
  const entries = [stone("r-ad", 3, "RED"), stone("r-crit", 3, "RED"), stone("p-hp", 2, "PURPLE")]
  const kept = await editor({
    content: withTop({ arcana: { status: "PARTIAL", entries } }),
    target: { seat: "BLUE:TOP", part: "arcana" },
  })
  const recorded = () => top(kept).arcana.entries.map((entry) => entry.selection.id)
  const listed = () =>
    [...document.querySelectorAll('[data-part="arcana"] [aria-label^="Bỏ "]')].map((entry) =>
      entry.getAttribute("aria-label"),
    )
  assert.equal(listed().length, 3)

  const answer = kept.hold()
  await pick('[aria-label="Bỏ Tỉ lệ chí mạng"]')
  assert.deepEqual(listed(), ["Bỏ Công vật lý/Xuyên giáp", "Bỏ Máu tối đa"], "the row leaves at once")
  assert.deepEqual(recorded(), ["r-ad", "r-crit", "p-hp"], "while the service has not answered yet")
  await pick('[aria-label="Bỏ Công vật lý/Xuyên giáp"]')
  answer()
  await waitFor(() => recorded().join() === "p-hp", "both removals are saved")
  assert.deepEqual(listed(), ["Bỏ Máu tối đa"], "the second removal did not bring the first row back")
})

test("a refused edit goes back to what is saved", async () => {
  const kept = await editor({
    content: withTop({ arcana: { status: "PARTIAL", entries: [stone("p-hp", 2, "PURPLE")] } }),
    target: { seat: "BLUE:TOP", part: "arcana" },
  })
  kept.refuse(true)
  const answer = kept.hold()
  await pick('[aria-label="Bỏ Máu tối đa"]')
  assert.equal(document.querySelector('[aria-label="Bỏ Máu tối đa"]'), null)
  answer()
  await waitFor(() => document.querySelector('[aria-label="Bỏ Máu tối đa"]'), "the refused removal is taken back")
  assert.equal(kept.changes.length, 0)
})

test("the second a part was seen is taken from the video, gone to and cleared", async () => {
  const kept = await editor({ target: { seat: "BLUE:TOP", part: "arcana" } })
  await click(button("Lấy ▸1:09:18 làm lúc video hiện bảng ngọc"))
  assert.equal(top(kept).arcana.observedAtSeconds, 440)
  assert.equal(said(kept), "Đã đặt mốc bảng ngọc của AZU Top lúc 7:20")
  await click(button("Tới lúc video hiện bảng ngọc, 7:20"))
  assert.deepEqual(kept.seeks, [4158])
  await click(button("Bỏ mốc bảng ngọc"))
  assert.equal(top(kept).arcana.observedAtSeconds, null)
  await act(async () => kept.undo())
  assert.equal(top(kept).arcana.observedAtSeconds, 440)
})

test("no second is taken where the video shows something else, and the desk says why", async () => {
  const kept = await editor({ target: { seat: "BLUE:TOP", part: "arcana" }, at: 4800 })
  const take = button("Lấy ▸1:20:00 làm lúc video hiện bảng ngọc")
  assert.equal(take?.getAttribute("aria-disabled"), "true")
  await click(take)
  assert.deepEqual(kept.said, ["Video đang ở ngoài ván 2."])
  assert.equal(top(kept).arcana.observedAtSeconds, undefined)
})

test("loadouts seen before 0:00 count as 0:00", () => {
  const [chapter] = layoutChapters([view("g2", recordedGame())], VIDEO)
  assert.deepEqual(seenAt(chapter!, 3600), { second: 0, refusal: null }, "while the game loads")
  assert.deepEqual(seenAt(chapter!, 4158), { second: 440, refusal: null })
  assert.equal(seenAt(chapter!, 3000).second, null, "before its draft")
  assert.equal(seenAt(chapter!, 4530).second, null, "after its end")
})

test("a part asked for from elsewhere opens on the first player who lacks it", async () => {
  await editor({ target: { part: "arcana" }, content: withTop({ arcana: { status: "NOT_SHOWN", entries: [] } }) })
  assert.equal(pressedFace(), "BLUE:JUNGLE", "what the source never showed is not missing")
  assert.equal(tab("Ngọc")?.getAttribute("aria-pressed"), "true")
})

test("Esc and the first button of the strip bring both teams back", async () => {
  await editor()
  await escape(document.querySelector("[data-ten-seat]"))
  assert.equal(document.querySelectorAll("[data-seat]").length, 10)
  await click(document.querySelector('[data-seat="RED:MID"] button.esp-seat-open'))
  await click(button("Cả hai đội"))
  assert.equal(document.querySelectorAll("[data-seat]").length, 10)
})

test("a main emblem of another branch asks before it throws the other slots away", async () => {
  const entries = [
    { selection: selection("Sung mãn"), primary: true, tier: 1, branchCode: "thap-quang-minh" },
    { selection: { id: "light-3", name: "Thần quang" }, primary: true, tier: 3, branchCode: "thap-quang-minh" },
  ]
  const kept = await editor({
    content: withTop({ enchantments: { status: "PARTIAL", entries } }),
    target: { seat: "BLUE:TOP", part: "enchantments" },
  })
  await click(button("Vực Hỗn Mang"))
  await pick('[data-enchantment="abyss-3"]')
  assert.match(confirmDialog()?.textContent ?? "", /1 phù hiệu đã ghi sẽ bị bỏ: Sung mãn/)
  await answerConfirm("Đổi nhánh chính")
  assert.deepEqual(
    top(kept).enchantments.entries.map(({ selection: { name } }) => name),
    ["Đấu khí"],
  )
})

test("a note is saved once, when its field is left", async () => {
  const kept = await editor()
  await click(button("Ghi chú tuyển thủ"))
  const field = document.querySelector<HTMLTextAreaElement>("textarea")!
  await type(field, "Đổi người ở phút 3")
  assert.equal(kept.changes.length, 0)
  await act(async () => field.blur())
  assert.equal(top(kept).note, "Đổi người ở phút 3")
  assert.equal(said(kept), "Đã sửa ghi chú của AZU Top")
})

test("taking a change of one player back leaves the rest of the player alone", () => {
  const content = recordedGame()
  const change = seatsChange(content, ["BLUE:TOP"], (value) => ({ ...value, spell: selection("Trừng trị") }), "x")!
  const later = seatsChange(
    change.apply(content),
    ["BLUE:TOP"],
    (value) => ({ ...value, note: "Ghi chú" }),
    "y",
  )!.apply(change.apply(content))
  const [player] = change.revert!(later).sides[0]!.participants
  assert.equal(player!.spell?.name, "Tốc biến")
  assert.equal(player!.note, "Ghi chú")
})

test("a change that changes nobody is none", () => {
  assert.equal(
    seatsChange(recordedGame(), ["BLUE:TOP"], (value) => value, "x"),
    null,
  )
})

test("what an edit did is said by what it changed", () => {
  const [old] = recordedGame().sides[0]!.participants
  const words = (change: Partial<Participant>) => seatWords(old!, { ...old!, ...change }, "Fish")
  const entries = [stone("p-hp", 10, "PURPLE")]
  assert.equal(words({ arcana: { status: "PARTIAL", entries } }), "Đã ghi bảng ngọc của Fish: Máu tối đa")
  assert.equal(words({ arcana: { status: "NOT_SHOWN", entries: [] } }), "Bảng ngọc của Fish: video không hiển thị")
  assert.equal(words({ arcana: { ...old!.arcana, note: "x" } }), "Đã sửa ghi chú bảng ngọc của Fish")
  assert.equal(words({ equipmentSnapshots: [{ atSeconds: 330, slots: [] }] }), "Đã thêm mốc trang bị 5:30 của Fish")
})
