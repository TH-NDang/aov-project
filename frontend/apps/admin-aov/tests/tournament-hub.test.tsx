import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import {
  QuietResizeObserver,
  answerConfirm,
  button,
  choose,
  click,
  confirmDialog,
  render,
  type,
  waitFor,
  withDom,
} from "./fixtures/dom"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { onePage, tournamentRow } from "./fixtures/tournament-list-data"

const { window } = withDom({
  url: "http://localhost:5175/tournaments",
  globals: () => ({ ResizeObserver: QuietResizeObserver, IntersectionObserver: intersectionHarness().Observer }),
})

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { competitionApi } = await import("../src/features/competition/competition-api")
const { ApiError } = await import("../src/lib/api/errors")
const { TournamentHubPage } = await import("../src/features/esports/pages/tournament-hub-page")

const originals = { tournament: { ...tournamentApi }, competition: { ...competitionApi } }
let rows: DocumentView<TournamentContent>[]
let capabilities: string[]
let searched: string[]
let router: ReturnType<typeof createMemoryRouter>

beforeEach(() => {
  rows = [
    tournamentRow("a", "Cup A", { startsOn: "2020-01-01", endsOn: "2020-01-02", status: "UPCOMING" }),
    tournamentRow("b", "Cup B"),
    tournamentRow("c", "Cup C"),
    tournamentRow("d", "Cup D"),
  ]
  capabilities = ["tournament:read", "tournament:write"]
  searched = []
  Object.assign(tournamentApi, {
    me: async () => ({ capabilities }),
    searchTournaments: async (filters: { q?: string; sort?: string }) => {
      searched.push(`${filters.q}|${filters.sort}`)
      return onePage(rows)
    },
    tournamentFacets: async () => ({
      total: rows.length,
      statuses: { UPCOMING: 1, FINISHED: 3 },
      tiers: { A: 4 },
      regions: { VN: 4 },
      years: {},
    }),
    tournamentParts: async () => [{ id: "part", parentId: "b", name: "Cup B - Wildcard" }],
    tournamentStats: async () => [],
    pick: async () => onePage([tournamentRow("main", "Main Cup")]),
    read: async () => tournamentRow("main", "Main Cup"),
    save: async (_kind: string, entry: DocumentView<TournamentContent>, content: TournamentContent) => {
      rows = rows.map((row) => (row.id === entry.id ? { ...row, version: row.version + 1, content } : row))
    },
  })
  Object.assign(competitionApi, {
    summaries: async () => [{ id: "c", entrants: 8, matches: 4, publishedAt: "2026-11-01T00:00:00Z" }],
  })
})
afterEach(() => {
  Object.assign(tournamentApi, originals.tournament)
  Object.assign(competitionApi, originals.competition)
  router.dispose()
})

async function openHub(url = "/tournaments") {
  router = createMemoryRouter(
    [
      { path: "/tournaments", element: <TournamentHubPage /> },
      { path: "/tournaments/:id", element: <p>Workspace</p> },
    ],
    { initialEntries: [url] },
  )
  await render(<RouterProvider router={router} />)
  await waitFor(() => opener("Cup A"), "The list loads")
}
/** The link a tournament's row is. */
const opener = (name: string) => document.querySelector<HTMLAnchorElement>(`a[aria-label="Mở giải ${name}"]`)
const rowOf = (name: string) => opener(name)!.closest("tr")!
const box = (name: string) => document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="Chọn ${name}"]`)!
const ticked = () =>
  ["Cup A", "Cup B", "Cup C", "Cup D"].filter((name) => box(name)?.getAttribute("aria-checked") === "true")
const tick = (name: string, shiftKey = false) =>
  act(async () => {
    box(name).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, shiftKey }))
  })
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')].find((item) =>
    item.textContent?.includes(label),
  )
async function openMenu(trigger: Element) {
  await act(async () => {
    trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
  })
  await waitFor(() => document.querySelector('[role="menu"]'), "The menu opens")
}

test("a reader's list offers neither menus nor boxes", async () => {
  capabilities = ["tournament:read"]
  await openHub()
  assert.equal(document.querySelector('[role="checkbox"]'), null)
  assert.equal(button("Thao tác với Cup A"), undefined)
  assert.equal(button("Đổi thành Đã kết thúc"), undefined)
  assert.match(rowOf("Cup A").textContent ?? "", /Lịch đã hết/, "the contradiction itself is still told")
})

test("a row is a link to its workspace, so it opens in a new tab as any link does", async () => {
  await openHub()
  assert.equal(opener("Cup A")!.getAttribute("href"), "/tournaments/a")
  await click(opener("Cup B"))
  assert.equal(router.state.location.pathname, "/tournaments/b")
})

test("a click on a row opens its workspace and a click on its box does not", async () => {
  await openHub()
  await tick("Cup A")
  assert.equal(router.state.location.pathname, "/tournaments")
  await click(rowOf("Cup A").querySelectorAll("td")[2])
  assert.equal(router.state.location.pathname, "/tournaments/a")
})

test("a row tells whether readers see the tournament on Stream", async () => {
  await openHub()
  assert.match(rowOf("Cup C").textContent ?? "", /Công khai trên Stream/)
  assert.match(rowOf("Cup D").textContent ?? "", /Chưa công khai/)
})

test("a status the dates contradict is corrected with one click that asks first", async () => {
  await openHub()
  await click(button("Đổi thành Đã kết thúc", rowOf("Cup A")))
  const dialog = await waitFor(confirmDialog, "The question opens")
  assert.match(dialog.textContent ?? "", /Cup A.*Sắp diễn ra.*Đã kết thúc/)
  assert.equal(rows[0]!.content.status, "UPCOMING", "nothing is saved before the answer")
  await answerConfirm("Đổi trạng thái")
  await waitFor(() => rows[0]!.content.status === "FINISHED", "The status is saved")
  await waitFor(() => !/Lịch đã hết/.test(rowOf("Cup A").textContent ?? ""), "The mark goes")
})

test("a row's menu starts a new season with the next name", async () => {
  rows[1] = tournamentRow("b", "Cup B 2026", { tier: "A" })
  await openHub()
  await openMenu(button("Thao tác với Cup B 2026")!)
  await click(menuItem("Nhân bản thành mùa mới"), "duplicate")
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input'), "The form opens")
  assert.equal(name.value, "Cup B 2027")
})

test("a row's menu starts a part of its tournament", async () => {
  await openHub()
  await openMenu(button("Thao tác với Cup B")!)
  await click(menuItem("Thêm phần"), "add part")
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input'), "The form opens")
  assert.equal(name.value, "Cup B - ")
})

test("a row's menu moves a tournament to the trash after the check of what uses it", async () => {
  let removed = ""
  tournamentApi.deletionImpact = async (_kind, id) => ({ id, version: 3, deletedAt: null, canDelete: true, usages: [] })
  tournamentApi.remove = async (_kind, entry) => {
    removed = entry.id
    return { ...entry, version: 4, deletedAt: "2026-11-24T00:00:00Z" }
  }
  await openHub()
  await openMenu(button("Thao tác với Cup D")!)
  await click(menuItem("Đưa vào thùng rác"), "trash")
  await answerConfirm("Chuyển vào thùng rác")
  await waitFor(() => removed === "d", "The tournament goes to the trash")
})

test("the search is kept in the address, replacing it while typing", async () => {
  await openHub()
  await type(document.querySelector<HTMLInputElement>('[aria-label="Tìm giải đấu"]')!, "cup")
  await waitFor(() => router.state.location.search === "?q=cup", "The address follows")
  assert.equal(router.state.historyAction, "REPLACE")
  await waitFor(() => searched.includes("cup|RECENT"), "The list is searched")
})

test("a list opened at an address shows that search and order", async () => {
  await openHub("/tournaments?q=cup&sort=NAME")
  assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Tìm giải đấu"]')!.value, "cup")
  assert.deepEqual(searched, ["cup|NAME"])
  await choose(document.querySelector<HTMLSelectElement>('[aria-label="Sắp xếp giải đấu"]')!, "STATUS")
  await waitFor(() => router.state.location.search === "?q=cup&sort=STATUS", "The order is kept too")
})

test("the filters offer only what finds something, with how many", async () => {
  await openHub("/tournaments?region=TH")
  const options = (label: string) =>
    [...document.querySelectorAll(`[aria-label="${label}"] option`)].map((option) => option.textContent)
  await waitFor(() => options("Trạng thái giải đấu").length > 1, "The counts arrive")
  assert.deepEqual(options("Trạng thái giải đấu"), ["Mọi trạng thái", "Sắp diễn ra (1)", "Đã kết thúc (3)"])
  assert.deepEqual(options("Hạng giải"), ["Mọi hạng giải", "Hạng A (4)"])
  assert.deepEqual(options("Khu vực giải đấu"), ["Mọi khu vực", "Thái Lan (0)", "Việt Nam (4)"])
  assert.equal(
    document.querySelector('[aria-label="Năm giải đấu"]'),
    null,
    "a filter with nothing to choose is left out",
  )
})

test("the seasons of a circuit stand together and the older ones wait to be shown", async () => {
  const seasons = ["2026", "2025", "2024", "2023", "2022"]
  rows = [...rows, ...seasons.map((year) => tournamentRow(year, `Premier League ${year}`, { year: Number(year) }))]
  competitionApi.summaries = async () =>
    seasons.map((id) => ({ id, entrants: 8, matches: 4, circuit: "Premier League", circuitPageId: "pl" }))
  await openHub()
  const heading = [...document.querySelectorAll("h2")].find((item) => item.textContent === "Premier League")!
  assert.match(heading.closest("tr")!.textContent ?? "", /5 mùa · 2022–2026/)
  assert.equal(opener("Premier League 2024")?.querySelector("strong")?.textContent, "2024")
  assert.equal(opener("Premier League 2023"), null, "older seasons are folded away")
  await click(button("Xem thêm 2 mùa của Premier League"))
  assert.ok(opener("Premier League 2022"))
})

test("what is on and coming up leads the list, and goes while the list is filtered", async () => {
  rows[1] = tournamentRow("b", "Cup B", { status: "ONGOING", startsOn: "2020-01-01", endsOn: "2099-01-01" })
  await openHub()
  const shelf = () => document.querySelector('[aria-labelledby="active-tournaments"]')
  assert.deepEqual(
    [...(shelf()?.querySelectorAll("a") ?? [])].map((link) => link.textContent),
    ["Cup B", "Cup A"],
    "a tournament whose dates are over waits behind it to be set right",
  )
  await type(document.querySelector<HTMLInputElement>('[aria-label="Tìm giải đấu"]')!, "cup")
  await waitFor(() => !shelf(), "A search shows its results only")
})

test("Shift ticks a range and the bar counts it", async () => {
  await openHub()
  await tick("Cup B")
  await tick("Cup D", true)
  assert.deepEqual(ticked(), ["Cup B", "Cup C", "Cup D"])
  assert.match(document.querySelector('[aria-label="Thao tác với giải đã chọn"]')?.textContent ?? "", /3 giải đã chọn/)
})

test("the header box ticks every row on screen and clears them again", async () => {
  await openHub()
  const all = document.querySelector('[aria-label="Chọn mọi giải đang hiện"]')!
  await click(all)
  assert.equal(ticked().length, 4)
  await click(all)
  assert.equal(ticked().length, 0)
})

test("other filters start with nothing ticked", async () => {
  await openHub()
  await tick("Cup B")
  const status = document.querySelector<HTMLSelectElement>('[aria-label="Trạng thái giải đấu"]')!
  await waitFor(() => status.querySelector('[value="FINISHED"]'), "The counts arrive")
  await choose(status, "FINISHED")
  await waitFor(() => /status=FINISHED/.test(router.state.location.search), "The filter applies")
  assert.deepEqual(ticked(), [])
})

test("a bulk status change lists old and new values, then keeps the failed ones ticked with their reason", async () => {
  const save = tournamentApi.save
  tournamentApi.save = async (kind, entry, content) => {
    if (entry.id === "c") throw new ApiError({ status: 409, code: "TOURNAMENT_VERSION_CONFLICT" })
    return save(kind, entry, content)
  }
  await openHub()
  await tick("Cup B")
  await tick("Cup D", true)
  await openMenu(button("Đổi trạng thái")!)
  await click(menuItem("Đã công bố"), "status")
  const dialog = await waitFor(confirmDialog, "The question opens")
  assert.match(dialog.textContent ?? "", /Cup B.*Đã kết thúc.*Đã công bố.*Cup C.*Cup D/)
  await answerConfirm("Đổi trạng thái")

  const report = await waitFor(() => document.querySelector('[role="alert"]'), "The report shows")
  assert.match(report.textContent ?? "", /Đã đổi trạng thái 2 giải.*Cup C · Dữ liệu đã thay đổi/)
  await waitFor(() => ticked().length === 1, "Only the failed one stays ticked")
  assert.deepEqual(ticked(), ["Cup C"])
})

test("tournaments become parts of a main event, except one that has parts of its own", async () => {
  await openHub()
  await tick("Cup B")
  await tick("Cup C", true)
  await click(button("Gắn vào giải chính"))
  await click(await waitFor(() => button("Giải chính: chưa chọn"), "The picker shows"))
  await click(await waitFor(() => button("Main Cup"), "The main event is offered"))
  const dialog = await waitFor(confirmDialog, "The question opens")
  assert.match(dialog.textContent ?? "", /Gắn 1 giải vào Main Cup/)
  assert.match(dialog.textContent ?? "", /Cup B.*Đang có 1 phần/)
  await answerConfirm("Gắn vào giải chính")
  await waitFor(() => rows[2]!.content.parentTournamentId === "main", "Cup C becomes a part")
  assert.equal(rows[1]!.content.parentTournamentId, undefined)
})

test("a bulk trash leaves out what is still in use and says why", async () => {
  const removed: string[] = []
  tournamentApi.deletionImpact = async (_kind, id) => ({
    id,
    version: 3,
    deletedAt: null,
    canDelete: id !== "d",
    usages: id === "d" ? [{ type: "SERIES", count: 8, adminPath: "/tournaments/d" }] : [],
  })
  tournamentApi.remove = async (_kind, entry) => {
    removed.push(entry.id)
    rows = rows.filter((row) => row.id !== entry.id)
    return { ...entry, version: 4, deletedAt: "2026-11-24T00:00:00Z" }
  }
  await openHub()
  await tick("Cup C")
  await tick("Cup D", true)
  await click(button("Đưa vào thùng rác"))
  const dialog = await waitFor(confirmDialog, "The question opens")
  assert.match(dialog.textContent ?? "", /Cup D.*Trận đấu 8/)
  await answerConfirm("Chuyển vào thùng rác")
  await waitFor(() => document.querySelector('[role="alert"]'), "The report shows")
  assert.deepEqual(removed, ["c"])
  await waitFor(() => !opener("Cup C"), "The row leaves the list")
  assert.equal(box("Cup D").getAttribute("aria-checked"), "true")
})
