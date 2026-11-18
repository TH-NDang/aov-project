import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import type { AssetDetail, AssetProvenance } from "../src/features/publishing/api/types"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("hero image sources share the image request and retain current provenance, safe links and missing states", async () => {
  const dom = createWindow("http://localhost/publishing/fixture-hero")
  const fixture = createHeroFixture()
  const requests: string[] = []
  const source = (id: string, overrides: Partial<AssetProvenance> = {}): AssetProvenance => ({
    id,
    versionId: null,
    type: "OFFICIAL",
    label: "Ảnh chính thức",
    url: "https://source.test/hero",
    observedAt: null,
    note: "Tệp gốc trong bộ dữ liệu.\nGiữ nguyên ảnh.",
    ...overrides,
  })
  const asset = {
    id: "head",
    semanticType: "HERO_HEAD",
    state: "ACTIVE",
    version: 2,
    currentVersionId: "v2",
    currentUrl: "/media/head.webp",
    versions: [{ id: "v2", url: "/media/head.webp" }],
    provenance: [
      source("common"),
      source("duplicate"),
      source("current", { versionId: "v2", label: "Bản đang dùng", note: "Đã đối chiếu ảnh head." }),
      source("old", { versionId: "v1", label: "Nguồn phiên bản cũ" }),
      source("unsafe", { label: "Nguồn thủ công", url: "javascript:alert(1)", note: "Không có URL hợp lệ." }),
      source("credentials", {
        label: "Không mở liên kết có thông tin đăng nhập",
        url: "https://name:secret@source.test/hero",
        note: null,
      }),
    ],
  }
  let restoreGlobals = () => {}
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input), "http://localhost").pathname
    if (path.includes("/admin/media/assets/")) {
      requests.push(path)
      if (path.endsWith("/broken")) return Response.json({ detail: "Unavailable" }, { status: 503 })
      if (path.endsWith("/empty")) return Response.json({ ...asset, id: "empty", provenance: [] })
      return Response.json(asset)
    }
    return fixture.fetcher(input, init)
  }
  restoreGlobals = installWindow(dom.window, {
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroImageSource, currentImageSources } =
    await import("../src/features/publishing/components/assets/hero-image-source")
  const { HeroAsset } = await import("../src/features/publishing/components/editing/hero-asset")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const render = async (id?: string) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HeroAsset id={id} />
          <HeroImageSource assetId={id} />
        </QueryClientProvider>,
      ),
    )

  try {
    assert.deepEqual(
      currentImageSources(asset as AssetDetail).map((item) => item.id),
      ["current"],
    )
    await verifySession()
    await render()
    assert.equal(requests.length, 0)
    assert.equal(document.querySelector('[aria-label="Nguồn ảnh"]'), null)
    await render("head")
    await waitFor(() => document.body.textContent!.includes("Đã đối chiếu ảnh head."))
    assert.equal(requests.length, 1)
    assert.equal(document.querySelector("img")!.getAttribute("src"), "/media/head.webp")
    assert.equal(document.querySelectorAll("li").length, 1)
    assert.doesNotMatch(document.body.textContent!, /Nguồn phiên bản cũ/)
    assert.equal(document.querySelectorAll("a").length, 1)
    assert.ok(
      [...document.querySelectorAll("a")].every((link) => link.getAttribute("href") === "https://source.test/hero"),
    )
    assert.doesNotMatch(document.body.textContent!, /Tệp gốc trong bộ dữ liệu/)
    await render("empty")
    await waitFor(() => document.body.textContent!.includes("Chưa ghi nhận nguồn cho ảnh này."))
    await render("broken")
    await waitFor(() => document.body.textContent!.includes("Chưa tải được nguồn ảnh."))
    assert.ok(
      [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Tải lại nguồn ảnh")),
    )
    assert.equal(fixture.writes.length, 0)
  } finally {
    await act(async () => root.unmount())
    await logout()
    client.clear()
    dom.window.close()
    restoreGlobals()
  }
})
