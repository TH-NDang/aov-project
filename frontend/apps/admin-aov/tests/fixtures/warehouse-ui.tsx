/**
 * The warehouse sheets of the Admin tests: a signed-in editor, a fixture server for the warehouse and media routes, and
 * the helpers that fill a sheet the way a person does.
 */
import assert from "node:assert/strict"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { WarehouseRevision } from "../../src/features/warehouse/model/warehouse-types"
import { createWindow, flush, installWindow, waitFor } from "./dom"

let activeRequests: string[] = []
let removalEvents: Record<string, unknown>[] = []
let activeFetcher: typeof fetch
const fixtureFetch: typeof fetch = (...args) => activeFetcher(...args)

/** Puts `next` in front of the fixture server until the test ends; it gets the server to fall back on. */
export function interceptFetch(
  next: (input: RequestInfo | URL, init: RequestInit | undefined, server: typeof fetch) => Promise<Response>,
) {
  const server = activeFetcher
  activeFetcher = (input, init) => next(input, init, server)
}

/** Runs `run` in a fresh window signed in with `capabilities`, against the warehouse fixture server. */
export async function withWarehouseUi(
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
  const dom = createWindow("http://localhost/spells")
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const requests: string[] = []
  activeRequests = requests
  removalEvents = []
  let restoreGlobals = () => {}
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
  restoreGlobals = installWindow(dom.window, {
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: fixtureFetch,
  })
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../../src/app/auth/session")
  const { defaultSettings } = await import("../../src/features/terminology/settings-api")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(["rich-text-settings"], { settings: defaultSettings, table: null })
  const document = dom.window.document
  const findButton = (text: string) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")]
    return (
      buttons.find((button) => button.textContent?.trim() === text) ??
      buttons.find((button) => button.getAttribute("aria-label") === text)
    )
  }
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
        // New uploads must name their owner first.
        const ownerField = [...document.querySelectorAll("label")]
          .find((label) => label.textContent?.trim() === "Chủ sở hữu / tên cần ghi công")!
          .querySelector("input")!
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
            ownerField,
            "Garena / Liên Quân Mobile",
          )
          ownerField.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
        })
        const input = document.querySelector<HTMLInputElement>('input[type="file"][aria-label="Tải ảnh mới"]')!
        assert.ok(input)
        await act(async () => {
          Object.defineProperty(input, "files", { configurable: true, value: [file] })
          input.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
        })
        await waitFor(
          () =>
            document.body.textContent?.includes("Asset đã chọn: uploaded-icon") ||
            document.querySelector('[role="alert"]'),
          "The upload finishes or reports its error",
        )
      },
    })
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await flush()
    dom.window.close()
    restoreGlobals()
  }
}

/** A first draft revision of the record `id` in the standard ruleset. */
export function fixtureRevision(id: string): WarehouseRevision {
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
