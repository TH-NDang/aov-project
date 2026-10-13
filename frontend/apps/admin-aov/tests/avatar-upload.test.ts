import { test } from "node:test"
import assert from "node:assert/strict"
import { uploadAvatar } from "../src/features/users/avatar-upload.ts"

test("avatar bytes go to signed storage URL without API credentials before completion", async () => {
  const calls: string[] = []
  const ticket = {
    uploadId: "upload-1",
    assetId: "asset-1",
    method: "PUT",
    uploadUrl: "https://storage.example/signed",
    headers: { "content-type": "image/png" },
    expiresAt: "",
  }
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    calls.push(path)
    assert.equal(init?.method, "POST")
    return (
      path.endsWith("complete") ? { assetId: "asset-1", avatarUrl: "https://storage.example/image" } : ticket
    ) as T
  }
  const fetcher = (async (url, init) => {
    calls.push(String(url))
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).has("Authorization"), false)
    assert.equal(init?.redirect, "error")
    assert.ok(init?.body instanceof File)
    return new Response(null, { status: 200 })
  }) as typeof fetch
  const result = await uploadAvatar(
    new File(["png"], "avatar.png", { type: "image/png" }),
    request,
    new AbortController().signal,
    () => {},
    fetcher,
  )
  assert.equal(result.assetId, "asset-1")
  assert.deepEqual(calls, ["/users/me/avatar-uploads", ticket.uploadUrl, "/users/me/avatar-uploads/upload-1/complete"])
})

test("failed storage upload never completes or binds an avatar", async () => {
  let count = 0
  const request = async <T>(): Promise<T> => {
    count++
    return { uploadId: "u", method: "PUT", uploadUrl: "https://storage.example/upload", headers: {} } as T
  }
  await assert.rejects(
    uploadAvatar(
      new File(["png"], "avatar.png", { type: "image/png" }),
      request,
      new AbortController().signal,
      () => {},
      async () => new Response(null, { status: 403 }),
    ),
  )
  assert.equal(count, 1)
})

test("invalid or oversized avatar fails before requesting an upload", async () => {
  const request = async <T>(): Promise<T> => {
    throw new Error("Must not call backend")
  }
  await assert.rejects(
    uploadAvatar(
      new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
      request,
      new AbortController().signal,
      () => {},
    ),
    /PNG/,
  )
  await assert.rejects(
    uploadAvatar(
      new File(["svg"], "avatar.svg", { type: "image/svg+xml" }),
      request,
      new AbortController().signal,
      () => {},
    ),
    /PNG/,
  )
  await assert.rejects(
    uploadAvatar(new File([], "avatar.png", { type: "image/png" }), request, new AbortController().signal, () => {}),
    /PNG/,
  )
})
