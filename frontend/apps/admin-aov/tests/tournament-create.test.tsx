import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import type { CompetitionPlan, TournamentContent } from "@aov/community-contracts"
import {
  QuietResizeObserver,
  answerConfirm,
  button,
  click,
  confirmDialog,
  render,
  type,
  waitFor,
  withDom,
} from "./fixtures/dom"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { tournamentRow } from "./fixtures/tournament-list-data"

const { window } = withDom({
  url: "http://localhost:5175/tournaments",
  globals: () => ({ ResizeObserver: QuietResizeObserver, IntersectionObserver: intersectionHarness().Observer }),
})

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { competitionApi } = await import("../src/features/competition/competition-api")
const { ApiError } = await import("../src/lib/api/errors")
const { CreateTournamentSheet } = await import("../src/features/tournaments/components/create-tournament-sheet")
const { RegistryEditor } = await import("../src/features/tournaments/components/registry-editor")

const originals = { tournament: { ...tournamentApi }, competition: { ...competitionApi } }
const source = tournamentRow("old", "Cup 2026", { tier: "A", logoUrl: "https://img.example/cup.png" })
const plan = (over: Partial<CompetitionPlan> = {}) =>
  ({ entrants: [], stages: [], venues: [], matches: [], playoffSeeds: {}, sourceUrl: "", ...over }) as never
let created: TournamentContent[]
let savedPlans: CompetitionPlan[]
let closed: number
let router: ReturnType<typeof createMemoryRouter>

beforeEach(() => {
  created = []
  savedPlans = []
  closed = 0
  Object.assign(tournamentApi, {
    create: async (_kind: string, content: TournamentContent) => {
      created.push(content)
      return tournamentRow("new", content.name, content)
    },
    read: async (_kind: string, id: string) => (id === "old" ? source : tournamentRow(id, "Cup 2027")),
    list: async (_kind: string, _signal: unknown, filters: { tournamentId: string }) =>
      filters.tournamentId === "old"
        ? [{ id: "line", content: { tournamentId: "old", teamId: "flash", playerId: "adc" } }]
        : [],
    rosterBatch: async () => ({ created: [], updated: [], removed: 0 }),
  })
  Object.assign(competitionApi, {
    read: async (id: string) => ({
      id,
      version: 1,
      content: {
        tournament: source.content,
        rosters: [{ teamId: "flash", playerId: "adc" }],
        plan: plan(
          id === "old" || savedPlans.length
            ? { entrants: [{ teamId: "flash", status: "REGISTERED", note: "" }] }
            : undefined,
        ),
      },
    }),
    save: async (_entry: unknown, content: CompetitionPlan) => {
      savedPlans.push(content)
    },
  })
})
afterEach(() => {
  Object.assign(tournamentApi, originals.tournament)
  Object.assign(competitionApi, originals.competition)
  router.dispose()
})

async function openForm(element = <CreateTournamentSheet onClose={() => closed++} />) {
  router = createMemoryRouter([
    { path: "/", element },
    { path: "/tournaments/:id", element: <p>Workspace</p> },
  ])
  await render(<RouterProvider router={router} />)
  return waitFor(() => document.querySelector<HTMLInputElement>('[role="dialog"] input'), "The form opens")
}
const codeField = () => document.querySelector<HTMLInputElement>('[role="dialog"] input[pattern]')!

test("the form starts with the name and suggests the code from it", async () => {
  const name = await openForm()
  await type(name, "Cúp Mùa Đông 2027")
  assert.equal(codeField().value, "cup-mua-dong-2027")
})

test("a name the code cannot follow asks for the code by hand", async () => {
  const name = await openForm()
  await type(name, "傳說對決 2027")
  assert.equal(codeField().value, "")
  assert.match(document.body.textContent ?? "", /Hãy tự đặt mã/)
})

test("a created tournament opens its workspace", async () => {
  const name = await openForm()
  await type(name, "Cúp 2027")
  await click(button("Tạo và mở giải"))
  await waitFor(() => router.state.location.pathname === "/tournaments/new", "The workspace opens")
  assert.equal(created[0]!.code, "cup-2027")
  assert.equal(closed, 1)
})

test("a new season copies the chosen parts and opens its workspace", async () => {
  await openForm(<CreateTournamentSheet source={source} onClose={() => closed++} />)
  await waitFor(() => /1 tuyển thủ/.test(document.body.textContent ?? ""), "The source says what it has to give")
  await click(button("Tạo và chép thiết lập"))
  await waitFor(() => router.state.location.pathname === "/tournaments/new", "The workspace opens")
  assert.equal(created[0]!.name, "Cup 2027")
  assert.equal(created[0]!.logoUrl, "https://img.example/cup.png")
  assert.equal(savedPlans[0]!.entrants[0]!.teamId, "flash")
})

test("a copy that stops half way says what is missing, tries again and still opens the tournament", async () => {
  let failing = true
  tournamentApi.rosterBatch = async () => {
    if (failing) throw new ApiError({ status: 503, code: "UNAVAILABLE" })
    return { created: [], updated: [], removed: 0 }
  }
  await openForm(<CreateTournamentSheet source={source} onClose={() => closed++} />)
  await click(button("Tạo và chép thiết lập"))
  const again = await waitFor(() => button("Chép lại phần còn thiếu"), "The report offers another try")
  assert.match(document.body.textContent ?? "", /Đội hình của các độiChưa chép được · 0\/1 tuyển thủ/)
  assert.match(document.body.textContent ?? "", /Đội tham dựĐã chép · 1 đội/)
  assert.ok(button("Mở giải"))

  failing = false
  await click(again)
  await waitFor(() => router.state.location.pathname === "/tournaments/new", "The workspace opens")
  assert.equal(created.length, 1, "the tournament is created once")
  assert.equal(savedPlans.length, 1, "what was copied is not written again")
})

test("a code in use keeps the form open with the reason", async () => {
  tournamentApi.create = async () => {
    throw new ApiError({ status: 409, code: "DUPLICATE_RECORD" })
  }
  const name = await openForm()
  await type(name, "Cúp 2027")
  await click(button("Tạo và mở giải"))
  const alert = await waitFor(() => document.querySelector('[role="alert"]'), "The reason shows")
  assert.match(alert.textContent ?? "", /Mã đã được dùng/)
  assert.equal(name.value, "Cúp 2027")
})

test("closing a form with something typed asks first", async () => {
  const name = await openForm()
  await type(name, "Cúp 2027")
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  assert.ok(await waitFor(confirmDialog, "The question opens"))
  await answerConfirm("Ở lại chỉnh sửa")
  assert.equal(closed, 0)
})

test("adding a part from anywhere uses the same form", async () => {
  const name = await openForm(
    <RegistryEditor
      open
      kind="tournaments"
      defaults={{ parentTournamentId: "old", name: "Cup 2026 - " }}
      onClose={() => closed++}
    />,
  )
  assert.equal(name.value, "Cup 2026 - ")
  assert.ok(button("Tạo và mở giải"))
})
