import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter, useLocation } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Request } from "../src/features/publishing/publishing-api"
import type { SkinBadgeRecord } from "../src/features/media/character-image-api"
import { badgeGroupKeys, createSkinBadgeGroupsApi, type BadgeGroup } from "../src/features/media/skin-badge-groups-api"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import { intersectionHarness } from "./fixtures/intersection-observer"

const rank: BadgeGroup = {
  id: "rank-a",
  code: "rank-a",
  kind: "RANK",
  version: 3,
  translations: [{ locale: "vi-VN", displayName: "A" }],
  displayName: "A",
  actualLocale: "vi-VN",
  fallbackApplied: false,
  badgeCount: 2,
  matchedByGroup: false,
}
const theme: BadgeGroup = {
  ...rank,
  id: "theme-aic",
  code: "aic",
  kind: "THEME",
  version: 5,
  translations: [
    { locale: "vi-VN", displayName: "Giải đấu AIC" },
    { locale: "en-US", displayName: "AIC Tournament" },
  ],
  displayName: "Giải đấu AIC",
  badgeCount: 1,
}
const ungrouped: BadgeGroup = {
  id: null,
  code: "__ungrouped",
  kind: null,
  version: 0,
  translations: [],
  displayName: null,
  actualLocale: null,
  fallbackApplied: true,
  badgeCount: 0,
  matchedByGroup: false,
}
const badge: SkinBadgeRecord = {
  id: "badge-a",
  code: "a-limited",
  kind: "RARITY",
  groupId: rank.id,
  version: 7,
  translations: [{ locale: "vi-VN", displayName: "A Hữu hạn", iconAssetId: null }],
  displayName: "A Hữu hạn",
  actualLocale: "vi-VN",
  fallbackApplied: false,
  iconAssetId: null,
  skinCount: 1,
}
const page = <T,>(items: T[], page = 0, size = 20, totalElements = items.length) => ({
  items,
  page,
  size,
  totalElements,
})

test("badge group APIs isolate group filters and locales, and send versioned metadata and move commands", async () => {
  const calls: { path: string; init?: RequestInit }[] = []
  const api = createSkinBadgeGroupsApi(async <T,>(path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return {} as T
  })
  const abort = new AbortController()
  await api.groups("en-US", " AIC ", 2, abort.signal)
  assert.deepEqual(Object.fromEntries(new URL(calls[0].path, "http://fixture").searchParams), {
    locale: "en-US",
    q: "AIC",
    page: "2",
    size: "20",
  })
  assert.equal(calls[0].init?.signal, abort.signal)
  await api.badges(theme.id, "rule", "en-US", " limited ", 1)
  let params = new URL(calls[1].path, "http://fixture").searchParams
  assert.equal(params.get("groupId"), theme.id)
  assert.equal(params.has("ungrouped"), false)
  assert.equal(params.get("q"), "limited")
  assert.equal(params.get("page"), "1")
  await api.badges(null, "", "vi-VN", "", 0)
  params = new URL(calls[2].path, "http://fixture").searchParams
  assert.equal(params.get("ungrouped"), "true")
  assert.equal(params.has("groupId"), false)
  assert.equal(params.has("rulesetId"), false)
  await api.save({ code: "immutable", kind: "THEME", translations: theme.translations }, theme)
  assert.equal(calls[3].path, "/admin/skin-badge-groups/theme-aic")
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), {
    expectedVersion: 5,
    kind: "THEME",
    translations: theme.translations,
  })
  await api.moveBadge(badge, null)
  assert.equal(calls[4].path, "/admin/skin-badges/badge-a/group")
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { expectedVersion: 7, groupId: null })
  assert.notDeepEqual(
    badgeGroupKeys.badges(rank.id, "rule", "vi-VN", ""),
    badgeGroupKeys.badges(theme.id, "rule", "vi-VN", ""),
  )
  assert.notDeepEqual(badgeGroupKeys.list("vi-VN", ""), badgeGroupKeys.list("en-US", ""))
})

async function withUi(
  request: Request,
  run: (ui: {
    document: Document
    client: QueryClient
    render: (node: React.ReactNode, location?: string) => Promise<void>
    waitFor: (condition: () => boolean) => Promise<void>
    click: (element: Element | null | undefined) => Promise<void>
    button: (text: string) => HTMLButtonElement | undefined
    input: (label: string, value: string) => Promise<void>
    select: (label: string, value: string) => Promise<void>
    intersect: (label: string) => Promise<void>
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/hero/media?tab=badges",
    pretendToBeVisual: true,
  })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const intersections = intersectionHarness()
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input), "http://localhost").pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["hero:write"],
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path.startsWith("/admin/media/assets/"))
      return Response.json({ id: path.split("/").at(-1), currentUrl: "/fixture.webp", provenance: [], versions: [] })
    throw new Error(`Unexpected fixture fetch: ${path}`)
  }
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    BroadcastChannel: undefined,
    IntersectionObserver: intersections.Observer,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { createRoot } = await import("react-dom/client")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  function Location() {
    const location = useLocation()
    return (
      <output data-location>
        {location.pathname}
        {location.search}
      </output>
    )
  }
  const render = async (node: React.ReactNode, location = "/hero/media?tab=badges") => {
    await act(async () =>
      root.render(
        <MemoryRouter key={location} initialEntries={[location]}>
          <QueryClientProvider client={client}>
            <TooltipProvider>
              <Location />
              {node}
            </TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  }
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 200 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), document.body.textContent ?? "")
  }
  const click = async (element: Element | null | undefined) => {
    assert.ok(element)
    await act(async () => (element as HTMLElement).click())
  }
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === text)
  const input = async (label: string, value: string) => {
    const element = Array.from(document.querySelectorAll("label"))
      .find((item) => item.textContent?.trim().startsWith(label))
      ?.querySelector("input")
    assert.ok(element, label)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(element, value)
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  }
  const select = async (label: string, value: string) => {
    const element = document.querySelector(`select[aria-label="${label}"]`)
    assert.ok(element, label)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value")!.set!.call(element, value)
      element.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  }
  const intersect = async (label: string) => {
    const target = document.querySelector(`[aria-label="${label}"]`)
    assert.ok(target, label)
    assert.ok(intersections.observing(target), `${label} must be active`)
    await act(async () => intersections.intersect(target))
  }
  try {
    await verifySession()
    await run({ document, client, render, waitFor, click, button, input, select, intersect })
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("badge accordions page independently, retain loaded rows when collapsed and open skin details without navigating", async () => {
  const calls: string[] = []
  const request: Request = async <T,>(path: string) => {
    calls.push(path)
    const url = new URL(path, "http://fixture")
    const index = Number(url.searchParams.get("page") ?? 0)
    if (path === "/admin/rulesets") return [{ id: "rule", code: "aov-standard" }] as T
    if (url.pathname === "/admin/skin-badge-groups") {
      if (url.searchParams.get("q") === "AIC") return page([{ ...theme, matchedByGroup: true }]) as T
      return (index ? page([ungrouped], 1, 2, 3) : page([rank, theme], 0, 2, 3)) as T
    }
    if (url.pathname === "/admin/skin-badges") {
      if (url.searchParams.get("groupId") === rank.id)
        return page(
          [
            {
              ...badge,
              id: index ? "badge-a-2" : badge.id,
              code: index ? "a-2" : badge.code,
              displayName: index ? "a-2" : badge.displayName,
            },
          ],
          index,
          1,
          2,
        ) as T
      return page(
        url.searchParams.get("groupId") === theme.id
          ? [{ ...badge, id: "aic-badge", groupId: theme.id, code: "aic" }]
          : [],
      ) as T
    }
    if (url.pathname === `/admin/skin-badges/${badge.id}/skins`)
      return page([
        {
          heroId: fixtureRevision.heroId,
          heroCode: "airi",
          heroName: "Airi",
          revisionId: fixtureRevision.id,
          skinKey: "default",
          skinName: "Mặc định",
          artAssetId: null,
        },
      ]) as T
    if (path === `/admin/heroes/${fixtureRevision.heroId}/revisions/${fixtureRevision.id}`)
      return { revision: fixtureRevision, content: fixtureContent } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await withUi(request, async ({ document, render, waitFor, click, button, intersect }) => {
    const { BadgesPage } = await import("../src/features/media/badges-page")
    await render(<BadgesPage request={request} />)
    await waitFor(() => !!document.querySelector('[aria-label="Mở nhóm A"]'))
    const scroller = document.querySelector<HTMLElement>('[aria-label="Danh sách bậc trang phục"]')!
    assert.ok(scroller.contains(document.querySelector('[aria-label="Đang tải thêm nhóm nhãn…"]')))
    assert.equal(calls.filter((path) => path.startsWith("/admin/skin-badges?")).length, 0)
    await click(document.querySelector('[aria-label="Mở nhóm A"]'))
    await waitFor(() => !!document.querySelector(`[aria-label="Xem trang phục dùng nhãn ${badge.code}"]`))
    assert.equal(button("Tải thêm nhãn"), undefined)
    assert.equal(calls.filter((path) => path.includes("groupId=rank-a") && path.includes("page=1")).length, 0)
    await intersect("Đang tải thêm nhãn nhóm A…")
    await waitFor(() => !!document.querySelector('[aria-label="Xem trang phục dùng nhãn a-2"]'))
    const unnamedRow = document.querySelector('[aria-label="Xem trang phục dùng nhãn a-2"]')!.closest("tr")!
    assert.equal(unnamedRow.querySelectorAll("code").length, 0)
    assert.match(unnamedRow.textContent!, /Chưa đặt tên/)
    assert.equal(unnamedRow.querySelector("button button"), null)
    assert.equal(unnamedRow.querySelector('[aria-label="Sao chép mã nhãn a-2"]'), null)
    assert.equal(
      unnamedRow.querySelector('[aria-label="Xem trang phục dùng nhãn a-2"]')?.getAttribute("aria-expanded"),
      "false",
    )
    const count = calls.filter((path) => path.startsWith("/admin/skin-badges?")).length
    const groupHeader = document.querySelector('[aria-label="Thu gọn nhóm A"]')!.parentElement!
    const originalBounds = groupHeader.getBoundingClientRect
    groupHeader.getBoundingClientRect = () =>
      ({
        top: groupHeader.querySelector('[aria-expanded="true"]') ? 100 : 100 + 80 - scroller.scrollTop,
      }) as DOMRect
    scroller.scrollTop = 420
    await click(document.querySelector('[aria-label="Thu gọn nhóm A"]'))
    assert.equal(scroller.scrollTop, 80, "Collapsing a pinned badge group must retain its on-screen header position")
    assert.equal(groupHeader.getBoundingClientRect().top, 100)
    groupHeader.getBoundingClientRect = originalBounds
    await click(document.querySelector('[aria-label="Mở nhóm A"]'))
    assert.ok(document.querySelector('[aria-label="Xem trang phục dùng nhãn a-2"]'))
    assert.equal(calls.filter((path) => path.startsWith("/admin/skin-badges?")).length, count)
    await click(document.querySelector(`[aria-label="Xem trang phục dùng nhãn ${badge.code}"]`))
    await waitFor(() => !!document.querySelector('button[aria-label="Xem trang phục Mặc định"]'))
    assert.equal(document.querySelector('a[href^="/publishing/"]'), null)
    const location = document.querySelector("[data-location]")?.textContent
    await click(document.querySelector('button[aria-label="Xem trang phục Mặc định"]'))
    await waitFor(() => !!document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelector("[data-location]")?.textContent, location)
    await waitFor(
      () =>
        !!document.querySelector(
          `a[href="/publishing/${fixtureRevision.heroId}?revision=${fixtureRevision.id}&tab=skins"]`,
        ),
    )
    await render(<BadgesPage request={request} />, "/hero/media?tab=badges&q=AIC")
    await waitFor(() => !!document.querySelector('[aria-label="Xem trang phục dùng nhãn aic"]'))
    const childCall = calls.findLast(
      (path) =>
        path.startsWith("/admin/skin-badges?") &&
        new URL(path, "http://fixture").searchParams.get("groupId") === theme.id,
    )!
    assert.equal(
      new URL(childCall, "http://fixture").searchParams.get("q"),
      "",
      "A matching group name must reveal all of its children",
    )
    await render(<BadgesPage request={request} />)
    await waitFor(() => !!document.querySelector('[aria-label="Đang tải thêm nhóm nhãn…"]'))
    assert.equal(button("Tải thêm nhóm"), undefined)
    await intersect("Đang tải thêm nhóm nhãn…")
    await waitFor(() => !!document.querySelector('[aria-label="Thu gọn nhóm Chưa phân nhóm"]'))
  })
})

test("theme editor preserves translations, creation chooses a group and moving uses its separate optimistic command", async () => {
  const writes: { path: string; body: Record<string, unknown> }[] = []
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (init?.method === "PUT" || init?.method === "POST") {
      writes.push({ path, body: JSON.parse(String(init.body)) })
      return { ...badge, version: 8 } as T
    }
    if (path.startsWith("/admin/skin-badge-groups?")) return page([rank, theme, ungrouped]) as T
    if (path === "/regions") return [{ id: "vn", code: "VN", displayName: "Việt Nam", available: true }] as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await withUi(request, async ({ client, render, waitFor, click, button, input, select, document }) => {
    const { SkinBadgeGroupEditor, SkinBadgeGroupAssignment } =
      await import("../src/features/media/skin-badge-group-editor")
    const { SkinBadgeEditor } = await import("../src/features/media/skin-badge-editor")
    let closed = 0
    await render(
      <SkinBadgeGroupEditor
        key="edit"
        group={theme}
        locale="vi-VN"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await input("Tên nhóm", "Sự kiện AIC")
    await click(button("Lưu nhóm nhãn"))
    await waitFor(() => closed === 1)
    assert.equal(writes[0].path, "/admin/skin-badge-groups/theme-aic")
    assert.deepEqual(writes[0].body, {
      expectedVersion: 5,
      kind: "THEME",
      translations: [{ locale: "vi-VN", displayName: "Sự kiện AIC" }, theme.translations[1]],
    })
    await render(
      <SkinBadgeGroupEditor
        key="create"
        group={null}
        locale="vi-VN"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await input("Mã nhóm", "hoc-vien")
    await input("Tên nhóm", "Học viện")
    await click(button("Lưu nhóm nhãn"))
    await waitFor(() => closed === 2)
    assert.deepEqual(writes[1].body, {
      code: "hoc-vien",
      kind: "THEME",
      translations: [{ locale: "vi-VN", displayName: "Học viện" }],
    })
    const listKey = badgeGroupKeys.list("vi-VN", "")
    client.setQueryData(listKey, { pages: [page([rank, theme, ungrouped])], pageParams: [0] })
    await render(
      <SkinBadgeGroupAssignment
        badge={badge}
        locale="vi-VN"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await waitFor(() => !!document.querySelector(`option[value="${theme.id}"]`))
    await select("Nhóm nhãn", theme.id!)
    await click(button("Lưu nhóm của nhãn"))
    await waitFor(() => closed === 3)
    assert.deepEqual(writes[2], {
      path: "/admin/skin-badges/badge-a/group",
      body: { expectedVersion: 7, groupId: theme.id },
    })
    await render(
      <SkinBadgeEditor
        badge={null}
        locale="vi-VN"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await waitFor(() => !!document.querySelector(`option[value="${theme.id}"]`))
    assert.equal(document.querySelector('input[aria-label="Mã nhãn"]'), null)
    await input("Tên hiển thị", "AIC 2026")
    await select("Nhóm nhãn", theme.id!)
    await click(button("Lưu nhãn trang phục"))
    await waitFor(() => closed === 4)
    assert.equal(writes[3].body.groupId, theme.id)
    assert.equal(writes[3].body.regionCode, "vn")
    assert.equal("code" in writes[3].body, false)
    assert.deepEqual(writes[3].body.translations, [{ locale: "vi-VN", displayName: "AIC 2026", iconAssetId: null }])
  })
})

test("grouped picker keeps selected-code cache and chooses a badge from an expanded theme", async () => {
  const calls: string[] = []
  const request: Request = async <T,>(path: string) => {
    calls.push(path)
    if (path.startsWith("/admin/skin-badge-groups?")) return page([theme]) as T
    if (path.startsWith("/admin/skin-badges?")) return page([{ ...badge, code: "aic", groupId: theme.id }]) as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await withUi(request, async ({ client, document, render, waitFor, click }) => {
    const { SkinBadgePicker } = await import("../src/features/media/skin-badge-picker")
    let chosen: string | null = null
    await render(
      <SkinBadgePicker
        value="aic"
        onChange={(value) => {
          chosen = value
        }}
        locale="vi-VN"
        request={request}
      />,
    )
    await waitFor(() => !!client.getQueryData(["skin-badges", "selected", "vi-VN", "aic"]))
    await click(document.querySelector('[aria-label="Chọn bậc trang phục"]'))
    await waitFor(() => !!document.querySelector('[aria-label="Mở nhóm nhãn Giải đấu AIC"]'))
    const count = calls.length
    await click(document.querySelector('[aria-label="Mở nhóm nhãn Giải đấu AIC"]'))
    await waitFor(() => calls.length > count && !!document.querySelector('button[class*="hover:bg-muted"]'))
    const option = Array.from(document.querySelectorAll("button")).find(
      (item) => item.textContent?.includes("A Hữu hạn") && item.className.includes("hover:bg-muted"),
    )
    await click(option)
    assert.equal(chosen, "aic")
    assert.ok(calls.some((path) => new URL(path, "http://fixture").searchParams.get("groupId") === theme.id))
  })
})

test("badge labels distinguish pending metadata from an unnamed source label", async () => {
  let finish: (() => void) | undefined
  const request: Request = async <T,>() => {
    await new Promise<void>((resolve) => (finish = resolve))
    return page([{ ...badge, code: "pending", displayName: "Bậc S" }]) as T
  }
  await withUi(request, async ({ document, render, waitFor }) => {
    const { SkinBadgeLabel } = await import("../src/features/media/skin-badge-label")
    try {
      await render(<SkinBadgeLabel code="pending" locale="vi-VN" request={request} />)
      await waitFor(() => !!finish)
      assert.ok(document.querySelector('[role="status"][aria-label="Đang tải nhãn trang phục"]'))
      assert.doesNotMatch(document.body.textContent!, /Chưa đặt tên/)
      await act(async () => finish!())
      await waitFor(() => document.body.textContent?.includes("Bậc S") ?? false)
      assert.equal(document.querySelector('[aria-label="Đang tải nhãn trang phục"]'), null)
    } finally {
      await act(async () => finish?.())
    }
  })
})

test("badge artwork previews the exact locale image in place, closes with Escape and keeps missing translations empty", async () => {
  const calls: string[] = []
  const translations = [
    { locale: "vi-VN", displayName: "Hữu hạn", iconAssetId: "vn-icon" },
    { locale: "en-US", displayName: "Limited", iconAssetId: "en-icon" },
  ]
  const localized = {
    ...badge,
    id: "localized",
    code: "limited",
    groupId: null,
    displayName: "Limited",
    actualLocale: "en-US",
    iconAssetId: "en-icon",
    translations,
  }
  const missing = {
    ...localized,
    id: "missing",
    code: "missing-icon",
    displayName: "No icon",
    iconAssetId: null,
    translations: [translations[0], { locale: "en-US", displayName: "No icon", iconAssetId: null }],
  }
  const request: Request = async <T,>(path: string) => {
    calls.push(path)
    if (path === "/admin/rulesets") return [{ id: "rule", code: "aov-standard" }] as T
    if (path.startsWith("/admin/skin-badge-groups?")) return page([{ ...ungrouped, badgeCount: 2 }]) as T
    if (path.startsWith("/admin/skin-badges?")) {
      assert.equal(new URL(path, "http://fixture").searchParams.get("locale"), "en-US")
      return page([localized, missing]) as T
    }
    if (path === "/admin/media/assets/en-icon")
      return {
        id: "en-icon",
        currentVersionId: "en-version",
        versions: [{ id: "en-version", url: "/icons/en-limited.webp" }],
        provenance: [],
      } as T
    throw new Error(`Unexpected artwork request: ${path}`)
  }
  await withUi(request, async ({ client, document, render, waitFor, click }) => {
    client.setQueryDefaults(["user-profile", "me"], { staleTime: Infinity })
    client.setQueryData(["user-profile", "me", "fixture", "editor"], { locale: "en-US" })
    const { BadgesPage } = await import("../src/features/media/badges-page")
    await render(<BadgesPage request={request} />)
    await waitFor(() => !!document.querySelector('button[aria-label="Xem lớn Biểu tượng nhãn Limited · en-US"]'))
    assert.ok(document.querySelector('[role="img"][aria-label="Chưa có ảnh cho nhãn No icon · en-US"]'))
    assert.equal(document.querySelector('button[aria-label="Xem lớn Biểu tượng nhãn No icon · en-US"]'), null)
    assert.equal(
      calls.some((path) => path.includes("vn-icon")),
      false,
    )
    const trigger = document.querySelector('button[aria-label="Xem lớn Biểu tượng nhãn Limited · en-US"]')!
    const location = document.querySelector("[data-location]")?.textContent
    await click(trigger)
    await waitFor(() => !!document.querySelector('[role="dialog"] img[src="/icons/en-limited.webp"]'))
    assert.equal(document.querySelector("[data-location]")?.textContent, location)
    assert.equal(
      document.querySelector('[aria-label="Xem trang phục dùng nhãn limited"]')?.getAttribute("aria-expanded"),
      "false",
    )
    assert.equal(
      calls.some((path) => path.includes("/skins?")),
      false,
    )
    assert.equal(document.querySelector('[data-slot="sheet-title"]'), null)
    assert.equal(document.querySelector('[role="dialog"] img')?.className.includes("object-contain"), true)
    await act(async () =>
      document.dispatchEvent(
        new document.defaultView!.KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    assert.equal(document.activeElement, trigger)
    await click(trigger)
    await waitFor(() => !!document.querySelector('[role="dialog"]'))
    await click(document.querySelector('[role="dialog"] [data-slot="dialog-close"]'))
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    const { SkinBadgeLabel } = await import("../src/features/media/skin-badge-label")
    await render(<SkinBadgeLabel code="limited" locale="en-US" request={request} />)
    await waitFor(() => !!document.querySelector('button[aria-label="Xem lớn Biểu tượng nhãn Limited · en-US"]'))
    const compactTrigger = document.querySelector('button[aria-label="Xem lớn Biểu tượng nhãn Limited · en-US"]')!
    assert.equal(compactTrigger.parentElement?.classList.contains("h-7"), true)
    assert.equal(compactTrigger.querySelector("svg"), null, "Compact artwork must keep its preview hint unobtrusive")
    await click(compactTrigger)
    await waitFor(() => !!document.querySelector('[role="dialog"] img[src="/icons/en-limited.webp"]'))
    await click(document.querySelector('[role="dialog"] [data-slot="dialog-close"]'))
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    await render(<SkinBadgeLabel code="missing-icon" locale="en-US" request={request} />)
    await waitFor(() => !!document.querySelector('[role="img"][aria-label="Chưa có ảnh cho nhãn No icon · en-US"]'))
    assert.equal(document.querySelector('button[aria-haspopup="dialog"]'), null)
    assert.equal(
      calls.some((path) => path.includes("vn-icon")),
      false,
    )
  })
})
