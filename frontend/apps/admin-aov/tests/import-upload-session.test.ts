import assert from "node:assert/strict"
import { test } from "node:test"
import { ApiError } from "../src/lib/api/errors"
import {
  createUploadSession,
  resumeUploadSession,
  type UploadSession,
  type UploadEntry,
} from "../src/features/publishing/import-upload-session"
import type { Request } from "../src/features/publishing/publishing-api"

function fixture() {
  let saved: UploadSession | undefined
  let assetCount = 0
  let uploads = 0
  let failUpload = 2
  let loseComplete = false
  let loseJob = false
  const stored = new Set<string>()
  const completed = new Set<string>()
  const jobs: unknown[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"))
    if (path.includes("/upload-sessions/")) {
      if (init?.method === "DELETE") return undefined as T
      saved = structuredClone({ ...body, id: path.split("/").at(-1), version: (saved?.version ?? -1) + 1 })
      return structuredClone(saved) as T
    }
    if (path.endsWith("/preview")) return { canApply: true, revisionId: null, version: null } as T
    if (path.endsWith("/assets")) return { id: `asset-${++assetCount}` } as T
    if (path.endsWith("/version-uploads")) {
      const id = path.split("/").at(-2)!
      return { uploadId: id, uploadUrl: `https://storage.test/${id}`, method: "PUT", headers: {} } as T
    }
    if (path.endsWith("/complete")) {
      const id = path.split("/").at(-2)!
      if (!stored.has(id)) throw new ApiError({ code: "MEDIA_OBJECT_NOT_FOUND", status: 422 })
      completed.add(id)
      if (loseComplete) {
        loseComplete = false
        throw new Error("Lost completion response")
      }
      return { assetId: id, current: true } as T
    }
    if (path.endsWith("/jobs")) {
      jobs.push(body)
      if (loseJob) {
        loseJob = false
        throw new Error("Lost job response")
      }
      return {} as T
    }
    throw new Error(path)
  }
  const fetcher = (async (url: string, init: RequestInit) => {
    assert.equal(init.credentials, "omit")
    uploads++
    if (uploads === failUpload) throw new Error("Tab closed")
    stored.add(url.split("/").at(-1)!)
    return new Response(null, { status: 200 })
  }) as typeof fetch
  const files = new Map(["a.png", "b.png"].map((name) => [name, new File([name], name, { type: "image/png" })]))
  const entries: UploadEntry[] = [
    {
      input: {
        code: "airi",
        rulesetId: "rules",
        contextId: "patch",
        mode: "BASELINE",
        locale: "vi-VN",
        expectedRevisionId: null,
        expectedVersion: null,
        values: {},
        policies: {},
      },
      imageUrls: { head: "a.png", portrait: "b.png" },
    },
  ]
  return {
    files,
    entries,
    request,
    fetcher,
    jobs,
    completed,
    saved: () => structuredClone(saved!),
    uploads: () => uploads,
    assets: () => assetCount,
    succeed: () => {
      failUpload = -1
    },
    loseCompletion: () => {
      loseComplete = true
    },
    loseJob: () => {
      loseJob = true
    },
  }
}

test("reopening uses persisted checkpoints and only uploads the missing image", async () => {
  const f = fixture()
  const session = await createUploadSession(f.entries, f.files, "", "heroes.json")
  await assert.rejects(
    resumeUploadSession(f.request, session, f.files, () => {}, f.fetcher),
    /Tab closed/,
  )
  const restored = f.saved()
  assert.equal(Object.values(restored.state.images).filter((image) => image.completed).length, 1)
  f.succeed()
  await resumeUploadSession(f.request, restored, new Map([["b.png", f.files.get("b.png")!]]), () => {}, f.fetcher)
  assert.equal(f.uploads(), 3)
  assert.equal(f.assets(), 2)
  assert.equal(f.jobs.length, 1)
  assert.equal(JSON.stringify(restored).includes("https://storage.test"), false)
})

test("lost complete response recovers without another byte upload", async () => {
  const f = fixture()
  f.entries[0].imageUrls = { head: "a.png" }
  f.loseCompletion()
  const session = await createUploadSession(f.entries, f.files, "", "heroes.json")
  await assert.rejects(
    resumeUploadSession(f.request, session, f.files, () => {}, f.fetcher),
    /Lost completion/,
  )
  await resumeUploadSession(f.request, f.saved(), new Map(), () => {}, f.fetcher)
  assert.equal(f.uploads(), 1)
  assert.equal(f.jobs.length, 1)
})

test("manifest credits persist in checkpoints and accompany the version upload after reopening", async () => {
  const f = fixture()
  f.files.set(
    "data/phu-tro.json",
    new File(
      [JSON.stringify({ items: [{ file: "a.png", sourceType: "provided-zip", collectedOn: null }] })],
      "phu-tro.json",
    ),
  )
  f.entries[0].imageUrls = { head: "a.png" }
  const session = await createUploadSession(f.entries, f.files, "", "heroes.json")
  const credit = Object.values(session.state.images)[0].credit!
  assert.equal(credit.ownerName, "Garena / Liên Quân Mobile")
  assert.equal(credit.type, "GAME_CLIENT")
  f.loseCompletion()
  const sent: unknown[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    if (path.endsWith("/assets") || path.endsWith("/version-uploads")) sent.push(JSON.parse(String(init?.body)).source)
    return f.request<T>(path, init)
  }
  await assert.rejects(
    resumeUploadSession(request, session, f.files, () => {}, f.fetcher),
    /Lost completion/,
  )
  assert.deepEqual(Object.values(f.saved().state.images)[0].credit, credit)
  await resumeUploadSession(request, f.saved(), new Map(), () => {}, f.fetcher)
  assert.deepEqual(sent, [credit, credit])
  assert.equal(f.uploads(), 1)
})

test("changed replacement files are rejected and job retry retains the idempotency key", async () => {
  const f = fixture()
  const session = await createUploadSession(f.entries, f.files, "", "heroes.json")
  await assert.rejects(resumeUploadSession(f.request, session, f.files, () => {}, f.fetcher))
  const wrong = new Map([["b.png", new File(["changed"], "b.png", { type: "image/png" })]])
  await assert.rejects(
    resumeUploadSession(f.request, f.saved(), wrong, () => {}, f.fetcher),
    /khác với file/,
  )
  f.succeed()
  f.loseJob()
  await assert.rejects(
    resumeUploadSession(f.request, f.saved(), f.files, () => {}, f.fetcher),
    /Lost job/,
  )
  const count = f.uploads()
  await resumeUploadSession(f.request, f.saved(), new Map(), () => {}, f.fetcher)
  assert.equal(f.uploads(), count)
  assert.deepEqual(f.jobs[0], f.jobs[1])
})

test("an accepted job remains successful when checkpoint cleanup response is lost", async () => {
  const f = fixture()
  f.succeed()
  const session = await createUploadSession(f.entries, f.files, "", "heroes.json")
  let cleanupAttempts = 0
  let checkpointWrites = 0
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    if (path.includes("/upload-sessions/") && init?.method === "DELETE") {
      cleanupAttempts++
      throw new ApiError({ code: "HERO_IMPORT_JOB_NOT_FOUND", status: 404 })
    }
    if (path.includes("/upload-sessions/") && init?.method === "PUT") checkpointWrites++
    return f.request<T>(path, init)
  }
  await resumeUploadSession(request, session, f.files, () => {}, f.fetcher)
  const writes = checkpointWrites
  const uploads = f.uploads()
  await resumeUploadSession(request, session, new Map(), () => {}, f.fetcher)
  assert.equal(cleanupAttempts, 2)
  assert.equal(checkpointWrites, writes)
  assert.equal(f.uploads(), uploads)
  assert.deepEqual(f.jobs[0], f.jobs[1])
})
