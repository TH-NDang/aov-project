import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { act } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { button, choose, click, type, waitFor } from "./fixtures/dom"
import { game, game2, series, SERIES_ID } from "./fixtures/esports-data"
import { elsewhere, isGameWrite, press, said, studioPage } from "./fixtures/esports-studio"
import { json } from "./fixtures/network"
import { holdPoll } from "./fixtures/esports-ui"

const open = studioPage()

const pointer = (type: string, clientX: number) =>
  new window.MouseEvent(type, { bubbles: true, clientX, clientY: 100, button: 0 })

/** The track measured as one pixel a second, so a pointer's place is the second it is at. */
function measureTrack() {
  const slider = document.querySelector<HTMLElement>('[role="slider"]')!
  const length = Number(slider.getAttribute("aria-valuemax"))
  slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: length, height: 228 }) as DOMRect
}

/** Drags a handle of the timeline by some seconds. */
async function drag(handle: Element, from: number, to: number) {
  await act(async () => handle.dispatchEvent(pointer("pointerdown", from)))
  await act(async () => window.dispatchEvent(pointer("pointermove", to)))
  await act(async () => window.dispatchEvent(pointer("pointerup", to)))
}

const named = (label: string) => document.querySelectorAll(`[aria-label="${label}"]`)

test("the screen has one way to play, one position slider and nothing that floats over the video", async () => {
  await open("?edit=1&t=300")
  assert.equal(named("Phát").length, 1)
  assert.equal(named("Lùi 10 giây").length, 1)
  assert.equal(named("Tới 10 giây").length, 1)
  assert.equal(document.querySelectorAll('[role="slider"]').length, 1)
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0)
})

test("a compact screen puts the next step above what is recorded", async (t) => {
  window.matchMedia = ((media: string) => ({
    matches: media.includes("899.98px"),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  t.after(() => Reflect.deleteProperty(window, "matchMedia"))
  await open("?edit=1&t=300")
  const parts = [...document.querySelectorAll(".esp-dock > *")].map((part) => part.className.split(" ")[0])
  assert.deepEqual(parts, ["esp-games", "esp-tools", "esp-notice", "esp-foot", "esp-body"])
})

test("the head names both teams with the score, and leads to this match in its tournament's schedule", async () => {
  await open("")
  assert.match(document.querySelector("h1")?.textContent ?? "", /AZT.*3 – 1.*EMW/)
  assert.match(
    document.querySelector(".esp-head-trail a")?.getAttribute("href") ?? "",
    /^\/tournaments\/fx-tournament\?step=schedule&match=[\w-]+$/,
  )
})

test("a match opened from the schedule goes back to it, at the place it was left", async () => {
  await open("", { fromSchedule: "/tournaments/fx-tournament?step=schedule&stage=GROUPS&key=m4" })
  await click(document.querySelector<HTMLElement>(".esp-head-back")!)
  assert.equal(elsewhere(), "/tournaments/fx-tournament?step=schedule&stage=GROUPS&key=m4")
})

test("viewing has nothing to move on the timeline and no foot", async () => {
  await open("?t=300")
  assert.equal(document.querySelectorAll("[data-movable]").length, 0)
  assert.equal(document.querySelector(".esp-foot"), null)
})

test("recording can be switched on from the head", async () => {
  await open("?t=300")
  await click(button("Ghi"))
  assert.ok(document.querySelector(".esp-foot"))
  assert.ok(document.querySelectorAll("[data-movable]").length > 0)
})

test("the part on the desk follows what the video shows until one is chosen", async () => {
  await open("?edit=1&t=20")
  const pressed = () => document.querySelector('.esp-tools [aria-pressed="true"]')?.textContent ?? ""
  assert.match(pressed(), /Cấm chọn/)
  for (const shiftKey of [false, false, true, true]) await press("l", document.body, { shiftKey })
  assert.match(pressed(), /Diễn biến/, "1:40 of the video is inside the game")
  await click(button("Ván đấu", document.querySelector(".esp-tools")!))
  await press("Home")
  assert.match(pressed(), /Ván đấu/)
})

/** The game on the desk, as its tab says it. */
const current = () => document.querySelector('.esp-games [aria-current="true"]')?.getAttribute("aria-label") ?? ""
const tab = (index: number) => document.querySelectorAll(".esp-games .esp-tab")[index]
const clock = () => document.querySelector('[role="slider"]')!.getAttribute("aria-valuetext")

test("another game is chosen without making the player again", async () => {
  const { players } = await open("?edit=1&t=300")
  // A paused video, which is sought; one that was never played is loaded at the second instead.
  await act(async () => players[0]!.report(2))
  await click(tab(1))
  assert.match(current(), /^Ván 2,/)
  assert.equal(players.length, 1)
  assert.equal(players[0]!.destroyed, false)
  assert.equal(players[0]!.seeks.at(-1), 1500, "the game is entered where its ban/pick phase begins")
})

/** The screen at an address, its player read only when the test says so. */
async function openRead(t: TestContext, search: string) {
  const timed = window.setInterval
  t.after(() => {
    window.setInterval = timed
  })
  const read = holdPoll()
  const { players } = await open(search)
  return { player: players[0]!, read }
}

test("a video that starts slowly leaves the desk at its second and in its game", async (t) => {
  const { player, read } = await openRead(t, "?edit=1&t=1600")
  await press(" ")
  await act(async () => player.report(3))
  await read(5)
  assert.equal(clock(), "26:40")
  assert.match(current(), /^Ván 2,/)
})

test("the second before a seek does not take the desk back, however late the player tells it", async (t) => {
  const { player, read } = await openRead(t, "?edit=1&t=300")
  await act(async () => player.report(1))
  player.time = 300
  await read()
  await click(tab(1))
  for (const late of [300.2, 300.4, 300.6]) {
    player.time = late
    await read()
  }
  assert.equal(clock(), "25:00")
  assert.match(current(), /^Ván 2,/)
  player.time = 1500.4
  await read()
  assert.equal(clock(), "25:00")
})

test("a video that does not go where it was sent takes the desk back to where it plays", async (t) => {
  const { player, read } = await openRead(t, "?edit=1&t=300")
  await act(async () => player.report(1))
  await click(tab(1))
  for (let reading = 0; reading <= 10; reading++) {
    player.time = 300 + reading / 5
    await read()
  }
  assert.equal(clock(), "5:02")
  assert.match(current(), /^Ván 1,/)
})

test("a press on the game that is on the desk leaves the video where it is", async () => {
  const { players } = await open("?edit=1&t=300")
  await click(tab(0))
  assert.deepEqual(players[0]!.seeks, [])
  assert.equal(clock(), "5:00")
})

test("a game with a video of its own loads it into the same player", async () => {
  const own = { ...game2, content: { ...game2.content, sourceUrl: "https://youtu.be/j8AvYygkzm4" } }
  const { players } = await open("?edit=1&t=300", { games: [game, own] })
  await click(tab(1))
  assert.match(current(), /^Ván 2,/)
  assert.equal(players.length, 1)
  assert.deepEqual(players[0]!.cued, [{ videoId: "j8AvYygkzm4", startSeconds: 1500 }])
  assert.equal(clock(), "25:00")
})

test("a game without a place in the video is chosen without moving it, and stays while the video is in another", async () => {
  const unplaced = {
    ...game2,
    content: { ...game2.content, sourceTimestampSeconds: undefined, draft: undefined, timeline: undefined },
  }
  const { players } = await open("?edit=1&t=300", { games: [game, unplaced] })
  await click(tab(1))
  assert.match(current(), /^Ván 2,.*chưa đặt mốc trên video/)
  assert.deepEqual(players[0]!.seeks, [])
  await press("l")
  assert.match(current(), /^Ván 2,/)
})

test("numbers the score counts are offered while recording, and say how their game starts", async () => {
  await open("?edit=1&t=1400")
  await click(button("Ván 3, chưa ghi"))
  const body = document.querySelector(".esp-body")?.textContent ?? ""
  assert.match(body, /Tỷ số 3 – 1 cho biết trận có 4 ván\./)
  assert.match(body, /Tua tới màn cấm chọn của ván 3\./)
  assert.match(body, /Ghi nhanh 2 ván thiếu/)
  assert.match(document.querySelector(".esp-next")?.textContent ?? "", /Cấm chọn ván 3▸23:20/)
})

test("a game is made where the video stands and comes on the desk with its draft", async () => {
  const { saves } = await open("?edit=1&t=3000")
  await click(button("Ván 3, chưa ghi"))
  await click(button("Cấm chọn ván 3"))
  await waitFor(() =>
    document.querySelector('.esp-games [aria-current="true"]')?.getAttribute("aria-label")?.startsWith("Ván 3,"),
  )
  assert.equal(saves[0]!.draft?.startSecond, 3000)
  assert.equal(saves[0]!.number, 3)
  assert.match(document.querySelector('.esp-tools [aria-pressed="true"]')?.textContent ?? "", /Cấm chọn/)
})

/** Moves 0:00 of game 1 from 1:35 to 1:50 of the video. */
async function moveStart() {
  measureTrack()
  await drag(document.querySelector('[data-edge="gameStart"][data-movable]')!, 95, 110)
}

test("a drag is saved through the game, told in the foot and taken back there", async () => {
  const { saves } = await open("?edit=1&t=300")
  await moveStart()
  await waitFor(() => /Đã dời lúc vào trận: ▸1:35 → ▸1:50/.test(said()), "The foot did not tell the move")
  assert.equal(saves.at(-1)!.sourceTimestampSeconds, 110)

  await click(button("Hoàn tác"))
  await waitFor(() => /Đã hoàn tác: dời lúc vào trận/.test(said()))
  assert.equal(saves.at(-1)!.sourceTimestampSeconds, 95)
  assert.equal(button("Hoàn tác"), undefined, "nothing is left to take back")
})

test("Ctrl + Z takes back the last change of the game", async () => {
  const { saves } = await open("?edit=1&t=300")
  await moveStart()
  await waitFor(() => /Đã dời/.test(said()))
  await press("z", document.body, { ctrlKey: true })
  await waitFor(() => saves.length === 2)
  assert.equal(saves.at(-1)!.sourceTimestampSeconds, 95)
})

test("a change that is refused says so and offers the newer version", async () => {
  const { games } = await open("?edit=1&t=300")
  games[0] = { ...games[0]!, version: 7 }
  await moveStart()
  const alert = await waitFor(() => document.querySelector('.esp-foot [role="alert"]'))
  assert.match(alert.textContent ?? "", /^Không lưu được: .*Tải bản mới$/)
})

test("a change the service finds invalid is told without offering a newer version", async () => {
  const { service } = await open("?edit=1&t=300")
  service.gate = (request, answer) =>
    isGameWrite(request) ? json({ code: "TOURNAMENT_INVALID_CONTENT", detail: "Invalid content" }, 422) : answer()
  await moveStart()
  const alert = await waitFor(() => document.querySelector('.esp-foot [role="alert"]'))

  assert.deepEqual([/^Không lưu được: /.test(alert.textContent ?? ""), !!button("Tải bản mới")], [true, false])
})

test("a match that cannot be read again stays on the desk with what was read before", async () => {
  const { games, service } = await open("?edit=1&t=300")
  games[0] = { ...games[0]!, version: 7 }
  await moveStart()
  await waitFor(() => button("Tải bản mới"))

  service.down = true
  await click(button("Tải bản mới"))
  await waitFor(() => /^Không tải được bản mới: /.test(said()), "The foot did not tell that nothing was read")
  assert.match(current(), /^Ván 1,/)

  service.down = false
  await click(button("Tải bản mới"))
  await waitFor(() => !document.querySelector('.esp-foot [role="alert"]'), "The newer version was not taken")
})

const part = (name: string) => click(button(name, document.querySelector(".esp-tools")!), name)
const seat = (key: string) => document.querySelector<HTMLElement>(`[data-seat="${key}"]`)

test("an edit of a player is saved through the game, told in the foot and taken back with Ctrl + Z", async () => {
  const { saves } = await open("?edit=1&t=300")
  await part("Đội hình")
  await click(seat("BLUE:TOP")!.querySelector('[aria-label="Phụ trợ: Tốc biến"]'))
  await click(button("Cấp cứu", document.querySelector('[data-part="spell"]')!))
  await waitFor(() => /Đã ghi phụ trợ của AZT Rock: Cấp cứu/.test(said()), "The foot did not tell the spell")
  const spell = () => saves.at(-1)!.sides[0]!.participants[0]!.spell?.name
  assert.equal(spell(), "Cấp cứu")

  await press("z", document.body, { ctrlKey: true })
  await waitFor(() => saves.length === 2)
  assert.equal(spell(), "Tốc biến")
  assert.equal(button("Tốc biến", document.querySelector('[data-part="spell"]')!)?.getAttribute("aria-pressed"), "true")
})

test("an edit of a player that is refused goes back to what is saved, and the foot says why", async () => {
  const { games } = await open("?edit=1&t=300")
  games[0] = { ...games[0]!, version: 7 }
  await part("Đội hình")
  await click(seat("BLUE:TOP")!.querySelector('[aria-label="Phụ trợ: Tốc biến"]'))
  const pressed = () => document.querySelector('[data-part="spell"] [aria-pressed="true"]')?.textContent
  await click(button("Cấp cứu", document.querySelector('[data-part="spell"]')!))
  await waitFor(() => document.querySelector('.esp-foot [role="alert"]'), "The foot did not tell the refusal")
  assert.match(said(), /^Không lưu được: /)
  assert.match(pressed() ?? "", /Tốc biến/)
})

test("the part that is open, asked for again, starts at its beginning", async () => {
  await open("?edit=1&t=300")
  await part("Đội hình")
  await click(seat("RED:MID")!.querySelector("button.esp-seat-open"))
  assert.equal(seat("RED:MID"), null, "one player stands in the place of the board")
  await part("Đội hình")
  assert.ok(seat("RED:MID"))
})

test("a game that was imported with its result alone takes a player all the same", async () => {
  const bare = {
    ...game,
    content: {
      ...game.content,
      draft: undefined,
      timeline: undefined,
      sides: game.content.sides.map((side) => ({ ...side, bans: [], participants: [] })),
    },
  }
  const { saves } = await open("?edit=1&t=300", { games: [bare] })
  await part("Đội hình")
  await choose(
    document.querySelector<HTMLSelectElement>('select[aria-label="Tuyển thủ Đường giữa của Azure Tide"]')!,
    "fx-azure-p2",
  )
  await waitFor(() => saves.length === 1, "Nothing was saved")
  assert.deepEqual(
    saves[0]!.sides[0]!.participants.map(({ lane, playerId }) => [lane, playerId]),
    [
      ["TOP", null],
      ["JUNGLE", null],
      ["MID", "fx-azure-p2"],
      ["DRAGON", null],
      ["SUPPORT", null],
    ],
  )
})

test("a link to a second between two games opens the game before it", async () => {
  await open("?edit=1&t=2900")
  assert.match(current(), /^Ván 2,/)
})

test("a panel of the match stands in the place of the part and closes with Esc", async () => {
  await open("?edit=1&t=300")
  await click(button("Xuất bản", document.querySelector(".esp-head")!))
  assert.match(document.querySelector(".esp-panel-head")?.textContent ?? "", /Xuất bản/)
  assert.equal(document.querySelector('.esp-tools [aria-pressed="true"]'), null)
  assert.equal(document.querySelector(".esp-next"), null, "the panel has its own button")
  await press("Escape")
  assert.equal(document.querySelector(".esp-panel-head"), null)
})

test("the game that is typed in stays on the desk until the form is closed", async () => {
  await open("?edit=1&t=300")
  await press("e")
  assert.ok(document.querySelector(".esp-body form"), "the form of a moment is open")
  measureTrack()
  const slider = document.querySelector<HTMLElement>('[role="slider"]')!
  await act(async () => slider.dispatchEvent(pointer("pointerdown", 1600)))
  await act(async () => slider.dispatchEvent(pointer("pointerup", 1600)))
  assert.equal(clock(), "26:40", "the video is in game 2")
  assert.match(current(), /^Ván 1,/)
  await press("Escape")
  assert.match(current(), /^Ván 2,/)
})

const unlinked = (entry: DocumentView<GameContent>) => ({
  ...entry,
  content: { ...entry.content, sourceUrl: undefined },
})
const withoutSource = series.map((entry) =>
  entry.id === SERIES_ID ? { ...entry, content: { ...entry.content, sourceUrl: undefined } } : entry,
)

test("a match without a video asks for the link of one, which every game then carries", async () => {
  const { saves } = await open("?edit=1", {
    games: [unlinked(game), unlinked(game2)],
    series: withoutSource,
    video: false,
  })
  const link = document.querySelector<HTMLInputElement>('[aria-label="Liên kết YouTube của trận"]')!
  await type(link, "https://example.test/video")
  assert.equal(button("Gắn video")!.disabled, true)
  assert.match(document.querySelector(".esp-linkrow")?.textContent ?? "", /Chỉ nhận liên kết YouTube/)

  await type(link, "https://youtu.be/R5rCsGqDJIg?t=1740")
  await click(button("Gắn video"))
  await waitFor(() => saves.length === 2)
  assert.deepEqual(
    saves.map((content) => [content.sourceUrl, content.sourceTimestampSeconds]),
    [
      ["https://youtu.be/R5rCsGqDJIg?t=1740", 95],
      ["https://youtu.be/R5rCsGqDJIg?t=1740", 1800],
    ],
    "the second in the link is never taken as 0:00",
  )
  await waitFor(() => button("Tới ▸29:00"), "The foot did not offer the second of the link")
})

test("a link that stands ready leaves its own button as the one thing to press", async () => {
  await open("?edit=1", { games: [unlinked(game)], series: withoutSource, video: false })
  assert.match(document.querySelector(".esp-next")?.textContent ?? "", /Thêm ván 2/)
  const link = document.querySelector<HTMLInputElement>('[aria-label="Liên kết YouTube của trận"]')!
  await type(link, "https://youtu.be/R5rCsGqDJIg")
  assert.equal(document.querySelector(".esp-next"), null)
  assert.equal(button("Gắn video")!.disabled, false)
})

test("a match without a video is viewed without a word about places in one", async () => {
  await open("", { games: [unlinked(game)], series: withoutSource, video: false })
  assert.match(document.querySelector(".esp-linkrow")?.textContent ?? "", /Trận chưa có video\. Bật Ghi để gắn video\./)
  assert.doesNotMatch(document.querySelector(".esp-games [aria-label]")?.getAttribute("aria-label") ?? "", /video/)
})
