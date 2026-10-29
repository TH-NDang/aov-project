import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import {
  createPublishingApi,
  uploadHeroImage,
  upgradeHeroImage,
  type Request,
} from "../src/features/publishing/publishing-api"
import { resourceContent } from "../src/features/publishing/resource-import"
import { publishIssues, type Content, type Revision } from "../src/features/publishing/types"
import type { Hero } from "../src/lib/api/types"
import { mediaPath } from "../../../tooling/media-proxy.mts"

test("admin preview maps backend section keys and retains imported head bindings", async () => {
  const profile = { roles: [], translations: [{ locale: "vi-VN", name: "Airi" }], sources: [] }
  const bindings = { bindings: { HEAD: "head-asset", PORTRAIT: "portrait-asset", SPLASH: "splash-asset" }, sources: [] }
  const api = createPublishingApi(
    async <T>() =>
      ({
        revision: { id: "revision", sections: { profile: "profile-section", mediaBindings: "media-section" } },
        content: {
          profile,
          mediaBindings: bindings,
          skills: { skills: [{ skillKey: "s1", iconAssetId: "skill-asset" }], sources: [] },
          skins: { skins: [{ skinKey: "skin1", artAssetId: "skin-asset" }], sources: [] },
        },
      }) as T,
  )
  const preview = await api.read("hero", "revision")
  assert.equal(preview.content.MEDIA_BINDINGS?.bindings.HEAD, "head-asset")
  assert.deepEqual(preview.content.PROFILE, profile)
  assert.equal(preview.revision.sections.MEDIA_BINDINGS, "media-section")
  assert.equal(preview.content.SKILLS?.skills[0].iconAssetId, "skill-asset")
  assert.equal(preview.content.SKINS?.skins[0].artAssetId, "skin-asset")
  assert.equal(preview.content.COMBAT_STATS, null)
})

test("asset detail resolves the active version URL rather than assuming a list response", async () => {
  const detail = {
    id: "skin",
    semanticType: "HERO_SKIN_ART",
    state: "ACTIVE",
    version: 3,
    currentVersionId: "v2",
    versions: [
      { id: "v1", url: "https://media.test/old.webp" },
      { id: "v2", url: "https://media.test/current.webp" },
    ],
    provenance: [
      {
        id: "source",
        versionId: "v2",
        type: "OFFICIAL",
        label: "Official art",
        url: "https://source.test/art",
        observedAt: null,
        note: "Original source",
      },
    ],
  }
  const api = createPublishingApi(async <T>() => detail as T)
  assert.equal((await api.asset("skin")).currentUrl, "https://media.test/current.webp")
  assert.deepEqual((await api.asset("skin")).provenance, detail.provenance)
  detail.currentVersionId = "missing"
  assert.equal((await api.asset("skin")).currentUrl, null)
})

test("section replacement matches the strict backend request and uses the latest draft version", async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, body: JSON.parse(String(init?.body)) })
    return { version: 8 } as T
  }
  const api = createPublishingApi(request)
  const revision = { heroId: "hero", id: "draft", version: 7 } as Revision
  await api.save(revision, "SKINS", { skins: [], sources: [] }, "Reviewed")
  assert.equal(calls[0].path, "/admin/heroes/hero/drafts/draft/skins")
  assert.deepEqual(calls[0].body, { expectedDraftVersion: 7, skins: [], sources: [], changeNote: "Reviewed" })
  await api.publish({ ...revision, version: 8 }, "Ready")
  assert.equal(calls[1].body.expectedVersion, 8)
})

test("upload sends bytes to storage without bearer credentials and completes before binding", async () => {
  const calls: string[] = []
  const request: Request = async <T>(path: string) => {
    calls.push(path)
    if (path.endsWith("/assets")) return { id: "asset" } as T
    if (path.endsWith("/version-uploads"))
      return {
        uploadId: "upload",
        method: "PUT",
        uploadUrl: "https://storage.example/incoming/upload",
        headers: { "Content-Type": "image/png" },
      } as T
    return { assetId: "asset", current: true } as T
  }
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).get("Authorization"), null)
    assert.equal(init?.redirect, "error")
    assert.ok(init?.body instanceof File)
    return new Response(null, { status: 200 })
  }) as typeof fetch
  assert.equal(
    await uploadHeroImage(
      request,
      new File(["png-fixture"], "a.png", { type: "image/png" }),
      "HERO_HEAD",
      { label: "Fixture", url: null, note: null },
      fetcher,
    ),
    "asset",
  )
  assert.deepEqual(calls, [
    "/admin/media/assets",
    "/admin/media/assets/asset/version-uploads",
    "/admin/media/uploads/upload/complete",
  ])
})

test("failed storage upload never completes or binds an asset", async () => {
  const paths: string[] = []
  const request: Request = async <T>(path: string) => {
    paths.push(path)
    return (
      path.endsWith("/assets")
        ? { id: "asset" }
        : { method: "PUT", uploadUrl: "https://storage.example/incoming/id", headers: {} }
    ) as T
  }
  await assert.rejects(
    uploadHeroImage(
      request,
      new File(["image"], "a.png", { type: "image/png" }),
      "HERO_HEAD",
      { label: "Fixture", url: null, note: null },
      (async () => new Response(null, { status: 403 })) as typeof fetch,
    ),
  )
  assert.equal(paths.length, 2)
})

test("Nakroth resource import preserves sources and missing descriptions instead of inventing gameplay data", () => {
  const raw = JSON.parse(
    readFileSync(new URL("../../../../resources/Lien-Quan-v3/data/heroes.json", import.meta.url), "utf8"),
  ) as { heroes: Hero[] }
  const nakroth = raw.heroes.find((hero) => hero.id === "nakroth")!
  const content = resourceContent(nakroth, "vi-VN")
  assert.equal(content.PROFILE!.translations[0].name, "Nakroth")
  assert.ok(content.SKILLS!.skills.some((skill) => skill.translations[0].description === ""))
  assert.equal(content.PROFILE!.sources[0].sourceUrl, nakroth.sources.portraits)
  assert.equal(content.PROFILE!.sources[0].verificationState, "UNVERIFIED")
  assert.equal(content.SKINS!.skins.length, nakroth.skins.filter((skin) => !skin.isDefault).length)
  assert.equal("COMBAT_STATS" in content, false)
  assert.ok(
    publishIssues({ ...content, OVERVIEW_RATINGS: null, COMBAT_STATS: null, MEDIA_BINDINGS: null } as Content).length >=
      3,
  )
})

test("local media proxy exposes only validated asset file paths", () => {
  const id = "11111111-1111-4111-8111-111111111111"
  assert.equal(mediaPath(`/media/${id}/${id}.png`, "wiki-media"), `/buckets/wiki-media/assets/${id}/${id}.png`)
  for (const path of ["/media/incoming/secret", "/media/../imports/a", "/media/", "/media/%2e%2e/key"])
    assert.equal(mediaPath(path, "wiki-media"), "/__invalid_public_asset__")
})

test("quality upgrades activate an asset version without changing hero content", async () => {
  const calls: { path: string; body: Record<string, unknown> | null }[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (path.endsWith("/version-uploads"))
      return { uploadId: "up", method: "PUT", uploadUrl: "https://storage.example/incoming/up", headers: {} } as T
    if (path.endsWith("/complete")) return { versionId: "v2", current: false } as T
    return { version: 12 } as T
  }
  await upgradeHeroImage(
    request,
    "asset",
    new File(["png"], "new.png", { type: "image/png" }),
    (async () => new Response(null, { status: 200 })) as typeof fetch,
  )
  assert.equal(calls.at(-1)?.path, "/admin/media/assets/asset/versions/v2/activate")
  assert.deepEqual(calls.at(-1)?.body, { expectedVersion: 12 })
  assert.ok(calls.every((call) => !call.path.includes("/heroes")))
})

test("image URL download omits credentials and rejects non-image responses", async () => {
  const { imageFromUrl } = await import("../src/features/publishing/image-url")
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.credentials, "omit")
      assert.equal(init?.redirect, "error")
      assert.equal(init?.referrerPolicy, "no-referrer")
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
    }
    const file = await imageFromUrl("https://images.example.org/hero.png")
    assert.equal(file.type, "image/png")
    assert.equal(file.size, 3)
    await assert.rejects(imageFromUrl("http://images.example.org/hero.png"), /HTTPS/)
    await assert.rejects(imageFromUrl("https://user:password@images.example.org/hero.png"), /mật khẩu/)
    globalThis.fetch = async () => new Response("not an image", { headers: { "content-type": "text/html" } })
    await assert.rejects(imageFromUrl("https://images.example.org/page"), /PNG/)
  } finally {
    globalThis.fetch = original
  }
})
