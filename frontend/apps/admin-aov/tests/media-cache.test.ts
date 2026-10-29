import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { createMediaIconResolver, invalidateMediaAsset, invalidateMediaAssets } from "../src/features/media/media-cache"
import type { AssetDetail } from "../src/features/publishing/types"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"

const entity: EntityReference = {
  id: "hero",
  kind: "hero",
  iconAssetId: "head",
  translations: [{ locale: "vi-VN", name: "Airi", aliases: [] }],
}
const asset = (version: number): AssetDetail => ({
  id: "head",
  semanticType: "HERO_HEAD",
  state: "ACTIVE",
  version,
  currentVersionId: `v${version}`,
  currentUrl: `/media/v${version}.webp`,
  provenance: [],
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))

test("batch credits refresh a shared list once and invalidate every affected detail", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let reads = 0
  const observer = new QueryObserver(client, {
    queryKey: ["managed-images", "infinite", "", true],
    queryFn: async () => ++reads,
  })
  const stop = observer.subscribe(() => {})
  try {
    for (const id of ["first", "second", "unrelated"]) client.setQueryData(["managed-image", id], asset(1))
    await settle()
    assert.equal(reads, 1)
    await invalidateMediaAssets(client, ["first", "second", "first"])
    assert.equal(reads, 2)
    assert.equal(client.getQueryState(["managed-image", "first"])?.isInvalidated, true)
    assert.equal(client.getQueryState(["managed-image", "second"])?.isInvalidated, true)
    assert.equal(client.getQueryState(["managed-image", "unrelated"])?.isInvalidated, false)
  } finally {
    stop()
    client.clear()
  }
})

test("media version changes invalidate all matching details and lists without fetching unused assets", async () => {
  const client = new QueryClient()
  const matching = [
    ["publishing-asset", "head"],
    ["hero-content-asset", "head"],
    ["managed-image", "head"],
    ["profile-draft-avatar", "head"],
    ["publishing-assets", "HERO_HEAD", 0],
    ["managed-images", "", 0],
  ]
  const unrelated = [
    ["publishing-asset", "other"],
    ["hero-content-asset", "other"],
    ["publishing-preview", "hero", "revision"],
  ]
  try {
    for (const key of [...matching, ...unrelated]) client.setQueryData(key, asset(1))
    client.setQueryData(["user-profile", "me"], { avatarAssetId: "head", avatarUrl: "/media/v1.webp" })
    client.setQueryData(["user-profile", "list", "", 0], { items: [{ avatarAssetId: "head" }] })
    client.setQueryData(["user-profile", "other"], { avatarAssetId: "other" })
    await invalidateMediaAsset(client, "head")
    for (const key of matching) assert.equal(client.getQueryState(key)?.isInvalidated, true)
    for (const key of unrelated) assert.equal(client.getQueryState(key)?.isInvalidated, false)
    assert.equal(client.getQueryState(["user-profile", "me"])?.isInvalidated, true)
    assert.equal(client.getQueryState(["user-profile", "list", "", 0])?.isInvalidated, true)
    assert.equal(client.getQueryState(["user-profile", "other"])?.isInvalidated, false)
  } finally {
    client.clear()
  }
})

test("mounted reference icons share a metadata request and receive new version URLs without remounting", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let version = 1
  let reads = 0
  const resolver = createMediaIconResolver(client, async () => {
    reads++
    return asset(version)
  })
  const first: unknown[] = [],
    second: unknown[] = []
  const stopFirst = resolver.subscribe!(entity, (url) => first.push(url))
  const stopSecond = resolver.subscribe!(entity, (url) => second.push(url))
  try {
    await settle()
    assert.equal(reads, 1)
    assert.equal(first.at(-1), "/media/v1.webp")
    assert.equal(second.at(-1), "/media/v1.webp")
    version = 2
    await invalidateMediaAsset(client, "head")
    await settle()
    assert.equal(reads, 2)
    assert.equal(first.at(-1), "/media/v2.webp")
    assert.equal(second.at(-1), "/media/v2.webp")
  } finally {
    stopFirst()
    stopSecond()
    client.clear()
  }
})

test("an old in-flight metadata response cannot replace a refreshed version", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let finishOld!: (value: AssetDetail) => void
  const old = new Promise<AssetDetail>((resolve) => {
    finishOld = resolve
  })
  let reads = 0
  const resolver = createMediaIconResolver(client, () => (++reads === 1 ? old : Promise.resolve(asset(2))))
  const urls: unknown[] = []
  const stop = resolver.subscribe!(entity, (url) => urls.push(url))
  try {
    await invalidateMediaAsset(client, "head")
    finishOld(asset(1))
    await settle()
    assert.equal(client.getQueryData<AssetDetail>(["publishing-asset", "head"])?.currentUrl, "/media/v2.webp")
    assert.equal(urls.at(-1), "/media/v2.webp")
  } finally {
    stop()
    client.clear()
  }
})
