import assert from "node:assert/strict"
import { test } from "node:test"
import { ApiError } from "../src/lib/api/errors"
import { createAssetLoader } from "../src/features/publishing/model/assets/asset-loader"
import { createPublishingApi } from "@/lib/api/publishing-api"
import type { AssetDetail } from "@/lib/hero-types"

const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
const asset = (id: string) => ({ id, currentUrl: `/media/${id}.webp` }) as AssetDetail

function reader({ unknown = [] as string[], failure = null as Error | null } = {}) {
  const singles: string[] = []
  const batches: string[][] = []
  return {
    singles,
    batches,
    read: {
      asset: async (id: string) => {
        singles.push(id)
        if (failure) throw failure
        return asset(id)
      },
      assetsById: async (ids: readonly string[]) => {
        batches.push([...ids])
        if (failure) throw failure
        return ids.filter((id) => !unknown.includes(id)).map(asset)
      },
    },
  }
}

test("ids asked for together share one request and each caller gets its own asset", async () => {
  const { read, singles, batches } = reader()
  const load = createAssetLoader(read)

  const [first, second, again] = await Promise.all([load(uuid(1)), load(uuid(2)), load(uuid(1))])

  assert.equal(first.id, uuid(1))
  assert.equal(second.id, uuid(2))
  assert.equal(again.id, uuid(1))
  assert.deepEqual(batches, [[uuid(1), uuid(2)]], "A repeated id is requested once")
  assert.deepEqual(singles, [])
})

test("a lone id keeps the plain read", async () => {
  const { read, singles, batches } = reader()

  await createAssetLoader(read)(uuid(1))

  assert.deepEqual(singles, [uuid(1)])
  assert.deepEqual(batches, [])
})

test("an id asked for after the request left starts a new one, so it cannot receive older data", async () => {
  const { read, batches } = reader()
  const load = createAssetLoader(read)

  await Promise.all([load(uuid(1)), load(uuid(2))])
  await Promise.all([load(uuid(1)), load(uuid(3))])

  assert.deepEqual(batches, [
    [uuid(1), uuid(2)],
    [uuid(1), uuid(3)],
  ])
})

test("an unknown id fails alone, as its own read would", async () => {
  const { read } = reader({ unknown: [uuid(2)] })
  const load = createAssetLoader(read)

  const [known, unknown] = await Promise.allSettled([load(uuid(1)), load(uuid(2))])

  assert.equal(known.status === "fulfilled" && known.value.id, uuid(1))
  assert.ok(unknown.status === "rejected" && unknown.reason instanceof ApiError)
  assert.equal(unknown.reason.status, 404)
  assert.equal(unknown.reason.code, "MEDIA_ASSET_NOT_FOUND")
})

test("a failed request fails every image that was waiting on it", async () => {
  const failure = new Error("offline")
  const { read } = reader({ failure })
  const load = createAssetLoader(read)

  const results = await Promise.allSettled([load(uuid(1)), load(uuid(2)), load(uuid(1))])

  assert.deepEqual(
    results.map((result) => result.status === "rejected" && result.reason),
    [failure, failure, failure],
  )
})

test("more ids than one request may carry are split", async () => {
  const { read, batches } = reader()
  const load = createAssetLoader(read)
  const ids = Array.from({ length: 205 }, (_, index) => uuid(index))

  const assets = await Promise.all(ids.map(load))

  assert.deepEqual(
    batches.map((batch) => batch.length),
    [100, 100, 5],
  )
  assert.deepEqual(
    assets.map((found) => found.id),
    ids,
  )
})

test("a malformed id reads alone instead of failing the images requested with it", async () => {
  const { read, singles, batches } = reader()
  const load = createAssetLoader(read)

  await Promise.all([load(uuid(1)), load("not-a-uuid"), load(uuid(2))])

  assert.deepEqual(singles, ["not-a-uuid"])
  assert.deepEqual(batches, [[uuid(1), uuid(2)]])
})

test("the batch read asks once for all ids and projects each asset like the single read", async () => {
  const paths: string[] = []
  const detail = (id: string) => ({
    id,
    currentVersionId: `${id}-v2`,
    versions: [
      { id: `${id}-v2`, url: `/media/${id}/2.webp` },
      { id: `${id}-v1`, url: `/media/${id}/1.webp` },
    ],
  })
  const api = createPublishingApi((async (path: string) => {
    paths.push(path)
    return path.includes("batch") ? { items: [detail("a"), detail("b")] } : detail("a")
  }) as never)

  const [first, second] = await api.assetsById(["a", "b"])

  assert.deepEqual(paths, ["/admin/media/assets/batch?ids=a,b"])
  assert.equal(first.currentUrl, "/media/a/2.webp")
  assert.equal(second.currentUrl, "/media/b/2.webp")
  assert.deepEqual(first.provenance, [])
  assert.deepEqual(first, await api.asset("a"))
})
