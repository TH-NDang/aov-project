import assert from "node:assert/strict"
import { before, beforeEach, test } from "node:test"
import type { AdminLineup, AdminMode, GuideContent } from "../src/features/game-modes/game-mode-api"
import { answerConfirm, button, click, confirmDialog, render, waitFor, withDom } from "./fixtures/dom"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { fakeBackend, json } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const revision = {
  id: "rev-1",
  revisionNo: 2,
  state: "DRAFT" as const,
  version: 4,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
}
const mode: AdminMode = {
  id: "mode-1",
  code: "co-lien-quan",
  revision,
  hasPublished: true,
  content: {
    name: "Cờ Liên Quân",
    group: "ENTERTAINMENT",
    guideKind: "NONE",
    rules: [],
    heroes: [],
    specialItems: [],
    sources: [],
  },
  missingFields: [],
  images: {},
}
const lineup = (index: number): AdminLineup => ({
  id: `lineup-${index}`,
  name: `Đội hình ${index}`,
  units: [],
  emblems: [],
  status: "VISIBLE",
  authorSubject: "player-subject",
  version: 1,
  likes: index,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
})
const lineups = Array.from({ length: 45 }, (_, index) => lineup(index + 1))

const backend = fakeBackend(sessionRoutes({ capabilities: ["gamemode:write", "gamemode:publish"] }), (request) => {
  if (request.pathname === "/admin/game-modes/mode-1") return json(mode)
  if (request.pathname === "/admin/game-modes/mode-1/revisions") return json([revision])
  if (request.pathname === "/admin/game-modes/mode-1/drafts/rev-1/discard")
    return json({ ...mode, revision: { ...revision, state: "DISCARDED" } })
  if (request.pathname === "/admin/game-modes/mode-1/auto-chess/community-lineups") {
    const page = Number(request.url.searchParams.get("page"))
    const size = Number(request.url.searchParams.get("size"))
    return json({ items: lineups.slice(page * size, (page + 1) * size), page, size, totalElements: lineups.length })
  }
  return undefined
})
const intersections = intersectionHarness()
withDom({
  url: "http://localhost/game-modes/mode-1",
  globals: () => ({ fetch: backend.fetch, IntersectionObserver: intersections.Observer }),
})

before(signIn)
beforeEach(() => {
  backend.requests.length = 0
})

const discards = () => backend.requests.filter((request) => request.pathname.endsWith("/discard"))

test("discarding a mode draft asks first and sends nothing when refused", async () => {
  const { MemoryRouter, Route, Routes } = await import("react-router")
  const { GameModeEditorPage } = await import("../src/features/game-modes/game-mode-editor")
  await render(
    <MemoryRouter initialEntries={["/game-modes/mode-1"]}>
      <Routes>
        <Route path="/game-modes/:modeId" element={<GameModeEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
  const discard = await waitFor(() => button("Bỏ nháp"))

  await click(discard)
  assert.match(confirmDialog()!.textContent!, /Bỏ bản nháp này\?/)
  await answerConfirm("Giữ bản nháp")
  assert.equal(discards().length, 0)

  await click(button("Bỏ nháp"))
  await answerConfirm("Bỏ nháp")
  await waitFor(() => discards().length === 1)
})

test("the community lineup review loads the next page as the editor reaches the end", async () => {
  const { CommunityModeration } = await import("../src/features/game-modes/auto-chess-editor")
  const content = { units: [] } as unknown as GuideContent
  await render(<CommunityModeration modeId="mode-1" canPublish content={content} />)
  const names = () => [...document.querySelectorAll("li strong")].map((node) => node.textContent)
  await waitFor(() => names().length === 30)

  const sentinel = await waitFor(() => document.querySelector('[aria-label="Đang tải thêm đội hình…"]'))
  intersections.intersect(sentinel)

  await waitFor(() => names().length === 45)
  assert.equal(names().at(-1), "Đội hình 45")
  assert.equal(document.querySelector('[aria-label="Đang tải thêm đội hình…"]'), null, "The last page ends the list")
})
