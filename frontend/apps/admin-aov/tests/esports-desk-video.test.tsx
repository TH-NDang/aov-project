import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { answerConfirm, button, click, confirmDialog, flush, type, waitFor } from "./fixtures/dom"
import { game, game2 } from "./fixtures/esports-data"
import { clock, current, press, said, studioPage, tab } from "./fixtures/esports-studio"

const open = studioPage()

const OWN = "https://youtu.be/j8AvYygkzm4"
const changed = (entry: DocumentView<GameContent>, change: Partial<GameContent>): DocumentView<GameContent> => ({
  ...entry,
  content: { ...entry.content, ...change },
})
const pointer = (kind: string, clientX: number) =>
  new window.MouseEvent(kind, { bubbles: true, clientX, clientY: 100, button: 0 })

/** Drags a mark of the track by seconds, the track measured as one pixel a second. */
async function drag(mark: Element, from: number, to: number) {
  const slider = document.querySelector<HTMLElement>('[role="slider"]')!
  const length = Number(slider.getAttribute("aria-valuemax"))
  slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: length, height: 228 }) as DOMRect
  await act(async () => mark.dispatchEvent(pointer("pointerdown", from)))
  await act(async () => window.dispatchEvent(pointer("pointermove", to)))
  await act(async () => window.dispatchEvent(pointer("pointerup", to)))
  await flush()
}

/** Opens the link row of the game tool with the link typed in it. */
async function typeLink(url: string) {
  await click(button("Ván đấu", document.querySelector(".esp-tools")!))
  await click(button("Đổi", document.querySelector('[role=group][aria-label="Video"]')!))
  const field = document.querySelector<HTMLInputElement>('[aria-label="Liên kết video YouTube"]')!
  await type(field, url)
  return field.closest("form")!
}

test("a second typed while the player tells no length is gone to as it was typed", async () => {
  const unplaced = [game, game2].map((entry) => changed(entry, { sourceTimestampSeconds: undefined, draft: undefined }))
  const { players } = await open("?edit=1", { games: unplaced, video: false })
  await waitFor(() => players.length > 0, "The player was not made")
  players[0]!.duration = 0
  await act(async () => players[0]!.events.onReady({ target: players[0]! }))
  await act(async () => players[0]!.events.onError({ data: 150 }))
  await click(document.querySelector('.esp-transport button[aria-label^="Vị trí"]'), "the position of the video")
  const field = document.querySelector<HTMLInputElement>(".esp-transport input")!
  await type(field, "1:09:18")
  await press("Enter", field)
  assert.equal(clock(), "1:09:18")
})

test("a match whose first game has a video of its own opens on that video", async () => {
  // The other games share the video of the match, and none of them has a place in it yet.
  const unplaced = changed(game2, { sourceTimestampSeconds: undefined, draft: undefined })
  const games = [
    changed(game, { sourceUrl: OWN, sourceTimestampSeconds: 120, draft: undefined }),
    unplaced,
    { ...changed(unplaced, { number: 3 }), id: "fx-game-3" },
  ]
  const { players } = await open("?edit=1", { games })
  assert.equal(players[0]!.vars.start, 120)
  assert.equal(clock(), "2:00")
  assert.match(current(), /^Ván 1,/)
})

test("a game whose video is its own is changed alone unless the whole match is asked for", async () => {
  await open("?edit=1&t=300", { games: [game, changed(game2, { sourceUrl: OWN })] })
  await click(tab(1))
  await typeLink("https://youtu.be/R5rCsGqDJIg")
  assert.equal(button("Chỉ ván này")?.getAttribute("aria-pressed"), "true")
})

test("emptying the link of the match asks first, then says the link is gone", async () => {
  const { games } = await open("?edit=1&t=300")
  const link = await typeLink("")
  await click(button("Lưu", link))
  assert.match(confirmDialog()?.textContent ?? "", /Bỏ video của cả trận\?/)
  assert.ok(
    games.every((entry) => entry.content.sourceUrl),
    "nothing is written before the answer",
  )

  await answerConfirm("Bỏ video")
  await waitFor(() => /^Đã bỏ video của cả trận\./.test(said()), "The foot did not say the link is gone")
})

test("another video for the whole match asks first and names the video it replaces", async () => {
  const { games } = await open("?edit=1&t=300")
  const link = await typeLink(OWN)
  await click(button("Lưu", link))
  assert.match(confirmDialog()?.textContent ?? "", /thay cho video R5rCsGqDJIg/)
  assert.ok(
    games.every((entry) => entry.content.sourceUrl !== OWN),
    "nothing is written before the answer",
  )

  await answerConfirm("Đổi video của cả trận")
  await waitFor(() => games.every((entry) => entry.content.sourceUrl === OWN), "The link was not written")
})

test("a video changed for one game is taken back with Hoàn tác", async () => {
  const { games } = await open("?edit=1&t=300")
  const before = games[0]!.content.sourceUrl
  const link = await typeLink(OWN)
  await click(button("Chỉ ván này", link))
  await click(button("Lưu", link))
  await waitFor(() => /^Đã đổi video của ván 1/.test(said()), "The foot did not tell the change")
  assert.equal(games[0]!.content.sourceUrl, OWN)

  await click(button("Hoàn tác", document.querySelector(".esp-foot")!))
  await waitFor(() => games[0]!.content.sourceUrl === before, "The link was not taken back")
})

test("Ctrl + Z after the link of the match is written says what it took back", async () => {
  await open("?edit=1&t=300")
  await press("1")
  await waitFor(() => /^Đã ghi Trụ/.test(said()))
  const link = await typeLink("https://youtu.be/R5rCsGqDJIg?t=10")
  await click(button("Lưu", link))
  await waitFor(() => /^Đã gắn video cho cả trận\./.test(said()))
  await press("z", document.body, { ctrlKey: true })
  await waitFor(() => /^Đã hoàn tác: ghi Trụ của AZT lúc 3:25/.test(said()), "The undo was not told")
})

test("a mark dropped while the video went into the game before is written to the game of the mark", async () => {
  const { games } = await open("?edit=1&t=1510", {
    games: [changed(game, { durationSeconds: null, winner: null }), game2],
  })
  await drag(document.querySelector('[data-edge="draftStart"][data-movable]')!, 1500, 1480)
  await waitFor(() => /^Đã dời lúc bắt đầu cấm chọn/.test(said()))
  assert.deepEqual(
    games.map((entry) => entry.content.draft?.startSecond),
    [game.content.draft?.startSecond, 1480],
  )
})

test("a 0:00 dropped inside the game it clashes with is written to its own game", async () => {
  const clash = [game, changed(game2, { sourceTimestampSeconds: 1200, draft: undefined })]
  const { games } = await open("?edit=1&t=1400", { games: clash })
  await drag(document.querySelector('[data-edge="gameStart"][data-movable]')!, 1200, 1302)
  await waitFor(() => /^Đã dời lúc vào trận/.test(said()))
  assert.deepEqual(
    games.map((entry) => entry.content.sourceTimestampSeconds),
    [game.content.sourceTimestampSeconds, 1302],
  )
})

test("one press on the tab of a game that begins inside another brings it on the desk", async () => {
  await open("?edit=1&t=2500", { games: [game, changed(game2, { sourceTimestampSeconds: 1200, draft: undefined })] })
  await click(tab(1))
  assert.match(current(), /^Ván 2,/)
})
