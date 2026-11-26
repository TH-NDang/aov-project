import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { button, click, flush, waitFor } from "./fixtures/dom"
import { game } from "./fixtures/esports-data"
import { clock, press, said, studioPage } from "./fixtures/esports-studio"

const open = studioPage()

const body = () => document.querySelector(".esp-body")!

test("a player list opened with the mouse gives the next key to the desk instead of picking a player by it", async () => {
  const { saves } = await open("?edit=1&t=300")
  await click(button("Đội hình", document.querySelector(".esp-tools")!))
  const list = await waitFor(() => document.querySelector<HTMLSelectElement>('select[aria-label^="Tuyển thủ"]'))
  const chosen = list.value
  await act(async () => list.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })))
  list.focus()
  assert.equal(await press("e", list), true)
  assert.ok(body().querySelector("form"), "E opens the form of a moment")
  assert.notEqual(document.activeElement, list, "the list let go of the keys")
  assert.equal(list.value, chosen)
  assert.equal(saves.length, 0)
})

test("while a player list opened with the mouse is open, its keys walk its options", async () => {
  await open("?edit=1&t=300")
  await click(button("Đội hình", document.querySelector(".esp-tools")!))
  const list = await waitFor(() => document.querySelector<HTMLSelectElement>('select[aria-label^="Tuyển thủ"]'))
  await act(async () => list.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })))
  list.focus()
  // An open list in the page's own style puts the focus on its options, so their keys go down on an option.
  assert.equal(await press("e", list.options[1]!), false)
  assert.equal(body().querySelector("form"), null)
  assert.equal(document.activeElement, list)
})

test("a key on a player list reached with the keyboard stays with the list", async () => {
  await open("?edit=1&t=300")
  await click(button("Đội hình", document.querySelector(".esp-tools")!))
  const list = await waitFor(() => document.querySelector<HTMLSelectElement>('select[aria-label^="Tuyển thủ"]'))
  list.focus()
  assert.equal(await press("e", list), false)
  assert.equal(body().querySelector("form"), null)
  assert.equal(document.activeElement, list)
})

/** Game 1 in its ban/pick, placed in the video but without its 0:00. */
const drafting = {
  ...game,
  content: {
    ...game.content,
    winner: null,
    durationSeconds: null,
    sourceTimestampSeconds: undefined,
    timeline: undefined,
    draft: { ...game.content.draft!, lockedSecond: null, turns: game.content.draft!.turns.slice(0, 10) },
  },
}

test("the form of a moment does not open in a game that has not begun, and the foot says why", async () => {
  await open("?edit=1&t=60", { games: [drafting] })
  await press("e")
  assert.equal(body().querySelector("form"), null)
  assert.equal(said(), "Ván 1 chưa vào trận.")
})

test("a letter typed after a press on a mark of the track goes to the hero search, not to the keys of the desk", async () => {
  await open("?edit=1&t=60", { games: [drafting] })
  const search = await waitFor(() => document.querySelector<HTMLInputElement>("[data-hero-search][data-keeps-focus]"))
  const mark = await waitFor(() => document.querySelector<HTMLElement>(".esp-track [data-movable]"))
  const at = clock()
  await act(async () => mark.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })))
  mark.focus()
  await act(async () => mark.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true })))
  await flush()
  assert.equal(document.activeElement, mark, "the pressed mark keeps the focus for Alt and the arrows")
  assert.equal(await press("l", mark), false, "the browser types the letter")
  assert.equal(document.activeElement, search)
  assert.equal(clock(), at, "L did not move the video")
})

test("Diễn biến khác in a game that has not begun says why instead of opening the form", async () => {
  await open("?edit=1&t=60", { games: [drafting] })
  await click(button("Diễn biến", document.querySelector(".esp-tools")!))
  await click(button("Diễn biến khác", body()))
  assert.equal(body().querySelector("form"), null)
  assert.equal(said(), "Ván 1 chưa vào trận.")
})

test("Alt and an arrow held on the selected moment move it once, not at every repeat", async () => {
  const { saves } = await open("?edit=1&t=300")
  await click(body().querySelector<HTMLButtonElement>('[data-event="fx-o1"] button'))
  await press("ArrowRight", document.body, { altKey: true })
  await press("ArrowRight", document.body, { altKey: true, repeat: true })
  await press("ArrowRight", document.body, { altKey: true, repeat: true })
  await waitFor(() => saves.length === 1)
  await flush()
  assert.equal(saves.length, 1)
  assert.equal(saves[0]!.timeline!.events.find((event) => event.id === "fx-o1")!.atSeconds, 241)
})
