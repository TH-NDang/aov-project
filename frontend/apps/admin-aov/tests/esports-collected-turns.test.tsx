import assert from "node:assert/strict"
import { test } from "node:test"
import type { DraftTurn } from "@aov/community-contracts"
import { button, click, type, waitFor } from "./fixtures/dom"
import { game, GAME_ID } from "./fixtures/esports-data"
import { holdWrites, press, said, studioPage } from "./fixtures/esports-studio"

const open = studioPage()

/** Game 1 as an import has it: heroes and bans without the order they were taken in, and no place in the video. */
const imported = {
  ...game,
  content: { ...game.content, draft: undefined, timeline: undefined, sourceTimestampSeconds: undefined },
}
/** The turns of game 1 typed again by hand, without seconds. */
const turns: DraftTurn[] = game.content.draft!.turns.map((turn) => ({ ...turn, atSecond: null }))
const KEY = `esports:pending-turns:${GAME_ID}`
const kept = () => (JSON.parse(localStorage.getItem(KEY) ?? "[]") as DraftTurn[]).length

/** Opens the imported game on its draft with some turns already typed in this browser. */
async function collecting(typed: number) {
  const page = await open("?edit=1", { games: [imported], stored: { [KEY]: JSON.stringify(turns.slice(0, typed)) } })
  await click(button("Cấm chọn", document.querySelector(".esp-tools")!))
  return page
}
async function typeTurn(turn: DraftTurn) {
  const search = document.querySelector<HTMLInputElement>("[data-hero-search]")!
  await type(search, turn.hero!.name!)
  await press("Enter", search)
}

test("an imported game names the recorded heroes no typed turn names yet, by team", async () => {
  await collecting(0)
  const list = document.querySelector('[aria-label="Tướng đã ghi chưa có lượt"]')
  assert.match(list?.textContent ?? "", /AZT.*EMW/)
  assert.equal(list?.querySelectorAll("[title]").length, 18)
})

test("a turn typed for an imported game is told in the foot as not saved yet", async () => {
  await collecting(0)
  await typeTurn(turns[0]!)
  assert.match(said(), new RegExp(`^Đã ghi lượt 1, AZT cấm ${turns[0]!.hero!.name}, chưa lưu`))
})

test("the tab of the draft counts the turns typed before they are saved", async () => {
  await collecting(3)
  assert.match(document.querySelector(".esp-tools")?.textContent ?? "", /Cấm chọn3\/18/)
})

test("Ctrl + Z while turns are collected drops the last one typed and says so", async () => {
  const { saves } = await collecting(3)
  await press("z", document.body, { ctrlKey: true })
  assert.equal(kept(), 2)
  assert.match(said(), /^Đã bỏ lượt 3, chưa lưu/)
  assert.equal(saves.length, 0, "nothing saved was taken back")
})

test("taking back the collected turns gives them back to go on with", async () => {
  const { service, games } = await collecting(17)
  await typeTurn(turns[17]!)
  await waitFor(() => /^Đã ghi 18 lượt cấm chọn/.test(said()), "The turns were not saved together")
  const writes = holdWrites(service)
  await press("z", document.body, { ctrlKey: true })
  await writes.release()
  await waitFor(() => /^Đã hoàn tác: ghi 18 lượt cấm chọn/.test(said()))
  assert.equal(games[0]!.content.draft?.turns.length ?? 0, 0)
  assert.equal(kept(), 18)
})
