import assert from "node:assert/strict"
import { after, test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import type { TimingIssue } from "../src/features/esports/model/timing-issues"
import { answerConfirm, button, click, confirmDialog, flush, render, type, waitFor, withDom } from "./fixtures/dom"
import { VIDEO_URL, deskOf, emptyGame, recordedGame, type DeskOptions } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"
import { view } from "./fixtures/match-records"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { GameTool } = await import("../src/features/esports/pages/tools/game-tool")

const original = { ...tournamentApi }
after(() => Object.assign(tournamentApi, original))
/** The other games of the match, as the page has them already. */
let games: DocumentView<GameContent>[] = []
tournamentApi.list = (async () => games) as typeof tournamentApi.list
tournamentApi.gamePatches = async () => []

type Options = DeskOptions & { issues?: TimingIssue[]; others?: DocumentView<GameContent>[]; row?: "scope" | "video" }
const links: [string, string][] = []
async function tool({ issues = [], others = [], row, ...options }: Options = {}) {
  games = others
  links.length = 0
  const desk = deskOf(options)
  await render(
    <MemoryRouter>
      <desk.kept.Host>
        {(current) => (
          <GameTool
            desk={current}
            target={row ? { row } : null}
            issues={issues}
            onVideo={(url, scope) => links.push([url, scope])}
          />
        )}
      </desk.kept.Host>
    </MemoryRouter>,
  )
  return desk.kept
}
const group = (label: string) => document.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`)!
const within = (label: string, text: string) => button(text, group(label))
const field = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!

test("pressing a team records the winner, and the undo takes it back", async () => {
  const kept = await tool({ content: recordedGame({ winner: null }) })
  await click(within("Đội thắng ván 2", "AZU"))
  assert.equal(kept.content().winner, "BLUE")
  assert.equal(kept.changes.at(-1)?.text, "AZU thắng ván 2")
  await act(async () => kept.undo())
  assert.equal(kept.content().winner, null)
})

test("another winner than the recorded one is set only after a question with both", async () => {
  const kept = await tool()
  await click(within("Đội thắng ván 2", "AZU"))
  assert.match(confirmDialog()?.textContent ?? "", /Đổi đội thắng ván 2\?.*CRI → AZU/)
  assert.equal(kept.content().winner, "RED")
  await answerConfirm("Đổi đội thắng")
  assert.equal(kept.content().winner, "BLUE")
})

test("an MVP is chosen from the players seated, and replaced only after a question", async () => {
  const kept = await tool()
  await click(within("MVP", "Chọn"))
  await click(within("MVP", "AZU Mid"))
  assert.equal(kept.content().mvpPlayerId, "a-MID")
  assert.match(group("MVP").textContent ?? "", /AZU Mid/)
  await click(within("MVP", "Đổi"))
  await click(within("MVP", "CRI Top"))
  assert.match(confirmDialog()?.textContent ?? "", /AZU Mid → CRI Top/)
  await answerConfirm("Đổi MVP")
  assert.equal(kept.content().mvpPlayerId, "b-TOP")
})

test("a mark takes the position of the video", async () => {
  const kept = await tool({ content: emptyGame(), at: 3154.6 })
  await click(within("Bắt đầu cấm chọn", "Lấy ▸52:34"))
  assert.equal(kept.content().draft?.startSecond, 3154)
  assert.equal(kept.changes.at(-1)?.text, "Ván 2 bắt đầu cấm chọn lúc ▸52:34")
})

test("a mark the service would refuse is not written, and the reason is said", async () => {
  const kept = await tool({ at: 3000 })
  const take = within("Chốt đội hình", "Lấy ▸50:00")!
  assert.equal(take.getAttribute("aria-disabled"), "true")
  await click(take)
  assert.equal(kept.changes.length, 0)
  assert.match(kept.said.at(-1)!, /Chốt đội hình phải sau lúc bắt đầu cấm chọn/)
})

test("pressing a recorded mark goes there", async () => {
  const kept = await tool()
  await click(within("Chốt đội hình", "Tới lúc chốt đội hình, ▸58:10"))
  await click(within("Kết thúc", "Tới lúc kết thúc, ▸1:15:20"))
  assert.deepEqual(kept.seeks, [3490, 4520])
})

test("the end of a game is its length on the game clock", async () => {
  const kept = await tool({ content: recordedGame({ durationSeconds: null }), at: 4520 })
  await click(within("Kết thúc", "Lấy ▸1:15:20"))
  assert.equal(kept.content().durationSeconds, 802)
  assert.equal(kept.changes.at(-1)?.text, "Ván 2 kết thúc, CRI thắng, dài 13:22")
})

test("a game does not end inside the next one of the match", async () => {
  const next = view("g3", { ...emptyGame(), number: 3, draft: { startSecond: 4500, lockedSecond: null, turns: [] } })
  const kept = await tool({ content: recordedGame({ durationSeconds: null }), at: 4520, others: [next] })
  const take = await waitFor(() => within("Kết thúc", "Lấy ▸1:15:20"))
  await waitFor(() => take.getAttribute("aria-disabled") === "true")
  await click(take)
  assert.equal(kept.content().durationSeconds, null)
  assert.equal(kept.said.at(-1), "Ván sau đã bắt đầu ở ▸1:15:00.")
})

test("the clock shown by the game finds its 0:00", async () => {
  const kept = await tool({ content: recordedGame({ durationSeconds: null }), at: 4158 })
  await type(field("Đồng hồ trên màn hình"), "7:00")
  assert.match(group("Đồng hồ game").textContent ?? "", /Mốc đang cho 7:20, nhanh 20 giây/)
  await click(button("Đặt lúc vào trận ở ▸1:02:18"))
  assert.equal(kept.content().sourceTimestampSeconds, 4158 - 420)
  assert.equal(field("Đồng hồ trên màn hình").value, "", "a written clock would only grow stale")
})

test("a broadcast that comes into the game at 0:15 places its 0:00 fifteen seconds before", async () => {
  const kept = await tool({
    content: recordedGame({ sourceTimestampSeconds: undefined, durationSeconds: null }),
    at: 3735,
  })
  const clock = field("Đồng hồ trên màn hình")
  assert.equal(clock.placeholder, "phút:giây")
  await type(clock, "0:15")
  assert.match(group("Đồng hồ game").textContent ?? "", /0:00 của ván ở ▸1:02:00/)
  assert.equal(button("Tạm dừng", group("Đồng hồ game")), undefined, "no pause before the game has a 0:00")
  await act(async () => clock.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  assert.equal(kept.content().sourceTimestampSeconds, 3720)
  assert.equal(kept.changes.at(-1)?.text, "Ván 2 vào trận lúc ▸1:02:00")
})

test("a clock behind the record later in the game is a pause, which a second reading makes longer", async () => {
  const kept = await tool({ content: recordedGame({ durationSeconds: null }), at: 4158 })
  const clock = field("Đồng hồ trên màn hình")
  await type(clock, "7:00")
  await act(async () => clock.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  assert.equal(kept.content().sourceTimestampSeconds, 3718, "0:00 stays where it was")
  assert.deepEqual(kept.content().timeline?.pauses, [{ atSeconds: 420, durationSeconds: 20 }])
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi tạm dừng lúc 7:00, dừng 0:20")

  // Read again while the game still stood: the same pause grows.
  await act(async () => kept.play(4170))
  await type(field("Đồng hồ trên màn hình"), "7:00")
  await click(button("Tạm dừng 0:12 ở 7:00"))
  assert.deepEqual(kept.content().timeline?.pauses, [{ atSeconds: 420, durationSeconds: 32 }])
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi tạm dừng lúc 7:00, dừng 0:32")
  await act(async () => kept.undo())
  assert.deepEqual(kept.content().timeline?.pauses, [{ atSeconds: 420, durationSeconds: 20 }])
})

test("a clock that agrees with the record says so and offers nothing", async () => {
  await tool({ content: recordedGame({ durationSeconds: null }), at: 4158 })
  await type(field("Đồng hồ trên màn hình"), "7:20")
  assert.match(group("Đồng hồ game").textContent ?? "", /Khớp với mốc vào trận/)
  assert.equal(group("Đồng hồ game").querySelectorAll("button").length, 0)
})

test("pauses are entered as positions of the video and can be removed", async () => {
  const kept = await tool({ at: 4018 })
  assert.equal(field("Mốc video bắt đầu tạm dừng").placeholder, "1:06:58", "the start shows what Lấy would take")
  await click(within("Tạm dừng", "Lấy lúc dừng"))
  assert.equal(field("Mốc video bắt đầu tạm dừng").value, "1:06:58")
  await type(field("Mốc video tiếp tục ván"), "1:08:28")
  await click(button("Thêm"))
  assert.deepEqual(kept.content().timeline?.pauses, [{ atSeconds: 300, durationSeconds: 90 }])
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi tạm dừng lúc 5:00, dừng 1:30")
  await click(button("Xóa đoạn tạm dừng"))
  assert.deepEqual(kept.content().timeline?.pauses, [])
  await act(async () => kept.undo())
  assert.equal(kept.content().timeline?.pauses.length, 1)
})

test("a position outside the game is not offered as the start of a pause", async () => {
  await tool({ at: 4800 })
  assert.equal(field("Mốc video bắt đầu tạm dừng").value, "")
})

test("a pause that ends before it begins cannot be added", async () => {
  await tool({ at: 4018 })
  await type(field("Mốc video bắt đầu tạm dừng"), "1:06:58")
  await type(field("Mốc video tiếp tục ván"), "1:00:00")
  assert.equal(button("Thêm")!.disabled, true)
})

test("without a place in a video the length is typed, and the marks are not asked for", async () => {
  const kept = await tool({ content: recordedGame({ sourceTimestampSeconds: undefined }), videoId: null })
  assert.equal(group("Vào trận"), null)
  await type(field("Thời lượng ván"), "15:00")
  await click(within("Thời lượng", "Lưu"))
  assert.equal(kept.content().durationSeconds, 900)
})

test("a link is written for the whole match or for this game alone, and its time is never taken as 0:00", async () => {
  const kept = await tool({ row: "video" })
  await type(field("Liên kết video YouTube"), "không phải liên kết")
  assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Chỉ nhận liên kết YouTube/)
  await type(field("Liên kết video YouTube"), "https://youtu.be/R5rCsGqDJIg?t=1740")
  await click(button("Chỉ ván này"))
  await click(within("Video", "Lưu"))
  assert.deepEqual(links, [["https://youtu.be/R5rCsGqDJIg?t=1740", "game"]])
  assert.equal(kept.content().sourceTimestampSeconds, 3718)
})

test("the video says whether the whole match uses it", async () => {
  await tool({ others: [view("g1", { ...recordedGame(), number: 1 }), view("g2", recordedGame())] })
  await waitFor(() => group("Video").textContent?.includes("j8AvYygkzm4, cả trận dùng"))
})

test("what is wrong with the game is told in words, and only what is", async () => {
  const issue = (gameId: string, text: string): TimingIssue => ({ gameId, kind: "overlap", from: 0, to: 1, text })
  await tool({
    issues: [issue("g2", "Ván 2 chồng ván 3."), issue("g5", "Ván 5 chồng ván 6.")],
    document: { missingFields: ["sides[0].participants[0].hero", "number.exceedsBestOf"] },
  })
  const text = group("Cần xem lại").textContent ?? ""
  assert.match(text, /Ván 2 chồng ván 3\./)
  assert.match(text, /Số ván vượt quá thể thức BO của trận\./)
  assert.doesNotMatch(text, /Ván 5|Tướng/, "what lacks is recorded elsewhere")
})

test("viewing, everything is read and only the marks can be pressed", async () => {
  await tool({ editable: false, content: recordedGame({ mvpPlayerId: "b-MID", note: "Ghi chú của ván" }) })
  const labels = [...document.querySelectorAll("button")].map((entry) => entry.getAttribute("aria-label"))
  assert.deepEqual(labels, [
    "Tới lúc bắt đầu cấm chọn, ▸52:34",
    "Tới lúc chốt đội hình, ▸58:10",
    "Tới lúc vào trận, ▸1:01:58",
    "Tới lúc kết thúc, ▸1:15:20",
  ])
  const text = document.body.textContent ?? ""
  for (const part of ["CRI", "CRI Mid", "13:22", "Ghi chú của ván", "Chưa xuất bản"])
    assert.ok(text.includes(part), part)
})

test("an unpublished game leads to the panel that publishes it", async () => {
  const kept = await tool()
  await click(button("Xuất bản…"))
  assert.deepEqual(kept.opened, ["publish"])
})

test("a mark typed by hand follows the same rules", async () => {
  const kept = await tool()
  const menu = group("Chốt đội hình").querySelector<HTMLElement>('[aria-haspopup="menu"]')!
  await act(async () => menu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await click(
    await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find((entry) => entry.textContent === "Gõ mốc…"),
    ),
  )
  await type(field("Mốc chốt đội hình"), "40:00")
  assert.match(group("Chốt đội hình").textContent ?? "", /phải sau lúc bắt đầu cấm chọn/)
  await type(field("Mốc chốt đội hình"), "58:20")
  await act(async () => field("Mốc chốt đội hình").form!.requestSubmit())
  await flush()
  assert.equal(kept.content().draft?.lockedSecond, 3500)
  assert.equal(VIDEO_URL, kept.content().sourceUrl)
})

test("the mark chosen to be typed takes the focus from the menu", async () => {
  await tool()
  const menu = group("Chốt đội hình").querySelector<HTMLElement>('[aria-haspopup="menu"]')!
  await act(async () => menu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await click(
    await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find((entry) => entry.textContent === "Gõ mốc…"),
    ),
  )
  await waitFor(() => document.activeElement === field("Mốc chốt đội hình"), "the typed mark has the focus")
})

test("the clock shown by the game is typed over a faint clock that goes on with the video", async () => {
  const kept = await tool({ content: recordedGame({ durationSeconds: null }), at: 4158 })
  assert.equal(field("Đồng hồ trên màn hình").placeholder, "7:20")
  await act(async () => kept.play(4758))
  assert.equal(field("Đồng hồ trên màn hình").placeholder, "17:20")
  assert.equal(field("Đồng hồ trên màn hình").value, "")
  assert.equal(group("Đồng hồ game").querySelectorAll("button").length, 0, "nothing to do until a clock is typed")
})

test("a pause is taken where the game stops and added where it runs again", async () => {
  const kept = await tool({ at: 4018 })
  await act(async () => kept.play(4100))
  await click(within("Tạm dừng", "Lấy lúc dừng"))
  assert.equal(field("Mốc video bắt đầu tạm dừng").value, "1:08:20")
  await act(async () => kept.play(4190))
  await click(within("Tạm dừng", "Lấy lúc chạy lại"))
  assert.deepEqual(kept.content().timeline?.pauses, [{ atSeconds: 382, durationSeconds: 90 }])
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi tạm dừng lúc 6:22, dừng 1:30")
  assert.equal(field("Mốc video bắt đầu tạm dừng").value, "", "the form is ready for the next pause")
})

test("two pauses removed one after the other within one save both stay removed", async () => {
  const pauses = [
    { atSeconds: 300, durationSeconds: 60 },
    { atSeconds: 610, durationSeconds: 95 },
  ]
  const kept = await tool({ content: recordedGame({ timeline: { events: [], pauses } }) })
  const answer = kept.hold()
  const removals = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Xóa đoạn tạm dừng"]')]
  await click(removals[0])
  await click(removals[1])
  answer()
  await waitFor(() => kept.changes.length === 2)
  assert.deepEqual(kept.content().timeline?.pauses, [])
})

test("a mark is checked against the game that follows the second it would stand at", async () => {
  const third = view("g3", { ...emptyGame(), number: 3, sourceTimestampSeconds: 2400, durationSeconds: 600 })
  const unplaced = recordedGame({ sourceTimestampSeconds: undefined, draft: undefined })
  const kept = await tool({ content: unplaced, at: 1700, others: [third] })
  await waitFor(() => within("Vào trận", "Lấy ▸28:20")?.getAttribute("aria-disabled") === "true")
  await act(async () => kept.play(3120))
  assert.equal(within("Vào trận", "Lấy ▸52:00")!.hasAttribute("aria-disabled"), false, "game 3 is over by then")
})

test("no mark of a game is taken while the video is inside another game", async () => {
  const first = view("g1", { ...emptyGame(), number: 1, sourceTimestampSeconds: 95, durationSeconds: 1122 })
  const unplaced = recordedGame({ sourceTimestampSeconds: undefined, draft: undefined })
  const kept = await tool({ content: unplaced, at: 300, others: [first] })
  const take = await waitFor(() => within("Vào trận", "Lấy ▸5:00"))
  await waitFor(() => take.getAttribute("aria-disabled") === "true")
  await click(take)
  assert.equal(kept.content().sourceTimestampSeconds, undefined)
  assert.equal(kept.said.at(-1), "Đang trong ván 1: kết thúc ván 1 hoặc tua ra ngoài ván.")
})
