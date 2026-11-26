import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { asBrowser } from "./fixtures/browser-events"
import { button, click, type, waitFor } from "./fixtures/dom"
import { game2 } from "./fixtures/esports-data"
import { current, draftingGame, heldReadings, studioPage } from "./fixtures/esports-studio"

const open = studioPage()

const body = () => document.querySelector(".esp-body")!
const search = () => waitFor(() => document.querySelector<HTMLInputElement>("[data-hero-search]"))
/** Types the way a browser delivers the key, which is where a state set too early drops it. */
const typeKey = (field: HTMLInputElement, text: string) => asBrowser(["input"], () => type(field, text))

test("a name typed into the empty hero search of the draft stays in the search", async () => {
  await open("?edit=1&t=60", { games: [draftingGame] })
  const field = await search()
  await typeKey(field, "n")
  assert.equal(field.value, "n")
})

test("a name typed into the hero search keeps its game on the desk while the video plays into the next one", async (t) => {
  const read = heldReadings(t)
  const { players } = await open("?edit=1&t=60", { games: [draftingGame, game2] })
  await typeKey(await search(), "n")

  await act(async () => players[0]!.report(1))
  players[0]!.time = 1520
  await read()
  assert.equal(document.querySelector('[role="slider"]')?.getAttribute("aria-valuetext"), "25:20")
  assert.match(current(), /^Ván 1,/)
})

test("a mark typed after Gõ mốc stays in its field", async () => {
  await open("?edit=1&t=300")
  await click(button("Ván đấu", document.querySelector(".esp-tools")!), "the tool Ván đấu")
  const menu = button("Thêm thao tác với mốc kết thúc", body())!
  await act(async () => menu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await click(
    await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Gõ mốc…"),
    ),
  )
  const field = await waitFor(() => document.querySelector<HTMLInputElement>('[aria-label="Mốc kết thúc"]'))
  await typeKey(field, "21:48")
  assert.equal(field.value, "21:48")
})
