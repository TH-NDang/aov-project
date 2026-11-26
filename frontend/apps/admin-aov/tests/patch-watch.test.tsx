import assert from "node:assert/strict"
import { before, test } from "node:test"
import { button, choose, click, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, page, type ApiRequest } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const vietnam = {
  code: "LIENQUAN_VN",
  region: "VN",
  channels: ["OFFICIAL"],
  pageUrl: "https://lienquan.garena.vn/category/cap-nhat/",
  readable: true,
  mode: "DAILY",
  dailyAt: "08:00:00",
  everyHours: 6,
  paused: false,
  lastCheckedAt: "2026-11-26T01:00:00Z",
  lastSuccessAt: "2026-11-26T01:00:00Z",
  nextCheckAt: "2026-11-27T01:00:00Z",
  failures: 0,
  failure: null,
  failureStatus: null,
  version: 4,
}
const indonesia = {
  ...vietnam,
  code: "GARENA_ID",
  region: "ID",
  pageUrl: "https://main.aov.garena.co.id/news/update",
  readable: false,
  nextCheckAt: null,
  lastCheckedAt: null,
  lastSuccessAt: null,
  version: 0,
}
const testServerPost = {
  id: "post-1",
  source: "ROV_TH",
  region: "TH",
  channel: "EXPERIMENTAL",
  url: "https://www.rov.in.th/patch-notes/expserver261117",
  title: "Máy chủ thử nghiệm 17/11",
  publishedAt: "2026-11-17T00:00:00Z",
  firstSeenAt: "2026-11-26T01:00:00Z",
  state: "NEW",
  stateChangedAt: null,
  version: 0,
}

const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read", "patch:write"] }), (request) => {
  if (request.method === "GET" && request.pathname === "/admin/patch-watch")
    return json({ scheduled: true, zone: "Asia/Ho_Chi_Minh", newCount: 1, sources: [vietnam, indonesia] })
  if (request.method === "GET" && request.pathname === "/admin/patch-watch/posts")
    return page(request.url.searchParams.get("state") === "NEW" ? [testServerPost] : [], { size: 30 })
  if (request.method === "PUT" && request.pathname === "/admin/patch-watch/posts/post-1/state")
    return json({ ...testServerPost, ...(request.body as object), version: 1 })
  if (request.method === "PUT" && request.pathname === "/admin/patch-watch/sources/LIENQUAN_VN/schedule")
    return json({ ...vietnam, ...(request.body as object), version: 5 })
  return undefined
})
withDom({ url: "http://localhost/patch-watch", globals: () => ({ fetch: backend.fetch }) })

before(signIn)

async function openPage() {
  const { MemoryRouter } = await import("react-router")
  const { PatchWatchPage } = await import("../src/features/patch-watch/patch-watch-page")
  await render(
    <MemoryRouter initialEntries={["/patch-watch"]}>
      <PatchWatchPage />
    </MemoryRouter>,
  )
  return waitFor(() => [...document.querySelectorAll("li")].find((row) => row.textContent?.includes("17/11")))
}

const sent = (method: string, pathname: string) => (request: ApiRequest) =>
  request.method === method && request.pathname === pathname

test("the inbox opens on new posts and a handled post is sent with the version it was read at", async () => {
  const row = await openPage()
  const list = backend.requests.find(sent("GET", "/admin/patch-watch/posts"))
  assert.equal(list?.url.searchParams.get("state"), "NEW")
  assert.match(row.textContent!, /TH\s*Thử nghiệm/)

  await click(button("Xong", row), "Xong")
  const change = await waitFor(() => backend.requests.find(sent("PUT", "/admin/patch-watch/posts/post-1/state")))
  assert.deepEqual(change.body, { state: "DONE", expectedVersion: 0 })
})

test("a source can be read every few hours instead of every morning", async () => {
  await openPage()
  await click(button("Đổi lịch Garena Việt Nam"), "schedule button")
  const dialog = await waitFor(() => document.querySelector<HTMLElement>('[role="dialog"]'))
  await click(button("Theo giờ", dialog), "every-hours choice")
  await choose(dialog.querySelector<HTMLSelectElement>("#pw-every-hours")!, "3")
  await click(button("Lưu lịch", dialog), "save")

  const change = await waitFor(() =>
    backend.requests.find(sent("PUT", "/admin/patch-watch/sources/LIENQUAN_VN/schedule")),
  )
  assert.deepEqual(change.body, {
    mode: "EVERY_HOURS",
    dailyAt: "08:00",
    everyHours: 3,
    paused: false,
    expectedVersion: 4,
  })
})

test("the Indonesian page says it is read on the server only", async () => {
  await openPage()
  const card = [...document.querySelectorAll("li")].find((row) => row.textContent?.includes("Garena Indonesia"))
  assert.match(card!.textContent!, /Chỉ đọc được trên máy chủ/)
})
