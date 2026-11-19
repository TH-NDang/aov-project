import assert from "node:assert/strict"
import { before, test } from "node:test"
import { render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, page } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read"] }), (request) => {
  if (request.pathname === "/admin/videos/subjects") return json({ items: [] })
  if (request.pathname === "/admin/videos") return page([], { size: 30 })
  if (request.pathname === "/admin/publication-overview") return json({ variants: [] })
  return undefined
})
withDom({ url: "http://localhost/videos", globals: () => ({ fetch: backend.fetch }) })

before(signIn)

test("the video filters are read from the link, so a reload keeps them", async () => {
  const { MemoryRouter } = await import("react-router")
  const { VideosPage } = await import("../src/features/videos/videos-page")
  await render(
    <MemoryRouter initialEntries={["/videos?status=PUBLISHED&kind=SKIN&q=airi"]}>
      <VideosPage />
    </MemoryRouter>,
  )

  const list = await waitFor(() =>
    backend.requests.find(
      (request) => request.pathname === "/admin/videos" && request.url.searchParams.get("size") === "30",
    ),
  )
  assert.equal(list.url.searchParams.get("status"), "PUBLISHED")
  assert.equal(list.url.searchParams.get("subjectKind"), "SKIN")
  assert.equal(list.url.searchParams.get("q"), "airi")
  assert.equal(document.querySelector<HTMLInputElement>('input[type="search"], input')!.value, "airi")
})
