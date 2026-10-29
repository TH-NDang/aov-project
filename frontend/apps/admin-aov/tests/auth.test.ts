import { test } from "node:test"
import assert from "node:assert/strict"
import { createAuthenticatedClient } from "../src/lib/api/authenticated-client.ts"
import { createAuthRequest, isGoogleCompletion } from "../src/app/auth/auth-api.ts"

test("password login goes only to backend and includes the CSRF header", async () => {
  const request = createAuthRequest(async (url, init) => {
    assert.equal(url, "/api/wiki/v1/auth/login")
    assert.equal(init?.credentials, "same-origin")
    assert.equal(init?.redirect, "error")
    assert.equal(new Headers(init?.headers).get("X-AOV-Auth"), "1")
    assert.equal(new Headers(init?.headers).get("Authorization"), null)
    assert.deepEqual(JSON.parse(String(init?.body)), { username: "editor", password: "test-password" })
    return Response.json({ accessToken: "access", expiresIn: 300 })
  })
  assert.deepEqual(await request("login", { username: "editor", password: "test-password" }), {
    accessToken: "access",
    expiresIn: 300,
  })
})

test("auth failures preserve stable backend error codes", async () => {
  const request = createAuthRequest(async () => Response.json({ code: "AUTH_RATE_LIMITED" }, { status: 429 }))
  await assert.rejects(request("login", {}), { status: 429, code: "AUTH_RATE_LIMITED" })
})

test("refresh and logout use cookies without exposing refresh tokens in JS bodies", async () => {
  const request = createAuthRequest(async (_url, init) => {
    assert.equal(init?.body, undefined)
    assert.equal(init?.credentials, "same-origin")
    return new Response(null, { status: 204 })
  })
  await request("refresh")
  await request("logout")
})

test("Google completion requires exact origin, popup identity and current state", () => {
  const popup = {} as Window
  const origin = "http://localhost:5175"
  const valid = {
    origin,
    source: popup,
    data: { type: "aov-google-complete", state: "current", status: "success" },
  } as MessageEvent
  assert.equal(isGoogleCompletion(valid, popup, "current", origin), true)
  assert.equal(
    isGoogleCompletion({ ...valid, origin: "https://evil.example" } as MessageEvent, popup, "current", origin),
    false,
  )
  assert.equal(isGoogleCompletion({ ...valid, source: {} } as MessageEvent, popup, "current", origin), false)
  assert.equal(isGoogleCompletion(valid, popup, "previous", origin), false)
  assert.equal(isGoogleCompletion({ ...valid, data: null } as MessageEvent, popup, "current", origin), false)
})

test("refreshes credentials before sending a same-origin API request", async () => {
  const events: string[] = []
  const request = createAuthenticatedClient(
    async () => {
      events.push("token")
      return "fresh-token"
    },
    () => {},
    async (url, init) => {
      events.push("fetch")
      assert.equal(url, "/api/wiki/v1/admin/me")
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh-token")
      assert.equal(init?.credentials, "omit")
      return Response.json({ subject: "editor" })
    },
  )
  assert.deepEqual(await request("/admin/me"), { subject: "editor" })
  assert.deepEqual(events, ["token", "fetch"])
})

test("community requests reuse refreshed credentials only under their fixed same-origin API prefix", async () => {
  const request = createAuthenticatedClient(
    async () => "community-token",
    () => {},
    async (url, init) => {
      assert.equal(url, "/api/community/v1/admin/me")
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer community-token")
      assert.equal(init?.redirect, "error")
      return Response.json({ capabilities: ["tournament:read"] })
    },
    "/api/community/v1",
  )
  assert.deepEqual(await request("/admin/me"), { capabilities: ["tournament:read"] })
  await assert.rejects(request("https://example.com/admin/me"), /Invalid API path/)
  assert.throws(
    () =>
      createAuthenticatedClient(
        async () => "token",
        () => {},
        fetch,
        "https://example.com" as "/api/wiki/v1",
      ),
    /Invalid API base/,
  )
})

test("does not forward credentials outside wiki API", async () => {
  const request = createAuthenticatedClient(
    async () => {
      assert.fail("Must not access token")
    },
    () => {},
  )
  for (const path of ["https://example.com", "//example.com", "/../outside", "/%2e%2e/outside"]) {
    await assert.rejects(request(path), /Invalid API path/)
  }
})

test("401 ends the session without replaying a write; 403 preserves the session", async () => {
  for (const status of [401, 403]) {
    let expired = 0
    let calls = 0
    const request = createAuthenticatedClient(
      async () => "token",
      () => {
        expired++
      },
      async () => {
        calls++
        return Response.json({ code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN" }, { status })
      },
    )
    await assert.rejects(request("/admin/media/assets", { method: "POST", body: "{}" }), { status })
    assert.equal(calls, 1)
    assert.equal(expired, status === 401 ? 1 : 0)
  }
})

test("refresh failure prevents the request", async () => {
  const request = createAuthenticatedClient(
    async () => {
      throw new Error("Expired")
    },
    () => {},
    async () => {
      assert.fail("Must not send an expired token")
    },
  )
  await assert.rejects(request("/admin/me"), /Expired/)
})

test("empty successful command responses do not become JSON parse failures", async () => {
  for (const status of [200, 204, 205]) {
    const request = createAuthenticatedClient(
      async () => "token",
      () => {},
      async () => new Response(null, { status }),
    )
    assert.equal(await request("/admin/heroes/import/upload-sessions/session", { method: "DELETE" }), undefined)
  }
  const malformed = createAuthenticatedClient(
    async () => "token",
    () => {},
    async () => new Response("{broken", { status: 200 }),
  )
  await assert.rejects(malformed("/admin/me"), SyntaxError)
})
