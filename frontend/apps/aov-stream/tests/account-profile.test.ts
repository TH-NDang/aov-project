import assert from "node:assert/strict"
import { test } from "node:test"
import { ApiError, createApiRequest, WIKI_API_ROOT, type ApiRequest } from "../src/lib/api-client.ts"
import { uploadAvatar } from "../src/lib/avatar-upload.ts"
import {
  initialDraft,
  initials,
  profileDraft,
  profileError,
  profileRequest,
  sameDraft,
  withCurrent,
  type UserProfile,
} from "../src/lib/profile-model.ts"

const unsaved: UserProfile = {
  id: null,
  displayName: "Người chơi",
  biography: "",
  locale: "vi-VN",
  timeZone: "Asia/Ho_Chi_Minh",
  avatarAssetId: null,
  avatarUrl: null,
  version: 0,
  createdAt: null,
  updatedAt: null,
}
const saved: UserProfile = { ...unsaved, id: "c1b5f1de-3a4e-4b8c-9a39-3b1a7c6a0e11", version: 3 }
const avatar = () => new File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" })
const ticket = {
  uploadId: "upload-1",
  assetId: "asset-1",
  method: "PUT",
  uploadUrl: "http://storage.test/incoming/upload-1?signature=abc",
  headers: { "Content-Type": "image/png" },
  expiresAt: "2026-11-02T10:00:00Z",
}

test("avatar upload asks for a ticket, sends bytes to storage without credentials, then completes", async () => {
  const calls: string[] = []
  const bodies: unknown[] = []
  let storage: RequestInit | undefined
  const request = async <T>(path: string, init?: ApiRequest) => {
    calls.push(`api ${init?.method} ${path}`)
    if (init?.body) bodies.push(init.body)
    return (path.endsWith("/complete") ? { assetId: "asset-1", avatarUrl: "http://storage.test/a.png" } : ticket) as T
  }
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push(`storage ${init?.method} ${url}`)
    storage = init
    return new Response(null, { status: 200 })
  }) as typeof fetch
  const steps: string[] = []

  const result = await uploadAvatar(
    avatar(),
    request,
    new AbortController().signal,
    (step) => steps.push(step),
    fetcher,
  )

  assert.deepEqual(calls, [
    "api POST /users/me/avatar-uploads",
    `storage PUT ${ticket.uploadUrl}`,
    "api POST /users/me/avatar-uploads/upload-1/complete",
  ])
  assert.deepEqual(bodies, [{ fileName: "me.png", contentType: "image/png", sizeBytes: 4 }])
  assert.equal(storage?.credentials, "omit")
  assert.equal(storage?.redirect, "error")
  assert.deepEqual(storage?.headers, { "Content-Type": "image/png" })
  assert.deepEqual(result, { assetId: "asset-1", avatarUrl: "http://storage.test/a.png" })
  assert.equal(steps.length, 3)
})

test("avatar upload never completes when storage rejects the bytes and validates files before any request", async () => {
  const calls: string[] = []
  const request = async <T>(path: string) => {
    calls.push(path)
    return ticket as T
  }
  const failing = (async () => new Response(null, { status: 403 })) as typeof fetch

  await assert.rejects(
    uploadAvatar(avatar(), request, new AbortController().signal, () => {}, failing),
    /kho lưu trữ/,
  )
  assert.deepEqual(calls, ["/users/me/avatar-uploads"])

  calls.length = 0
  const gif = new File([new Uint8Array([71])], "me.gif", { type: "image/gif" })
  const empty = new File([], "empty.png", { type: "image/png" })
  for (const file of [gif, empty])
    await assert.rejects(
      uploadAvatar(file, request, new AbortController().signal, () => {}, failing),
      /PNG, JPEG/,
    )
  assert.deepEqual(calls, [])
})

test("wiki requests carry the in-memory bearer token without cookies and keep the problem code", async () => {
  let sent: { url: string; init?: RequestInit } | undefined
  const fetcher = (async (url: string, init?: RequestInit) => {
    sent = { url, init }
    return Response.json({ code: "USER_PROFILE_CONFLICT", detail: "Profile version is stale." }, { status: 409 })
  }) as typeof fetch
  const request = createApiRequest({
    root: WIKI_API_ROOT,
    token: async () => "token-1",
    describe: (status, problem) => problem.detail || `HTTP ${status}`,
    fetcher,
  })

  const failure = await request("/users/me", { method: "PUT", body: {} }).catch((error: unknown) => error)

  assert.equal(sent?.url, "/api/wiki/v1/users/me")
  assert.equal(sent?.init?.credentials, "omit")
  assert.equal(sent?.init?.cache, "no-store")
  assert.equal((sent?.init?.headers as Record<string, string>).Authorization, "Bearer token-1")
  assert.ok(failure instanceof ApiError)
  assert.equal(failure.status, 409)
  assert.equal(failure.code, "USER_PROFILE_CONFLICT")
  assert.match(profileError(failure), /tải bản mới nhất/)
  assert.match(profileError(new ApiError(401, "", "")), /đăng nhập lại/)
  assert.match(profileError(new ApiError(500, "UNKNOWN", "")), /thử lại/)
})

test("saving sends only editable fields with the expected version and a trimmed name", () => {
  const body = profileRequest({ ...profileDraft(saved), displayName: "  Thánh Gióng  ", avatarAssetId: null }, 3)

  assert.deepEqual(Object.keys(body).sort(), [
    "avatarAssetId",
    "biography",
    "currency",
    "displayName",
    "expectedVersion",
    "locale",
    "timeZone",
  ])
  assert.equal(body.displayName, "Thánh Gióng")
  assert.equal(body.expectedVersion, 3)
  assert.ok(sameDraft(profileDraft(saved), profileDraft({ ...saved, avatarUrl: "http://renewed.test/a.png" })))
  assert.ok(!sameDraft(profileDraft(saved), { ...profileDraft(saved), biography: "Mới" }))
  assert.ok(!sameDraft(profileDraft(saved), { ...profileDraft(saved), currency: "THB" }))
})

test("a currency chosen in this browser fills only a profile that was never saved", () => {
  const browser = { languages: [], currency: "THB" }

  assert.equal(initialDraft(unsaved, browser).currency, "THB")
  assert.equal(initialDraft(saved, browser).currency, profileDraft(saved).currency)
  assert.equal(initialDraft(unsaved, { languages: [] }).currency, null)
})

test("browser language and time zone are suggested only before the first save", () => {
  const browser = { languages: ["not a locale!", "en-US"], timeZone: "Asia/Bangkok" }

  assert.deepEqual(
    { locale: initialDraft(unsaved, browser).locale, timeZone: initialDraft(unsaved, browser).timeZone },
    { locale: "en-US", timeZone: "Asia/Bangkok" },
  )
  assert.deepEqual(initialDraft(saved, browser), profileDraft(saved))
  assert.equal(initialDraft(unsaved, { languages: [], timeZone: "Mars/Olympus" }).timeZone, "Asia/Ho_Chi_Minh")
})

test("stored values stay selectable and initials fall back for an empty name", () => {
  assert.deepEqual(withCurrent(["vi-VN", "en-US"], "ja-JP"), ["ja-JP", "vi-VN", "en-US"])
  assert.deepEqual(withCurrent(["vi-VN", "en-US"], "en-US"), ["vi-VN", "en-US"])
  assert.equal(initials("Nguyễn Văn An"), "VA")
  assert.equal(initials("   "), "?")
})
