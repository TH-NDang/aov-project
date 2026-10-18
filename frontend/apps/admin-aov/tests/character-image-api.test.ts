import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { invalidateHeroCatalogs } from "../src/features/publishing/publishing-cache"
import {
  characterImageKeys,
  createCharacterImageApi,
  imageSectionChange,
} from "../src/features/media/character-image-api"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"

test("hero mutations invalidate every cached media role and badge locale without unrelated queries", async () => {
  const cache = new QueryClient()
  const keys = [
    ["publishing-heroes", "infinite"],
    characterImageKeys.list("rule", "HEAD", "vi-VN", ""),
    characterImageKeys.list("rule", "PORTRAIT", "en-US", "airi"),
    characterImageKeys.badgeList("rule", "en-US", ""),
    characterImageKeys.badgeSkins("badge", "rule", "vi-VN"),
    ["skin-badges", "selected", "en-US", "ss"],
  ]
  for (const key of keys) cache.setQueryData(key, {})
  cache.setQueryData(["unrelated"], {})
  await invalidateHeroCatalogs(cache)
  for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, true)
  assert.equal(cache.getQueryState(["unrelated"])?.isInvalidated, false)
  cache.clear()
})

test("main image selection retains alternate labels, implicit old main, other roles, sources and translations", () => {
  const content = structuredClone(fixtureContent)
  content.MEDIA_BINDINGS = {
    bindings: { HEAD: "old-head", PORTRAIT: "portrait" },
    images: {
      HEAD: [{ assetId: "alternate", label: "airi-head-2.png" }],
      PORTRAIT: [{ assetId: "portrait", label: "portrait-1.png" }],
    },
    sources: [{ label: "Fixture", sourceUrl: null, observedAt: null, verificationState: "VERIFIED", note: null }],
  }
  const original = structuredClone(content)
  const updated = imageSectionChange(
    { revision: fixtureRevision, content },
    { ownerType: "HERO", skinKey: null },
    "HEAD",
    "alternate",
    null,
    true,
  )
  assert.equal(updated.section, "MEDIA_BINDINGS")
  if (updated.section !== "MEDIA_BINDINGS") return
  assert.deepEqual(updated.value.bindings, { HEAD: "alternate", PORTRAIT: "portrait" })
  assert.deepEqual(updated.value.images?.HEAD, [
    { assetId: "alternate", label: "airi-head-2.png" },
    { assetId: "old-head", label: null },
  ])
  assert.deepEqual(updated.value.images?.PORTRAIT, original.MEDIA_BINDINGS!.images?.PORTRAIT)
  assert.deepEqual(updated.value.sources, original.MEDIA_BINDINGS!.sources)
  assert.deepEqual(content, original)
  const added = imageSectionChange(
    { revision: fixtureRevision, content },
    { ownerType: "HERO", skinKey: null },
    "HEAD",
    "third",
    "head-3.png",
    false,
  )
  if (added.section !== "MEDIA_BINDINGS") return
  assert.equal(added.value.bindings.HEAD, "old-head")
  assert.equal(added.value.images?.HEAD?.at(-1)?.label, "head-3.png")
})

test("skin image role selection preserves cover, localized metadata, sources and unrelated skins", () => {
  const content = structuredClone(fixtureContent)
  const skin = content.SKINS!.skins[0]
  skin.artAssetId = "cover"
  skin.portraitAssetId = "old-portrait"
  skin.images = {
    PORTRAIT: [{ assetId: "new-portrait", label: "default-portrait-2.png" }],
    SPLASH: [{ assetId: "cover", label: "cover.jpg" }],
  }
  skin.translations.push({ locale: "en-US", name: "Default", description: "Keep", acquisitionNote: null })
  content.SKINS!.skins.push({ ...structuredClone(skin), skinKey: "other" })
  const before = structuredClone(content)
  const changed = imageSectionChange(
    { revision: fixtureRevision, content },
    { ownerType: "SKIN", skinKey: "default" },
    "PORTRAIT",
    "new-portrait",
    null,
    true,
  )
  if (changed.section !== "SKINS") return assert.fail("Expected skin section")
  assert.equal(changed.value.skins[0].portraitAssetId, "new-portrait")
  assert.equal(changed.value.skins[0].artAssetId, "cover")
  assert.deepEqual(changed.value.skins[0].images?.PORTRAIT, [
    { assetId: "new-portrait", label: "default-portrait-2.png" },
    { assetId: "old-portrait", label: null },
  ])
  assert.deepEqual(changed.value.skins[0].translations, before.SKINS!.skins[0].translations)
  assert.deepEqual(changed.value.skins[1], before.SKINS!.skins[1])
  assert.deepEqual(content, before)
  assert.throws(
    () =>
      imageSectionChange(
        { revision: fixtureRevision, content },
        { ownerType: "SKIN", skinKey: "missing" },
        "HEAD",
        "id",
        null,
        true,
      ),
    /no longer exists/,
  )
})

test("media APIs scope search and page server-side, and badge writes send full translations plus expected version", async () => {
  const calls: { path: string; init?: RequestInit }[] = []
  const api = createCharacterImageApi(async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return {} as T
  })
  const abort = new AbortController()
  await api.groups("rule", "PORTRAIT", "en-US", " airi ", 2, abort.signal)
  assert.match(calls[0].path, /^\/admin\/hero-media\?/)
  const url = new URL(calls[0].path, "http://fixture")
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    rulesetId: "rule",
    role: "PORTRAIT",
    locale: "en-US",
    q: "airi",
    page: "2",
    size: "20",
  })
  assert.equal(calls[0].init?.signal, abort.signal)
  assert.notDeepEqual(
    characterImageKeys.list("rule", "HEAD", "vi-VN", ""),
    characterImageKeys.list("rule", "PORTRAIT", "vi-VN", ""),
  )
  assert.notDeepEqual(
    characterImageKeys.badgeList("rule", "en-US", ""),
    characterImageKeys.badgeList("rule", "vi-VN", ""),
  )
  const translations = [
    { locale: "vi-VN", displayName: "Hữu hạn", iconAssetId: "vn-icon" },
    { locale: "en-US", displayName: "Limited", iconAssetId: null },
  ]
  await api.saveBadge({ kind: "EVENT", translations }, { id: "badge", version: 7 } as never)
  assert.equal(calls[1].path, "/admin/skin-badges/badge")
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { expectedVersion: 7, kind: "EVENT", translations })
})
