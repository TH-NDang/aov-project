import assert from "node:assert/strict"
import { afterEach, before, beforeEach, test } from "node:test"
import { act } from "react"
import type { GameContent } from "@aov/community-contracts"
import { MemoryRouter, Route, Routes } from "react-router"
import { VIDEO_MARK } from "../src/features/esports/model/vod"
import { answerMediaQueries, button, click, QuietResizeObserver, render, type, waitFor, withDom } from "./fixtures/dom"
import { esportsBackend } from "./fixtures/esports-backend"
import * as data from "./fixtures/esports-data"
import { mockYouTube } from "./fixtures/esports-ui"
import { fakeBackend } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const service = esportsBackend()
const backend = fakeBackend(
  sessionRoutes({ communityCapabilities: ["tournament:read", "tournament:write", "tournament:publish"] }),
  service.routes,
)
const dom = withDom({
  url: "http://localhost:5175/tournaments",
  globals: () => ({
    fetch: backend.fetch,
    ResizeObserver: QuietResizeObserver,
    CSS: { escape: (value: string) => value },
  }),
})
const players = mockYouTube()
const { MatchPage } = await import("../src/features/esports/pages/match-page")

before(signIn)
beforeEach(() => {
  service.reset()
  localStorage.clear()
  players.length = 0
})
afterEach(() => Reflect.deleteProperty(dom.window, "matchMedia"))

/** The match page at `search`, for the final between Azure Tide and Ember Wolves unless another match is named. */
const openMatch = (search = "", seriesId = data.SERIES_ID) =>
  render(
    <MemoryRouter initialEntries={[`/tournaments/${data.TOURNAMENT_ID}/matches/${seriesId}${search}`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/matches/:seriesId" element={<MatchPage />} />
      </Routes>
    </MemoryRouter>,
  )

const text = () => document.body.textContent ?? ""
const slider = () => document.querySelector<HTMLElement>('[role="slider"]')!
const playhead = () => Number(slider().getAttribute("aria-valuenow"))
const chip = (number: number) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((entry) =>
    entry.textContent?.startsWith(`Ván ${number}`),
  )!
const press = (key: string, extra: KeyboardEventInit = {}) =>
  act(async () => void window.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, ...extra })))
const saved = (id = data.GAME_ID) =>
  service.writes
    .filter((request) => request.method === "PUT" && request.pathname === `/admin/games/${id}`)
    .map((request) => (request.body as { content: GameContent }).content)

test("the match page names both teams and the score, and a game chip brings the video to that game", async () => {
  await openMatch("?t=200")
  await waitFor(() => chip(2), "the games are listed")
  assert.match(text(), /Azure Tide/)
  assert.match(text(), /Ember Wolves/)
  assert.match(document.querySelector('nav[aria-label="Đường dẫn"]')!.textContent ?? "", /Cúp Thử Nghiệm Mùa Thu 2026/)
  assert.equal(chip(1).getAttribute("aria-selected"), "true", "the playhead at 3:20 is inside game 1")
  assert.equal(playhead(), 200)
  assert.equal(button("Chế độ ghi")?.getAttribute("aria-pressed"), "false")

  await click(chip(2))
  assert.equal(chip(2).getAttribute("aria-selected"), "true")
  assert.equal(playhead(), 1500, "game 2 starts with its ban/pick phase")
  assert.match(text(), /Đang phát · Ván 2/)
})

test("arrow and letter keys jump the video and a short note says where it went", async () => {
  await openMatch("?t=200")
  await waitFor(() => chip(1))

  await press("ArrowRight")
  assert.equal(playhead(), 205)
  assert.equal(document.querySelector('[role="status"]')?.textContent, `+5 giây · ${VIDEO_MARK} 3:25`)
  await press("j", { shiftKey: true })
  assert.equal(playhead(), 175)
  await press(",")
  assert.equal(playhead(), 174)
  await press("ArrowLeft", { shiftKey: true })
  assert.equal(playhead(), 173)
  assert.equal(document.querySelector('[role="status"]')?.textContent, `−1 giây · ${VIDEO_MARK} 2:53`)
})

test("Home returns to the start of the game and the brackets step from moment to moment", async () => {
  await openMatch("?t=200")
  await waitFor(() => chip(1))
  await waitFor(() => document.querySelectorAll(".esp-pill").length > 0, "the moments are on the bar")

  await press("Home")
  assert.equal(playhead(), 0, "game 1 starts with its ban/pick phase at the start of the video")
  await press("]")
  assert.equal(playhead(), 113, "the first finished item, bought at ⏱0:18")
  await press("]")
  assert.equal(playhead(), 117, "the next one, at ⏱0:22")
  await press("[")
  assert.equal(playhead(), 113)
})

test("? opens the list of shortcuts, with the recording keys only while recording", async () => {
  const { unmount } = await openMatch("?t=200")
  await waitFor(() => chip(1))
  await press("?")
  await waitFor(() => /Phím tắt khi xem video/.test(text()), "the shortcut list opens")
  assert.doesNotMatch(text(), /Ghi hạ gục \/ mục tiêu/)
  await unmount()

  await openMatch("?edit=1&t=200")
  await waitFor(() => chip(1))
  await press("?")
  await waitFor(() => /Ghi hạ gục \/ mục tiêu \/ trang bị \/ khoảnh khắc/.test(text()), "recording keys are listed")
})

test("recording mode shows the game tools and a key opens the composer of the focused game", async () => {
  await openMatch("?edit=1&t=200")
  await waitFor(() => chip(1))
  assert.equal(button("Đang ghi")?.getAttribute("aria-pressed"), "true")
  for (const label of [
    "Video & kết thúc ván",
    "Cấm chọn",
    "Tuyển thủ, ngọc, trang bị",
    "Ghi sự kiện",
    "Thông tin ván 1",
  ])
    assert.ok(button(label), `${label} is offered`)
  assert.ok(document.querySelector('[aria-label="Tiến độ ghi ván 1"]'))
  assert.equal(document.querySelectorAll("[data-add]").length, 3, "the timeline records on its rows")

  await press("k")
  await waitFor(() => /Ghi sự kiện · Ván 1/.test(text()), "the composer opens in game 1")
})

test("a new game starts at the playhead only outside the games already placed on the video", async () => {
  const { unmount } = await openMatch("?edit=1&t=200")
  const inside = await waitFor(() => button("Bắt đầu cấm chọn ván 3"))
  assert.equal(inside.disabled, true)
  assert.equal(inside.title, "Đang trong ván 1: kết thúc ván 1 hoặc tua ra ngoài ván")
  await unmount()

  await openMatch("?edit=1&t=2850")
  const after = await waitFor(() => button("Bắt đầu cấm chọn ván 3"))
  assert.equal(after.disabled, false, "past the end of game 2 the next game can start")
  assert.equal(after.textContent?.trim(), `Bắt đầu cấm chọn ván 3 tại ${VIDEO_MARK} 47:30`)
})

test("a ban/pick phase goes live where the video is paused", async () => {
  const { sourceTimestampSeconds: _start, ...waiting } = data.game.content
  service.reset([{ ...data.game, content: waiting }])
  await openMatch("?edit=1&t=310")
  const live = await waitFor(() => button("Vào trận 1 tại"))
  assert.equal(live.disabled, false)

  await click(live)
  await waitFor(() => saved().length === 1, "the game start is saved")
  assert.equal(saved()[0]!.sourceTimestampSeconds, 310)
  assert.equal(saved()[0]!.sourceUrl, data.game.content.sourceUrl)
})

test("a marker moved on the bar is saved at once and can be put back with one click", async () => {
  await openMatch("?edit=1&t=200")
  await waitFor(() => document.querySelector('[data-edge="gameStart"][data-chapter="fx-game-1"][data-movable]'))
  const duration = Number(slider().getAttribute("aria-valuemax"))
  slider().getBoundingClientRect = () => ({ left: 0, top: 0, width: duration, height: 158 }) as DOMRect
  const flag = document.querySelector<HTMLElement>('[data-edge="gameStart"][data-chapter="fx-game-1"]')!
  const pointer = (type: string, clientX: number) =>
    new window.MouseEvent(type, { bubbles: true, clientX, clientY: 0, button: 0 })
  await act(async () => void flag.dispatchEvent(pointer("pointerdown", 95)))
  await act(async () => void window.dispatchEvent(pointer("pointermove", 100)))
  await act(async () => void window.dispatchEvent(pointer("pointerup", 100)))

  await waitFor(() => saved().length === 1, "the new game start is saved")
  assert.equal(saved()[0]!.sourceTimestampSeconds, 100)
  const notice = await waitFor(() => button("Hoàn tác")?.closest('[role="status"]'), "the undo is offered")
  assert.ok(
    notice.textContent?.startsWith(
      `Đã đổi giây · Vào trận · Ván 1: ${VIDEO_MARK} 1:35 → 1:40 · sự kiện của ván dời theo`,
    ),
  )

  await click(button("Hoàn tác"))
  await waitFor(() => saved().length === 2, "the old game start is saved again")
  assert.equal(saved()[1]!.sourceTimestampSeconds, 95)
  assert.equal(button("Hoàn tác"), undefined, "an undo is used once")
})

test("a match without games takes its video first, then starts the ban/pick phase of game 1 at the playhead", async () => {
  await openMatch("?edit=1", "fx-series-semi")
  const link = await waitFor(() => document.querySelector<HTMLInputElement>('[aria-label="Link YouTube của cả trận"]'))
  assert.match(text(), /Gắn video YouTube của cả trận\./, "the setup guide starts with the video")

  await type(link, "https://example.test/video")
  assert.match(text(), /Chỉ nhận link YouTube/)
  assert.equal(button("Gắn video")!.disabled, true)
  await type(link, "https://youtu.be/R5rCsGqDJIg?t=600")
  await act(async () => void link.form!.requestSubmit())
  await waitFor(() => players.length === 1, "the video player opens on the attached video")
  assert.equal(localStorage.getItem("esports:match-video:fx-series-semi"), "https://youtu.be/R5rCsGqDJIg?t=600")
  assert.equal(playhead(), 600, "the link's own time becomes the playhead")

  await click(button("Bắt đầu cấm chọn ván 1"))
  const create = await waitFor(() => service.writes.find((request) => request.method === "POST"))
  const content = (create.body as { content: GameContent }).content
  assert.equal(content.number, 1)
  assert.equal(content.sourceUrl, "https://youtu.be/R5rCsGqDJIg?t=600")
  assert.deepEqual(content.draft, { startSecond: 600, lockedSecond: null, turns: [] })
  await waitFor(() => /Cấm chọn · Ván 1/.test(text()), "the ban/pick panel of the new game opens")
  assert.equal(localStorage.getItem("esports:match-video:fx-series-semi"), null, "the game now carries the video")
})

test("on a phone the feed and the scoreboard are tabs and a floating button records a moment", async () => {
  answerMediaQueries(dom.window, (query) => query === "(max-width: 639px)")
  await openMatch("?edit=1&t=200")
  await waitFor(() => chip(1))
  const tabs = document.querySelector('nav[aria-label="Nội dung ván"]')!
  assert.deepEqual(
    [...tabs.querySelectorAll("button")].map((tab) => [tab.textContent?.trim(), tab.getAttribute("aria-pressed")]),
    [
      ["Diễn biến", "true"],
      ["Bảng điểm", "false"],
    ],
  )
  assert.ok(button("Video"), "the tools keep short names")
  assert.equal(button("Video & kết thúc ván"), undefined)

  await click(document.querySelector('button.fixed[aria-label="Ghi sự kiện"]'), "the floating record button")
  await waitFor(() => /Ghi sự kiện · Ván 1/.test(text()), "the composer opens in game 1")
})

test("a match that does not exist says so and links back to its tournament", async () => {
  await openMatch("", "missing-series")
  await waitFor(() => /Không tìm thấy trận đấu/.test(text()))
  assert.equal(
    [...document.querySelectorAll("a")].find((anchor) => anchor.textContent === "Về trang giải")?.getAttribute("href"),
    `/tournaments/${data.TOURNAMENT_ID}`,
  )
})
