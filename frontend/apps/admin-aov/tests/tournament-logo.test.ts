import assert from "node:assert/strict"
import { test } from "node:test"
import { uploadTeamLogo } from "../src/features/tournaments/team-logo-upload"
import type { Request } from "../src/features/publishing/publishing-api"

test("team logos use Media ingestion and return immutable URLs without forwarding API credentials to storage", async () => {
  const calls: { path: string; init?: RequestInit }[] = []
  const signal = new AbortController().signal
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, init })
    assert.equal(init?.signal, signal)
    const responses: Record<string, unknown> = {
      "/admin/media/assets": { id: "asset" },
      "/admin/media/assets/asset/version-uploads": {
        uploadId: "upload",
        method: "PUT",
        uploadUrl: "https://storage.example/incoming/logo",
        headers: { "Content-Type": "image/png" },
      },
      "/admin/media/uploads/upload/complete": { assetId: "asset", current: true },
      "/admin/media/assets/asset": {
        currentVersionId: "version",
        versions: [{ id: "version", url: "https://img.example/asset/version.png" }],
      },
    }
    assert.ok(path in responses)
    return responses[path] as T
  }
  let uploaded = false
  const file = new File(["logo"], "team.png", { type: "image/png" })
  const fetcher: typeof fetch = async (url, init) => {
    uploaded = true
    assert.equal(url, "https://storage.example/incoming/logo")
    assert.equal(init?.method, "PUT")
    assert.equal(init?.credentials, "omit")
    assert.equal(init?.redirect, "error")
    assert.equal(new Headers(init?.headers).get("Authorization"), null)
    assert.equal(init?.body, file)
    assert.ok(init?.signal)
    return new Response(null, { status: 200 })
  }
  const result = await uploadTeamLogo(
    request,
    file,
    "Team Example",
    "https://official.example/logo.png",
    signal,
    fetcher,
  )
  assert.equal(uploaded, true)
  assert.equal(result, "https://img.example/asset/version.png")
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    semanticType: "OTHER",
    source: {
      label: "Logo đội tuyển Team Example",
      url: "https://official.example/logo.png",
      note: "Uploaded team logo: team.png",
    },
  })
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/admin/media/assets",
      "/admin/media/assets/asset/version-uploads",
      "/admin/media/uploads/upload/complete",
      "/admin/media/assets/asset",
    ],
  )
})

test("invalid team-logo files fail before creating any Media asset", async () => {
  const request: Request = async () => assert.fail("Invalid files must not create Media assets")
  await assert.rejects(
    uploadTeamLogo(
      request,
      new File(["<svg />"], "logo.svg", { type: "image/svg+xml" }),
      "Team",
      undefined,
      new AbortController().signal,
    ),
    /PNG, JPEG hoặc WebP/,
  )
})
