import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { SecondaryContent } from "../src/features/warehouse/secondary-editor"
import type {
  SpellContent,
  ArcanaContent,
  ItemContent,
  EnchantmentContent,
  WarehouseEntry,
  WarehouseRevision,
} from "../src/features/warehouse/warehouse-types"

let activeRequests: string[] = []
let removalEvents: Record<string, unknown>[] = []
let activeFetcher: typeof fetch
const fixtureFetch: typeof fetch = (...args) => activeFetcher(...args)

test("timeline keeps baseline separate, selects a patch, and suppresses selection after horizontal dragging", async () => {
  await withUi(async ({ document, render }) => {
    const { CatalogTimeline } = await import("../src/features/publishing/catalog-timeline")
    const data = {
      markets: [],
      seasons: [
        { id: "s3", displayName: "S3" },
        { id: "s4", displayName: "S4" },
      ],
      rulesets: [],
      releases: [],
      variants: [
        {
          id: "base",
          seasonId: "s3",
          rulesetId: "standard",
          rulesetOrdinal: 1,
          patchCode: "Nền S3",
          status: "PUBLISHED",
        },
        {
          id: "added",
          seasonId: "s4",
          rulesetId: "standard",
          rulesetOrdinal: 2,
          patchCode: "29/09",
          status: "PUBLISHED",
        },
        {
          id: "empty",
          seasonId: "s4",
          rulesetId: "standard",
          rulesetOrdinal: 3,
          patchCode: "15/10",
          status: "PUBLISHED",
        },
      ],
    } as unknown as import("../src/features/publishing/publication-overview").PublicationOverview
    let selected = { seasonId: "", variantId: "" }
    await render(
      <CatalogTimeline
        data={data}
        value={selected}
        onChange={(next) => {
          selected = next
        }}
        counts={
          new Map([
            ["base", { changes: 0, baseline: 31 }],
            ["added", { changes: 2, baseline: 0 }],
            ["empty", { changes: 0, baseline: 0 }],
          ])
        }
      />,
    )
    const button = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Lọc patch ${label}"]`)!
    assert.match(button("Nền S3").textContent!, /31 mục dữ liệu nền/)
    assert.match(button("29/09").textContent!, /2 mục thay đổi/)
    assert.match(button("15/10").textContent!, /Chưa ghi nhận thay đổi/)
    await act(async () => button("29/09").click())
    assert.deepEqual(selected, { seasonId: "s4", variantId: "added" })
    const rail = button("29/09").parentElement!
    Object.assign(rail, { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} })
    const pointer = (type: string, x: number) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        pointerType: { value: "mouse" },
        pointerId: { value: 1 },
        button: { value: 0 },
        buttons: { value: 1 },
        clientX: { value: x },
      })
      rail.dispatchEvent(event)
    }
    await act(async () => {
      pointer("pointerdown", 220)
      pointer("pointermove", 100)
      pointer("pointerup", 100)
      button("15/10").click()
    })
    assert.equal(rail.scrollLeft, 120)
    assert.equal(selected.variantId, "added", "Dragging does not accidentally select a patch")
    await act(async () => button("15/10").click())
    assert.equal(selected.variantId, "empty")
    data.variants.find((v) => v.id === "empty")!.dataReviewState = "COMPLETE"
    await render(
      <CatalogTimeline
        data={data}
        value={{ seasonId: "", variantId: "" }}
        onChange={(next) => {
          selected = next
        }}
        counts={
          new Map([
            ["base", { changes: 0, baseline: 31 }],
            ["added", { changes: 2, baseline: 0 }],
            ["empty", { changes: 0, baseline: 0 }],
          ])
        }
      />,
    )
    assert.equal(button("15/10"), null)
    assert.ok(button("29/09"))
    assert.deepEqual(
      [...document.querySelectorAll('[aria-label^="Lọc mùa"]')].map((season) => season.textContent),
      ["S3", "S4"],
    )
  })
})

async function withUi(
  run: (ui: {
    document: Document
    client: QueryClient
    requests: string[]
    render: (node: React.ReactNode) => Promise<void>
    click: (text: string) => Promise<void>
    tab: (text: string) => Promise<void>
    language: (value: string) => Promise<void>
    name: (value: string) => Promise<void>
    upload: (file: File) => Promise<void>
  }) => Promise<void>,
  capabilities = ["spell:write", "spell:publish", "media:write"],
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/spells", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const requests: string[] = []
  activeRequests = requests
  removalEvents = []
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    activeRequests.push(`${path}${url.search}`)
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities,
      })
    if (path === "/admin/media/assets" && init?.method === "POST") {
      assert.equal(JSON.parse(String(init.body)).semanticType, "SPELL_ICON")
      return Response.json({ id: "uploaded-icon" })
    }
    if (path === "/admin/media/assets") return Response.json({ items: [], totalElements: 0 })
    if (path === "/admin/media/assets/uploaded-icon/version-uploads")
      return Response.json({
        uploadId: "fixture-upload",
        uploadUrl: "https://storage.test/fixture-upload",
        method: "PUT",
        headers: {},
      })
    if (path === "/fixture-upload") {
      assert.equal(init?.method, "PUT")
      assert.equal(init?.credentials, "omit")
      assert.equal(new Headers(init?.headers).has("Authorization"), false)
      return new Response(null, { status: 200 })
    }
    if (path === "/admin/media/uploads/fixture-upload/complete")
      return Response.json({ assetId: "uploaded-icon", current: true })
    if (path === "/admin/rulesets")
      return Response.json([
        { id: "regional", code: "regional", description: "" },
        { id: "standard", code: "aov-standard", description: "" },
      ])
    if (path === "/admin/reference-catalog") {
      const rulesetId = url.searchParams.get("rulesetId") || "standard"
      return Response.json({
        rulesetId,
        items: [
          {
            id: "item-uuid",
            kind: "item",
            iconAssetId: "item-icon",
            autoMatch: false,
            translations: [
              { locale: "vi-VN", name: "Kiếm dài", aliases: [], description: "Công vật lý" },
              { locale: "en-US", name: "Long Sword", aliases: [], description: "Physical attack" },
            ],
            destinations: { admin: `/items?item=item-uuid&ruleset=${rulesetId}` },
          },
        ],
      })
    }
    if (path === "/admin/spells/legacy/removals") {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body))
        assert.equal(body.patchVariantId, "patch-fixture")
        assert.equal(body.revisionId, "legacy-revision")
        assert.equal(body.sourceUrl, "https://example.com/evidence")
        const event = { id: "removal", rulesetId: "standard", recordedAt: "2026-10-18", ...body }
        removalEvents.push(event)
        return Response.json(event, { status: 201 })
      }
      return Response.json(removalEvents)
    }
    if (path === "/admin/items")
      return Response.json({
        items: [
          {
            id: "item-uuid",
            code: "long-sword",
            revision: { id: "item-revision" },
            content: {
              iconAssetId: "item-icon",
              notes: null,
              translations: [
                { locale: "vi-VN", name: "Kiếm dài", summary: null, description: "Công vật lý" },
                { locale: "en-US", name: "Long Sword", summary: null, description: "Physical attack" },
              ],
            },
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        hasNext: false,
      })
    if (path === "/admin/heroes") return Response.json({ items: [], page: 0, size: 20, totalElements: 0 })
    if (["/admin/enchantments", "/admin/arcana", "/admin/spells"].includes(path))
      return Response.json({ items: [], page: 0, size: 100, totalElements: 0 })
    if (path === "/admin/publication-overview")
      return Response.json({
        asOf: "2026-10-18",
        markets: [],
        seasons: [],
        variants: [
          {
            id: "patch-fixture",
            patchId: "patch",
            patchCode: "2026-10-15",
            rulesetId: "standard",
            rulesetOrdinal: 1,
            status: "PUBLISHED",
            seasonId: null,
          },
        ],
        releases: [],
        rulesets: [],
        assignments: [],
        seasonSchedules: [],
      })
    if (path.startsWith("/admin/media/assets/"))
      return Response.json({
        id: path.split("/").at(-1),
        currentVersionId: "version",
        currentUrl: "/fixture.webp",
        versions: [{ id: "version", url: "/fixture.webp" }],
        provenance: [],
      })
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  // Session clients retain their fetch dependency, so route it to the active fixture between tests.
  activeFetcher = fetcher
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
    fetch: fixtureFetch,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { defaultSettings } = await import("../src/features/terminology/settings-api")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(["rich-text-settings"], { settings: defaultSettings, table: null })
  const document = dom.window.document
  const findButton = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)
  const render = async (node: React.ReactNode) => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <TooltipProvider>{node}</TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  }
  try {
    await verifySession()
    await run({
      document,
      client,
      requests,
      render,
      click: async (text) => {
        const button = findButton(text)
        assert.ok(button, text)
        await act(async () => button.click())
      },
      tab: async (text) => {
        const button = findButton(text)
        assert.ok(button, text)
        await act(async () => {
          button.dispatchEvent(new dom.window.MouseEvent("mousedown", { button: 0, bubbles: true }))
          button.click()
        })
      },
      language: async (value) => {
        const node = document.querySelector<HTMLSelectElement>('[aria-label="Ngôn ngữ bản dịch"]')!
        assert.ok(node)
        await act(async () => {
          node.value = value
          node.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
        })
      },
      name: async (value) => {
        const node = [...document.querySelectorAll("label")]
          .find((label) => label.textContent?.trim() === "Tên hiển thị")
          ?.querySelector("input")
        assert.ok(node)
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, value)
          node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
        })
      },
      upload: async (file) => {
        const input = document.querySelector<HTMLInputElement>('input[type="file"][aria-label="Tải ảnh mới"]')!
        assert.ok(input)
        await act(async () => {
          Object.defineProperty(input, "files", { configurable: true, value: [file] })
          input.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
        })
        for (let attempt = 0; attempt < 100; attempt++) {
          if (
            document.body.textContent?.includes("Asset đã chọn: uploaded-icon") ||
            document.querySelector('[role="alert"]')
          )
            return
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
          })
        }
      },
    })
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await new Promise((resolve) => setTimeout(resolve, 20))
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("compact references use real identities, all translations and lazy media in the selected ruleset", async () => {
  await withUi(async ({ requests }) => {
    const { referenceCatalogApi } = await import("../src/features/terminology/reference-api")
    const references = await referenceCatalogApi.list()
    assert.equal(references[0].id, "item-uuid")
    assert.equal(references[0].iconAssetId, "item-icon")
    assert.deepEqual(
      references[0].translations.map((text) => text.locale),
      ["vi-VN", "en-US"],
    )
    assert.equal(references[0].autoMatch, false)
    assert.equal(references[0].destinations?.admin, "/items?item=item-uuid&ruleset=standard")
    assert.ok(requests.includes("/admin/reference-catalog"))
    assert.equal(requests.filter((path) => path.startsWith("/admin/media/")).length, 0)
    assert.equal(
      requests.some((path) => path.includes("resources")),
      false,
    )
    await referenceCatalogApi.list("regional")
    assert.ok(requests.includes("/admin/reference-catalog?rulesetId=regional"))
    assert.equal(requests.filter((path) => path.startsWith("/admin/reference-catalog")).length, 2)
    assert.equal(
      requests.some((path) => /^\/admin\/(items|heroes|rulesets)(\?|$)/.test(path)),
      false,
    )
  })
})

test("enchantment scope controls clear dependent patches and show both matching branches without hero-specific copy", async () => {
  await withUi(async ({ document, render, click }) => {
    const { CatalogContext } = await import("../src/features/publishing/catalog-context")
    const { EnchantmentBranches } = await import("../src/features/warehouse/enchantment-branches")
    const data = {
      seasons: [
        { id: "s3", displayName: "S3 2026" },
        { id: "s4", displayName: "S4 2026" },
      ],
      variants: [
        { id: "baseline", patchCode: "s3-observed", seasonId: "s3", rulesetId: "standard", status: "PUBLISHED" },
        { id: "september", patchCode: "2026-09-29", seasonId: "s4", rulesetId: "standard", status: "PUBLISHED" },
        { id: "october", patchCode: "2026-10-15", seasonId: "s4", rulesetId: "standard", status: "PUBLISHED" },
      ],
      rulesets: [{ id: "standard", code: "aov-standard" }],
    } as unknown as import("../src/features/publishing/publication-overview").PublicationOverview
    const branches = ["tower", "chaos", "forest"].map((code, index) => ({
      code,
      version: 1,
      displayOrder: index,
      iconAssetId: null,
      backgroundAssetId: null,
      color: null,
      translations: [{ locale: "vi-VN", name: code }],
    }))
    const entries: WarehouseEntry<EnchantmentContent>[] = ["chaos", "forest"].map((branchCode) => ({
      id: branchCode,
      code: branchCode,
      revision: fixtureRevision(branchCode),
      missingFields: [],
      content: {
        branchCode,
        tier: 2,
        position: 2,
        iconAssetId: null,
        translations: [{ locale: "vi-VN", name: branchCode }],
        notes: null,
      },
    }))
    let selected = { seasonId: "", variantId: "" }
    function Fixture() {
      const [scope, setScope] = React.useState(selected)
      selected = scope
      return (
        <>
          <CatalogContext
            data={data}
            value={scope}
            onChange={setScope}
            filteredDescription="Các phù hiệu tại mốc đã chọn."
            unfilteredDescription="Tất cả phù hiệu."
          />
          <EnchantmentBranches
            records={entries}
            branches={branches}
            active=""
            scoped
            onSelect={() => {}}
            onOpen={() => {}}
            selectedId=""
            locale="vi-VN"
            search=""
            canWrite={false}
            onEditBranch={() => {}}
          />
        </>
      )
    }
    await render(<Fixture />)
    const select = async (label: string, value: string) => {
      await act(async () => {
        const input = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
        input.value = value
        input.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }))
      })
    }
    await select("Mùa có thay đổi", "s4")
    assert.deepEqual(selected, { seasonId: "s4", variantId: "" })
    assert.equal(document.querySelector('select[aria-label="Patch có thay đổi"] option[value="baseline"]'), null)
    await select("Patch có thay đổi", "september")
    assert.equal(selected.variantId, "september")
    assert.deepEqual(
      [...document.querySelectorAll("h2")].map((heading) => heading.textContent),
      ["chaos", "forest"],
    )
    assert.equal(document.querySelectorAll('[aria-label="Phù hiệu cấp II"]').length, 2)
    assert.equal(document.querySelector('[aria-label="Phù hiệu cấp I"]'), null)
    assert.equal(document.querySelector('[aria-label="Phù hiệu cấp III"]'), null)
    assert.equal(document.body.textContent?.includes("tướng"), false)
    await select("Mùa có thay đổi", "s3")
    assert.equal(selected.variantId, "")
    await click("Bỏ lọc")
    assert.deepEqual(selected, { seasonId: "", variantId: "" })
  })
})

test("order popup compares peers, retains the proposed order on failure and saves only after confirmation", async () => {
  await withUi(async ({ document, render, click }) => {
    const { WarehouseOrderPicker } = await import("../src/features/warehouse/warehouse-order-picker")
    const original = ["First", "Second", "Third"].map((name) => ({ id: name, name, iconAssetId: null }))
    const calls: string[][] = []
    await render(
      <WarehouseOrderPicker
        label="Thứ tự các hệ"
        items={original}
        onSave={async (ids) => {
          calls.push(ids)
          if (calls.length === 1) throw new Error("A peer has changed. Reload and retry.")
        }}
      />,
    )
    await click("Thứ tự các hệ")
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(calls.length, 0)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đưa Second lên"]')!.click())
    assert.deepEqual(
      [...document.querySelectorAll("ol li")].map((row) =>
        row.querySelector('[aria-label^="Kéo "]')?.getAttribute("aria-label"),
      ),
      ["Kéo Second", "Kéo First", "Kéo Third"],
    )
    await click("Lưu thứ tự")
    assert.deepEqual(calls[0], ["Second", "First", "Third"])
    assert.ok(document.querySelector('[role="alert"]')?.textContent?.includes("A peer has changed"))
    assert.ok(document.querySelector('[role="dialog"]'))
    await click("Lưu thứ tự")
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.deepEqual(
      original.map((item) => item.id),
      ["First", "Second", "Third"],
    )
  })
})

test("branch editor replaces numeric ordering with the peer popup and hides suitability without dropping translations", async () => {
  await withUi(async ({ document, render, click }) => {
    const { EnchantmentBranchEditor } = await import("../src/features/warehouse/secondary-editor")
    const branch = {
      code: "forest",
      version: 1,
      displayOrder: 0,
      iconAssetId: null,
      backgroundAssetId: null,
      color: null,
      translations: [{ locale: "vi-VN", name: "Forest", description: "Description", suitability: "Keep legacy value" }],
    }
    await render(
      <EnchantmentBranchEditor
        branch={branch}
        branches={[branch]}
        locale="vi-VN"
        onClose={() => {}}
        onSave={async () => {}}
        onReorderBranches={async () => {}}
      />,
    )
    assert.equal(
      [...document.querySelectorAll("label")].some((node) => node.textContent?.includes("Thứ tự hiển thị")),
      false,
    )
    await click("Thứ tự các hệ")
    assert.ok(document.querySelector('ol[aria-label="Thứ tự các hệ"]'))
    await click("Hủy")
    await act(async () => {
      const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((node) =>
        node.textContent?.includes("Bản dịch"),
      )!
      tab.dispatchEvent(new document.defaultView!.MouseEvent("mousedown", { button: 0, bubbles: true }))
      tab.click()
    })
    assert.equal(document.body.textContent?.includes("Vai trò phù hợp"), false)
    assert.equal(branch.translations[0].suitability, "Keep legacy value")
  })
})

test("creating a spell uploads its icon from the information tab and saves the completed media reference", async () => {
  await withUi(async ({ document, requests, render, upload, click }) => {
    const { SecondaryEditor, newSecondaryContent } = await import("../src/features/warehouse/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0].name = "Phụ trợ mới"
    let saved: SecondaryContent | undefined
    await render(
      <SecondaryEditor
        kind="spells"
        code="new-spell"
        content={content}
        branches={[]}
        locale="vi-VN"
        isNew
        rulesetId="standard"
        onClose={() => {}}
        onSave={async (_code, value) => {
          saved = value
        }}
      />,
    )
    assert.equal(document.querySelector('[role="tab"][data-state="active"]')?.textContent?.trim(), "Thông tin")
    assert.ok([...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Tải ảnh mới"))
    await upload(new File([new Uint8Array([137, 80, 78, 71])], "new-spell.png", { type: "image/png" }))
    assert.ok(
      requests.includes("/admin/media/assets/uploaded-icon/version-uploads"),
      JSON.stringify({ requests, error: document.querySelector('[role="alert"]')?.textContent }),
    )
    assert.ok(requests.includes("/fixture-upload"))
    assert.ok(requests.includes("/admin/media/uploads/fixture-upload/complete"))
    assert.ok(document.body.textContent?.includes("Asset đã chọn: uploaded-icon"))
    await click("Lưu nháp")
    assert.equal(saved?.iconAssetId, "uploaded-icon")
  })
})

test("editing one spell translation preserves other locales, mechanics, states and artwork; published views cannot upload", async () => {
  await withUi(async ({ document, render, tab, language, name, click }) => {
    const { SecondaryEditor } = await import("../src/features/warehouse/secondary-editor")
    const content: SecondaryContent = {
      iconAssetId: "spell-icon",
      notes: "Evidence",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      unlockLevel: null,
      availability: "AVAILABLE",
      legacy: false,
      displayOrder: 2,
      maxCharges: 2,
      chargeRechargeSeconds: 45,
      defaultStateKey: "empowered",
      referenceImages: [{ assetId: "reference-icon", notes: "Alternate artwork" }],
      translations: [
        { locale: "vi-VN", name: "Tốc hành", summary: "Di chuyển", description: "Tăng tốc chạy" },
        { locale: "en-US", name: "Sprint", summary: "Movement", description: "Increase movement speed" },
      ],
      states: [
        {
          key: "empowered",
          iconAssetId: "state-icon",
          translations: [{ locale: "vi-VN", name: "Cường hóa", description: "Trạng thái nâng cấp" }],
        },
      ],
    }
    const before = structuredClone(content)
    let saved: SecondaryContent | undefined
    let savedPatch: string | null | undefined
    const props = {
      kind: "spells" as const,
      code: "sprint",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      initialPatchId: "patch-fixture",
      onClose() {},
      onSave: async (_code: string, value: SecondaryContent, patchId: string | null) => {
        saved = value
        savedPatch = patchId
      },
    }
    await render(<SecondaryEditor {...props} />)
    await tab("Bản dịch")
    await language("en-US")
    await name("Sprint revised")
    await click("Lưu nháp")
    assert.ok(saved)
    assert.equal(saved.translations.find((text) => text.locale === "en-US")?.name, "Sprint revised")
    assert.deepEqual(
      saved.translations.find((text) => text.locale === "vi-VN"),
      before.translations[0],
    )
    assert.deepEqual({ ...saved, translations: before.translations }, before)
    assert.equal(savedPatch, "patch-fixture")
    assert.deepEqual(content, before)
    await render(<SecondaryEditor key="published" {...props} readOnly />)
    await tab("Ảnh")
    assert.equal(document.querySelector('input[type="file"]'), null)
    assert.equal(
      [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Chọn / tải ảnh")),
      false,
    )
  })
})

test("spell cards expose both state icons, open details and collapse legacy entries without hiding filtered results", async () => {
  await withUi(async ({ document, client, render }) => {
    const { SpellCollection } = await import("../src/features/warehouse/spell-cards")
    const entry: WarehouseEntry<SpellContent> = {
      id: "punish",
      code: "trung-tri",
      revision: {
        id: "revision",
        ownerId: "punish",
        code: "trung-tri",
        rulesetId: "standard",
        revisionNo: 1,
        state: "DRAFT",
        version: 1,
        publicationSequence: null,
        publishedAt: null,
        cause: "DATA_BASELINE",
        effectiveFromPatchVariantId: null,
        sourceRevisionId: null,
        createdAt: "2026-10-18",
        updatedAt: "2026-10-18",
      },
      content: {
        iconAssetId: "normal-icon",
        translations: [{ locale: "vi-VN", name: "Trừng trị" }],
        notes: null,
        cooldownSeconds: 10,
        unlockLevel: 1,
        availability: "AVAILABLE",
        legacy: false,
        displayOrder: 1,
        states: [
          { key: "normal", iconAssetId: "normal-icon", translations: [{ locale: "vi-VN", name: "Trừng trị thường" }] },
          { key: "chill", iconAssetId: "chill-icon", translations: [{ locale: "vi-VN", name: "Trừng trị tê tái" }] },
        ],
      },
    }
    const removed: WarehouseEntry<SpellContent> = {
      ...entry,
      id: "legacy",
      code: "legacy",
      content: {
        ...entry.content,
        translations: [{ locale: "vi-VN", name: "Phụ trợ đã gỡ" }],
        availability: "REMOVED",
        states: [],
      },
    }
    for (const id of ["normal-icon", "chill-icon"]) {
      client.setQueryData(["hero-content-asset", id], { id, currentUrl: `/${id}.webp` })
    }
    let opened: string | undefined
    const props = {
      records: [entry, removed],
      locale: "vi-VN",
      selectedId: "",
      onOpen: (value: WarehouseEntry<SpellContent>) => {
        opened = value.id
      },
    }
    await render(<SpellCollection {...props} />)
    const card = document.querySelector<HTMLElement>('[data-spell-card="punish"]')!
    const openButton = card.querySelector<HTMLButtonElement>('button[aria-label="Xem Trừng trị"]')!
    assert.ok(card)
    // The whole card opens the details; the repeated open hint is gone, the accessible label remains.
    assert.ok(openButton)
    assert.doesNotMatch(card.textContent!, /Xem chi tiết/)
    assert.deepEqual(
      [...card.querySelectorAll("img")].map((image) => [image.alt, image.getAttribute("src")]).sort(),
      [
        ["Trừng trị thường", "/normal-icon.webp"],
        ["Trừng trị tê tái", "/chill-icon.webp"],
      ].sort(),
    )
    for (const button of card.querySelectorAll("button")) assert.equal(button.querySelector("button"), null)
    const switchButton = card.querySelector<HTMLButtonElement>('button[aria-label="Chuyển sang Trừng trị tê tái"]')!
    assert.ok(switchButton)
    await act(async () => switchButton.click())
    assert.equal(card.querySelector('[aria-live="polite"]')?.textContent, "Trừng trị tê tái")
    assert.ok(card.querySelector('button[aria-label="Chuyển sang Trừng trị thường"]'))
    assert.equal(opened, undefined)
    assert.equal(entry.content.defaultStateKey, undefined)
    await act(async () => openButton.click())
    assert.equal(opened, "punish")
    const toggle = document.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!
    assert.equal(toggle.getAttribute("aria-expanded"), "false")
    assert.equal(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'), null)
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute("aria-expanded"), "true")
    assert.ok(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'))
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute("aria-expanded"), "false")
    await render(<SpellCollection key="filtered" {...props} records={[removed]} revealLegacy />)
    assert.equal(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute("aria-expanded"), "true")
    assert.ok(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'))
    const { SecondaryEditor } = await import("../src/features/warehouse/secondary-editor")
    await render(
      <SecondaryEditor
        kind="spells"
        code={entry.code}
        content={entry.content}
        branches={[]}
        locale="vi-VN"
        isNew={false}
        rulesetId="standard"
        readOnly
        onClose={() => {}}
        onSave={async () => {}}
      />,
    )
    const detailSwitch = document.querySelector<HTMLButtonElement>('button[aria-label="Chuyển sang Trừng trị tê tái"]')!
    assert.ok(detailSwitch)
    for (const image of document.querySelectorAll('img[alt^="Trừng trị"]')) {
      assert.ok(image.parentElement?.classList.contains("rounded-full"))
    }
    await act(async () => detailSwitch.click())
    assert.equal(document.querySelector('[aria-live="polite"]')?.textContent, "Trừng trị tê tái")
  })
})

function fixtureRevision(id: string): WarehouseRevision {
  return {
    id: `${id}-revision`,
    ownerId: id,
    code: id,
    rulesetId: "standard",
    revisionNo: 1,
    state: "DRAFT",
    version: 1,
    publicationSequence: null,
    publishedAt: null,
    cause: "DATA_BASELINE",
    effectiveFromPatchVariantId: null,
    sourceRevisionId: null,
    createdAt: "2026-10-18",
    updatedAt: "2026-10-18",
  }
}

test("arcana keeps tier III visible, collapses lower tiers and reveals filtered results with circular icons", async () => {
  await withUi(async ({ document, client, render }) => {
    const { ArcanaCollection } = await import("../src/features/warehouse/arcana-cards")
    client.setQueryData(["hero-content-asset", "arcana-icon"], { currentUrl: "/arcana.webp" })
    const records: WarehouseEntry<ArcanaContent>[] = [1, 2, 3].map((tier) => ({
      id: `tier-${tier}`,
      code: `tier-${tier}`,
      revision: fixtureRevision(`tier-${tier}`),
      content: {
        iconAssetId: "arcana-icon",
        notes: null,
        translations: [{ locale: "vi-VN", name: `Ngọc ${tier}` }],
        color: "RED",
        tier,
        stats: [],
      },
    }))
    let opened: string | undefined
    const props = {
      records,
      locale: "vi-VN",
      selectedId: "",
      onOpen: (entry: WarehouseEntry<ArcanaContent>) => {
        opened = entry.id
      },
    }
    await render(<ArcanaCollection {...props} />)
    assert.ok(document.querySelector('button[aria-label="Xem Ngọc 3"]'))
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 1"]'), null)
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 2"]'), null)
    const tiers = [...document.querySelectorAll<HTMLButtonElement>('[data-slot="collapsible-trigger"]')]
    assert.match(tiers[0].textContent!, /Ngọc bậc II/)
    assert.match(tiers[1].textContent!, /Ngọc bậc I/)
    const toggle = tiers[1]
    await act(async () => toggle.click())
    const card = document.querySelector<HTMLButtonElement>('button[aria-label="Xem Ngọc 1"]')!
    assert.ok(card)
    assert.ok(card.querySelector("img")?.parentElement?.classList.contains("rounded-full"))
    await act(async () => card.click())
    assert.equal(opened, "tier-1")
    await act(async () => toggle.click())
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 1"]'), null)
    await render(<ArcanaCollection key="filtered" {...props} records={[records[1]]} revealLowerTiers />)
    assert.ok(document.querySelector('button[aria-label="Xem Ngọc 2"]'))
    assert.equal(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute("aria-expanded"), "true")
  })
})

test("archived spells stay separate, gameplay revisions require a patch, and later removal history needs a source", async () => {
  await withUi(async ({ document, render, click }) => {
    const { SecondaryEditor, newSecondaryContent } = await import("../src/features/warehouse/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0] = { locale: "vi-VN", name: "Phụ trợ cũ", description: "Mô tả lịch sử" }
    Object.assign(content, {
      legacy: true,
      availability: "REMOVED",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      iconAssetId: "spell-icon",
    })
    let published = 0
    const props = {
      kind: "spells" as const,
      code: "legacy",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      canPublish: true,
      missingFields: ["effectiveFromPatchVariantId"],
      onClose() {},
      onSave: async () => {},
      onPublish: async () => {
        published++
      },
    }
    await render(<SecondaryEditor {...props} />)
    assert.ok(document.body.textContent?.includes("Có thể xuất bản hồ sơ lưu trữ"))
    await click("Xuất bản")
    assert.equal(published, 1)
    await render(
      <SecondaryEditor
        key="active"
        {...props}
        revisionCause="GAME_PATCH"
        content={{ ...content, availability: "AVAILABLE" }}
      />,
    )
    const publishButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Xuất bản",
    )!
    assert.equal(publishButton.disabled, true)
    const { SpellRemovalHistory } = await import("../src/features/warehouse/spell-removal-history")
    await render(
      <SpellRemovalHistory id="legacy" revisionId="legacy-revision" rulesetId="standard" published canPublish />,
    )
    await click("Thêm mốc loại bỏ")
    const recordButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Ghi nhận lịch sử",
    )!
    assert.equal(recordButton.disabled, true)
    await act(async () => {
      const patch = document.querySelector<HTMLSelectElement>('[aria-label="Patch loại bỏ"]')!
      patch.value = "patch-fixture"
      patch.dispatchEvent(new window.Event("change", { bubbles: true }))
      const source = [...document.querySelectorAll("label")]
        .find((label) => label.textContent?.trim() === "Link nguồn xác nhận")!
        .querySelector("input")!
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(
        source,
        "https://example.com/evidence",
      )
      source.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    assert.equal(recordButton.disabled, false)
    await click("Ghi nhận lịch sử")
    for (let attempt = 0; attempt < 100 && !document.body.textContent?.includes("Đã loại bỏ · 2026-10-15"); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }
    assert.ok(document.body.textContent?.includes("Đã loại bỏ · 2026-10-15"))
    assert.equal(document.querySelector('a[href="https://example.com/evidence"]')?.getAttribute("rel"), "noreferrer")
  })
})

test("baseline spell publication needs no invented patch and corrections retain their unscoped baseline", async () => {
  await withUi(async ({ document, render, click }) => {
    const { SecondaryEditor, newSecondaryContent } = await import("../src/features/warehouse/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0] = { locale: "vi-VN", name: "Tốc hành", description: "Tăng tốc chạy" }
    Object.assign(content, {
      availability: "AVAILABLE",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      iconAssetId: "spell-icon",
    })
    let published = 0
    const props = {
      kind: "spells" as const,
      code: "sprint",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      canPublish: true,
      onClose() {},
      onSave: async () => {},
      onPublish: async () => {
        published++
      },
    }
    await render(<SecondaryEditor {...props} missingFields={["effectiveFromPatchVariantId"]} allowPatchChange />)
    assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /Dữ liệu nền · chưa xác định patch/)
    assert.match(document.body.textContent ?? "", /không phải xác nhận mục được thêm ở mùa hiện tại/)
    await click("Xuất bản")
    assert.equal(published, 1)

    await render(
      <SecondaryEditor
        key="correction"
        {...props}
        revisionCause="CONTENT_CORRECTION"
        sourceRevisionId="published-baseline"
      />,
    )
    assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /Dữ liệu nền kế thừa/)
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Ngữ cảnh dữ liệu"]')?.disabled, true)
    await click("Xuất bản")
    assert.equal(published, 2)

    await render(
      <SecondaryEditor
        key="gameplay"
        {...props}
        revisionCause="GAME_PATCH"
        missingFields={["effectiveFromPatchVariantId"]}
      />,
    )
    const publishButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Xuất bản",
    )!
    assert.equal(publishButton.disabled, true)
  })
})

test("patch history can compare published unscoped baselines without offering drafts, future or archived spells", async () => {
  await withUi(
    async ({ document, client, render, click }) => {
      const { WarehouseChangeHistory } = await import("../src/features/warehouse/warehouse-change-history")
      const baseline = {
        ...fixtureRevision("baseline"),
        id: "baseline",
        ownerId: "spell",
        code: "spell",
        state: "PUBLISHED" as const,
        archived: false,
      }
      const revisions: WarehouseRevision[] = [
        baseline,
        { ...baseline, id: "correction", cause: "CONTENT_CORRECTION", sourceRevisionId: "baseline", revisionNo: 2 },
        { ...baseline, id: "draft", state: "DRAFT" },
        { ...baseline, id: "archived", archived: true },
        { ...baseline, id: "another-ruleset", rulesetId: "regional" },
        { ...baseline, id: "earlier", cause: "GAME_PATCH", effectiveFromPatchVariantId: "earlier-patch" },
        { ...baseline, id: "target", cause: "GAME_PATCH", effectiveFromPatchVariantId: "patch-fixture" },
        { ...baseline, id: "future", cause: "GAME_PATCH", effectiveFromPatchVariantId: "future-patch" },
      ]
      client.setQueryDefaults(["warehouse", "history"], { staleTime: Infinity })
      client.setQueryDefaults(["publication-overview"], { staleTime: Infinity })
      client.setQueryData(["warehouse", "history", "spells", "spell"], revisions)
      client.setQueryData(["warehouse", "changes", "spells", "standard", "vi-VN"], [])
      client.setQueryData(["publication-overview"], {
        seasons: [],
        variants: [
          { id: "earlier-patch", patchCode: "Trước", rulesetId: "standard", rulesetOrdinal: 1, status: "PUBLISHED" },
          { id: "patch-fixture", patchCode: "Hiện tại", rulesetId: "standard", rulesetOrdinal: 2, status: "PUBLISHED" },
          { id: "future-patch", patchCode: "Sau", rulesetId: "standard", rulesetOrdinal: 3, status: "PUBLISHED" },
        ],
      })
      await render(<WarehouseChangeHistory kind="spells" entryId="spell" rulesetId="standard" locale="vi-VN" />)
      await click("Ghi nhận thay đổi / tạo bản cập nhật")
      const choose = async (label: string, value: string) =>
        act(async () => {
          const select = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!
          select.value = value
          select.dispatchEvent(new window.Event("change", { bubbles: true }))
        })
      await choose("Snapshot đã xuất bản", "target")
      const options = () => [
        ...document.querySelectorAll<HTMLOptionElement>('[aria-label="Bản trước để đối chiếu"] option'),
      ]
      assert.deepEqual(
        options().map((option) => option.value),
        ["", "baseline", "correction", "earlier"],
      )
      assert.match(
        options().find((option) => option.value === "baseline")?.textContent ?? "",
        /v1 · Dữ liệu nền chưa rõ patch/,
      )

      await choose("Snapshot đã xuất bản", "baseline")
      await choose("Patch ghi nhận thay đổi", "patch-fixture")
      assert.equal(
        options().some((option) => option.value === "baseline"),
        false,
      )
    },
    ["spell:write", "spell:publish", "patch:write"],
  )
})

test("item cards separate recipe selection from opening details and hide ports on outer columns", async () => {
  await withUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/item-shop-graph")
    const { Page } = await import("../src/components/page-header")
    const items: WarehouseEntry<ItemContent>[] = ["base", "middle", "final"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }))
    let selected: string | null = null
    let opened: string | undefined
    const focusEvents: (string | null)[] = []
    await render(
      <>
        <div data-outside-blank>Outside page</div>
        <div role="dialog">
          <span data-dialog-blank>Dialog blank space</span>
        </div>
        <div data-page-tab="/arcana">
          <div data-other-tab-blank>Other tab blank space</div>
        </div>
        <div data-page-tab="/items" data-active="true">
          <div data-panel-blank>Tab panel blank space</div>
          <Page data-item-selection-surface>
            <div data-page-blank>Page blank space</div>
            <button type="button" data-page-action>
              Page action
            </button>
            <ItemShopGraph
              items={items}
              categories={[]}
              locale="vi-VN"
              selectedId={null}
              category="attack"
              onCategory={() => {}}
              onSelect={(id) => {
                opened = id
              }}
              onFocus={(id) => {
                selected = id
                focusEvents.push(id)
              }}
              onConnect={() => {}}
              onMove={() => {}}
              editable
            />
          </Page>
        </div>
      </>,
    )
    assert.equal(document.querySelector('button[aria-label="Ghép từ base"]'), null)
    assert.equal(document.querySelector('button[aria-label="Nâng cấp từ final"]'), null)
    assert.ok(document.querySelector('button[aria-label="Nâng cấp từ base"]'))
    assert.ok(document.querySelector('button[aria-label="Ghép từ final"]'))
    const select = document.querySelector<HTMLButtonElement>('button[aria-label="Chọn trang bị middle"]')!
    await act(async () => select.click())
    assert.equal(selected, "middle")
    assert.equal(opened, undefined)
    const open = document.querySelector<HTMLButtonElement>('button[aria-label="Xem trang bị middle"]')!
    await act(async () => open.click())
    assert.equal(opened, "middle")
    assert.equal(selected, "middle")
    assert.equal(open.parentElement?.querySelector("button button"), null)
    await act(async () => document.querySelector<HTMLElement>('[data-item-node="middle"]')!.click())
    assert.equal(selected, "middle", "Card padding does not clear selection")
    const port = document.querySelector<HTMLButtonElement>('[aria-label="Nâng cấp từ base"]')!
    await act(async () => port.click())
    assert.equal(port.getAttribute("aria-pressed"), "true")
    const empty = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    await act(async () => {
      empty.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
      empty.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 10 }))
      empty.click()
    })
    assert.equal(selected, "middle", "Dragging across blank space does not clear selection")
    await act(async () => empty.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0 })))
    await act(async () => empty.click())
    assert.equal(selected, null)
    assert.equal(port.getAttribute("aria-pressed"), "false")

    const page = document.querySelector<HTMLElement>("[data-item-selection-surface]")!
    const pageBlank = document.querySelector<HTMLElement>("[data-page-blank]")!
    const panel = document.querySelector<HTMLElement>('[data-page-tab="/items"]')!
    const panelBlank = document.querySelector<HTMLElement>("[data-panel-blank]")!
    const pointerDown = (target: HTMLElement) =>
      target.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
    await act(async () => {
      select.click()
      port.click()
    })
    const beforeControls = focusEvents.length
    await act(async () => document.querySelector<HTMLButtonElement>("[data-page-action]")!.click())
    assert.equal(focusEvents.length, beforeControls, "Same-page controls do not clear selection")
    await act(async () => document.querySelector<HTMLElement>("[data-outside-blank]")!.click())
    await act(async () => document.querySelector<HTMLElement>("[data-dialog-blank]")!.click())
    await act(async () => document.querySelector<HTMLElement>("[data-other-tab-blank]")!.click())
    assert.equal(focusEvents.length, beforeControls, "Other pages and portaled dialogs do not clear selection")
    assert.equal(port.getAttribute("aria-pressed"), "true")

    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 10 }))
      pageBlank.click()
    })
    assert.equal(selected, "middle", "Dragging outside the graph border does not clear selection")
    await act(async () => {
      pointerDown(pageBlank)
      page.dispatchEvent(new window.Event("scroll"))
      pageBlank.click()
    })
    assert.equal(selected, "middle", "Scrolling the page does not turn into a deselection click")

    page.hidden = true
    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, "middle", "A hidden cached page cannot clear its selection")
    page.hidden = false
    page.setAttribute("inert", "")
    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, "middle", "An inert cached page cannot clear its selection")
    page.removeAttribute("inert")

    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, null, "Blank space outside the graph border clears selection after a fresh pointer down")
    assert.equal(port.getAttribute("aria-pressed"), "false", "Clicking the page blank also cancels an armed connector")
    await act(async () => {
      select.click()
      port.click()
      pointerDown(page)
      page.click()
    })
    assert.equal(selected, null, "The page padding outside all child elements clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")

    await act(async () => {
      select.click()
      port.click()
    })
    panel.hidden = true
    await act(async () => {
      pointerDown(panelBlank)
      panelBlank.click()
    })
    assert.equal(selected, "middle", "A hidden tab panel cannot clear its selection")
    panel.hidden = false
    await act(async () => {
      pointerDown(panelBlank)
      panelBlank.click()
    })
    assert.equal(selected, null, "Blank tab-panel space outside the Page element clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")
    await act(async () => {
      select.click()
      port.click()
      pointerDown(panel)
      panel.click()
    })
    assert.equal(selected, null, "The tab scroll container padding clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")
  })
})

test("item row picker keeps cancellation local, supports physical row selection and blocks undefined columns", async () => {
  await withUi(async ({ document, render, click }) => {
    const { ItemRowPicker } = await import("../src/features/warehouse/item-row-picker")
    const entry: WarehouseEntry<ItemContent> = {
      id: "edited",
      code: "edited",
      revision: fixtureRevision("edited"),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: "Kiếm thử" }],
        tier: 2,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 2, column: 1, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }
    let selected: number | null | undefined
    const props = {
      entry,
      items: [entry],
      positionIndex: 0,
      locale: "vi-VN",
      contextLabel: "Công",
      disabled: false,
      onChange: (row: number | null) => {
        selected = row
      },
    }
    await render(<ItemRowPicker {...props} />)
    const open = () => document.querySelector<HTMLButtonElement>('[aria-label="Điều chỉnh hàng vị trí 1"]')!
    await act(async () => open().click())
    assert.ok(document.querySelector('[aria-label="Kéo Kiếm thử"]'))
    await click("Lên")
    await click("Hủy")
    assert.equal(selected, undefined)
    await act(async () => open().click())
    assert.equal(document.querySelector('[aria-label="Chọn hàng 3"]')?.getAttribute("aria-pressed"), "true")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Chọn hàng 1"]')!.click())
    await click("Chọn hàng 1")
    assert.equal(selected, 0)
    assert.equal(entry.content.shopPositions[0].row, 2)
    await render(<ItemRowPicker key="disabled" {...props} disabled />)
    assert.equal(open().disabled, true)
    await render(
      <ItemRowPicker
        key="unassigned"
        {...props}
        entry={{
          ...entry,
          content: {
            ...entry.content,
            shopPositions: [{ categoryCode: "attack", row: null, column: null, variant: null }],
          },
        }}
      />,
    )
    assert.equal(open().disabled, true)
    assert.match(document.body.textContent!, /Chọn cột trước khi xếp hàng/)
    assert.equal(document.querySelector('input[type="number"]'), null)
  })
})

test("shop paints wire underlays first and skips unchanged layout measurements during scrolling", async () => {
  await withUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/item-shop-graph")
    const callbacks: (() => void)[] = []
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        callbacks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    const items: WarehouseEntry<ItemContent>[] = ["base", "other", "target"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "VERIFIED",
        components:
          id === "target"
            ? [
                { itemId: "base", quantity: 1 },
                { itemId: "other", quantity: 1 },
              ]
            : [],
        stats: [],
      },
    }))
    let commits = 0
    const shop = (selectedId: string | null) => (
      <React.Profiler id="shop" onRender={() => commits++}>
        <ItemShopGraph
          items={items}
          categories={[]}
          locale="vi-VN"
          selectedId={selectedId}
          category="attack"
          onCategory={() => {}}
          onSelect={() => {}}
          onFocus={() => {}}
          onConnect={() => {}}
          onMove={() => {}}
          editable={false}
        />
      </React.Profiler>
    )
    await render(shop(null))
    assert.equal(callbacks.length, 0, "No geometry observation is needed without visible recipe wires")
    await render(shop("target"))
    const resize = callbacks.at(-1)!
    assert.ok(resize)
    const canvas = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    let scrollOffset = 0
    const bounds = (x: number, y: number, width: number, height: number) =>
      ({ left: x, right: x + width, top: y - scrollOffset, bottom: y + height - scrollOffset }) as DOMRect
    canvas.getBoundingClientRect = () => bounds(0, 0, 968, 300)
    for (const [index, node] of [...canvas.querySelectorAll<HTMLElement>("[data-item-node]")].entries())
      node.getBoundingClientRect = () => bounds(28 + index * 320, 40, 272, 80)
    const notify = async () => {
      await act(async () => {
        resize()
        resize()
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }
    await notify()
    const wires = [...canvas.querySelectorAll("[data-recipe-line]")]
    const halos = [...canvas.querySelectorAll("[data-recipe-halo]")]
    assert.equal(wires.length, 2)
    assert.equal(halos.length, 2)
    for (const halo of halos)
      for (const wire of wires)
        assert.ok(
          halo.compareDocumentPosition(wire) & document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING,
          "Every underlay must paint before every recipe wire so overlapping paths cannot erase earlier lines",
        )
    const before = commits
    scrollOffset = 240
    canvas.parentElement!.dispatchEvent(new window.Event("scroll"))
    await notify()
    assert.equal(commits, before, "Moving the viewport without changing card geometry must not rerender the shop")
    assert.equal(
      canvas.querySelector('svg[aria-label="Đường ghép của trang bị được chọn"]')?.hasAttribute("width"),
      false,
      "The wire layer sizes itself without layout state",
    )
  })
})

test("connector drag previews its wire, snaps near compatible targets, and cancels without creating a recipe", async () => {
  await withUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/item-shop-graph")
    const items: WarehouseEntry<ItemContent>[] = ["base", "target"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }))
    const connected: string[][] = []
    await render(
      <ItemShopGraph
        items={items}
        categories={[]}
        locale="vi-VN"
        selectedId={null}
        category="attack"
        onCategory={() => {}}
        onSelect={() => {}}
        onFocus={() => {}}
        onConnect={(from, to) => {
          connected.push([from, to])
        }}
        onMove={() => {}}
        editable
      />,
    )
    const source = document.querySelector<HTMLButtonElement>('[aria-label="Nâng cấp từ base"]')!
    const target = document.querySelector<HTMLButtonElement>('[aria-label="Ghép từ target"]')!
    const canvas = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    const rect = (left: number, right: number, top = 78, bottom = 122) => ({
      left,
      right,
      top,
      bottom,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      toJSON() {},
    })
    source.getBoundingClientRect = () => rect(100, 132)
    target.getBoundingClientRect = () => rect(300, 332)
    canvas.getBoundingClientRect = () => rect(0, 800, 0, 300)
    Object.assign(source, { setPointerCapture() {}, hasPointerCapture: () => false })
    const pointer = (type: string, x: number, y = 100) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        pointerType: { value: "mouse" },
        button: { value: 0 },
        buttons: { value: 1 },
        clientX: { value: x },
        clientY: { value: y },
      })
      source.dispatchEvent(event)
    }
    await act(async () => {
      pointer("pointerdown", 116)
      pointer("pointermove", 220)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    const preview = document.querySelector('[data-connection-preview="dragging"]')!
    assert.ok(preview)
    assert.match(preview.querySelectorAll("path")[1].getAttribute("d")!, /^M.* C/)
    assert.equal(target.getAttribute("data-connection-compatible"), "true")
    await act(async () => {
      pointer("pointermove", 284)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    assert.ok(document.querySelector('[data-connection-preview="snapped"]'))
    assert.equal(target.getAttribute("data-connection-target"), "true")
    await act(async () => pointer("pointerup", 284))
    assert.deepEqual(connected, [["base", "target"]])
    assert.equal(document.querySelector("[data-connection-preview]"), null)
    assert.equal(target.getAttribute("data-connection-target"), null)
    await act(async () => {
      pointer("pointerdown", 116)
      pointer("pointermove", 220)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await act(async () =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    )
    assert.equal(document.querySelector("[data-connection-preview]"), null)
    await act(async () => pointer("pointerup", 316))
    assert.equal(connected.length, 1)
  })
})

test("shop separates terminal column two items and renders external attributes beneath their real columns", async () => {
  await withUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/item-shop-graph")
    const make = (
      id: string,
      name: string,
      tier: number,
      categoryCode: string,
      column: number,
      row: number,
      components: ItemContent["components"] = [],
    ): WarehouseEntry<ItemContent> => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name }],
        tier,
        price: 100,
        categoryCode,
        shopPositions: [{ categoryCode, row, column, variant: null }],
        recipeStatus: "VERIFIED",
        components,
        stats: [],
      },
    })
    const items = [
      make("sword", "Kiếm ngắn", 1, "attack", 0, 0),
      make("mace", "Chùy cổ", 2, "attack", 1, 1, [{ itemId: "sword", quantity: 1 }]),
      make("gloves", "Găng giác đấu", 1, "defense", 0, 2),
      make("uriel", "Gươm Uriel", 3, "attack", 1, 7, [
        { itemId: "mace", quantity: 1 },
        { itemId: "gloves", quantity: 1 },
      ]),
    ]
    const original = structuredClone(items)
    let focus: string | null = "uriel",
      opened: string | undefined
    await render(
      <ItemShopGraph
        items={items}
        categories={[{ code: "defense", translations: [{ locale: "vi-VN", name: "Thủ" }] }] as never}
        locale="vi-VN"
        selectedId="uriel"
        category="attack"
        onCategory={() => {}}
        onSelect={(id) => {
          opened = id
        }}
        onFocus={(id) => {
          focus = id
        }}
        onConnect={() => {}}
        onMove={() => {}}
        editable
      />,
    )
    const terminal = document.querySelector('[aria-label^="Trang bị hoàn chỉnh · Cột 2"]')!
    assert.match(terminal.textContent!, /Gươm Uriel/)
    assert.equal(terminal.querySelector('[aria-label="Nâng cấp từ Gươm Uriel"]'), null)
    assert.ok(terminal.querySelector('[aria-label="Ghép từ Gươm Uriel"]'))
    assert.ok(document.querySelector('[aria-label="Nâng cấp từ Chùy cổ"]'))
    const external = document.querySelector('[aria-label="Thuộc tính khác · Thủ · Cột 1"]')!
    assert.match(external.textContent!, /Thủ.*Thuộc tính khác.*Găng giác đấu/)
    assert.equal(
      external.closest('[aria-label="Cột 1"]')?.querySelector("[data-item-node]")?.getAttribute("data-item-node"),
      "sword",
    )
    assert.equal(document.querySelectorAll('[data-item-node="gloves"]').length, 1)
    assert.equal(external.querySelector('[aria-label="Di chuyển Găng giác đấu"]'), null)
    assert.equal(document.querySelector('[aria-label^="Vùng ghép của"]'), null)
    const terminalHelp = terminal.querySelector<HTMLButtonElement>(
      '[aria-label="Giải thích vùng trang bị hoàn chỉnh"]',
    )!
    await act(async () => terminalHelp.click())
    const terminalExplanation = document.querySelector('[role="dialog"]')!
    assert.ok(terminalExplanation)
    assert.match(terminalExplanation.textContent!, /Các món này không dùng làm nguyên liệu/)
    assert.match(terminalExplanation.textContent!, /không tạo thành từ trang bị ở cột 3/)
    assert.equal(focus, "uriel", "Opening region help preserves the selected item")
    assert.equal(opened, undefined)
    await act(async () => terminalHelp.click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(focus, "uriel", "Closing region help preserves the selected item")
    await act(async () => {
      terminalHelp.focus()
      terminalHelp.click()
    })
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.activeElement, terminalHelp)
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(focus, "uriel", "Escape closes region help without clearing the selected item")
    const externalHelp = external.querySelector<HTMLButtonElement>('[aria-label="Giải thích vùng thuộc tính Thủ"]')!
    await act(async () => externalHelp.click())
    const externalExplanation = document.querySelector('[role="dialog"]')!
    assert.ok(externalExplanation)
    assert.match(externalExplanation.textContent!, /thuộc nhóm Thủ/i)
    assert.match(externalExplanation.textContent!, /quan hệ ghép với Gươm Uriel/)
    assert.equal(focus, "uriel")
    await act(async () => externalHelp.click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    await act(async () =>
      external.querySelector<HTMLButtonElement>('[aria-label="Chọn trang bị Găng giác đấu"]')!.click(),
    )
    assert.equal(focus, "gloves")
    assert.equal(opened, undefined)
    await act(async () => terminal.querySelector<HTMLButtonElement>('[aria-label="Xem trang bị Gươm Uriel"]')!.click())
    assert.equal(opened, "uriel")
    assert.deepEqual(items, original)
    const magic = [
      make("orb", "Cầu chiêm tinh", 2, "magic", 1, 8),
      make("penetration", "Xuyên tâm lệnh", 3, "magic", 1, 9),
      make("emerald", "Dây chuyền lục bảo", 3, "magic", 1, 7),
      make("burst", "Trượng bùng nổ", 3, "magic", 2, 0, [{ itemId: "orb", quantity: 1 }]),
    ]
    await render(
      <ItemShopGraph
        items={magic}
        categories={[]}
        locale="vi-VN"
        selectedId="orb"
        category="magic"
        onCategory={() => {}}
        onSelect={() => {}}
        onFocus={() => {}}
        onConnect={() => {}}
        onMove={() => {}}
        editable
      />,
    )
    const secondColumn = document.querySelector('[aria-label="Cột 2"]')!
    assert.deepEqual(
      [...secondColumn.querySelectorAll("[data-item-node]")].map((node) => node.getAttribute("data-item-node")),
      ["emerald", "orb", "penetration"],
    )
    const orb = secondColumn.querySelector('[data-item-node="orb"]')!
    assert.equal(orb.closest('[aria-label^="Trang bị hoàn chỉnh"]'), null)
    assert.ok(orb.querySelector('[aria-label="Nâng cấp từ Cầu chiêm tinh"]'))
    assert.equal(secondColumn.querySelectorAll('[aria-label^="Trang bị hoàn chỉnh"]').length, 2)
  })
})
