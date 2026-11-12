import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
  AccountSecurityError,
  applicationName,
  createAccountSecurityApi,
  deviceName,
} from "@aov/ui/lib/account-security"

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test("calls the security API with the bearer token, no cookies and the email language", async () => {
  const requests: { url: string; init: RequestInit }[] = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init: init ?? {} })
    return Response.json(
      { challengeId: "c1", emailHint: "r•••r@example.com", expiresAt: "", resendAvailableAt: "" },
      { status: 201 },
    )
  }
  const api = createAccountSecurityApi(async () => "token-1")
  await api.startPasswordChange("en-US")
  assert.equal(requests[0].url, "/api/wiki/v1/users/me/security/password-change")
  assert.equal(requests[0].init.method, "POST")
  assert.equal((requests[0].init.headers as Record<string, string>).Authorization, "Bearer token-1")
  assert.equal(requests[0].init.credentials, "omit")
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), { language: "en" })

  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init: init ?? {} })
    return new Response(null, { status: 204 })
  }
  await api.signOutSession("a/b")
  assert.equal(requests[1].url, "/api/wiki/v1/users/me/security/sessions/a%2Fb")
  assert.equal(requests[1].init.method, "DELETE")
})

test("turns problem details into typed errors with their context", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { code: "USER_PASSWORD_CODE_INVALID", context: { attemptsRemaining: 3 } },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    )
  const api = createAccountSecurityApi(async () => "token-1")
  await assert.rejects(
    api.confirmPasswordChange("c1", {
      code: "000000",
      newPassword: "new-password",
      signOutOtherSessions: true,
      language: "vi",
    }),
    (error: unknown) =>
      error instanceof AccountSecurityError &&
      error.status === 400 &&
      error.code === "USER_PASSWORD_CODE_INVALID" &&
      error.context.attemptsRemaining === 3,
  )
  globalThis.fetch = async () => {
    throw new TypeError("offline")
  }
  await assert.rejects(
    api.overview(),
    (error: unknown) => error instanceof AccountSecurityError && error.code === "NETWORK_ERROR",
  )
})

test("names devices and applications for people", () => {
  assert.equal(
    deviceName({ browser: "Chrome/152.0.7977", os: "Windows", osVersion: "10", device: "Other", mobile: false }),
    "Chrome 152 · Windows 10",
  )
  assert.equal(deviceName({ browser: null, os: "Other", osVersion: "Unknown", device: null, mobile: false }), null)
  assert.equal(deviceName(null), null)
  assert.equal(applicationName("aov-stream"), "AOV Stream")
  assert.equal(applicationName("admin-aov-backend"), "AOV Admin")
  assert.equal(applicationName("custom"), "custom")
})
