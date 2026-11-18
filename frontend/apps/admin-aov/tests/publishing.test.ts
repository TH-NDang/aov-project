import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createPublishingApi,
  uploadHeroImage,
  upgradeHeroImage,
  type Request,
} from "../src/features/publishing/api/publishing-api"
import { contentBlockers, publicationPatchIssue } from "../src/features/publishing/model/publish-rules"
import type { Revision } from "../src/features/publishing/api/types"
import { observedAttributes } from "../src/features/publishing/model/assessment/combat-attributes"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import { mediaPath } from "../../../tooling/media-proxy.mts"
import { withGlobals } from "./fixtures/dom"

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

test("publication requires the revision's own patch to be published in its ruleset, independently of market scheduling", () => {
  const revision = { ...fixtureRevision, effectiveFromPatchVariantId: "october-patch" }
  const patch = { rulesetId: revision.rulesetId, patchCode: "2026-10-30", status: "DRAFT" }
  assert.match(publicationPatchIssue(revision, patch, false) ?? "", /xuất bản patch 2026-10-30/)
  assert.equal(publicationPatchIssue(revision, { ...patch, status: "PUBLISHED" }, false), null)
  assert.ok(publicationPatchIssue(revision, { ...patch, rulesetId: "other", status: "PUBLISHED" }, false))
  assert.ok(publicationPatchIssue(revision, undefined, true))
  assert.ok(publicationPatchIssue(revision, undefined, false))
  assert.ok(publicationPatchIssue(fixtureRevision, undefined, false))
  assert.equal(publicationPatchIssue({ ...fixtureRevision, cause: "TRANSLATION" }, undefined, false), null)
})

test("publication accepts observed stats from the revision patch without a base stat or a known hero level", () => {
  const content = structuredClone(fixtureContent)
  content.COMBAT_STATS!.values = []
  content.MEDIA_BINDINGS!.bindings = { HEAD: "head", PORTRAIT: "portrait", SPLASH: "splash" }
  const observation = {
    method: "MANUAL_VISUAL_TRANSCRIPTION",
    scope: "DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE",
    heroLevel: null,
    values: {} as Record<string, unknown>,
  }
  content.SKILLS!.skills[0].effects.push({
    effectType: "SOURCE_SNAPSHOT",
    metadata: { patchCode: "s4", observedAttributes: observation },
  })
  const issues = (patch: string) => contentBlockers(content, !!observedAttributes(content.SKILLS, patch))
  for (const values of [{}, { resourceLabel: "Năng lượng" }, { health: "?" }]) {
    observation.values = values
    assert.equal(issues("s4").length, 1)
  }
  observation.values = { magicAttack: 0 }
  assert.deepEqual(issues("s4"), [])
  assert.equal(issues("s3").length, 1)
  assert.deepEqual(content.COMBAT_STATS!.values, [])
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
  const { imageFromUrl } = await import("../src/features/publishing/model/import/image-url")
  let respond: typeof fetch = async (_url, init) => {
    assert.equal(init?.credentials, "omit")
    assert.equal(init?.redirect, "error")
    assert.equal(init?.referrerPolicy, "no-referrer")
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
  }
  const fetch: typeof globalThis.fetch = (input, init) => respond(input, init)
  await withGlobals({ fetch }, async () => {
    const file = await imageFromUrl("https://images.example.org/hero.png")
    assert.equal(file.type, "image/png")
    assert.equal(file.size, 3)
    await assert.rejects(imageFromUrl("http://images.example.org/hero.png"), /HTTPS/)
    await assert.rejects(imageFromUrl("https://user:password@images.example.org/hero.png"), /mật khẩu/)
    respond = async () => new Response("not an image", { headers: { "content-type": "text/html" } })
    await assert.rejects(imageFromUrl("https://images.example.org/page"), /PNG/)
  })
})
