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
import { mediaPath } from "../../../tooling/media-proxy"
import { wikiRequest, WikiError, wikiErrorMessage } from "../../aov-wiki/src/features/heroes/wiki-api"

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

test("wiki uses public revalidation, carries structured context errors, and never sends credentials", async () => {
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.cache, "no-cache")
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).get("Authorization"), null)
    return Response.json({ code: "PATCH_CONTEXT_UNAVAILABLE", requestId: "trace" }, { status: 422 })
  }) as typeof fetch
  await assert.rejects(
    wikiRequest("/heroes?region=VN&locale=vi-VN", undefined, fetcher),
    (error) =>
      error instanceof WikiError &&
      error.requestId === "trace" &&
      wikiErrorMessage(error).includes("chưa có dữ liệu patch"),
  )
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
