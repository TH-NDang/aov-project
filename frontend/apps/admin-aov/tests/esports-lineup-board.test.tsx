import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { GameContent, Participant, Side } from "@aov/community-contracts"
import type { ToolTarget } from "../src/features/esports/model/desk"
import { answerConfirm, button, choose, click, confirmDialog, render, waitFor, withDom } from "./fixtures/dom"
import { deskOf, recordedGame, selection, type DeskOptions } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })

const { LineupTool } = await import("../src/features/esports/pages/tools/lineup-tool")

async function tool({ target = null, ...options }: DeskOptions & { target?: ToolTarget | null } = {}) {
  const desk = deskOf(options)
  await render(<desk.kept.Host>{(current) => <LineupTool desk={current} target={target} />}</desk.kept.Host>)
  return desk.kept
}
/** The game with one seat changed. */
const seated = (side: Side, lane: number, change: Partial<Participant>, content = recordedGame()): GameContent => ({
  ...content,
  sides: content.sides.map((entry) =>
    entry.side === side
      ? {
          ...entry,
          participants: entry.participants.map((value, index) => (index === lane ? { ...value, ...change } : value)),
        }
      : entry,
  ),
})
const seat = (key: string) => document.querySelector<HTMLElement>(`[data-seat="${key}"]`)!
const items = (key: string) =>
  [...seat(key).querySelectorAll<HTMLElement>(".esp-seat-item")].map((entry) => entry.getAttribute("aria-label"))
const player = (lane: string, team: string) =>
  document.querySelector<HTMLSelectElement>(`select[aria-label="Tuyển thủ ${lane} của ${team}"]`)!
const chosenFace = () => document.querySelector('[data-ten-seat][aria-pressed="true"]')?.getAttribute("data-ten-seat")
const openPart = () =>
  document.querySelector('nav[aria-label="Phần của tuyển thủ"] [aria-pressed="true"]')?.firstChild?.textContent
const bought = [
  { atSeconds: 60, type: "BUY" as const, item: selection("Gươm Loki"), toSlot: 1 },
  { atSeconds: 430, type: "BUY" as const, item: selection("Thánh kiếm"), toSlot: 2 },
  { atSeconds: 600, type: "BUY" as const, item: selection("Kiếm ngắn"), toSlot: 3 },
]

test("the items are those at the playhead, with what was just bought outlined", async () => {
  await tool({ content: seated("BLUE", 1, { equipmentEvents: bought }) })
  assert.match(document.body.textContent ?? "", /Trang bị lúc 7:20/)
  assert.deepEqual(items("BLUE:JUNGLE").slice(0, 3), ["Gươm Loki", "Thánh kiếm", "Ô 3: chưa quan sát"])
  const changed = [...seat("BLUE:JUNGLE").querySelectorAll("[data-changed]")].map((entry) =>
    entry.getAttribute("aria-label"),
  )
  assert.deepEqual(changed, ["Thánh kiếm"], "bought ten seconds ago")
})

test("outside the game the items are those of the end", async () => {
  const end = { atSeconds: 790, slots: [{ slot: 3, known: true, item: selection("Kiếm ngắn") }] }
  await tool({ content: seated("BLUE", 1, { equipmentEvents: bought, equipmentSnapshots: [end] }), at: 4800 })
  assert.match(document.body.textContent ?? "", /Trang bị cuối ván/)
  assert.equal(items("BLUE:JUNGLE")[2], "Kiếm ngắn")
  assert.equal(document.querySelectorAll("[data-changed]").length, 0)
})

test("a game that knows only its last items shows those all through", async () => {
  const last = {
    atSeconds: recordedGame().durationSeconds!,
    slots: [{ slot: 1, known: true, item: selection("Gươm Loki") }],
  }
  await tool({ content: seated("BLUE", 1, { equipmentSnapshots: [last] }) })
  assert.match(document.body.textContent ?? "", /Trang bị cuối ván/)
  assert.equal(items("BLUE:JUNGLE")[0], "Gươm Loki")
  assert.equal(document.querySelectorAll("[data-changed]").length, 0)
})

test("a game without recorded kills shows no kills, deaths and assists", async () => {
  await tool()
  assert.equal(document.querySelectorAll(".esp-seat-kda").length, 0)
})

test("kills, deaths and assists are those at the playhead", async () => {
  await tool({
    content: recordedGame({
      timeline: {
        pauses: [],
        events: [
          {
            id: "k",
            atSeconds: 120,
            kind: "KILL",
            killer: { side: "BLUE", lane: "JUNGLE" },
            victim: { side: "RED", lane: "MID" },
            assists: [{ side: "BLUE", lane: "MID" }],
          },
        ],
      },
    }),
  })
  assert.equal(seat("BLUE:JUNGLE").querySelector(".esp-seat-kda")?.textContent, "1/0/0")
  assert.equal(seat("RED:MID").querySelector(".esp-seat-kda")?.textContent, "0/1/0")
})

test("a press on a part opens its editor in the place of the board, and the way back is at the top", async () => {
  await tool({ content: seated("RED", 2, { spell: { id: null, name: null } }) })
  await click(button("Ghi phụ trợ của CRI Mid"))
  assert.equal(document.querySelector("[data-seat]"), null)
  assert.equal(chosenFace(), "RED:MID", "the editor is on the seat that was pressed")
  assert.equal(openPart(), "Phụ trợ")
  await click(button("Cả hai đội"))
  assert.ok(seat("RED:MID"))
})

test("the items of a seat open its equipment", async () => {
  await tool()
  await click(button("Ghi trang bị của CRI Dragon"))
  assert.deepEqual([chosenFace(), openPart()], ["RED:DRAGON", "Trang bị"])
})

test("a press on a recorded spell opens the editor and not its card", async () => {
  await tool()
  await click(seat("BLUE:TOP").querySelector('[aria-label="Phụ trợ: Tốc biến"]'))
  assert.ok(button("Cả hai đội"))
  assert.equal(document.querySelector('[role="dialog"]'), null)
})

test("a part asked for from elsewhere opens on the first seat that lacks it", async () => {
  await tool({ content: seated("RED", 2, { spell: null }), target: { part: "spell" } })
  assert.equal(chosenFace(), "RED:MID")
})

test("a lane seats blue before red, with what each took into the game", async () => {
  const recorded: Partial<Participant> = {
    enchantments: {
      status: "PARTIAL",
      entries: [{ selection: selection("Thần quang"), primary: true, tier: 3, branchCode: "thap-quang-minh" }],
    },
    arcana: { status: "PARTIAL", entries: [{ selection: selection("Đỏ III Giáp"), count: 10, color: "RED" }] },
  }
  await tool({ content: seated("BLUE", 2, recorded), editable: false })
  const lane = [...document.querySelectorAll('[data-lane="MID"] [data-seat]')].map((entry) =>
    entry.getAttribute("data-seat"),
  )
  assert.deepEqual(lane, ["BLUE:MID", "RED:MID"])
  const row = seat("BLUE:MID")
  assert.match(row.textContent ?? "", /AZU Mid/)
  assert.doesNotMatch(row.textContent ?? "", /Tulen/, "the hero is the face, not a second line of text")
  for (const label of ["Phụ trợ: Tốc biến", "Phù hiệu: 1 trên 5 ô", "Bảng ngọc: 10 trên 30 viên"])
    assert.ok(row.querySelector(`[aria-label="${label}"]`), label)
  assert.ok(seat("RED:MID").querySelector('[aria-label="Phù hiệu: 0 trên 5 ô"]'))
})

test("taking a teammate's hero swaps the two, and the undo swaps them back", async () => {
  const kept = await tool()
  await click(seat("BLUE:MID").querySelector("[data-swap]"))
  const options = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>(".esp-seat-pick")]
    return found.length ? found : null
  })
  await click(options.find((entry) => entry.textContent?.includes("Nakroth")))
  const heroes = () => kept.content().sides[0]!.participants.map(({ hero }) => hero.name)
  assert.deepEqual(heroes(), ["Maloch", "Tulen", "Nakroth", "Violet", "Alice"])
  assert.equal(kept.changes.at(-1)?.text, "Đã đổi tướng Đường giữa của AZU: Tulen → Nakroth")
  await act(async () => kept.undo())
  assert.deepEqual(heroes(), ["Maloch", "Nakroth", "Tulen", "Violet", "Alice"])
})

test("an empty seat asks for its player and takes one at once", async () => {
  const kept = await tool({ content: seated("BLUE", 2, { playerId: null }) })
  const select = player("Đường giữa", "Azure")
  assert.equal(select.selectedOptions[0]?.textContent, "Ghi tuyển thủ")
  assert.equal(select.options[1]?.textContent, "AZU Mid", "the player of the lane comes first")
  await choose(select, "a-MID")
  assert.equal(kept.content().sides[0]!.participants[2]!.playerId, "a-MID")
  assert.equal(kept.changes.at(-1)?.text, "Đã ghi AZU Mid ở Đường giữa của AZU")
})

test("a recorded player is replaced only after a question", async () => {
  const kept = await tool({ content: seated("BLUE", 3, { playerId: null }) })
  await choose(player("Đường giữa", "Azure"), "a-DRAGON")
  assert.match(confirmDialog()?.textContent ?? "", /AZU Mid → AZU Dragon/)
  assert.equal(kept.content().sides[0]!.participants[2]!.playerId, "a-MID")
  await answerConfirm("Đổi tuyển thủ")
  assert.equal(kept.content().sides[0]!.participants[2]!.playerId, "a-DRAGON")
})

test("a player seated in another lane changes places instead of sitting twice", async () => {
  const kept = await tool()
  await choose(player("Đường giữa", "Azure"), "a-TOP")
  await answerConfirm("Đổi chỗ")
  const players = () => kept.content().sides[0]!.participants.map(({ playerId }) => playerId)
  assert.deepEqual(players(), ["a-MID", "a-JUNGLE", "a-TOP", "a-DRAGON", "a-SUPPORT"])
  await act(async () => kept.undo())
  assert.deepEqual(players(), ["a-TOP", "a-JUNGLE", "a-MID", "a-DRAGON", "a-SUPPORT"])
})

test("a hero the team played earlier in the match carries its reason", async () => {
  await tool({
    locks: { decider: false, byTeam: new Map([["a", [{ gameNumber: 1, hero: selection("Tulen") }]]]) },
  })
  assert.ok(seat("BLUE:MID").querySelector('[aria-label="AZU đã dùng Tulen ở ván 1"]'))
})

/** Chooses an entry from the menu of a team. */
async function teamAction(team: string, label: string) {
  const menu = document.querySelector<HTMLElement>(`[aria-label="Thao tác với cả đội ${team}"]`)!
  await act(async () => menu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  const entries = () => [...document.querySelectorAll('[role="menuitem"]')]
  await click(await waitFor(() => entries().find((entry) => entry.textContent === label), label))
}

test("a part of a whole team is marked at the second the video shows it, and the undo takes every mark back", async () => {
  const kept = await tool({ content: seated("BLUE", 0, { spellObservedAtSeconds: 12 }) })
  const marks = (side: number) => kept.content().sides[side]!.participants.map((entry) => entry.spellObservedAtSeconds)
  await teamAction("AZU", "Mốc phụ trợ cả đội")
  assert.deepEqual(marks(0), [440, 440, 440, 440, 440], "the mark is the game second at the player position")
  assert.deepEqual(marks(1), Array(5).fill(undefined), "the other team is untouched")
  assert.equal(kept.changes.at(-1)?.text, "Đã đặt mốc phụ trợ của cả đội AZU lúc 7:20")
  await act(async () => kept.undo())
  assert.deepEqual(marks(0), [12, undefined, undefined, undefined, undefined])
})

test("a team is marked only where the video shows the game, and the desk says why", async () => {
  const kept = await tool({ at: 4800 })
  await teamAction("AZU", "Mốc bảng ngọc cả đội")
  assert.deepEqual(kept.said, ["Video đang ở ngoài ván 2."])
  assert.equal(kept.changes.length, 0)
})

test("what the source never showed of a team leaves what is recorded alone", async () => {
  const kept = await tool({ content: seated("RED", 0, { arcana: { status: "KNOWN", entries: [] } }) })
  await teamAction("CRI", "Bảng ngọc không hiển thị")
  assert.deepEqual(
    kept.content().sides[1]!.participants.map(({ arcana }) => arcana.status),
    ["KNOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN"],
  )
})

test("the line-ups are filled from the registered players in one press", async () => {
  const kept = await tool({ content: seated("BLUE", 2, { playerId: null }) })
  await click(button("Điền theo đội hình đăng ký"))
  assert.equal(kept.content().sides[0]!.participants[2]!.playerId, "a-MID")
  assert.equal(kept.changes.at(-1)?.text, "Đã điền 1 tuyển thủ theo đội hình đăng ký")
  assert.equal(button("Điền theo đội hình đăng ký"), undefined, "nothing is left to fill")
})

test("a team takes the players of the game before only after a question naming both", async () => {
  const previous = { ...seated("BLUE", 2, { playerId: "a-TOP" }), number: 1 }
  const kept = await tool({ content: seated("BLUE", 0, { playerId: null }), previous })
  await teamAction("AZU", "Thay tuyển thủ bằng ván 1…")
  assert.match(confirmDialog()?.textContent ?? "", /Đường giữa, tuyển thủ: AZU Mid → AZU Top/)
  assert.equal(kept.changes.length, 0)
  await answerConfirm("Thay bằng ván trước")
  assert.equal(kept.content().sides[0]!.participants[2]!.playerId, "a-TOP")
})

test("viewing, the board has no lists and nothing to press", async () => {
  await tool({ editable: false })
  assert.equal(document.querySelectorAll("select, button").length, 0)
  assert.match(seat("BLUE:MID").textContent ?? "", /AZU Mid/)
})

test("the line-ups stand while the catalog loads, and say so", async () => {
  await tool({ catalog: undefined })
  assert.equal(document.querySelector('[role="status"]')?.textContent, "Đang tải danh mục của ván…")
  assert.equal(document.querySelectorAll("[data-seat]").length, 10)
})

test("a catalog that could not be read is asked for again from the line-ups", async () => {
  let asked = 0
  await tool({ catalog: undefined, catalogError: new Error("no answer"), reloadCatalog: () => asked++ })
  await click(button("Tải lại"))
  assert.equal(asked, 1)
  assert.match(document.body.textContent ?? "", /Trang bị lúc 7:20/)
})

test("the catalog still loading is said in the place of the editor", async () => {
  await tool({ catalog: undefined, target: { part: "arcana" } })
  assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /Đang tải danh mục/)
})
