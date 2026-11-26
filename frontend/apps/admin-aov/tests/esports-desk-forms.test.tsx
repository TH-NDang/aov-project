import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { GameContent } from "@aov/community-contracts"
import { answerConfirm, button, click, confirmDialog, flush, type, waitFor } from "./fixtures/dom"
import {
  alerts,
  current,
  heldReadings,
  holdWrites,
  isGameWrite,
  press,
  said,
  studioPage,
  tab,
} from "./fixtures/esports-studio"
import { json } from "./fixtures/network"

const open = studioPage()

const conflict = () => json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, 409)
const form = () => document.querySelector<HTMLFormElement>(".esp-body form")
const title = () => form()?.querySelector<HTMLInputElement>('input[aria-label="Tiêu đề"]') ?? null
const notes = (content: GameContent) =>
  (content.timeline?.events ?? []).flatMap((event) => (event.kind === "NOTE" ? [event.title] : []))

/** Opens the form of a note with N and types its title. */
async function typeNote(text: string) {
  await press("n")
  await type(title()!, text)
}
const saveForm = () => click(button("Lưu diễn biến", form()!) ?? button("Cập nhật", form()!), "the save of the form")

test("a refused moment of a game that left the desk comes back to that game only", async () => {
  const { service } = await open("?edit=1&t=300")
  await typeNote("Pha A")
  const writes = holdWrites(service)
  await saveForm()
  await click(tab(1))
  await writes.release(conflict())
  assert.equal(form()?.getAttribute("aria-label"), undefined, "game 2 shows no form of game 1")
  assert.match(
    document.querySelector('.esp-tools [aria-pressed="true"]')?.textContent ?? "",
    /Cấm chọn/,
    "game 2 keeps its own tool",
  )
  assert.match(document.querySelector(".esp-notice")?.textContent ?? "", /Không lưu được ván 1: ghi Pha A lúc 3:25\./)

  await click(tab(0))
  assert.equal(title()?.value, "Pha A")
})

test("a moment that was refused and then saved is taken back whole", async () => {
  const { service, games } = await open("?edit=1&t=300")
  const before = notes(games[0]!.content)
  let first = true
  service.gate = (request, answer) => {
    if (!isGameWrite(request) || !first) return answer()
    first = false
    return conflict()
  }
  await typeNote("Lần đầu")
  await saveForm()
  await waitFor(() => title(), "The refused form did not come back")
  await type(title()!, "Lần hai")
  await saveForm()
  await waitFor(() => /^Đã ghi Lần hai lúc 3:25/.test(said()), "The moment was not saved")

  await press("z", document.body, { ctrlKey: true })
  await waitFor(() => /^Đã hoàn tác/.test(said()))
  assert.deepEqual(notes(games[0]!.content), before)
})

test("a new moment whose save is refused comes back as a new one, not as an edit", async () => {
  const { service } = await open("?edit=1&t=300")
  service.gate = (request, answer) => (isGameWrite(request) ? conflict() : answer())
  await typeNote("Pha B")
  await saveForm()
  await waitFor(() => title(), "The refused form did not come back")

  assert.deepEqual(
    [form()?.getAttribute("aria-label"), title()?.value, !!button("Lưu diễn biến", form()!)],
    ["Ghi diễn biến mới", "Pha B", true],
  )
})

test("a typed moment waits under a panel and comes back when the panel closes", async () => {
  await open("?edit=1&t=300")
  await typeNote("Đang gõ dở")
  await click(button("Xuất bản", document.querySelector(".esp-head")!))
  assert.ok(document.querySelector(".esp-panel-head"), "the panel is open")
  await press("Escape")
  assert.equal(title()?.value, "Đang gõ dở")
})

test("another tool asks before a typed moment is thrown away", async () => {
  await open("?edit=1&t=300")
  await typeNote("Đang gõ dở")
  await click(button("Đội hình", document.querySelector(".esp-tools")!))
  assert.match(confirmDialog()?.textContent ?? "", /Bỏ chữ vừa gõ\?/)
  await answerConfirm("Ở lại chỉnh sửa")
  assert.equal(title()?.value, "Đang gõ dở")
})

test("another game asks before a typed moment is thrown away", async () => {
  await open("?edit=1&t=300")
  await typeNote("Đang gõ dở")
  await click(tab(1))
  assert.match(confirmDialog()?.textContent ?? "", /Diễn biến đang ghi chưa được lưu\./)
  await answerConfirm("Bỏ chữ vừa gõ")
  await waitFor(() => /^Ván 2,/.test(current()), "The other game did not come on the desk")
})

test("a note typed for a game keeps it on the desk while the video plays into the next one", async (t) => {
  const read = heldReadings(t)
  const { players } = await open("?edit=1&t=1290")
  await click(button("Ván đấu", document.querySelector(".esp-tools")!))
  await click(document.querySelector('[aria-label="Sửa phiên bản game, số ván, ghi chú"]'), "the edit of the game")
  const note = document.querySelector<HTMLTextAreaElement>(".esp-body textarea")!
  note.focus()
  await type(note, "Ghi chú của ván 1")

  await act(async () => players[0]!.report(1))
  players[0]!.time = 1520
  await read()
  assert.equal(document.querySelector('[role="slider"]')?.getAttribute("aria-valuetext"), "25:20")
  assert.match(current(), /^Ván 1,/)
  assert.equal(document.querySelector<HTMLTextAreaElement>(".esp-body textarea")?.value, "Ghi chú của ván 1")
})

test("a typed note of a player stays in its field when its save is refused", async () => {
  const { service } = await open("?edit=1&t=300")
  await click(button("Đội hình", document.querySelector(".esp-tools")!))
  await click(
    document.querySelector('[data-seat="BLUE:TOP"] [aria-label="Phụ trợ: Tốc biến"]'),
    "the spell of the player",
  )
  await click(button("Ghi chú tuyển thủ"))
  const note = document.querySelector<HTMLTextAreaElement>(".esp-body textarea")!
  await type(note, "Chơi vị trí khác lúc đầu")
  service.gate = (request, answer) => (isGameWrite(request) ? conflict() : answer())
  await act(async () => note.blur())
  await waitFor(() => alerts().some((text) => /^Không lưu được: sửa ghi chú/.test(text)), "The refusal was not told")
  await flush()
  assert.equal(document.querySelector<HTMLTextAreaElement>(".esp-body textarea")?.value, "Chơi vị trí khác lúc đầu")
})

test("a game made at the playhead is told in the foot and taken back there", async () => {
  const { saves } = await open("?edit=1&t=3000")
  await click(button("Ván 3, chưa ghi"))
  await click(button("Cấm chọn ván 3"))
  await waitFor(() => /^Đã tạo ván 3, cấm chọn từ ▸50:00/.test(said()), "The foot did not tell the new game")

  await click(button("Hoàn tác", document.querySelector(".esp-foot")!))
  await waitFor(() => /^Đã hoàn tác: ván 3 bắt đầu cấm chọn lúc ▸50:00/.test(said()))
  assert.equal(saves.at(-1)?.draft?.startSecond, null)
})

test("a game made is told in its foot also when its desk comes up before the other lists are read again", async () => {
  const { service } = await open("?edit=1&t=3000")
  // Once the game is made, the list of games answers at once and every other list waits.
  const waiting: (() => void)[] = []
  let made = false
  service.gate = (request, answer) => {
    if (request.method === "POST") made = true
    if (!made || request.method !== "GET" || request.pathname === "/admin/games") return answer()
    return new Promise((resolve) => waiting.push(() => resolve(answer())))
  }
  await click(button("Ván 3, chưa ghi"))
  await click(button("Cấm chọn ván 3"))
  await waitFor(() => /^Ván 3,/.test(current()) && waiting.length > 0, "The new game was not on its desk")

  await act(async () => {
    service.gate = null
    for (const release of waiting.splice(0)) release()
  })
  await waitFor(() => /^Đã tạo ván 3, cấm chọn từ ▸50:00/.test(said()), "The foot did not tell the new game")
})
