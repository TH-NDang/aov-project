import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameContent } from "@aov/community-contracts"
import { button, click, flush, type, waitFor } from "./fixtures/dom"
import { alerts, holdWrites, press, refused, said, studioPage, tab } from "./fixtures/esports-studio"
import { json } from "./fixtures/network"

const open = studioPage()
// The client of the services reads the page it runs in, so it comes once the page is there.
const { tournamentKeys } = await import("../src/features/tournaments/api/tournament-api")

const conflict = () => json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, 409)
const footAlert = () => document.querySelector('.esp-foot [role="alert"]')?.textContent ?? ""
const notices = () => document.querySelector(".esp-notice")?.textContent ?? ""
/** The objectives a game holds, by team and kind. */
const objectives = (content: GameContent, name?: string) =>
  (content.timeline?.events ?? []).filter(
    (event) => event.kind === "OBJECTIVE" && (!name || `${event.side}:${event.objective}` === name),
  ).length

test("a refused change stays told while the changes queued behind it are saved", async () => {
  const { service } = await open("?edit=1&t=300")
  const writes = holdWrites(service)
  await press("1")
  await press("2")
  await press("8")
  await writes.release(refused())
  await writes.release()
  await writes.release()
  assert.match(footAlert(), /^Không lưu được: ghi Trụ của AZT lúc 3:25\. Thông tin chưa hợp lệ\./)
})

test("Ctrl + Z while a change is still being saved takes back that change", async () => {
  const { service, games } = await open("?edit=1&t=300")
  await press("1")
  await waitFor(() => /^Đã ghi Trụ/.test(said()))
  const writes = holdWrites(service)
  await press("2")
  await press("z", document.body, { ctrlKey: true })
  await writes.release()
  await writes.release()
  assert.deepEqual(
    [objectives(games[0]!.content, "BLUE:TURRET"), objectives(games[0]!.content, "BLUE:ABYSSAL_DRAGON")],
    [1, 2],
  )
  assert.match(said(), /^Đã hoàn tác: ghi Rồng của AZT lúc 3:25/)
})

test("Ctrl + Z right after the first change of a game takes it back once it is saved", async () => {
  const { service, games } = await open("?edit=1&t=300")
  const before = objectives(games[0]!.content)
  const writes = holdWrites(service)
  await press("1")
  await press("z", document.body, { ctrlKey: true })
  await writes.release()
  await writes.release()
  assert.equal(objectives(games[0]!.content), before)
})

test("a refused save of a game that left the desk is told in the dock, then on its own desk", async () => {
  const { service } = await open("?edit=1&t=300")
  const writes = holdWrites(service)
  await press("1")
  await click(tab(1))
  await writes.release(conflict())
  assert.match(notices(), /Không lưu được ván 1: ghi Trụ của AZT lúc 3:25\. Dữ liệu đã thay đổi\./)

  await click(tab(0))
  assert.match(footAlert(), /^Không lưu được: ghi Trụ của AZT lúc 3:25\./)
  assert.doesNotMatch(notices(), /Không lưu được/, "the desk of the game tells it once")
})

test("a game that comes back while its save is under way goes on from that save", async () => {
  const { service, games } = await open("?edit=1&t=300")
  const before = objectives(games[0]!.content)
  const writes = holdWrites(service)
  await press("1")
  await click(tab(1))
  await click(tab(0))
  await press("End")
  await press("8")
  await writes.release()
  await writes.release()
  assert.equal(objectives(games[0]!.content), before + 2)
  assert.deepEqual(alerts(), [])
})

test("a key pressed while the link of the match is written is saved after the link", async () => {
  const { service, games } = await open("?edit=1&t=300")
  const before = objectives(games[0]!.content)
  await click(button("Ván đấu", document.querySelector(".esp-tools")!))
  await click(button("Đổi", document.querySelector('[role=group][aria-label="Video"]')!))
  const link = document.querySelector<HTMLInputElement>('[aria-label="Liên kết video YouTube"]')!
  await type(link, "https://youtu.be/R5rCsGqDJIg?t=10")
  await click(button("Cho cả trận"))
  const writes = holdWrites(service)
  await click(button("Lưu", link.closest("form")!))
  await click(button("Diễn biến", document.querySelector(".esp-tools")!))
  await press("1")
  while (writes.waiting.length || objectives(games[0]!.content) === before) await writes.release()
  assert.equal(objectives(games[0]!.content), before + 1)
  assert.ok(games.every((entry) => entry.content.sourceUrl === "https://youtu.be/R5rCsGqDJIg?t=10"))
  assert.deepEqual(alerts(), [])
})

test("a list of games read before a save does not bring the older game back", async () => {
  const { service, client } = await open("?edit=1&t=300")
  const turret = () => document.querySelector('[aria-label^="Ghi Trụ của AZT, đang có"]')?.getAttribute("aria-label")
  let arrive = () => {}
  let asked = false
  service.gate = (request, answer) => {
    if (asked || request.method !== "GET" || request.pathname !== "/admin/games") return answer()
    asked = true
    // The list leaves the services with what they hold now, and arrives once the turret below is saved.
    const older = Promise.resolve(answer())
    return new Promise((resolve) => (arrive = () => void older.then(resolve)))
  }
  void client.invalidateQueries({ queryKey: tournamentKeys.kind("games") })
  await flush()
  await press("1")
  await waitFor(() => /^Đã ghi Trụ/.test(said()))
  const counted = turret()
  arrive()
  await flush(5)
  assert.equal(turret(), counted)
})

test("a refusal of a game published while viewing is told under its button", async () => {
  const { service } = await open("?t=300")
  service.gate = (request, answer) =>
    request.method === "POST" && /\/publish$/.test(request.pathname) ? refused() : answer()
  await click(button("Xuất bản", document.querySelector(".esp-head")!))
  const details = [...document.querySelectorAll("summary")].find((summary) =>
    /từng mục/.test(summary.textContent ?? ""),
  )
  ;(details!.parentElement as HTMLDetailsElement).open = true
  await flush()
  await click(button("Xuất bản ván 1", details!.parentElement!))
  await click(button("Xuất bản", document.querySelector('[role="alertdialog"]')!))
  await waitFor(() => alerts().some((text) => /^Không xuất bản được: /.test(text)), "The refusal was told nowhere")
})

test("an error of making a game stays with its match", async () => {
  const { service } = await open("?edit=1&t=3000")
  service.gate = (request, answer) =>
    request.method === "POST" && request.pathname === "/admin/games" ? refused() : answer()
  await click(button("Ván 3, chưa ghi"))
  await click(button("Cấm chọn ván 3"))
  await waitFor(() => /Thông tin chưa hợp lệ/.test(notices()))
  await press("N", document.body, { shiftKey: true })
  await waitFor(() => /EMW.*ONX/.test(document.querySelector("h1")?.textContent ?? ""), "The next match did not open")
  assert.doesNotMatch(notices(), /Thông tin chưa hợp lệ/)
})
