import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import { characterMediaOwners, ownerMainEntry } from "../src/features/media/model/character-image-viewer-data"
import type { Request } from "@/lib/api/publishing-api"
import type { CharacterImageEntry, CharacterImageGroup } from "../src/features/media/api/character-image-api"
import type { Preview } from "@/lib/hero-types"
import { createWindow, flush, installWindow, waitFor } from "./fixtures/dom"

function viewerFixture(): Preview {
  const content = structuredClone(fixtureContent)
  content.MEDIA_BINDINGS = {
    bindings: { HEAD: "hero-head", PORTRAIT: "hero-portrait", SPLASH: "hero-cover" },
    images: {
      PORTRAIT: [
        { assetId: "hero-portrait", label: "portrait-1.png" },
        { assetId: "hero-alternate", label: "portrait-2.png" },
      ],
    },
    sources: [],
  }
  content.SKINS = {
    skins: [
      {
        skinKey: "skin-a",
        displayOrder: 1,
        headAssetId: "skin-head",
        portraitAssetId: "skin-portrait",
        artAssetId: "skin-cover",
        rarityCode: "ss",
        images: {
          HEAD: [{ assetId: "skin-head", label: "skin-head.png" }],
          PORTRAIT: [
            { assetId: "skin-portrait", label: "skin-portrait-1.png" },
            { assetId: "skin-alternate", label: "skin-portrait-2.png" },
          ],
        },
        translations: [{ locale: "vi-VN", name: "Trang phục A", description: null, acquisitionNote: null }],
      },
      {
        skinKey: "skin-b",
        displayOrder: 2,
        headAssetId: "b-head",
        portraitAssetId: null,
        artAssetId: "b-cover",
        rarityCode: null,
        images: { PORTRAIT: [{ assetId: "b-alternate", label: "b-2.png" }] },
        translations: [{ locale: "vi-VN", name: "Trang phục B", description: null, acquisitionNote: null }],
      },
    ],
    sources: [],
  }
  return { revision: { ...fixtureRevision, version: 7 }, content }
}

test("secondary media entries expose only explicit primary bindings and keep missing roles empty", () => {
  const preview = viewerFixture()
  const before = structuredClone(preview)
  const owners = characterMediaOwners(preview, "vi-VN", "airi")
  assert.equal(owners.length, 3)
  assert.deepEqual(
    owners.map((owner) => ownerMainEntry(owner, "PORTRAIT").assetId),
    ["hero-portrait", "skin-portrait", null],
  )
  assert.equal(ownerMainEntry(owners[1], "PORTRAIT").label, "skin-portrait-1.png")
  assert.equal(ownerMainEntry(owners[2], "PORTRAIT").main, true)
  assert.deepEqual(preview, before)
})

test("one-preview media viewer preserves clicked alternatives, switches only mains, protects candidates and opens skins in place", async () => {
  const dom = createWindow("http://localhost/hero/media")
  let wide = true
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  const preview = viewerFixture()
  let published = false
  let reads = 0
  let closed = 0
  const writes: { path: string; body: Record<string, unknown> }[] = []
  const badgeReads: string[] = []
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (path === `/admin/heroes/${fixtureRevision.heroId}/revisions/${fixtureRevision.id}`) {
      reads++
      return { ...preview, revision: { ...preview.revision, state: published ? "PUBLISHED" : "DRAFT" } } as T
    }
    if (path.startsWith("/admin/skin-badges?")) {
      const locale = new URL(path, "http://fixture").searchParams.get("locale")
      badgeReads.push(locale!)
      return {
        items: [
          {
            id: "badge",
            code: "ss",
            kind: "RARITY",
            version: 1,
            translations: [],
            displayName: locale === "en-US" ? "Limited English" : "Bậc SS",
            iconAssetId: locale === "en-US" ? null : "badge-vn",
            actualLocale: locale,
            fallbackApplied: false,
            skinCount: 1,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      } as T
    }
    if (init?.method === "PUT") {
      writes.push({ path, body: JSON.parse(String(init.body)) })
      return { ...preview.revision, version: 8 } as T
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
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
    if (path === "/admin/media/assets")
      return Response.json({
        items: [{ id: "fresh", state: "ACTIVE", currentVersionId: "v1", currentUrl: "/fresh.webp" }],
        page: 0,
        size: 20,
        totalElements: 1,
      })
    if (path.startsWith("/admin/media/assets/")) {
      const id = path.split("/").at(-1)
      return Response.json({ id, currentVersionId: "v1", versions: [{ id: "v1", url: `/${id}.webp` }], provenance: [] })
    }
    throw new Error(`Unexpected fixture fetch: ${path}`)
  }
  restoreGlobals = installWindow(dom.window, {
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
  const { CharacterImageDetail } = await import("../src/features/media/components/characters/character-image-detail")
  const { SkinMediaDetail } = await import("../src/features/media/components/characters/skin-media-detail")
  const { SkinBadgeLabel } = await import("../src/features/media/components/badges/skin-badge-label")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const render = async (element: React.ReactNode) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>{element}</QueryClientProvider>
          <ConfirmDialogHost />
        </MemoryRouter>,
      ),
    )

  const click = async (element: Element | undefined | null) => {
    assert.ok(element)
    await act(async () => (element as HTMLElement).click())
  }
  const button = (label: string) =>
    Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.includes(label))
  const currentImage = () => document.querySelector('[aria-label="Ảnh đang xem"] img')?.getAttribute("src")
  const nav = (label: string) => document.querySelector(`button[aria-label="${label}"]`)
  const entry: CharacterImageEntry = {
    ownerType: "HERO",
    skinKey: null,
    name: "Airi",
    assetId: "hero-alternate",
    label: "portrait-2.png",
    main: false,
    rarityCode: null,
  }
  const group: CharacterImageGroup = {
    heroId: fixtureRevision.heroId,
    code: "airi",
    name: "Airi",
    actualLocale: "vi-VN",
    revision: preview.revision,
    entries: [entry],
  }
  try {
    await verifySession()
    await render(
      <CharacterImageDetail
        selected={{ group, entry }}
        role="PORTRAIT"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await waitFor(() => currentImage() === "/hero-alternate.webp")
    assert.match(document.body.textContent!, /Ảnh bổ sung/)
    for (const region of ["Loại ảnh chính của đối tượng đang xem", "Tướng và trang phục liên quan"])
      assert.ok(
        Array.from(document.querySelectorAll(`[aria-label="${region}"] img`)).every(
          (image) => !image.getAttribute("src")?.includes("alternate"),
        ),
      )
    await click(nav("Xem ảnh chính Head của Airi"))
    await waitFor(() => currentImage() === "/hero-head.webp")
    assert.equal(nav("Xem ảnh chính Head · Trang phục A"), null, "A skin has no head among the related images")
    await click(nav("Xem ảnh chính Portrait của Airi"))
    await click(nav("Xem ảnh chính Portrait · Trang phục A"))
    await waitFor(() => currentImage() === "/skin-portrait.webp")
    await click(nav("Xem ảnh chính Portrait · Trang phục B"))
    await waitFor(() => document.querySelector('[aria-label="Ảnh đang xem"] [aria-label="Chưa có ảnh"]') !== null)
    assert.equal(currentImage(), undefined)
    await click(nav("Xem ảnh chính Portrait · Trang phục A"))
    await click(nav("Xem ảnh chính Cover của Trang phục A"))
    await waitFor(() => currentImage() === "/skin-cover.webp")
    assert.equal(reads, 1, "Owner and role switches reuse the same revision preview")
    assert.equal(document.querySelectorAll('a[href^="/hero/"]').length, 1)
    await click(button("Chọn / tải ảnh"))
    await waitFor(() => nav("Chọn ảnh fresh") !== null)
    await click(nav("Chọn ảnh fresh"))
    const fullPageClick = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    await act(async () => {
      document.querySelector('a[href^="/hero/"]')!.dispatchEvent(fullPageClick)
    })
    assert.equal(
      fullPageClick.defaultPrevented,
      true,
      "Opening a full page cannot silently discard a pending candidate",
    )
    const question = () => document.querySelector('[role="alertdialog"]')
    await waitFor(() => question() !== null)
    await click(button("Ở lại chỉnh sửa"))
    await waitFor(() => question() === null)
    assert.equal(nav("Xem ảnh chính Head của Trang phục A"), null, "A skin has no head to pick any more")
    await click(nav("Xem ảnh chính Portrait của Trang phục A"))
    await waitFor(() => question() !== null)
    await click(button("Ở lại chỉnh sửa"))
    await waitFor(() => question() === null)
    assert.equal(currentImage(), "/skin-cover.webp", "Declining discard preserves owner, role and candidate")
    await click(nav("Xem ảnh chính Portrait của Trang phục A"))
    await waitFor(() => question() !== null)
    await click(button("Bỏ ảnh và chuyển"))
    await waitFor(() => currentImage() === "/skin-portrait.webp")
    assert.equal((button("Lưu vào bản nháp") as HTMLButtonElement).disabled, true)
    await click(button("Chọn / tải ảnh"))
    await waitFor(() => nav("Chọn ảnh fresh") !== null)
    await click(nav("Chọn ảnh fresh"))
    await click(document.querySelector('input[type="checkbox"]'))
    await click(button("Lưu vào bản nháp"))
    await waitFor(() => closed === 1)
    assert.match(writes[0].path, /\/skins$/)
    assert.equal(writes[0].body.expectedDraftVersion, 7)
    const saved = writes[0].body.skins as NonNullable<typeof preview.content.SKINS>["skins"]
    assert.equal(saved[0].headAssetId, "skin-head", "A stored head survives saving another image")
    assert.equal(saved[0].portraitAssetId, "fresh")
    assert.equal(saved[0].artAssetId, "skin-cover")
    assert.deepEqual(saved[0].images?.HEAD, [{ assetId: "skin-head", label: "skin-head.png" }])
    assert.deepEqual(saved[0].images?.PORTRAIT, [
      { assetId: "skin-portrait", label: "skin-portrait-1.png" },
      { assetId: "skin-alternate", label: "skin-portrait-2.png" },
      { assetId: "fresh", label: null },
    ])
    assert.deepEqual(saved[1], preview.content.SKINS!.skins[1])
    published = true
    wide = false
    await render(
      <SkinMediaDetail
        heroId={fixtureRevision.heroId}
        heroCode="airi"
        revisionId={fixtureRevision.id}
        skinKey="skin-a"
        request={request}
        onClose={() => {
          closed++
        }}
      />,
    )
    await waitFor(
      () =>
        currentImage() === "/skin-cover.webp" && document.body.textContent!.includes("Bản đã xuất bản được giữ nguyên"),
    )
    assert.ok(document.querySelector('[role="dialog"]')?.classList.contains("bottom-0"))
    assert.equal(button("Lưu vào bản nháp"), undefined)
    assert.ok(
      document.querySelector(`a[href="/hero/${fixtureRevision.heroId}?revision=${fixtureRevision.id}&tab=skins"]`),
    )
    await render(<SkinBadgeLabel code="ss" locale="en-US" request={request} />)
    await waitFor(() => document.body.textContent!.includes("Limited English"))
    assert.equal(
      document.querySelectorAll("img").length,
      0,
      "A locale without an icon cannot borrow another locale's icon",
    )
    const callsBefore = badgeReads.length
    await render(<SkinBadgeLabel code="ss" locale="vi-VN" request={request} />)
    await waitFor(() => document.body.textContent!.includes("Bậc SS"))
    assert.equal(badgeReads.length, callsBefore, "Read-only badge labels share the existing locale/code cache")
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await flush()
    dom.window.close()
    restoreGlobals()
  }
})
