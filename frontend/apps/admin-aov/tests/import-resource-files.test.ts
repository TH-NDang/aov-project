import assert from "node:assert/strict"
import { test } from "node:test"
import { importImageFile, resolveImportImage } from "../src/features/publishing/import-files"

const limit = 25 * 1024 * 1024
const path = "/__resources/assets/hero/head/airi.jpg"
const empty = new Map<string, File>()

async function withFetch<T>(fetcher: typeof fetch, work: () => Promise<T>) {
  const previous = globalThis.fetch
  globalThis.fetch = fetcher
  try {
    return await work()
  } finally {
    globalThis.fetch = previous
  }
}

test("resource references stay in the fixed asset namespace after repeated decoding", () => {
  assert.equal(resolveImportImage(path, empty, ""), path)
  const unicode = "/__resources/assets/skin/ảnh nền.jpg"
  assert.equal(resolveImportImage(unicode, empty, ""), "/__resources/assets/skin/%E1%BA%A3nh%20n%E1%BB%81n.jpg")
  for (const source of [
    "/__resources/assets/../secret.png",
    "/__resources/assets/%2e%2e/secret.png",
    "/__resources/assets/%252e%252e/secret.png",
    "/__resources/assets/hero%2f..%2fsecret.png",
    "/__resources/assets/hero%5c..%5csecret.png",
    "/__resources/assets/hero/airi.jpg?token=secret",
    "/__resources/assets/hero/airi.jpg%3Ftoken=secret",
    "/__resources/assets/hero/airi.jpg#fragment",
    "/__resources/assets/hero/%00airi.jpg",
    "/__resources/assets/hero/%0Aairi.jpg",
    "/__resources/assets//airi.jpg",
    "/__resources/assets/hero/%.jpg",
    "/__resources/data/heroes.json",
    "/api/wiki/v1/admin/media/assets/test",
    "http://localhost:9000/assets/airi.jpg",
  ])
    assert.throws(() => resolveImportImage(source, empty, ""), undefined, source)
})

test("selected resource files and ordinary relative files share MIME, size and empty-file validation", () => {
  const inferred = new File(["image"], "airi.jpg")
  for (const source of [path, "assets/hero/head/airi.jpg"]) {
    const result = resolveImportImage(source, new Map([["assets/hero/head/airi.jpg", inferred]]), "")
    assert.ok(result instanceof File)
    assert.equal(result.type, "image/jpeg")
    assert.equal(result.name, "airi.jpg")
    for (const file of [
      new File([], "airi.jpg", { type: "image/jpeg" }),
      new File(["not an image"], "airi.jpg", { type: "text/html" }),
      new File([new Uint8Array(limit + 1)], "airi.jpg", { type: "image/jpeg" }),
    ])
      assert.throws(() => resolveImportImage(source, new Map([["assets/hero/head/airi.jpg", file]]), ""), /25 MB/)
  }
  const selected = new File(["head"], "ảnh nền.jpg", { type: "image/jpeg" })
  assert.equal(
    resolveImportImage(
      "/__resources/assets/skin/%E1%BA%A3nh%20n%E1%BB%81n.jpg",
      new Map([["pack/assets/skin/ảnh nền.jpg", selected]]),
      "pack",
    ),
    selected,
  )
})

test("resource images stream without credentials, redirects or API transport", async () => {
  let request: RequestInit | undefined
  let source = ""
  const file = await withFetch(
    async (input, init) => {
      source = String(input)
      request = init
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/jpeg; charset=binary" } })
    },
    () => importImageFile(path, empty, ""),
  )
  assert.equal(source, path)
  assert.equal(request?.credentials, "omit")
  assert.equal(request?.redirect, "error")
  assert.equal(request?.referrerPolicy, "no-referrer")
  assert.equal(request?.headers, undefined)
  assert.equal(file.type, "image/jpeg")
  assert.equal(file.name, "airi.jpg")
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3]))
})

test("oversized resource content length is rejected before body reads", async () => {
  let reads = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads++
        controller.enqueue(new Uint8Array([1]))
      },
      cancel() {
        cancelled = true
      },
    },
    { highWaterMark: 0 },
  )
  await withFetch(
    async () => new Response(body, { headers: { "Content-Type": "image/png", "Content-Length": String(limit + 1) } }),
    async () => {
      await assert.rejects(importImageFile(path, empty, ""), /25 MB/)
    },
  )
  assert.equal(reads, 0)
  assert.equal(cancelled, true)
})

test("resource streaming enforces the limit even with an absent or misleading content length", async () => {
  for (const declared of [undefined, "1"]) {
    let reads = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads++
          controller.enqueue(new Uint8Array(reads === 1 ? limit : 1))
        },
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 },
    )
    const headers: Record<string, string> = { "Content-Type": "image/png" }
    if (declared) headers["Content-Length"] = declared
    await withFetch(
      async () => new Response(body, { headers }),
      async () => {
        await assert.rejects(importImageFile(path, empty, ""), /25 MB/)
      },
    )
    assert.equal(reads, 2)
    assert.equal(cancelled, true)
  }
})

test("resource errors, empty bodies, invalid MIME and Git LFS pointers are rejected", async () => {
  for (const response of [
    new Response("missing", { status: 404 }),
    new Response("html", { headers: { "Content-Type": "text/html" } }),
    new Response(null, { status: 204 }),
    new Response(new Uint8Array(), { headers: { "Content-Type": "image/jpeg" } }),
  ])
    await withFetch(
      async () => response,
      () => assert.rejects(importImageFile(path, empty, "")),
    )
  const pointer = "version https://git-lfs.github.com/spec/v1\noid sha256:fixture\nsize 1000\n"
  await withFetch(
    async () => new Response(pointer, { headers: { "Content-Type": "image/jpeg" } }),
    () => assert.rejects(importImageFile(path, empty, ""), /Git LFS pointer/),
  )
  await assert.rejects(
    importImageFile(
      path,
      new Map([["assets/hero/head/airi.jpg", new File([pointer], "airi.jpg", { type: "image/jpeg" })]]),
      "",
    ),
    /Git LFS pointer/,
  )
})
