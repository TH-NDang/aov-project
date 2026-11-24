import assert from "node:assert/strict"
import { after, beforeEach, test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import type { DocumentView, GameContent, LinkMention, PlayerContent } from "@aov/community-contracts"
import {
  answerConfirm,
  button,
  click,
  confirmDialog,
  flush,
  QuietResizeObserver,
  render,
  waitFor,
  withDom,
} from "./fixtures/dom"
import { game, match, view } from "./fixtures/match-records"

withDom({
  url: "http://localhost:5175/link-review",
  globals: () => ({ ResizeObserver: QuietResizeObserver }),
})

const { tournamentApi, tournamentKeys } = await import("../src/features/tournaments/api/tournament-api")
const { LinkReviewPage } = await import("../src/features/tournaments/pages/link-review-page")

const original = { ...tournamentApi }
after(() => Object.assign(tournamentApi, original))

const row = (recordId: string, text: string, gameNumber: number): LinkMention => ({
  kind: "GAME_MVP",
  recordId,
  tournamentId: "t",
  tournamentName: "Autumn Cup",
  seriesId: "s",
  gameNumber,
  label: "Azure vs Crimson",
  text,
})
const SOURCE = " Tuyển thủ theo vị trí được suy ra từ đội hình giải trên Liquipedia, chưa đối chiếu từng ván."
const player = (id: string, nickname: string, aliases: string[] = []) =>
  view<PlayerContent>(id, { code: id, nickname, aliases })
const records: Record<string, DocumentView<unknown>[]> = {
  series: [match([2, 1])],
  players: [player("vinh-hoang", "VinhHoang", ["TinSr"]), player("anne", "Anne"), player("stranger", "Koffi")],
  teams: [view("a", { code: "a", name: "Azure" }), view("b", { code: "b", name: "Crimson" })],
  "roster-memberships": [
    view("r1", { tournamentId: "t", teamId: "a", playerId: "vinh-hoang" }),
    view("r2", { tournamentId: "t", teamId: "b", playerId: "anne" }),
  ],
}

let games: Map<string, DocumentView<GameContent>>
beforeEach(() => {
  games = new Map([1, 2, 3].map((number) => [`g${number}`, game(number)]))
})
const mentions = () =>
  [row("g1", `TinSr${SOURCE}`, 1), row("g2", "Anne", 2), row("g3", "Koffi", 3)].filter(
    (mention) => !games.get(mention.recordId)!.content.mvpPlayerId,
  )
Object.assign(tournamentApi, {
  me: async () => ({ capabilities: ["tournament:read", "tournament:write"] }),
  linkReviewFacets: async () => [{ kind: "GAME_MVP", count: mentions().length }],
  linkReview: async (kind: string) => {
    const items = kind === "GAME_MVP" ? mentions() : []
    return { items, totalElements: items.length, page: 0, size: 50 }
  },
  list: async (kind: string) => records[kind] ?? [],
  read: async (kind: string, id: string) =>
    kind === "games" ? games.get(id) : view(id, { code: id, name: "Autumn Cup" }),
  save: async (_kind: string, entry: DocumentView<GameContent>, content: GameContent) => {
    const saved = { ...entry, content, version: entry.version + 1 }
    games.set(entry.id, saved)
    return saved
  },
})

const rows = () => [...document.querySelectorAll<HTMLElement>("[data-link-row]")]
const open = async () => {
  const page = await render(
    <MemoryRouter>
      <LinkReviewPage />
    </MemoryRouter>,
  )
  await waitFor(() => button("Liên kết TinSr với VinhHoang · Azure"))
  return page
}
const mvp = (id: string) => games.get(id)!.content.mvpPlayerId ?? null

test("a row shows the name that was written and keeps the whole text for a closer look", async () => {
  await open()
  const name = [...rows()[0]!.querySelectorAll("[title]")].find((entry) => entry.textContent === "TinSr")
  assert.equal(name?.getAttribute("title"), `TinSr${SOURCE}`)
})

test("one click links the suggested player and the row leaves the list", async () => {
  await open()
  await click(button("Liên kết TinSr với VinhHoang · Azure"))
  await waitFor(() => rows().length === 2)
  assert.equal(mvp("g1"), "vinh-hoang")
})

test("a link can be taken back and its row returns", async () => {
  await open()
  await click(button("Liên kết Anne với Anne · Crimson"))
  await waitFor(() => rows().length === 2)
  await click(button("Hoàn tác"))
  await waitFor(() => rows().length === 3)
  assert.equal(mvp("g2"), null)
})

test("the certain links are written together after a list of what becomes what", async () => {
  await open()
  await click(button("Liên kết 2 gợi ý chắc chắn"))
  assert.match(confirmDialog()?.textContent ?? "", /TinSr → VinhHoang.*Anne → Anne/)
  assert.deepEqual([mvp("g1"), mvp("g2")], [null, null])

  await answerConfirm("Liên kết 2 chỗ")
  await waitFor(() => rows().length === 1)
  assert.deepEqual([mvp("g1"), mvp("g2"), mvp("g3")], ["vinh-hoang", "anne", null])
})

test("a namesake from outside the two rosters is offered but never linked with the certain ones", async () => {
  await open()
  assert.ok(button("Liên kết Koffi với Koffi · Ngoài đội hình"))
  assert.equal(button("Liên kết 3 gợi ý chắc chắn"), undefined)
})

test("the arrow keys move between rows and linking goes on to the next one", async () => {
  await open()
  const first = button("Liên kết TinSr với VinhHoang · Azure")!
  const key = async (name: string) => {
    await act(async () => {
      document.activeElement!.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
      )
    })
    await flush()
  }
  first.focus()
  await key("ArrowDown")
  assert.equal(document.activeElement, button("Liên kết Anne với Anne · Crimson"))
  await key("ArrowUp")
  assert.equal(document.activeElement, first)

  await click(first)
  assert.equal(document.activeElement, button("Liên kết Anne với Anne · Crimson"))
})

test("a place somebody linked meanwhile is reported and keeps their choice", async () => {
  await open()
  games.set("g1", view("g1", { ...game(1).content, mvpPlayerId: "other" }))
  await click(button("Liên kết TinSr với VinhHoang · Azure"))
  await waitFor(() => document.querySelector('[role="alert"]')?.textContent?.includes("vừa được liên kết ở nơi khác"))
  assert.equal(mvp("g1"), "other")
})

test("linking refreshes the games cached for other screens", async () => {
  const { client } = await open()
  const key = tournamentKeys.seriesGames("fixture", "s")
  client.setQueryData(key, [])
  await click(button("Liên kết Anne với Anne · Crimson"))
  await waitFor(() => client.getQueryState(key)?.isInvalidated)
})
