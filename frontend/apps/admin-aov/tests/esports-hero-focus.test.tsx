import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { button, click, flush, render, waitFor, withDom } from "./fixtures/dom"
import { catalog } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })

// Read once the page is there: the menus decide at their import whether they lay out.
const { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } = await import("@aov/ui/components/dropdown-menu")
const { HeroPicker } = await import("../src/features/esports/components/game/hero-picker")
const { DockMenuContent } = await import("../src/features/esports/components/game/dock-menu")

const search = () => document.querySelector<HTMLInputElement>("[data-hero-search]")!

/** The search of a turn on the desk beside a button and a menu of the dock, as the ban/pick tool stands there. */
async function desk(keepFocus = true) {
  const picked: string[] = []
  await render(
    <div className="esp-studio">
      <button type="button">Đổi bên</button>
      <button type="button" data-movable aria-label="Lượt 1, AZU cấm, ▸1:40">
        Lượt 1
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Thêm thao tác với lượt 1</button>
        </DropdownMenuTrigger>
        <DockMenuContent>
          <DropdownMenuItem onSelect={() => picked.push("team")}>Đổi đội</DropdownMenuItem>
        </DockMenuContent>
      </DropdownMenu>
      <HeroPicker
        head={null}
        label="Lượt 1, AZU cấm"
        turn={0}
        options={catalog.heroes}
        catalog={catalog.heroes}
        whyNot={() => null}
        keepFocus={keepFocus}
        onPick={(hero) => picked.push(hero.name ?? "")}
        onEscape={() => false}
      />
    </div>,
  )
  return picked
}

/** The end of a press: what the browser sends after a button took the focus from the search. */
async function release(target: HTMLElement, pointerType = "mouse") {
  target.focus()
  const event = new window.MouseEvent("pointerup", { bubbles: true })
  Object.defineProperty(event, "pointerType", { value: pointerType })
  await act(async () => target.dispatchEvent(event))
}

test("a press with the mouse elsewhere on the desk gives the focus back to the hero search", async () => {
  await desk()
  await release(button("Đổi bên")!)
  await waitFor(() => document.activeElement === search(), "the search has the focus again")
})

test("a press on a mark the keys move leaves the focus on it, so Alt and the arrows still move that mark", async () => {
  await desk()
  const mark = document.querySelector<HTMLElement>("[data-movable]")!
  await release(mark)
  await flush()
  assert.equal(document.activeElement, mark)
})

test("a touch elsewhere leaves the focus where it went, so no keyboard opens by itself", async () => {
  await desk()
  const swap = button("Đổi bên")!
  await release(swap, "touch")
  await click(swap)
  assert.equal(document.activeElement, swap)
})

test("a menu of the dock gives the focus back to the hero search when it closes", async () => {
  const picked = await desk()
  const trigger = button("Thêm thao tác với lượt 1")!
  await act(async () => trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await click(
    await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Đổi đội"),
    ),
  )
  assert.deepEqual(picked, ["team"])
  await waitFor(() => document.activeElement === search(), "the search has the focus, not the button of the menu")
})

test("without a fine pointer a closed menu gives the focus back to its button", async () => {
  await desk(false)
  const trigger = button("Thêm thao tác với lượt 1")!
  await act(async () => trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  await click(
    await waitFor(() =>
      [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Đổi đội"),
    ),
  )
  await waitFor(() => document.activeElement === trigger)
})
