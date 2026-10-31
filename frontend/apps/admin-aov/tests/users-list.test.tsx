import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { intersectionHarness } from "./fixtures/intersection-observer"
import type { UserProfile } from "../src/features/users/user-api"

test("users load on scroll, retain rows after errors and restart server search without pagination controls", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/users" })
  const intersections = intersectionHarness()
  const profiles: UserProfile[] = Array.from({ length: 45 }, (_, index) => ({
    id: `user-${index}`,
    displayName: `Person ${index}`,
    biography: "",
    locale: "vi-VN",
    timeZone: "Asia/Ho_Chi_Minh",
    avatarAssetId: null,
    avatarUrl: null,
    version: 1,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
  }))
  const requests: { search: string; page: number }[] = []
  let canRead = true
  let failLastPage = true
  let releasePage: (() => void) | undefined
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "users-fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "users-reader",
        type: "HUMAN",
        displayName: "Users reader",
        capabilities: canRead ? ["user:read"] : [],
      })
    assert.equal(path, "/admin/users")
    const search = url.searchParams.get("search") ?? ""
    const page = Number(url.searchParams.get("page"))
    const size = Number(url.searchParams.get("size"))
    requests.push({ search, page })
    assert.equal(size, 20)
    if (!search && page === 1) await new Promise<void>((resolve) => (releasePage = resolve))
    if (!search && page === 2 && failLastPage) {
      failLastPage = false
      return Response.json({ code: "PAGE_UNAVAILABLE" }, { status: 503 })
    }
    const matching = profiles.filter((profile) => profile.displayName.includes(search))
    return Response.json({
      items: matching.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: matching.length,
    })
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle,
    IntersectionObserver: intersections.Observer,
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { UsersPage } = await import("../src/features/users/users-page")
  const document = dom.window.document
  const root = createRoot(document.getElementById("root")!)
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
  const rows = () => [...document.querySelectorAll('a[aria-label^="Xem hồ sơ "]')]
  const sentinel = () => document.querySelector<HTMLElement>('[aria-label="Đang tải thêm người dùng…"]')!
  const waitFor = async (condition: () => boolean, message: string) => {
    for (let attempt = 0; attempt < 400 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(condition(), message)
  }
  const fill = async (value: string) =>
    act(async () => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Tìm người dùng theo tên"]')!
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value)
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <div id="users-scroll" style={{ overflowY: "auto" }}>
              <UsersPage />
            </div>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => rows().length === 20, "Only the first page loads initially")
    await waitFor(() => intersections.observing(sentinel()), "The first page is ready to observe scrolling")
    assert.equal(document.querySelector('[aria-label="Phân trang người dùng"]'), null)
    assert.deepEqual(requests, [{ search: "", page: 0 }])
    assert.equal(intersections.root(sentinel()), document.getElementById("users-scroll"))
    const firstRow = rows()[0]
    const target = sentinel()
    await act(async () => {
      intersections.intersect(target)
      intersections.intersect(target)
    })
    await waitFor(() => !!releasePage, "Scrolling requests the next page")
    assert.equal(requests.filter((request) => request.page === 1).length, 1)
    assert.equal(rows().length, 20, "Loaded profiles remain visible while the next page is pending")
    await act(async () => releasePage?.())
    await waitFor(() => rows().length === 40, "The second page appends to the list")
    assert.equal(rows()[0], firstRow, "Existing profile links stay mounted")
    await waitFor(() => intersections.observing(sentinel()), "Scrolling resumes after the previous request finishes")
    await act(async () => intersections.intersect(sentinel()))
    await waitFor(() => !!document.querySelector('[role="alert"]'), "Failed loading exposes a retry action")
    assert.equal(rows().length, 40, "A failed next page does not replace loaded profiles")
    assert.equal(sentinel(), null, "Errors stop automatic requests")
    const retry = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Thử lại"))!
    await act(async () => retry.click())
    await waitFor(() => rows().length === 45, "Retry appends the final page")
    assert.equal(requests.filter((request) => request.page === 2).length, 2)
    assert.equal(sentinel(), null, "The final page stops observing")
    assert.match(document.body.textContent ?? "", /Đã hiển thị 45 \/ 45 hồ sơ/)

    await fill("Person 44")
    await waitFor(() => rows().length === 1, "Search replaces the accumulated list")
    assert.equal(rows()[0].getAttribute("href"), "/users/user-44")
    assert.deepEqual(requests.at(-1), { search: "Person 44", page: 0 })
    await fill("Missing")
    await waitFor(
      () => document.body.textContent?.includes("Không tìm thấy người dùng") === true,
      "Empty search has a clear state",
    )
    const clear = [...document.querySelectorAll("button")].find((button) => button.textContent === "Xóa tìm kiếm")!
    await act(async () => clear.click())
    await waitFor(() => rows().length === 45, "Clearing search restores the unfiltered cached list")

    const previousRequestCount = requests.length
    canRead = false
    await act(async () => verifySession())
    await waitFor(
      () => document.body.textContent?.includes("Bạn chưa có quyền") === true,
      "Read permission still gates the list",
    )
    assert.equal(rows().length, 0)
    assert.equal(requests.length, previousRequestCount)
  } finally {
    releasePage?.()
    await act(async () => root.unmount())
    cache.clear()
    await logout()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
