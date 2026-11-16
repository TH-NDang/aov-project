import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer, type Server } from "node:http"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  collectFolder,
  imageTypeOf,
  normalizePath,
  publishCaptures,
  pull,
  push,
  SourceApi,
} from "../server/source-sync.ts"

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

/** A tiny Admin API: collections, presigned uploads to itself, complete with a hash check, links and downloads. */
async function fakeBackend() {
  const objects = new Map<string, Buffer>()
  const incoming = new Map<string, Buffer>()
  const uploads = new Map<string, { path: string; sha256: string }>()
  const files: { id: string; path: string; sha256: string; sizeBytes: number }[] = []
  let collection: { id: string; code: string; version: number; category?: string } | null = null
  let next = 0
  const server: Server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)
    const url = new URL(request.url ?? "/", "http://localhost")
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" })
      response.end(JSON.stringify(value))
    }
    const base = `http://localhost:${(server.address() as { port: number }).port}`
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (request.method === "GET" && path === "/admin/source-collections")
      return json(200, { items: collection ? [collection] : [], page: 0, size: 100, totalElements: collection ? 1 : 0 })
    if (request.method === "POST" && path === "/admin/source-collections") {
      const input = JSON.parse(body.toString())
      collection = { id: "c1", code: input.code, version: 0, category: input.category }
      return json(201, collection)
    }
    if (request.method === "POST" && path === "/admin/source-collections/c1/uploads") {
      const input = JSON.parse(body.toString())
      const existing = files.find((file) => file.path === input.path)
      if (existing && existing.sha256 !== input.sha256 && !input.replace)
        return json(409, {
          code: "SOURCE_FILE_PATH_TAKEN",
          context: { fileId: existing.id, sha256: existing.sha256, version: 0 },
        })
      if (objects.has(input.sha256)) {
        if (!existing)
          files.push({ id: `f${next++}`, path: input.path, sha256: input.sha256, sizeBytes: input.sizeBytes })
        return json(200, { status: "STORED", file: {}, upload: null })
      }
      const uploadId = `u${next++}`
      uploads.set(uploadId, { path: input.path, sha256: input.sha256 })
      return json(201, {
        status: "UPLOAD_REQUIRED",
        file: null,
        upload: {
          uploadId,
          method: "PUT",
          uploadUrl: `${base}/put/${uploadId}`,
          headers: { "Content-Type": input.contentType },
        },
      })
    }
    if (request.method === "PUT" && url.pathname.startsWith("/put/")) {
      incoming.set(url.pathname.slice(5), body)
      response.writeHead(200).end()
      return
    }
    const completed = path.match(/^\/admin\/source-uploads\/(u\d+)\/complete$/)
    if (request.method === "POST" && completed) {
      const upload = uploads.get(completed[1])!
      const bytes = incoming.get(completed[1])
      if (!bytes) return json(409, { code: "SOURCE_UPLOAD_NOT_UPLOADED" })
      if (sha256(bytes) !== upload.sha256) return json(409, { code: "SOURCE_UPLOAD_REJECTED" })
      objects.set(upload.sha256, bytes)
      const existing = files.find((file) => file.path === upload.path)
      if (existing) existing.sha256 = upload.sha256
      else files.push({ id: `f${next++}`, path: upload.path, sha256: upload.sha256, sizeBytes: bytes.length })
      return json(200, { file: {} })
    }
    if (request.method === "GET" && path === "/admin/source-collections/c1/files")
      return json(200, {
        items: url.searchParams.get("page") === "0" ? files : [],
        page: 0,
        size: 200,
        totalElements: files.length,
      })
    if (request.method === "POST" && path === "/admin/source-collections/c1/links") {
      const { paths } = JSON.parse(body.toString()) as { paths: string[] }
      const items = files
        .filter((file) => paths.includes(file.path))
        .map((file) => ({ path: file.path, sha256: file.sha256, url: `${base}/get/${file.sha256}` }))
      return json(200, { items, missing: [] })
    }
    if (request.method === "GET" && url.pathname.startsWith("/get/")) {
      const bytes = objects.get(url.pathname.slice(5))
      if (!bytes) return json(404, {})
      response.writeHead(200).end(bytes)
      return
    }
    json(404, { code: "NOT_FOUND" })
  })
  await new Promise<void>((done) => server.listen(0, done))
  const api = new SourceApi(`http://localhost:${(server.address() as { port: number }).port}`, async () => ({
    token: "test",
    expiresIn: 300,
  }))
  return { server, api, files, objects, collection: () => collection }
}

test("paths follow the backend rules", () => {
  assert.equal(normalizePath("raw/shop/a.jpg"), "raw/shop/a.jpg")
  assert.equal(normalizePath("Ha\u0302\u0301u.png"), "Hấu.png")
  for (const unsafe of ["", "/abs.png", "a/../b.png", "a//b.png", "a\\b.png", "c:/x.png", "x. /y.png"])
    assert.equal(normalizePath(unsafe), null, unsafe)
})

test("push stores new bytes once, verifies them, and a second push only places what is already there", async () => {
  const work = await mkdtemp(join(tmpdir(), "source-sync-"))
  const backend = await fakeBackend()
  try {
    const source = join(work, "source")
    await mkdir(join(source, "tuong"), { recursive: true })
    await writeFile(join(source, "tuong", "airi.jpg"), Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]))
    await writeFile(join(source, "manifest.json"), "{}")
    await writeFile(join(source, "copy.json"), "{}")
    await writeFile(join(source, "page.html"), "<p>no</p>")
    await mkdir(join(source, ".local-state"))
    await writeFile(join(source, ".local-state", "preview.png"), "x")

    const collected = await collectFolder(source, "raw/shop", [".local-state"])
    assert.deepEqual(
      collected.items.map((item) => item.path),
      ["raw/shop/copy.json", "raw/shop/manifest.json", "raw/shop/tuong/airi.jpg"],
    )
    assert.deepEqual(collected.skipped, [{ path: "raw/shop/page.html", reason: "unsupported type" }])

    const collection = await backend.api.call<{ id: string; code: string; version: number }>(
      "/admin/source-collections",
      {
        method: "POST",
        body: { code: "shop-test" },
      },
    )
    const receipts = join(work, "receipts.jsonl")
    const first = await push(backend.api, collection, collected.items, { receipts, workers: 1, log: () => {} })
    // copy.json has the same bytes as manifest.json, so its bytes are stored once and the second file is placed.
    assert.deepEqual(first, { uploaded: 2, stored: 1, failed: 0 })
    assert.equal(backend.objects.size, 2)

    const second = await push(backend.api, collection, collected.items, { receipts, workers: 2, log: () => {} })
    assert.deepEqual(second, { uploaded: 0, stored: 3, failed: 0 })
    const lines = (await readFile(receipts, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    assert.equal(lines.length, 6)
    assert.ok(lines.every((line) => line.verified === true))

    const target = join(work, "pulled")
    const planned = await pull(backend.api, collection, target, false, () => {})
    assert.equal(planned.toDownload, 3)
    const pulled = await pull(backend.api, collection, target, true, () => {})
    assert.equal(pulled.downloaded, 3)
    assert.deepEqual(
      await readFile(join(target, "raw", "shop", "tuong", "airi.jpg")),
      Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]),
    )
    const again = await pull(backend.api, collection, target, true, () => {})
    assert.equal(again.kept, 3)
    assert.equal(again.downloaded, 0)

    backend.files.push({ id: "evil", path: "../evil.txt", sha256: "0".repeat(64), sizeBytes: 1 })
    const refused: string[] = []
    const guarded = await pull(backend.api, collection, target, true, (line) => refused.push(line))
    assert.equal(guarded.failed, 1)
    assert.match(refused[0], /REFUSED \.\.\/evil\.txt/)
  } finally {
    backend.server.close()
    await rm(work, { recursive: true, force: true })
  }
})

test("publish-captures refuses a set whose screenshots are not stored, then replaces its manifest only when it changed", async () => {
  const work = await mkdtemp(join(tmpdir(), "source-sync-publish-"))
  const backend = await fakeBackend()
  try {
    const shot = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const raw = join(work, "raw", "builds", "2026-11-11")
    const extracted = join(work, "extracted", "builds", "2026-11-11")
    await mkdir(join(raw, "pro-001"), { recursive: true })
    await mkdir(extracted, { recursive: true })
    await writeFile(join(raw, "pro-001", "1.png"), shot)
    const manifest = (needsReview: boolean) => ({
      capturedOn: "2026-11-11",
      capture: {
        code: "vn-pro-20261111",
        capturedAt: "2026-11-11T05:02:43Z",
        sourceTimeZone: "Asia/Ho_Chi_Minh",
        sourceLabel: "Đề cử Pro",
        regionCode: "VN",
        images: [{}],
        heroes: [{ builds: [{ needsReview }] }],
      },
      images: { [sha256(shot)]: { path: "pro-001/1.png" } },
    })
    await writeFile(join(extracted, "build-manifest.json"), JSON.stringify(manifest(true)))
    const collection = await backend.api.call<{ id: string; code: string; version: number; category: string }>(
      "/admin/source-collections",
      { method: "POST", body: { code: "builds-test", category: "BUILD_CAPTURE" } },
    )
    const receipts = join(work, "receipts.jsonl")
    const options = (apply: boolean) => ({ apply, receipts, log: () => {} })

    await assert.rejects(publishCaptures(backend.api, collection, extracted, options(true)), /1 of 1 pictures/)
    const shots = await collectFolder(raw, "raw/builds/2026-11-11")
    await push(backend.api, collection, shots.items, { receipts, log: () => {} })

    const planned = await publishCaptures(backend.api, collection, extracted, options(false))
    assert.deepEqual([planned.kind, planned.pictures, planned.published], ["BUILD_CAPTURE", 1, false])
    assert.equal(
      backend.files.some((file) => file.path === "capture-manifest.json"),
      false,
      "a plan writes nothing",
    )

    const published = await publishCaptures(backend.api, collection, extracted, options(true))
    assert.equal(published.published, true)
    const first = backend.files.find((file) => file.path === "capture-manifest.json")!.sha256
    const set = JSON.parse(backend.objects.get(first)!.toString())
    assert.deepEqual([set.kind, set.set.needsReview, set.capture.code], ["BUILD_CAPTURE", 1, "vn-pro-20261111"])

    const again = await publishCaptures(backend.api, collection, extracted, options(true))
    assert.deepEqual([again.unchanged, again.published], [true, false], "nothing changed, nothing is sent")

    await writeFile(join(extracted, "build-manifest.json"), JSON.stringify(manifest(false)))
    const replaced = await publishCaptures(backend.api, collection, extracted, options(true))
    assert.equal(replaced.published, true, "a changed review replaces the manifest on purpose")
    const current = backend.files.find((file) => file.path === "capture-manifest.json")!
    assert.notEqual(current.sha256, first)
    assert.equal(JSON.parse(backend.objects.get(current.sha256)!.toString()).set.needsReview, 0)

    const media = { ...collection, category: "IMPORT_DATA" }
    await assert.rejects(publishCaptures(backend.api, media, extracted, options(true)), /not a capture set/)
  } finally {
    backend.server.close()
    await rm(work, { recursive: true, force: true })
  }
})

test("images are declared by their bytes, so a JPEG saved as .png is not refused", async () => {
  const work = await mkdtemp(join(tmpdir(), "source-sync-types-"))
  try {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
    await writeFile(join(work, "ui-import-complete.png"), jpeg)
    await writeFile(join(work, "real.png"), png)
    await writeFile(join(work, "notes.json"), "{}")
    const types = Object.fromEntries((await collectFolder(work)).items.map((item) => [item.path, item.contentType]))
    assert.deepEqual(types, {
      "notes.json": "application/json",
      "real.png": "image/png",
      "ui-import-complete.png": "image/jpeg",
    })
    assert.equal(imageTypeOf(Buffer.from("GIF89a")), "image/gif")
    assert.equal(imageTypeOf(Buffer.from("RIFF    WEBP")), "image/webp")
    assert.equal(imageTypeOf(Buffer.from("not an image")), null)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
})
