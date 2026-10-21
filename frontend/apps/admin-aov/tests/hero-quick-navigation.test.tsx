import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"

test("quick hero navigation keeps drawer/full-page context and cached drafts while rejecting switches during upload", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero", pretendToBeVisual: true })
  const fixture = createHeroFixture()
  const secondRevision = { ...fixtureRevision, id: "second-draft", heroId: "second-hero" }
  const secondContent = structuredClone(fixtureContent)
  secondContent.PROFILE!.translations[0].name = "Tulen"
  secondContent.SKILLS!.skills[0].translations[0].name = "Lôi điện"
  secondContent.SKILLS!.skills[0].translations[0].description = "Nội dung riêng của Tulen"
  let finishUpload: ((response: Response) => void) | undefined
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    const path = url.replace("/api/wiki/v1", "")
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["catalog:read", "hero:write", "media:write"],
      })
    if (path.startsWith("/admin/heroes?"))
      return Response.json({
        items: [
          { id: fixtureRevision.heroId, code: "airi", revisions: [fixtureRevision] },
          { id: secondRevision.heroId, code: "tulen", revisions: [secondRevision] },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
      })
    if (path.startsWith("/admin/reference-catalog"))
      return Response.json({
        rulesetId: fixtureRevision.rulesetId,
        items: [
          {
            id: fixtureRevision.heroId,
            kind: "hero",
            translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
            destinations: { admin: "/hero/fixture-hero?revision=fixture-draft" },
          },
          {
            id: secondRevision.heroId,
            kind: "hero",
            translations: [{ locale: "vi-VN", name: "Tulen", aliases: [], description: "" }],
            destinations: { admin: "/hero/second-hero?revision=second-draft" },
          },
        ],
      })
    if (path === "/admin/heroes/second-hero/revisions") return Response.json([secondRevision])
    if (path === "/admin/heroes/second-hero/revisions/second-draft")
      return Response.json({ revision: secondRevision, content: secondContent })
    if (path === "/admin/heroes/second-hero/skill-images") return Response.json({ items: [] })
    if (path === "/admin/media/assets" && init?.method === "POST") return Response.json({ id: "upload-icon" })
    if (path === "/admin/media/assets/upload-icon/version-uploads")
      return Response.json({
        uploadId: "quick-upload",
        method: "PUT",
        headers: {},
        uploadUrl: "https://storage.test/quick-held-upload",
      })
    if (url === "https://storage.test/quick-held-upload")
      return new Promise<Response>((resolve) => {
        finishUpload = resolve
      })
    if (path === "/admin/media/uploads/quick-upload/complete")
      return Response.json({ assetId: "upload-icon", current: true })
    if (path === "/admin/media/assets/upload-icon")
      return Response.json({
        id: "upload-icon",
        currentVersionId: "upload-version",
        versions: [{ id: "upload-version", url: "/media/upload.webp" }],
        provenance: [],
      })
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { draftRepository } = await import("../src/app/drafts/draft-store")
  const { PublishingPage } = await import("../src/features/publishing/publishing-page")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const router = createMemoryRouter(
    [
      { path: "/hero", element: <PublishingPage /> },
      { path: "/hero/:heroId", element: <PublishingPage /> },
    ],
    {
      initialEntries: [
        "/hero?hero=fixture-hero&revision=fixture-draft&ruleset=fixture-rules&tab=skills&skill=passive&skillLayout=flat&readLocale=vi-VN&compare=old-comparison&diff=split&changes=skills",
      ],
    },
  )
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 250 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(
      condition(),
      `Expected quick navigation state was not reached: ${document.body.textContent?.slice(-1200)}`,
    )
  }
  const visibleButton = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.getAttribute("aria-label") === label && !button.closest('[aria-hidden="true"]'),
    )!
  const click = (node: HTMLElement) => act(async () => node.click())
  const switchTo = async (name: string) => {
    await click(visibleButton("Chuyển tướng nhanh"))
    await waitFor(() => !!visibleButton(`Chuyển sang ${name}`))
    await click(visibleButton(`Chuyển sang ${name}`))
  }
  const selectedHero = () =>
    router.state.location.pathname === "/hero"
      ? new URLSearchParams(router.state.location.search).get("hero")
      : router.state.location.pathname.split("/").at(-1)
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      ),
    )
    await waitFor(
      () => !!visibleButton("Chuyển tướng nhanh") && !!document.querySelector('[aria-label="Tất cả kỹ năng"]'),
    )
    assert.ok(document.querySelector('[role="dialog"]'), "The first hero must remain in the drawer")
    await click(visibleButton("Chỉnh sửa Kỹ năng"))
    const draftName = () =>
      [...document.querySelectorAll("label")]
        .find((label) => label.textContent === "Tên chiêu")!
        .querySelector<HTMLInputElement>("input")!
    await waitFor(() => !draftName().closest("fieldset")?.disabled)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        draftName(),
        "Airi chưa lưu",
      )
      draftName().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await waitFor(() =>
      Object.values(draftRepository.store.getState().slots).some((slot) =>
        JSON.stringify(slot.record?.value ?? null).includes("Airi chưa lưu"),
      ),
    )
    const leaveEditor = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Xem hồ sơ",
    )!
    await click(leaveEditor)
    await waitFor(() => document.body.textContent?.includes("Airi chưa lưu") === true)
    const firstUrl = router.state.location.pathname + router.state.location.search
    await switchTo("Tulen")
    await waitFor(
      () =>
        selectedHero() === "second-hero" && document.body.textContent?.includes("Nội dung riêng của Tulen") === true,
    )
    assert.equal(router.state.location.pathname, "/hero")
    const drawer = new URLSearchParams(router.state.location.search)
    assert.equal(drawer.get("revision"), "second-draft")
    assert.equal(drawer.get("tab"), "skills")
    assert.equal(drawer.get("skillLayout"), "flat")
    assert.equal(drawer.get("readLocale"), "vi-VN")
    assert.equal(drawer.get("ruleset"), "fixture-rules")
    for (const key of ["skill", "compare", "diff", "changes"]) assert.equal(drawer.get(key), null)
    assert.ok(document.querySelector('[role="dialog"]'))
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(
      () => selectedHero() === "fixture-hero" && document.body.textContent?.includes("Airi chưa lưu") === true,
    )
    assert.equal(router.state.location.pathname + router.state.location.search, firstUrl)
    assert.equal(new URLSearchParams(router.state.location.search).get("skill"), "passive")
    const fullPage = document.querySelector<HTMLElement>('[aria-label="Mở trang tướng đầy đủ"]')!
    await click(fullPage)
    await waitFor(() => router.state.location.pathname === "/hero/fixture-hero")
    await switchTo("Tulen")
    await waitFor(
      () =>
        router.state.location.pathname === "/hero/second-hero" &&
        document.body.textContent?.includes("Nội dung riêng của Tulen") === true,
    )
    assert.equal(new URLSearchParams(router.state.location.search).get("revision"), "second-draft")
    assert.equal(new URLSearchParams(router.state.location.search).get("tab"), "skills")
    assert.equal(new URLSearchParams(router.state.location.search).get("skillLayout"), "flat")
    assert.equal(new URLSearchParams(router.state.location.search).get("hero"), null)
    await click(visibleButton("Chỉnh sửa Kỹ năng"))
    const upload = document.querySelector<HTMLInputElement>('input[type="file"][aria-label="Tải ảnh mới"]')!
    await act(async () => {
      Object.defineProperty(upload, "files", {
        configurable: true,
        value: [new dom.window.File(["test-image"], "skill.png", { type: "image/png" })],
      })
      upload.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(() => !!finishUpload && visibleButton("Chuyển tướng nhanh")?.disabled === true)
    const uploadUrl = router.state.location.pathname + router.state.location.search
    await click(visibleButton("Chuyển tướng nhanh"))
    assert.equal(router.state.location.pathname + router.state.location.search, uploadUrl)
    assert.equal(visibleButton("Chuyển sang Airi"), undefined)
    await act(async () => {
      finishUpload!(new Response(null, { status: 200 }))
    })
    await waitFor(() => visibleButton("Chuyển tướng nhanh")?.disabled === false)
    assert.equal(fixture.writes.length, 0, "Switching heroes must not publish or save unfinished content")
  } finally {
    finishUpload?.(new Response(null, { status: 200 }))
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    client.clear()
    router.dispose()
    await logout()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
