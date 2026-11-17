import assert from "node:assert/strict"
import { before, beforeEach, test } from "node:test"
import { answerMediaQueries, choose, click, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, page } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const rows = Array.from({ length: 3 }, (_, index) => ({
  id: `asset-${index}`,
  semanticType: "HERO_HEAD",
  state: "ACTIVE",
  version: 1,
  currentVersionId: `version-${index}`,
  currentUrl: `/fixture-${index}.png`,
  createdAt: "2026-10-29T00:00:00Z",
  updatedAt: "2026-10-29T00:00:00Z",
  sources: [{ label: "Game capture", ownerName: "Garena" }],
}))
const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read"] }), (request) => {
  if (request.pathname === "/users/me") return json({ locale: "vi-VN" })
  if (request.pathname === "/admin/media/usage-totals")
    return json({
      states: { SHOWN: 0, DRAFT_ONLY: 0, HISTORY_ONLY: 0, STORED_ONLY: 0, NONE: 0 },
      competitionChecked: true,
    })
  if (request.pathname === "/admin/media/assets" && request.url.searchParams.get("withUsage")) return page([])
  if (request.pathname === "/admin/media/assets") return page(rows, { size: 20 })
  if (request.pathname.startsWith("/admin/media/assets/")) return json({ ...rows[0], versions: [], provenance: [] })
  return undefined
})
withDom({
  url: "http://localhost/image-management",
  globals: (window) => {
    answerMediaQueries(window, () => true)
    return { fetch: backend.fetch }
  },
})

before(signIn)
beforeEach(() => {
  backend.requests.length = 0
})

async function library(entry: string) {
  const { createMemoryRouter, RouterProvider } = await import("react-router")
  const { ImageManagementPage } = await import("../src/features/media/image-management-page")
  const router = createMemoryRouter([{ path: "/image-management", element: <ImageManagementPage /> }], {
    initialEntries: [entry],
  })
  await render(<RouterProvider router={router} />)
  await waitFor(() => document.querySelectorAll("tbody tr").length === 3)
  return router
}

const listRequests = () =>
  backend.requests.filter(
    (request) =>
      request.pathname === "/admin/media/assets" &&
      !request.url.searchParams.get("withUsage") &&
      request.url.searchParams.get("size") === "20",
  )

test("the image filters are read from the link, so a reload keeps them", async () => {
  await library("/image-management?type=HERO_HEAD&usage=SHOWN")

  assert.equal(document.querySelector<HTMLSelectElement>('select[aria-label="Loại ảnh"]')!.value, "HERO_HEAD")
  assert.equal(document.querySelector<HTMLSelectElement>('select[aria-label="Nơi dùng"]')!.value, "SHOWN")
  const sent = listRequests().at(-1)!.url.searchParams
  assert.equal(sent.get("semanticType"), "HERO_HEAD")
  assert.equal(sent.get("usage"), "SHOWN")
})

test("opening an image keeps the filters chosen after the page opened", async () => {
  const router = await library("/image-management")

  await choose(document.querySelector<HTMLSelectElement>('select[aria-label="Loại ảnh"]')!, "HERO_HEAD")
  await waitFor(() => router.state.location.search === "?type=HERO_HEAD")
  await waitFor(() => document.querySelectorAll("tbody tr").length === 3)
  await click(document.querySelector("tbody tr button"), "row")

  const params = new URLSearchParams(router.state.location.search)
  assert.equal(params.get("type"), "HERO_HEAD")
  assert.equal(params.get("asset"), "asset-0")
})
