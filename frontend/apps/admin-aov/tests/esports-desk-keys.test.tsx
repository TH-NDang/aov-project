import assert from "node:assert/strict"
import { test } from "node:test"
import { button, click, type, waitFor } from "./fixtures/dom"
import { game } from "./fixtures/esports-data"
import { press, said, studioPage } from "./fixtures/esports-studio"

const open = studioPage()
const { HotkeysProvider } = await import("../src/app/hotkeys")

const turrets = (saves: { timeline?: { events: { objective?: unknown; side?: unknown; atSeconds: number }[] } }[]) =>
  saves.at(-1)?.timeline?.events.filter((event) => event.objective === "TURRET" && event.side === "BLUE") ?? []
const body = () => document.querySelector(".esp-body")!
const clock = () => document.querySelector('[role="slider"]')!.getAttribute("aria-valuetext")

test("1 records a turret of the blue team at the second on screen", async () => {
  const { saves } = await open("?edit=1&t=300")
  assert.equal(await press("1"), true)
  await waitFor(() => saves.length === 1)
  assert.deepEqual(
    turrets(saves).map((event) => event.atSeconds),
    [205],
    "5:00 of the video is 3:25 of the game",
  )
  await waitFor(() => /Đã ghi Trụ của AZT lúc 3:25/.test(said()))
})

test("a key that is held down records once", async () => {
  const { saves } = await open("?edit=1&t=300")
  await press("7")
  await press("7", document.body, { repeat: true })
  await waitFor(() => saves.length > 0)
  assert.equal(saves.length, 1)
})

test("outside the game an objective key records nothing and says why", async () => {
  const { saves } = await open("?edit=1&t=20")
  await press("1")
  assert.equal(said(), "Ván 1 chưa vào trận.")
  assert.equal(saves.length, 0)
})

test("viewing, the keys of recording do nothing", async () => {
  const { saves } = await open("?t=300")
  assert.equal(await press("1"), false)
  assert.equal(await press("g"), false)
  assert.equal(saves.length, 0)
})

test("G presses the next step of the foot", async () => {
  const open1 = { ...game, content: { ...game.content, durationSeconds: null, winner: null } }
  const { saves } = await open("?edit=1&t=1312", { games: [open1] })
  assert.match(document.querySelector(".esp-next")?.textContent ?? "", /Kết thúc▸21:52/)
  await press("g")
  await waitFor(() => saves.length === 1)
  assert.equal(saves[0]!.durationSeconds, 1122, "a pause of 95 seconds lies before the end")
  assert.equal(saves[0]!.winner, null)
})

test("G pressed twice in a row does not press the step that follows", async () => {
  const open1 = { ...game, content: { ...game.content, durationSeconds: null, winner: "BLUE" as const } }
  const { saves } = await open("?edit=1&t=1312", { games: [open1] })
  await press("g")
  await press("g")
  await waitFor(() => /kết thúc/.test(said()))
  assert.equal(saves.length, 1)
})

test("Space plays the video, also after a button was pressed with the mouse", async () => {
  const { players } = await open("?edit=1&t=300")
  const control = button("Tới 10 giây")!
  control.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }))
  control.focus()
  assert.equal(await press(" ", control), true)
  assert.equal(players[0]!.plays, 1)
})

test("Space stays with a button the keyboard reached", async () => {
  const { players } = await open("?edit=1&t=300")
  const control = button("Tới 10 giây")!
  await press("Tab")
  control.focus()
  assert.equal(await press(" ", control), false)
  assert.equal(players[0]!.plays, 0)
})

test("arrows, J and L step through the video", async () => {
  await open("?edit=1&t=300")
  await press("ArrowLeft")
  assert.equal(clock(), "4:55")
  await press("ArrowRight", document.body, { shiftKey: true })
  assert.equal(clock(), "4:56")
  await press("l")
  assert.equal(clock(), "5:06")
  await press("j", document.body, { shiftKey: true })
  assert.equal(clock(), "4:36")
})

test("Home and End go to the edges of the game, PageDown to the next game", async () => {
  await open("?edit=1&t=300")
  await press("Home")
  assert.equal(clock(), "0:00")
  await press("End")
  assert.equal(clock(), "21:52")
  await press("PageDown")
  assert.equal(clock(), "25:00")
})

test("the bracket keys walk every mark: the edges of the games, the turns and the moments", async () => {
  await open("?edit=1&t=90")
  await press("]")
  assert.equal(clock(), "1:32", "the line-ups are locked")
  await press("]")
  assert.equal(clock(), "1:35", "the game starts")
  await press("[")
  assert.equal(clock(), "1:32")
})

test("a letter typed in a field is text, not a key of the desk", async () => {
  const { saves } = await open("?edit=1&t=300")
  await press("e")
  const field = body().querySelector<HTMLInputElement>("input")!
  assert.equal(await press("1", field), false)
  assert.equal(await press("g", field), false)
  assert.equal(saves.length, 0)
})

test("a menu that is open keeps the keys", async () => {
  const { saves } = await open("?edit=1&t=300")
  const menu = document.body.appendChild(document.createElement("div"))
  menu.setAttribute("role", "menu")
  assert.equal(await press("1", menu), false)
  menu.remove()
  assert.equal(saves.length, 0)
})

test("with the shortcuts of Admin switched off no key works but Esc", async () => {
  const { saves } = await open("?edit=1&t=300", {
    around: (node) => {
      localStorage.setItem("aov-admin:hotkeys-enabled", "false")
      return <HotkeysProvider>{node}</HotkeysProvider>
    },
  })
  assert.equal(await press("1"), false)
  assert.equal(await press("l"), false)
  await click(button("Trận này", document.querySelector(".esp-head")!))
  assert.equal(await press("Escape"), true)
  assert.equal(document.querySelector(".esp-panel-head"), null)
  assert.equal(saves.length, 0)
})

test("Esc closes one thing at a time: the form, then the panel, then the selection", async () => {
  await open("?edit=1&t=300")
  const moment = body().querySelector<HTMLButtonElement>("[data-event] button")!
  await click(moment)
  const selected = () => document.querySelector("[data-active]")
  assert.ok(selected())
  await press("e")
  assert.ok(body().querySelector("form"))
  await press("Escape")
  assert.equal(body().querySelector("form"), null)
  assert.ok(selected(), "the selection behind the form stays")
  await press("?")
  assert.ok(document.querySelector(".esp-panel-head"))
  await press("Escape")
  assert.ok(selected(), "the selection behind the panel stays")
  await press("Escape")
  assert.equal(selected(), null)
})

test("Delete takes the selected moment out, and the foot offers it back", async () => {
  const { saves } = await open("?edit=1&t=300")
  await click(body().querySelector<HTMLButtonElement>('[data-event="fx-o1"] button'))
  await press("Delete")
  await waitFor(() => saves.length === 1)
  assert.equal(
    saves[0]!.timeline!.events.some((event) => event.id === "fx-o1"),
    false,
  )
  await waitFor(() => /Đã xóa Rồng của AZT lúc 4:00/.test(said()))
  await click(button("Hoàn tác"))
  await waitFor(() => saves.length === 2)
  assert.ok(saves[1]!.timeline!.events.some((event) => event.id === "fx-o1"))
})

test("Alt and the arrows move the selected moment", async () => {
  const { saves } = await open("?edit=1&t=300")
  await click(body().querySelector<HTMLButtonElement>('[data-event="fx-o1"] button'))
  await press("ArrowRight", document.body, { altKey: true })
  await waitFor(() => saves.length === 1)
  assert.equal(saves[0]!.timeline!.events.find((event) => event.id === "fx-o1")!.atSeconds, 241)
})

test("an empty search of the draft leaves Space and the arrows to the video, a typed one only Space", async () => {
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
  const { players } = await open("?edit=1&t=60", { games: [drafting] })
  const field = await waitFor(() => document.querySelector<HTMLInputElement>("[data-hero-search]"))
  assert.equal(await press("ArrowLeft", field), true)
  assert.equal(clock(), "0:55")
  assert.equal(await press(" ", field), true)
  assert.equal(players[0]!.plays, 1)
  assert.equal(await press("j", field), false, "letters are typed")

  await type(field, "omen")
  assert.equal(await press("ArrowLeft", field), false, "the caret moves in the text")
  assert.equal(await press(" ", field), true)
  assert.equal(await press(" ", field, { shiftKey: true }), false, "Shift and Space type a space")
})
