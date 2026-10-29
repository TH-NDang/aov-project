import assert from "node:assert/strict"
import { test } from "node:test"
import {
  addMediaSourcesInBulk,
  bulkSourceValidation,
  type MediaSourceTarget,
} from "../src/features/media/bulk-media-sources"
import type { Request } from "../src/features/publishing/publishing-api"

const targets = (count: number): MediaSourceTarget[] =>
  Array.from({ length: count }, (_, index) => ({
    assetId: `asset-${index}`,
    versionId: `version-${index}`,
    previewUrl: null,
    label: `Image ${index}`,
  }))
const source = {
  type: "GAME_CLIENT",
  label: " Game capture ",
  ownerName: " Garena ",
  contactUrl: "https://example.com/contact",
}

test("bulk source writes are bounded, isolate failures and retry only unsuccessful targets with the same payload", async () => {
  const selected = targets(6)
  const writes: { path: string; body: string }[] = []
  let active = 0,
    peak = 0,
    fail = true
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    const target = selected.find((item) => path.includes(`/assets/${item.assetId}`))!
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active--
    if (init?.method === "POST") {
      writes.push({ path, body: String(init.body) })
      if (target.assetId === "asset-2" && fail) {
        fail = false
        throw new Error("Temporary write failure")
      }
    }
    return { id: target.assetId, state: "ACTIVE", currentVersionId: target.versionId } as T
  }
  const first = await addMediaSourcesInBulk(request, [...selected, selected[0]], source, () => {})
  assert.equal(first.length, 6)
  assert.equal(first.filter((result) => result.state === "success").length, 5)
  assert.equal(first.filter((result) => result.state === "error").length, 1)
  assert.ok(peak <= 3)
  assert.deepEqual(JSON.parse(writes[0].body), { ...source, label: "Game capture", ownerName: "Garena", url: null })
  const retry = first.filter((result) => result.state === "error").map((result) => result.target)
  const second = await addMediaSourcesInBulk(request, retry, source, () => {})
  assert.equal(second[0].state, "success")
  assert.equal(writes.length, 7)
  const retried = writes.filter((write) => write.path.includes("/asset-2/"))
  assert.equal(retried.length, 2)
  assert.equal(retried[0].body, retried[1].body)
  assert.equal(writes.filter((write) => write.path.includes("/asset-0/")).length, 1)
})

test("changed versions and inactive assets are skipped before any write", async () => {
  const selected = targets(3)
  const writes: string[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    if (init?.method === "POST") writes.push(path)
    const target = selected.find((item) => path.includes(`/assets/${item.assetId}`))!
    return {
      state: target.assetId === "asset-1" ? "BLOCKED" : "ACTIVE",
      currentVersionId: target.assetId === "asset-0" ? "replacement" : target.versionId,
    } as T
  }
  const results = await addMediaSourcesInBulk(request, selected, source, () => {})
  assert.deepEqual(
    results.map((result) => result.state),
    ["changed", "changed", "success"],
  )
  assert.deepEqual(writes, ["/admin/media/assets/asset-2/versions/version-2/sources"])
})

test("stopping during reads prevents new writes and leaves the remaining images resumable", async () => {
  let stopped = false
  let writes = 0
  const request: Request = async <T>(_path: string, init?: RequestInit) => {
    if (init?.method === "POST") writes++
    stopped = true
    return { state: "ACTIVE", currentVersionId: "version-0" } as T
  }
  const results = await addMediaSourcesInBulk(
    request,
    targets(5),
    source,
    () => {},
    () => stopped,
  )
  assert.ok(results.every((result) => result.state === "pending"))
  assert.equal(writes, 0)
})

test("stopping lets in-flight writes finish but does not schedule the remaining images", async () => {
  let stopped = false
  const finish: (() => void)[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    const id = path.match(/asset-(\d+)/)![1]
    if (init?.method === "POST") await new Promise<void>((resolve) => finish.push(resolve))
    return { state: "ACTIVE", currentVersionId: `version-${id}` } as T
  }
  const running = addMediaSourcesInBulk(
    request,
    targets(5),
    source,
    () => {},
    () => stopped,
  )
  while (finish.length < 3) await new Promise((resolve) => setTimeout(resolve, 1))
  stopped = true
  finish.forEach((resolve) => resolve())
  const results = await running
  assert.deepEqual(
    results.map((result) => result.state),
    ["success", "success", "success", "pending", "pending"],
  )
})

test("invalid source metadata is rejected before the first request", async () => {
  let calls = 0
  const request: Request = async <T>() => {
    calls++
    return {} as T
  }
  for (const invalid of [
    { label: " " },
    { label: "Capture", url: "javascript:alert(1)" },
    { label: "Capture", contactUrl: "https://user:secret@example.com" },
  ]) {
    assert.ok(bulkSourceValidation(invalid))
    await assert.rejects(addMediaSourcesInBulk(request, targets(1), invalid, () => {}))
  }
  assert.equal(calls, 0)
  assert.equal(bulkSourceValidation({ label: "Capture", ownerName: "Garena", url: null }), null)
})
