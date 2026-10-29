import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"

test("admin authors natural skill mentions and restores saved references with their hero and exact skill route", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/terminology?ruleset=fixture-rules",
    pretendToBeVisual: true,
  })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const heroId = "00000000-0000-4000-8000-000000000001"
  const revisionId = "00000000-0000-4000-8000-000000000002"
  const selectedRulesetId = "selected-revision-rules"
  const hero: EntityReference = {
    id: heroId,
    kind: "hero",
    iconAssetId: "fixture-head",
    translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "Ninja rồng" }],
  }
  const skill: EntityReference = {
    id: `${heroId}.skill-1-1`,
    kind: "skill",
    heroId,
    skillKey: "skill-1-1",
    revisionId,
    sourceSlot: 1,
    variantNo: 1,
    iconAssetId: "fixture-skill-1",
    iconSource: "REVISION",
    autoMatch: false,
    translations: [
      { locale: "vi-VN", name: "Phi tiêu", aliases: [], description: "Phóng phi tiêu gây sát thương vật lý." },
    ],
    owner: { ...hero, kind: "hero" },
    destinations: {
      admin: `/hero/${heroId}?revision=${revisionId}&tab=skills&skill=skill-1-1&ruleset=${selectedRulesetId}`,
    },
  }
  const otherSkill: EntityReference = {
    ...skill,
    id: `${heroId}.skill-2-1`,
    skillKey: "skill-2-1",
    sourceSlot: 2,
    iconAssetId: "fixture-skill-2",
    translations: [{ locale: "vi-VN", name: "Kiếm vũ", aliases: [], description: "Lướt theo hướng chỉ định." }],
    destinations: {
      admin: `/hero/${heroId}?revision=${revisionId}&tab=skills&skill=skill-2-1&ruleset=${selectedRulesetId}`,
    },
  }
  const fixture = createHeroFixture(true)
  const requests: URL[] = []
  const lookupBatches: string[][] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    requests.push(url)
    if (url.pathname.startsWith("/api/community/") && url.pathname.endsWith("/admin/reference-catalog"))
      return Response.json({
        items: [],
        page: Number(url.searchParams.get("page") ?? 0),
        size: Number(url.searchParams.get("size") ?? 20),
        totalElements: 0,
      })
    if (url.pathname.endsWith("/admin/reference-skills")) {
      assert.equal(url.searchParams.get("locale"), "vi-VN")
      assert.equal(url.searchParams.get("rulesetId"), selectedRulesetId)
      const ids = url.searchParams.get("ids")?.split(",")
      if (ids) {
        lookupBatches.push(ids)
        assert.equal(url.searchParams.has("q"), false)
        return Response.json({
          items: [skill, otherSkill].filter((entry) => ids.includes(entry.id)),
          page: 0,
          size: 50,
          totalElements: ids.length,
        })
      }
      assert.equal(url.searchParams.get("q"), "airi chiêu 1")
      assert.equal(url.searchParams.get("page"), "0")
      assert.equal(url.searchParams.get("size"), "20")
      return Response.json({ items: [skill], page: 0, size: 20, totalElements: 1 })
    }
    if (url.pathname.endsWith("/admin/reference-catalog")) {
      assert.equal(url.searchParams.get("rulesetId"), selectedRulesetId)
      return Response.json({ rulesetId: selectedRulesetId, items: [hero] })
    }
    const assetId = url.pathname.match(/\/admin\/media\/assets\/(fixture-(?:head|skill-[12]))$/)?.[1]
    if (assetId)
      return Response.json({
        id: assetId,
        currentVersionId: `${assetId}-v1`,
        versions: [{ id: `${assetId}-v1`, url: `http://localhost/media/${assetId}.webp` }],
        provenance: [],
      })
    return fixture.fetcher(input, init)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    MutationObserver: dom.window.MutationObserver,
    DocumentFragment: dom.window.DocumentFragment,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    fetch: fetcher,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { AdminRichTextField, AdminRichTextPreview } = await import("../src/features/terminology/rich-text-field")
  const { AdminEntityText, AdminReferenceProvider, ReferenceRulesetProvider } =
    await import("../src/features/terminology/catalog")
  const document = dom.window.document
  const container = document.getElementById("root")!
  let root = createRoot(container)
  let client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  let saved = ""
  function Authoring() {
    const [text, setText] = React.useState("")
    saved = text
    return (
      <>
        <AdminRichTextField
          label="Mô tả kỹ năng"
          value={text}
          onChange={setText}
          locale="vi-VN"
          renderPreview={false}
        />
        <div data-testid="live-preview">
          <AdminRichTextPreview text={text} locale="vi-VN" />
        </div>
      </>
    )
  }
  const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/terminology?ruleset=fixture-rules"]}>
        <ReferenceRulesetProvider rulesetId={selectedRulesetId}>{children}</ReferenceRulesetProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  const waitFor = async (condition: () => boolean, message: string) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    assert.ok(condition(), message)
  }
  const mentions = () => [
    ...(document.querySelector('[data-testid="live-preview"]') ?? container).querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Kỹ năng: Airi ·"]',
    ),
  ]
  const assertArtwork = (element: Element) => {
    assert.ok(
      element.querySelector('img[src="http://localhost/media/fixture-head.webp"]'),
      "Owner head accompanies skill",
    )
    assert.ok(
      element.querySelector('img[src="http://localhost/media/fixture-skill-1.webp"]'),
      "The referenced skill retains its own icon",
    )
  }
  try {
    await verifySession()
    await act(async () => root.render(wrap(<Authoring />)))
    await waitFor(
      () => requests.some((url) => url.pathname.endsWith("/admin/reference-catalog")),
      "Compact catalog loads independently of skill references",
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    assert.equal(requests.filter((url) => url.pathname.endsWith("/admin/reference-skills")).length, 0)
    const area = referenceInput(document)
    await act(async () => fillReferenceInput(area, "@airi chiêu 1"))
    await waitFor(
      () => !!document.querySelector('[role="option"][aria-label^="Airi · Phi tiêu · Chiêu 1"]'),
      "Natural hero and slot search offers a skill with its owner context",
    )
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[role="option"][aria-label^="Airi · Phi tiêu"]')!.click(),
    )
    const token = `<ref=skill:${skill.id}>Phi tiêu</ref>`
    assert.equal(referenceInputValue(area), token)
    assert.equal(saved, token, "The controlled field persists a stable composite identity, not a hero-only token")
    assert.ok(area.querySelector(`[data-reference-kind="skill"][data-reference-id="${skill.id}"]`))
    assert.ok(area.textContent?.includes("Phi tiêu"), "The input displays a readable skill label")
    assert.ok(area.textContent?.includes("Airi"), "The skill chip identifies its owning hero while editing")
    assert.equal(area.textContent?.includes("<ref="), false, "Raw reference syntax is hidden inside the editor")
    await waitFor(
      () =>
        !!area.querySelector('img[src="http://localhost/media/fixture-head.webp"]') &&
        !!area.querySelector('img[src="http://localhost/media/fixture-skill-1.webp"]'),
      "The editable skill chip shows the owner head and skill icon together",
    )
    assertArtwork(area)
    await waitFor(() => mentions().length === 1, "Live preview resolves the selected skill")
    await waitFor(
      () => !!mentions()[0]!.querySelector('img[src="http://localhost/media/fixture-skill-1.webp"]'),
      "Live preview loads skill artwork",
    )
    assertArtwork(mentions()[0]!)
    assert.equal(lookupBatches.length, 0, "Search results seed preview metadata without an immediate ID lookup")
    await act(async () => mentions()[0]!.click())
    await waitFor(
      () => !!document.querySelector(`a[href="${skill.destinations!.admin}"]`),
      "Skill popover exposes its route",
    )
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${skill.destinations!.admin}"]`)!
    const route = new URL(link.href)
    assert.equal(route.pathname, `/hero/${heroId}`)
    assert.equal(route.searchParams.get("revision"), revisionId)
    assert.equal(route.searchParams.get("tab"), "skills")
    assert.equal(route.searchParams.get("skill"), "skill-1-1")
    assert.equal(route.searchParams.get("ruleset"), selectedRulesetId)
    assert.ok(document.body.textContent?.includes("Phóng phi tiêu gây sát thương vật lý."))

    await act(async () => root.unmount())
    client.clear()
    root = createRoot(container)
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const otherSaved = `<ref=skill:${otherSkill.id}>Kiếm vũ</ref>`
    await act(async () =>
      root.render(
        wrap(
          <>
            <div data-testid="saved-preview">
              <AdminRichTextPreview text={saved} locale="vi-VN" />
            </div>
            <AdminRichTextPreview text={otherSaved} locale="vi-VN" />
            <AdminReferenceProvider locale="vi-VN">
              <AdminEntityText text={`${saved} rồi ${otherSaved}`} />
            </AdminReferenceProvider>
          </>,
        ),
      ),
    )
    await waitFor(() => mentions().length === 4, "Saved previews and provider-backed descriptions restore both skills")
    assert.equal(lookupBatches.length, 1, "Concurrent readers coalesce different skill IDs into one backend lookup")
    assert.deepEqual(new Set(lookupBatches[0]), new Set([skill.id, otherSkill.id]))
    assert.equal(
      requests.filter((url) => url.pathname.endsWith("/admin/reference-skills") && url.searchParams.has("q")).length,
      1,
      "Reloading saved references resolves identities without repeating a natural-language search",
    )
    const restored = document.querySelector<HTMLButtonElement>('[data-testid="saved-preview"] button')!
    await waitFor(
      () => restored.querySelectorAll("img").length === 2,
      "Restored reference loads the owner and skill artwork after a cold query cache",
    )
    assertArtwork(restored)
    assert.ok(
      requests
        .filter(
          (url) => url.pathname.startsWith("/api/wiki/") && /\/admin\/reference-(?:catalog|skills)$/.test(url.pathname),
        )
        .every((url) => url.searchParams.get("rulesetId") === selectedRulesetId),
      "The selected revision context overrides the URL ruleset for catalog, editor search and saved reference lookup",
    )
    assert.ok(
      requests
        .filter((url) => url.pathname.startsWith("/api/community/"))
        .every((url) => !url.searchParams.has("rulesetId")),
      "Community identities remain separate from Wiki ruleset scope",
    )
    assert.equal(
      requests.some((url) => /\/admin\/heroes(?:\/|$)/.test(url.pathname)),
      false,
      "Authoring and reading references never download full hero revisions",
    )
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await new Promise((resolve) => setTimeout(resolve, 30))
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
