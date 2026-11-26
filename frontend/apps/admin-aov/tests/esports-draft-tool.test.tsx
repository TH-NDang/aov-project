import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { act } from "react"
import type { DraftTurn, GameContent } from "@aov/community-contracts"
import { DRAFT_ORDER, unnamed } from "../src/features/esports/model/draft"
import { answerConfirm, button, click, confirmDialog, flush, render, type, withDom } from "./fixtures/dom"
import { HEROES, catalog, deskOf, emptyGame, recordedGame, selection, type DeskOptions } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })
beforeEach(() => localStorage.clear())

const { DraftTool } = await import("../src/features/esports/pages/tools/draft-tool")

async function tool(options: DeskOptions = {}) {
  const desk = deskOf(options)
  const view = await render(<desk.kept.Host>{(current) => <DraftTool desk={current} />}</desk.kept.Host>)
  return { ...desk.kept, ...view }
}
const search = () => document.querySelector<HTMLInputElement>("[data-hero-search]")!
const face = (name: string) => document.querySelector(`[role="option"][title="${name}"]`)
const faces = () => [...document.querySelectorAll('[role="option"]')].map((entry) => entry.getAttribute("title"))
const press = (key: string, target: Element = search()) =>
  act(async () => target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })))
const slot = (order: number) => document.querySelector<HTMLElement>(`[data-turn="${order}"]`)!
/** Types a name and takes the first answer. */
async function take(name: string) {
  await type(search(), name)
  await press("Enter")
}
const taken = (content: GameContent) => content.draft!.turns.map((turn) => turn.hero?.name ?? null)
const heroes = (content: GameContent) => content.sides.flatMap((side) => side.participants.map(({ hero }) => hero.name))

const started = (turns: DraftTurn[] = []) => emptyGame({ draft: { startSecond: 100, lockedSecond: null, turns } })
const turns = (...names: string[]): DraftTurn[] =>
  names.map((name, index) => ({
    ...DRAFT_ORDER[index]!,
    order: index + 1,
    hero: selection(name),
    atSecond: 100 + index,
  }))

test("Enter takes the first hero typed, at the second of the first key", async () => {
  const kept = await tool({ content: started(), at: 130 })
  await type(search(), "k")
  await act(async () => kept.play(137))
  await type(search(), "kee")
  await press("Enter")
  assert.deepEqual(kept.content().draft!.turns, [
    { order: 1, kind: "BAN", side: "BLUE", hero: selection("Keera"), atSecond: 130 },
  ])
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi lượt 1, AZU cấm Keera lúc ▸2:10")
  assert.equal(search().value, "", "the field is ready for the next turn")
})

test("a face pressed is a turn at the second of the press", async () => {
  const kept = await tool({ content: started(), at: 141.7 })
  await click(face("Omen"))
  assert.equal(kept.content().draft!.turns[0]?.atSecond, 141)
})

test("turns typed faster than they are saved follow one another", async () => {
  const desk = deskOf({ content: started(), at: 130 })
  const waiting: (() => void)[] = []
  const slow = {
    ...desk,
    record: (change: Parameters<typeof desk.record>[0]) =>
      new Promise<boolean>((resolve) => waiting.push(() => void desk.record(change).then(resolve))),
  }
  await render(<DraftTool desk={slow} />)
  await take("keera")
  await take("omen")
  assert.deepEqual(
    [slot(1), slot(2)].map((entry) => entry.getAttribute("aria-label")),
    ["Lượt 1, AZU cấm Keera, ▸2:10", "Lượt 2, CRI cấm Omen, ▸2:10"],
  )
  for (const answer of waiting) await act(async () => answer())
  await flush()
  assert.deepEqual(taken(desk.kept.content()), ["Keera", "Omen"])
})

test("a refused turn leaves the board", async () => {
  const kept = await tool({ content: started(), at: 130 })
  kept.refuse(true)
  await take("keera")
  await flush()
  assert.equal(slot(1).getAttribute("aria-label"), "Lượt 1, AZU cấm")
})

test("heroes another turn took are not offered, and typing one says why", async () => {
  await tool({ content: started(turns("Aoi", "Elsu")) })
  assert.equal(faces().includes("Aoi"), false)
  await type(search(), "aoi")
  assert.equal(document.querySelector('[role="alert"]')?.textContent, "Aoi: Đã cấm ở lượt 1.")
  await press("Enter")
  assert.equal(search().value, "aoi", "nothing was taken")
})

test("a name that is refused does not take another hero that holds it", async () => {
  const kept = await tool({
    content: started(turns("Aya")),
    heroes: [...catalog.heroes, { ...selection("Aya"), code: "aya" }],
  })
  await type(search(), "aya")
  assert.deepEqual(faces(), ["Hayate"])
  await press("Enter")
  assert.deepEqual(taken(kept.content()), ["Aya"])
})

test("a name nobody knows can be used as it is written", async () => {
  const kept = await tool({ content: started() })
  await type(search(), "Tướng mới")
  assert.deepEqual(faces(), [])
  await click(button("Dùng tên “Tướng mới”"))
  assert.deepEqual(kept.content().draft!.turns[0]?.hero, { id: null, name: "Tướng mới" })
})

test("a team may ban nobody, and the last turn can be dropped", async () => {
  const kept = await tool({ content: started() })
  await click(button("Không cấm"))
  assert.deepEqual(taken(kept.content()), [null])
  await click(button("Bỏ lượt 1"))
  assert.deepEqual(taken(kept.content()), [])
})

test("the second of a turn stays inside what the service accepts, and is none without a draft start", async () => {
  const inside = await tool({ content: started(turns("Aoi", "Elsu")), at: 5 })
  await take("keera")
  assert.equal(inside.content().draft!.turns[2]?.atSecond, 101, "not before the turn it follows")
  await inside.unmount()
  const unstarted = await tool({ content: emptyGame(), at: 130 })
  await take("keera")
  assert.equal(unstarted.content().draft!.turns[0]?.atSecond, null)
})

test("a recorded turn is changed where it stands, and its second with it", async () => {
  const kept = await tool({ content: started(turns("Aoi", "Elsu", "Keera")), at: 102 })
  await click(slot(2))
  await click(button("Tới"))
  assert.deepEqual(kept.seeks, [101])
  await click(button("Lấy mốc ở đây"))
  assert.equal(kept.content().draft!.turns[1]?.atSecond, 102)
  await click(button("Bỏ mốc"))
  assert.equal(kept.content().draft!.turns[1]?.atSecond, null)
  await take("omen")
  assert.deepEqual(taken(kept.content()), ["Aoi", "Omen", "Keera"])
  assert.match(document.querySelector(".esp-draft-ask")?.textContent ?? "", /Lượt 4/, "the next turn is ready again")
})

test("Esc lets go of a turn that is being changed", async () => {
  await tool({ content: started(turns("Aoi")) })
  await click(slot(1))
  assert.equal(slot(1).getAttribute("aria-pressed"), "true")
  await press("Escape")
  assert.equal(slot(1).getAttribute("aria-pressed"), "false")
})

test("each turn can be taken back on its own", async () => {
  const kept = await tool({ content: started() })
  await take("keera")
  await take("omen")
  await act(async () => kept.undo())
  assert.deepEqual(taken(kept.content()), ["Keera"])
})

test("changing sides keeps every team's bans with it", async () => {
  const kept = await tool({ content: recordedGame() })
  await click(button("Đổi bên"))
  assert.equal(kept.content().sides[0]!.teamId, "b")
  assert.equal(kept.content().winner, "BLUE", "the winner is the same team on the other side")
  assert.equal(kept.changes.at(-1)?.text, "Đã đổi bên: CRI bên xanh, AZU bên đỏ")
  await act(async () => kept.undo())
  assert.equal(kept.content().sides[0]!.teamId, "a")
})

test("a hero a team played earlier in the match is warned about on the board", async () => {
  await tool({
    content: started(turns("Aoi", "Elsu", "Keera", "Omen", "Nakroth")),
    locks: { decider: false, byTeam: new Map([["a", [{ gameNumber: 1, hero: selection("Nakroth") }]]]) },
  })
  assert.match(slot(5).getAttribute("aria-label")!, /AZU đã dùng Nakroth ở ván 1/)
  assert.match(document.querySelector("summary")?.textContent ?? "", /Đã dùng ở ván trước: 1 tướng/)
})

test("viewing shows the turns, and a press goes to one", async () => {
  const kept = await tool({ content: started(turns("Aoi", "Elsu")), editable: false })
  assert.equal(search(), null)
  assert.equal(button("Đổi bên"), undefined)
  await click(document.querySelector(".esp-turn-row"))
  assert.deepEqual(kept.seeks, [100])
})

test("without the catalog the picker waits, and says when it could not be read", async () => {
  await tool({ content: started(), catalog: undefined })
  assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /Đang tải danh mục/)
})

/** An imported game: ten heroes and eight bans, no order. */
const imported = () => recordedGame({ draft: undefined })
/** The turns that name everything of the imported game. */
const order = () => {
  const names = (kind: "bans" | "participants", side: 0 | 1) =>
    imported().sides[side]![kind].map((entry) => ("hero" in entry ? entry.hero.name! : entry.name!))
  const left = {
    BANBLUE: names("bans", 0),
    BANRED: names("bans", 1),
    PICKBLUE: names("participants", 0),
    PICKRED: names("participants", 1),
  }
  return DRAFT_ORDER.map(({ kind, side }) => left[`${kind}${side}`].shift()!)
}

test("the first turn of an imported game wipes nothing", async () => {
  const kept = await tool({ content: imported() })
  await take("aoi")
  assert.equal(kept.changes.length, 0, "nothing is sent while recorded heroes have no turn")
  assert.deepEqual(heroes(kept.content()), [...HEROES.BLUE, ...HEROES.RED])
  assert.equal(slot(1).getAttribute("aria-label"), "Lượt 1, AZU cấm Aoi")
})

test("the turns of an imported game are kept by the browser until they name everything, then saved at once", async () => {
  const first = await tool({ content: imported() })
  const names = order()
  for (const name of names.slice(0, 9)) await take(name)
  await first.unmount()

  const kept = await tool({ content: imported() })
  assert.equal(unnamed(kept.content(), []).length, 18)
  for (const name of names.slice(9)) await take(name)
  await flush()
  assert.equal(kept.changes.length, 1)
  assert.deepEqual(taken(kept.content()), names)
  assert.deepEqual(heroes(kept.content()), [...HEROES.BLUE, ...HEROES.RED], "every hero keeps its lane")
  assert.equal(localStorage.length, 0)
})

test("eighteen turns that leave a recorded hero out are saved only after a question that names it", async () => {
  const kept = await tool({ content: imported() })
  const names = order()
  for (const name of names.slice(0, 17)) await take(name)
  await take("biron")
  assert.equal(kept.changes.length, 0)
  await click(button("Lưu theo 18 lượt"))
  assert.match(confirmDialog()?.textContent ?? "", /CRI chọn Zip/)
  await answerConfirm("Lưu theo 18 lượt")
  await flush()
  assert.equal(taken(kept.content()).at(-1), "Biron")
  assert.equal(heroes(kept.content()).includes("Zip"), false)
})

test("collected turns can be thrown away without touching the game", async () => {
  const kept = await tool({ content: imported() })
  await take("aoi")
  await click(button("Bỏ 1 lượt vừa nhập"))
  await answerConfirm("Bỏ 1 lượt")
  assert.equal(slot(1).getAttribute("aria-label"), "Lượt 1, AZU cấm")
  assert.deepEqual(heroes(kept.content()), [...HEROES.BLUE, ...HEROES.RED])
})

test("a recorded hero that has no turn yet is offered first", async () => {
  await tool({ content: imported() })
  assert.deepEqual(faces().slice(0, 4), ["Aoi", "Keera", "Yena", "Qi"])
})
