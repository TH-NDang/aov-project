import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixturePreviousRevision } from "./fixtures/hero-workspace-data"
import { draftRepository } from "../src/app/drafts/draft-store"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("hero links restore a side panel beyond loaded rows, survive reload, and preserve state in full view and browser history", async () => {
  const dom = createWindow("http://localhost/publishing")
  const fixture = createHeroFixture(false, true)
  const heroFlag = { field: "heroLevel", note: "Cần xác nhận cấp tướng." }
  const skillFlag = { field: "hero.skills[1].description", note: "Ảnh thiếu phần cuối mô tả." }
  const passive = fixture.content.SKILLS!.skills[0]
  const heroReviewFlags = [heroFlag, skillFlag]
  passive.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { heroReviewFlags } }]
  fixture.content.SKILLS!.skills.push({
    ...passive,
    skillKey: "skill-1-1",
    displayOrder: 1,
    kind: "ACTIVE",
    translations: [{ locale: "vi-VN", name: "Kiếm khí", description: "Mô tả cần kiểm tra." }],
    effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { heroReviewFlags, reviewFlags: [skillFlag] } }],
  })
  const catalogItems = Array.from({ length: 129 }, (_, index) => ({
    id: `catalog-hero-${index}`,
    code: `catalog-hero-${index}`,
    revisions: [],
    lastEditedAt: "2026-10-15T01:02:03Z",
  }))
  const fetcher: typeof fetch = (input, init) => {
    if (String(input).split("?")[0].endsWith("/admin/heroes")) {
      return Promise.resolve(
        Response.json({ items: catalogItems, page: 0, size: catalogItems.length, totalElements: catalogItems.length }),
      )
    }
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
  const { PublishingPage } = await import("../src/features/publishing/pages/publishing-page")
  const { createRoot } = await import("react-dom/client")
  let root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const routes = [
    { path: "/hero", element: <PublishingPage /> },
    { path: "/hero/:heroId", element: <PublishingPage /> },
  ]
  let router = createMemoryRouter(routes, {
    initialEntries: [
      "/hero?search=all&ruleset=fixture-rules",
      "/hero?search=all&ruleset=fixture-rules&hero=fixture-hero&revision=fixture-draft&tab=media",
    ],
  })
  const document = dom.window.document
  const mount = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
          <ConfirmDialogHost />
        </QueryClientProvider>,
      ),
    )

  const click = (selector: string) => act(async () => document.querySelector<HTMLElement>(selector)!.click())
  try {
    await verifySession()
    await mount()
    await waitFor(() => !!document.querySelector("#hero-content-media"))
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelectorAll("tbody tr").length, catalogItems.length)
    const catalogButton = document.querySelector('[aria-label="Xem tướng catalog-hero-0"]')
    assert.ok(catalogButton)
    const warnings = '[aria-label="Xem 2 cảnh báo cần đối chiếu từ nguồn"]'
    const goToWarning = async (label: string) => {
      await click(warnings)
      const link = [...document.querySelectorAll<HTMLButtonElement>('[data-slot="popover-content"] button')].find(
        (button) => button.textContent?.includes(label),
      )
      assert.ok(link)
      await act(async () => link.click())
    }
    await goToWarning("Đến Chiêu 1 · Kiếm khí")
    await waitFor(() => !!document.querySelector('[data-review-skill="skill-1-1"] details[open]'))
    assert.equal(new URLSearchParams(router.state.location.search).get("skill"), "skill-1-1")
    await waitFor(() => !!document.activeElement?.closest("details")?.textContent?.includes(skillFlag.note))
    await click('[aria-label="Chọn kỹ năng"] button')
    await goToWarning("Đến Chiêu 1 · Kiếm khí")
    await waitFor(
      () => document.activeElement?.closest("[data-review-skill]")?.getAttribute("data-review-skill") === "skill-1-1",
    )
    await click('[aria-controls="workspace-history"]')
    await goToWarning("Đến Chiêu 1 · Kiếm khí")
    await waitFor(
      () => document.activeElement?.closest("[data-review-skill]")?.getAttribute("data-review-skill") === "skill-1-1",
    )
    await goToWarning("Đến Thuộc tính chiến đấu")
    // An attribute warning opens the window with every attribute; closing it returns to the page.
    const attributesWindow = () => document.querySelector("[data-attributes-window]")
    await waitFor(() => !!attributesWindow()?.textContent?.includes("Giáp"))
    await click("[data-attributes-window] [data-slot='dialog-close']")
    await waitFor(() => !attributesWindow())
    assert.equal(new URLSearchParams(router.state.location.search).get("revision"), "fixture-draft")
    await click(warnings)
    const reviewButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Xử lý cảnh báo",
      )!
    await act(async () => reviewButton().click())
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu cảnh báo nguồn"]'))
    assert.ok(
      document.querySelector('[aria-label="Đối chiếu cảnh báo nguồn"]')?.closest('[role="dialog"]'),
      "Review controls open in a drawer",
    )
    const warningRow = () =>
      [...document.querySelectorAll('[aria-label="Đối chiếu cảnh báo nguồn"] li')].find((row) =>
        row.textContent?.includes(skillFlag.note),
      )!
    await act(async () => warningRow().querySelector<HTMLButtonElement>("button")!.click())
    assert.equal(fixture.writes.length, 0, "Review changes stay in the working copy until saved")
    assert.ok(document.querySelector('[aria-label="Xem 1 cảnh báo cần đối chiếu từ nguồn"]'))
    await click('[aria-label="Đóng đối chiếu cảnh báo"]')
    const saveButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Lưu phần này",
      )!
    await act(async () => saveButton().click())
    await waitFor(() => !document.querySelector('[aria-label="Chỉnh sửa nội dung"]'))
    assert.equal(fixture.writes.at(-1)?.section, "SKILLS")
    for (const skill of fixture.content.SKILLS!.skills) {
      const flags = skill.effects[0].metadata.heroReviewFlags as Record<string, unknown>[]
      assert.equal(flags.find((flag) => flag.note === skillFlag.note)?.reviewResolution, "RESOLVED")
    }
    await click('[aria-label="Xem 1 cảnh báo cần đối chiếu từ nguồn"]')
    await act(async () => reviewButton().click())
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu cảnh báo nguồn"]'))
    assert.match(warningRow().textContent!, /Đã đối chiếu/)
    await act(async () => warningRow().querySelector<HTMLButtonElement>("button")!.click())
    await click('[aria-label="Đóng đối chiếu cảnh báo"]')
    await act(async () => saveButton().click())
    await waitFor(() => !document.querySelector('[aria-label="Chỉnh sửa nội dung"]'))
    assert.ok(document.querySelector(warnings))
    assert.equal(
      document.querySelector('[aria-label="Xem tướng catalog-hero-0"]'),
      catalogButton,
      "Workspace navigation must preserve mounted catalog cells instead of rebuilding the loaded list",
    )
    await click('[aria-label="Chọn kỹ năng"] button')
    assert.equal(new URLSearchParams(router.state.location.search).get("skill"), "passive")
    await click('[aria-label="Cách hiển thị kỹ năng"] button:nth-child(2)')
    assert.equal(new URLSearchParams(router.state.location.search).get("skillLayout"), "flat")
    // Translating opens from a language's own pencil in the language menu at the top.
    await act(async () => {
      document
        .querySelector('[aria-label="Ngôn ngữ hiển thị nội dung"]')!
        .dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    await act(async () =>
      document.querySelector<HTMLElement>('[role="menuitem"][aria-label="Dịch sang Tiếng Anh (Mỹ)"]')!.click(),
    )
    const target = document.querySelector<HTMLButtonElement>('[aria-label="Ngôn ngữ đích"]')!
    await act(async () => {
      target.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    await click('[role="menuitemradio"][data-locale="th-TH"]')
    await click('[aria-label="Các phần nội dung"] button:nth-child(2)')
    const restoredUrl = router.state.location.pathname + router.state.location.search
    assert.equal(new URLSearchParams(router.state.location.search).get("target"), "th-TH")
    assert.equal(new URLSearchParams(router.state.location.search).get("section"), "SKILLS")
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    assert.equal(
      document.querySelector('[aria-label="Xem tướng catalog-hero-0"]'),
      catalogButton,
      "Closing a hero preserves the existing catalog controls",
    )
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    assert.equal(router.state.location.pathname + router.state.location.search, restoredUrl)
    await act(async () => root.unmount())
    router.dispose()
    root = createRoot(document.getElementById("root")!)
    router = createMemoryRouter(routes, { initialEntries: [restoredUrl] })
    await mount()
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    assert.ok(document.querySelector('[aria-controls="workspace-overview"][aria-selected="true"]'))
    // The drawer has no full-page link any more; the same address opens the full page directly.
    const { heroPageLocation } = await import("../src/features/publishing/model/hero-location")
    await act(async () => {
      await router.navigate(heroPageLocation("fixture-hero", new URLSearchParams(router.state.location.search)))
    })
    await waitFor(() => router.state.location.pathname === "/hero/fixture-hero")
    const params = new URLSearchParams(router.state.location.search)
    assert.equal(params.get("hero"), null)
    assert.equal(params.get("view"), "translations")
    assert.equal(params.get("tab"), "skills")
    assert.equal(params.get("target"), "th-TH")
    assert.equal(params.get("section"), "SKILLS")
    assert.equal(params.get("ruleset"), "fixture-rules")
    assert.equal(params.get("skill"), "passive")
    assert.equal(params.get("skillLayout"), "flat")
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    const nameInput = [...document.querySelectorAll("label")]
      .find((label) => label.textContent === "Tên · Tiếng Thái (Thái Lan)")!
      .querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        nameInput,
        "Unsaved translation",
      )
      nameInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    const beforeBack = router.state.location.pathname + router.state.location.search
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => router.state.location.pathname === "/hero")
    assert.equal(
      document.querySelector('[role="alertdialog"]'),
      null,
      "A recoverable draft should not block internal navigation",
    )
    await waitFor(() => [...document.querySelectorAll("input")].some((input) => input.value === "Unsaved translation"))
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => router.state.location.pathname + router.state.location.search === beforeBack)
    await waitFor(() => [...document.querySelectorAll("input")].some((input) => input.value === "Unsaved translation"))
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => router.state.location.pathname === "/hero")
    assert.equal(new URLSearchParams(router.state.location.search).get("hero"), "fixture-hero")
    await act(async () => root.unmount())
    router.dispose()
    client.setQueryData(["publishing-preview", "fixture-hero", "fixture-previous"], {
      revision: fixturePreviousRevision,
      content: fixture.content,
    })
    root = createRoot(document.getElementById("root")!)
    router = createMemoryRouter(routes, {
      initialEntries: ["/hero/fixture-hero?revision=fixture-previous&tab=media"],
    })
    await mount()
    await waitFor(() => !!document.querySelector("#hero-content-media"))
    assert.equal(new URLSearchParams(router.state.location.search).get("revision"), "fixture-previous")
    assert.equal(
      document.querySelector<HTMLElement>('[aria-label="Phiên bản dữ liệu"]')!.dataset.revision,
      "fixture-previous",
    )
    assert.equal(
      fixture.writes.length,
      2,
      "Navigation and read-only revisions do not write beyond the two review saves",
    )
  } finally {
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    router.dispose()
    await logout()
    client.clear()
    dom.window.close()
    restoreGlobals()
  }
})
