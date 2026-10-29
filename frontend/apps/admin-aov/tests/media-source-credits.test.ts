import assert from "node:assert/strict"
import { test } from "node:test"
import { buildResourceMediaSources, findResourceMediaSource } from "../../../packages/ui/src/lib/resource-media-sources"
import { creditHttpUrl, currentMediaSources, needsMediaCredit } from "../../../packages/ui/src/lib/media-credit"
import { uploadHeroImage, upgradeHeroImage, type Request } from "../src/features/publishing/publishing-api"

test("source resolution follows exact bytes, including renamed files, and preserves derived artwork", () => {
  const index = buildResourceMediaSources({
    "danh-sach-anh.json": [
      {
        file: "assets/head/a.png",
        sha256: "a",
        url: "https://cdn.example/a.png",
        page: "https://lienquan.garena.vn/a",
      },
    ],
    "phu-hieu.json": {
      groups: [
        {
          icon: {
            file: "assets/icon.png",
            sha256: "b",
            sourceUrl: "https://lienquan.garena.vn/icon.png",
            derived: true,
            method: "ai-reconstruction",
          },
        },
      ],
    },
  })
  assert.equal(findResourceMediaSource(index, "assets/renamed.png", "a").type, "OFFICIAL")
  assert.equal(findResourceMediaSource(index, "assets/head/a.png", "changed").label, "Chưa xác minh nguồn")
  assert.equal(findResourceMediaSource(index, "assets/icon.png", "b").type, "OTHER")
  assert.equal(findResourceMediaSource(index, "assets/icon.png", "b").ownerName, null)
})

test("an explicitly unknown collection date never inherits the dataset date", () => {
  const index = buildResourceMediaSources({
    "phu-tro.json": {
      collectedOn: "2026-10-10",
      items: [{ file: "assets/old.webp", sha256: "c", sourceType: "provided-zip", collectedOn: null }],
    },
  })
  assert.match(index[0].source.label, /phu-tro.zip/)
  assert.doesNotMatch(index[0].source.note!, /2026-10-10/)
  assert.equal(index[0].source.url, null)
  assert.equal(index[0].source.type, "GAME_CLIENT")
  assert.equal(index[0].source.ownerName, "Garena / Liên Quân Mobile")
})

test("upload and replacement carry their own credit without passing API credentials to storage", async () => {
  const bodies: Record<string, unknown>[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"))
    if (path.endsWith("/assets")) {
      bodies.push(body)
      return { id: "asset" } as T
    }
    if (path.endsWith("/version-uploads")) {
      bodies.push(body)
      return { uploadId: "upload", uploadUrl: "https://storage.test/image", method: "PUT", headers: {} } as T
    }
    if (path.endsWith("/complete")) return { assetId: "asset", versionId: "version", current: true } as T
    throw new Error(path)
  }
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).has("Authorization"), false)
    return new Response(null, { status: 200 })
  }) as typeof fetch
  const file = new File(["image"], "image.png", { type: "image/png" })
  const original = { type: "GAME_CLIENT", label: "Ảnh chụp Liên Quân", ownerName: "Garena" }
  const replacement = { ...original, label: "Ảnh thay thế", contactUrl: "https://source.test/contact" }
  await uploadHeroImage(request, file, "HERO_HEAD", original, fetcher)
  await upgradeHeroImage(request, "asset", file, fetcher, replacement)
  assert.deepEqual(
    bodies.map((body) => body.source),
    [original, original, replacement],
  )
})

test("current version credits override legacy sources and unsafe contact links are inert", () => {
  assert.deepEqual(
    currentMediaSources(
      [
        { label: "legacy", versionId: null },
        { label: "old", versionId: "v1" },
        { label: "new", versionId: "v2" },
      ],
      "v2",
    ).map((source) => source.label),
    ["new"],
  )
  assert.equal(creditHttpUrl("javascript:alert(1)"), undefined)
  assert.equal(creditHttpUrl("https://name:secret@example.com"), undefined)
  assert.equal(creditHttpUrl("https://example.com/contact"), "https://example.com/contact")
})

test("missing credits stay visible while confirmed game captures do not require a fabricated URL", () => {
  assert.equal(needsMediaCredit([]), true)
  assert.equal(needsMediaCredit([{ label: "Logo đội tuyển", url: "https://example.com/logo.png" }]), true)
  assert.equal(needsMediaCredit([{ label: "Ảnh chụp Liên Quân", ownerName: "Garena", url: null }]), false)
  assert.equal(needsMediaCredit([{ label: "Chưa xác minh nguồn", ownerName: "Garena" }]), true)
  assert.equal(
    needsMediaCredit([{ label: "Chưa xác minh nguồn" }, { label: "Ảnh chụp Liên Quân", ownerName: "Garena" }]),
    false,
  )
})
