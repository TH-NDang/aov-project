import assert from "node:assert/strict"
import { test } from "node:test"
import { act, useRef } from "react"
import { MemoryRouter } from "react-router"
import { answerMediaQueries, button, click, render, waitFor, withDom, QuietResizeObserver } from "./fixtures/dom"
import { fakeBackend, json } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read"] }), (request) =>
  request.pathname === "/admin/patch-watch" ? json({ newCount: 3 }) : undefined,
)
const dom = withDom({
  url: "http://localhost/hero",
  globals: () => ({ fetch: backend.fetch, ResizeObserver: QuietResizeObserver }),
})
// A wide screen with room for the list of pages beside the rail.
answerMediaQueries(dom.window, (query) => query.includes("min-width"))
await signIn()

const { NAV_AREAS, NAV_ITEMS, activeNavArea } = await import("../src/app/nav")
const { areaCount, areasFor, barAtTop, followScroll, recentItems, rememberRecent, RECENT_LIMIT } =
  await import("../src/app/layout/nav/nav-model")
const { AdminNavProvider } = await import("../src/app/layout/nav/admin-nav")
const { CompactNavigation, SideNavigation } = await import("../src/app/layout/nav/navigation")
const { BackgroundTasksProvider } = await import("../src/app/background-tasks")
const { ThemeProvider } = await import("../src/app/theme")

test("every page of the navigation belongs to exactly one area", () => {
  const listed = NAV_AREAS.flatMap((area) => area.groups.flatMap((group) => group.items.map((item) => item.to)))
  assert.equal(new Set(listed).size, listed.length)
  assert.deepEqual(
    NAV_ITEMS.map((item) => item.to).filter((to) => !listed.includes(to)),
    ["/profile"],
    "Only the profile lives outside the areas, in the account menu",
  )
  assert.equal(activeNavArea("/hero/media")?.key, "wiki")
  assert.equal(activeNavArea("/teams")?.key, "competition")
  assert.equal(activeNavArea("/patch-watch")?.key, "game")
  assert.equal(activeNavArea("/")?.key, "home")
  assert.equal(activeNavArea("/profile"), undefined)
})

test("a reader sees only the pages they may open, and no area left empty", () => {
  const keys = (capabilities: string[]) =>
    areasFor(NAV_AREAS, capabilities).map((area) => [
      area.key,
      area.groups.flatMap((group) => group.items.map((item) => item.to)),
    ])
  const visitor = Object.fromEntries(keys([]))
  assert.equal(visitor.wiki, undefined, "Every Wiki page needs catalog:read")
  assert.ok(visitor.competition.includes("/tournaments"))
  assert.ok(!visitor.system, "System pages need a capability each")
  const editor = Object.fromEntries(keys(["catalog:read"]))
  assert.ok(editor.system.includes("/files"))
  assert.ok(!editor.system.includes("/users"))
  const wiki = areasFor(NAV_AREAS, ["catalog:read"]).find((area) => area.key === "wiki")!
  assert.ok(wiki.groups.every((group) => group.items.length))
})

test("an area's mark sums the counts of its pages", () => {
  const game = NAV_AREAS.find((area) => area.key === "game")!
  const wiki = NAV_AREAS.find((area) => area.key === "wiki")!
  assert.equal(areaCount(game, { patchNotes: 4 }), 4)
  assert.equal(areaCount(game, {}), 0)
  assert.equal(areaCount(wiki, { patchNotes: 4 }), 0)
})

test("recent pages put the newest first, skip the overview and keep a few", () => {
  assert.deepEqual(rememberRecent(["/items", "/hero"], "/hero"), ["/hero", "/items"])
  assert.deepEqual(rememberRecent(["/items"], "/"), ["/items"])
  const many = ["/a", "/b", "/c", "/d", "/e"]
  assert.equal(rememberRecent(many, "/f").length, RECENT_LIMIT)
  assert.equal(rememberRecent(many, "/f")[0], "/f")
  assert.deepEqual(
    recentItems(["/users", "/streams", "/gone", "/hero"], ["catalog:read"]).map((item) => item.to),
    ["/hero"],
    "Pages the reader may not open, pages still to come and pages that no longer exist are left out",
  )
})

test("the phone bar goes away while reading down and comes back after a short scroll up", () => {
  const scroll = (...tops: number[]) => tops.reduce(followScroll, barAtTop)
  assert.equal(scroll(30, 45).hidden, false, "Near the top the bar stays")
  assert.equal(scroll(100, 112).hidden, true)
  assert.equal(scroll(100, 300, 280).hidden, true, "A small move up keeps reading")
  assert.equal(scroll(100, 300, 280, 260).hidden, false, "A short pull up brings it back")
  assert.equal(scroll(100, 300, 260, 262, 266).hidden, false, "A jitter down does not hide it again")
  assert.equal(scroll(100, 300, 40).hidden, false)
})

const railArea = (title: string) =>
  dom.document.querySelector<HTMLButtonElement>(`.adm-rail-area[aria-label^="${title}"]`)
const panel = () => dom.document.querySelector<HTMLElement>(".adm-panel")
const pageLink = (title: string, scope: ParentNode = dom.document) =>
  [...scope.querySelectorAll<HTMLAnchorElement>("a.adm-nav-row")].find((link) => link.textContent?.includes(title))

async function renderNav() {
  await render(
    <MemoryRouter initialEntries={["/hero"]}>
      <ThemeProvider>
        <BackgroundTasksProvider>
          <AdminNavProvider>
            <SideNavigation />
          </AdminNavProvider>
        </BackgroundTasksProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

test("the rail marks the area being read and the list beside it shows its pages", async () => {
  dom.document.cookie = "sidebar_state=true; path=/"
  await renderNav()
  const wiki = railArea("Wiki")
  assert.equal(wiki?.dataset.current, "true")
  assert.equal(wiki?.getAttribute("aria-pressed"), "true")
  assert.equal(pageLink("Tướng", panel()!)?.getAttribute("aria-current"), "page")
  await waitFor(() => railArea("Quản lý game")?.getAttribute("aria-label")?.includes("3 mục mới"))

  await click(railArea("Giải đấu"), "competition area")
  assert.ok(pageLink("Giải đấu", panel()!), "Picking an area shows its pages")
  assert.equal(railArea("Giải đấu")?.getAttribute("aria-pressed"), "true")
  assert.equal(railArea("Wiki")?.dataset.current, "true", "The area being read keeps its mark")
  await click(railArea("Hệ thống"), "system area")
  assert.ok(pageLink("Quản lý tệp", panel()!))
  assert.equal(pageLink("Người dùng", panel()!), undefined, "Users need user:read")
  await click(railArea("Giải đấu"), "competition area")

  await click(pageLink("Hồ sơ thi đấu", panel()!), "profile directory link")
  assert.equal(railArea("Giải đấu")?.dataset.current, "true")
  await click(railArea("Tổng quan"), "overview area")
  const recent = panel()!.querySelector('[aria-label="Gần đây"]')
  assert.ok(recent && pageLink("Tướng", recent), "The overview lists the page opened before")
  assert.deepEqual(JSON.parse(localStorage.getItem("aov-admin:recent-pages:fixture:editor") ?? "[]"), [
    "/organizations",
    "/hero",
  ])
})

test("Ctrl B puts the list away; the rail then opens an area as a floating list", async () => {
  dom.document.cookie = "sidebar_state=true; path=/"
  await renderNav()
  assert.ok(panel())
  await act(async () => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }))
  })
  assert.equal(panel(), null)
  assert.match(dom.document.cookie, /sidebar_state=false/)
  assert.ok(button("Mở danh sách trang"), "The rail offers to bring the list back")

  const wiki = railArea("Wiki")
  assert.equal(wiki?.getAttribute("aria-expanded"), "false")
  await click(wiki, "Wiki area")
  assert.equal(railArea("Wiki")?.getAttribute("aria-expanded"), "true")
  const flyout = await waitFor(() => dom.document.querySelector<HTMLElement>(".adm-flyout"))
  assert.ok(pageLink("Bảng ngọc", flyout))

  await click(pageLink("Bảng ngọc", flyout), "arcana link")
  await waitFor(() => !dom.document.querySelector(".adm-flyout"), "Opening a page puts the floating list away")
  assert.equal(railArea("Wiki")?.dataset.current, "true")

  await click(button("Mở danh sách trang"), "open list button")
  assert.ok(panel())
  assert.match(dom.document.cookie, /sidebar_state=true/)
})

test("on phones the bar slides away as the reader scrolls down and returns on a short scroll up", async () => {
  answerMediaQueries(dom.window, (query) => query.includes("max-width"))
  try {
    function Shell() {
      const content = useRef<HTMLDivElement>(null)
      return (
        <AdminNavProvider>
          <div ref={content} className="test-content" />
          <CompactNavigation content={content} />
        </AdminNavProvider>
      )
    }
    await render(
      <MemoryRouter initialEntries={["/hero"]}>
        <ThemeProvider>
          <BackgroundTasksProvider>
            <Shell />
          </BackgroundTasksProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )
    const content = dom.document.querySelector<HTMLElement>(".test-content")!
    let top = 0
    Object.defineProperties(content, {
      scrollTop: { configurable: true, get: () => top },
      scrollHeight: { configurable: true, value: 3000 },
      clientHeight: { configurable: true, value: 600 },
    })
    const hidden = () => dom.document.querySelector<HTMLElement>(".adm-tabbar")?.dataset.hidden === "true"
    const scrollTo = async (to: number) => {
      top = to
      await act(async () => {
        content.dispatchEvent(new dom.window.Event("scroll"))
      })
    }
    // The bar's own space comes and goes after each change, so the next scroll waits for it to settle.
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 320)))

    await scrollTo(900)
    assert.equal(hidden(), false, "A page put back where it was left scrolls without the reader")
    content.dispatchEvent(new dom.window.Event("pointerdown"))
    await scrollTo(940)
    assert.equal(hidden(), true)
    await settle()
    await scrollTo(920)
    assert.equal(hidden(), true)
    await scrollTo(880)
    assert.equal(hidden(), false)

    await settle()
    await scrollTo(1000)
    assert.equal(hidden(), true)
    await act(async () => dom.document.querySelector<HTMLButtonElement>(".adm-tab")!.focus())
    assert.equal(hidden(), false, "A keyboard reader reaching the bar sees it")
  } finally {
    answerMediaQueries(dom.window, (query) => query.includes("min-width"))
  }
})
