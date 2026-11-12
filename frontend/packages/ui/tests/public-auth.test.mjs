import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { createHash } from "node:crypto"
import { createPublicAuth, safeAuthReturnPath } from "../src/lib/public-auth.ts"

const originals = Object.fromEntries(
  ["location", "history", "sessionStorage", "fetch"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
)
let storage, assigned, requests
const config = {
  issuer: "https://login.example.test/realms/aov",
  clientId: "aov-stream",
  storageKey: "stream-login",
  returnPath: "/pages",
  profileUrl: "/api/community/v1/me",
  nameField: "name",
  locale: () => "en",
}
beforeEach(() => {
  storage = new Map()
  assigned = []
  requests = []
  Object.defineProperties(globalThis, {
    location: {
      configurable: true,
      writable: true,
      value: {
        origin: "https://stream.example.test",
        pathname: "/pages",
        search: "?tab=directory",
        hash: "#teams",
        assign: (url) => assigned.push(url),
      },
    },
    history: {
      configurable: true,
      value: {
        replaceState: (_, __, path) => {
          location.pathname = path
          location.search = ""
        },
      },
    },
    sessionStorage: {
      configurable: true,
      value: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    },
    fetch: {
      configurable: true,
      writable: true,
      value: async (url, options) => {
        requests.push({ url, options })
        return Response.json(
          url.endsWith("/token")
            ? { access_token: "access", refresh_token: "refresh", id_token: "id-token", expires_in: 300 }
            : { name: "Explorer" },
        )
      },
    },
  })
})
afterEach(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
async function callback(auth, overrides = {}) {
  await auth.signIn()
  const flow = JSON.parse(storage.get(config.storageKey))
  storage.set(config.storageKey, JSON.stringify({ ...flow, ...overrides }))
  location.pathname = "/auth/callback"
  location.search = `?state=${flow.state}&code=authorization-code`
  return flow
}

test("sign-in sends S256 and locale without storing tokens", async () => {
  const auth = createPublicAuth(config)
  await Promise.all([auth.signIn(), auth.signIn()])
  assert.equal(assigned.length, 1)
  const url = new URL(assigned[0])
  const flow = JSON.parse(storage.get(config.storageKey))
  assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(flow.verifier).digest("base64url"))
  assert.equal(url.searchParams.get("code_challenge_method"), "S256")
  assert.equal(url.searchParams.get("ui_locales"), "en")
  assert.equal(url.searchParams.get("redirect_uri"), "https://stream.example.test/auth/callback")
  assert.deepEqual(Object.keys(flow).sort(), ["created", "returnTo", "state", "verifier"])
})

test("callback exchanges once, clears transaction and restores path, query and fragment", async () => {
  const auth = createPublicAuth(config)
  const flow = await callback(auth)
  const first = auth.completeLogin()
  assert.equal(auth.completeLogin(), first)
  assert.equal(await first, "/pages?tab=directory#teams")
  assert.equal(storage.size, 0)
  assert.equal(location.search, "")
  assert.equal(auth.getSnapshot().name, "Explorer")
  assert.equal(await auth.accessToken(), "access")
  assert.equal(requests.length, 2)
  assert.equal(requests[0].options.body.get("code_verifier"), flow.verifier)
  assert.equal(requests[0].options.body.get("grant_type"), "authorization_code")
  assert.equal(requests[1].options.headers.Authorization, "Bearer access")
  assert.equal(requests[1].options.credentials, "omit")
})

test("invalid state, stale timestamps and invalid verifier fail before network access", async () => {
  for (const overrides of [
    { state: "wrong" },
    { created: Date.now() - 601000 },
    { created: null },
    { created: Date.now() + 60000 },
    { verifier: "short" },
  ]) {
    const auth = createPublicAuth(config)
    await callback(auth, overrides)
    await assert.rejects(auth.completeLogin())
    assert.equal(auth.getSnapshot().status, "anonymous")
    assert.equal(storage.size, 0)
  }
  assert.equal(requests.length, 0)
})

test("rejects external, malformed and callback return paths", () => {
  for (const path of [
    "//evil.test",
    "/\\evil.test",
    "/\nevil.test",
    "https://evil.test",
    "/auth/callback?code=x",
    "/../auth/callback",
    "//[",
    null,
  ]) {
    assert.equal(safeAuthReturnPath(path, "/pages"), "/pages")
  }
  assert.equal(safeAuthReturnPath("/pages?q=a%20b#latest", "/"), "/pages?q=a%20b#latest")
})

test("sign-out during profile loading cannot restore an old authenticated session", async () => {
  const auth = createPublicAuth(config)
  await callback(auth)
  let releaseProfile, reachedProfile
  const reached = new Promise((resolve) => {
    reachedProfile = resolve
  })
  fetch = async (url) => {
    if (url.endsWith("/token")) return Response.json({ access_token: "old-access", expires_in: 300 })
    reachedProfile()
    return new Promise((resolve) => {
      releaseProfile = resolve
    })
  }
  const pending = auth.completeLogin()
  await reached
  auth.signOut(false)
  releaseProfile(Response.json({ name: "Old account" }))
  await assert.rejects(pending, /Session ended/)
  assert.equal(auth.getSnapshot().status, "anonymous")
  await assert.rejects(auth.accessToken(), /Authentication required/)
})

test("expired tokens share one refresh and remote logout uses the ID token", async () => {
  const auth = createPublicAuth(config)
  await callback(auth)
  fetch = async (url) =>
    Response.json(
      url.endsWith("/token")
        ? { access_token: "access", refresh_token: "refresh", id_token: "id-token", expires_in: 1 }
        : { name: "Explorer" },
    )
  await auth.completeLogin()
  let refreshes = 0
  fetch = async (_, options) => {
    refreshes++
    assert.equal(options.body.get("grant_type"), "refresh_token")
    return Response.json({
      access_token: "new-access",
      refresh_token: "new-refresh",
      id_token: "new-id",
      expires_in: 300,
    })
  }
  assert.deepEqual(await Promise.all([auth.accessToken(), auth.accessToken()]), ["new-access", "new-access"])
  assert.equal(refreshes, 1)
  auth.signOut()
  const logout = new URL(assigned.at(-1))
  assert.equal(logout.searchParams.get("id_token_hint"), "new-id")
  assert.equal(logout.searchParams.get("post_logout_redirect_uri"), "https://stream.example.test/pages")
})

test("Wiki uses an independent public client transaction and registration endpoint", async () => {
  const stream = createPublicAuth(config)
  const wiki = createPublicAuth({ ...config, clientId: "aov-wiki", storageKey: "wiki-login", locale: () => "vi-VN" })
  await stream.signIn()
  await wiki.signIn(true)
  assert.equal(storage.size, 2)
  const url = new URL(assigned.at(-1))
  assert.equal(url.searchParams.get("client_id"), "aov-wiki")
  assert.equal(url.searchParams.get("ui_locales"), "vi")
  assert.ok(url.pathname.endsWith("/registrations"))
})

test("account actions add kc_action and forced re-authentication, then report their status once", async () => {
  const auth = createPublicAuth({ ...config, clientId: "aov-wiki", storageKey: "wiki-login", returnPath: "/" })
  location.pathname = "/account"
  location.search = ""
  location.hash = ""
  await auth.signIn(false, { action: "delete_credential:0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", reauthenticate: true })
  const url = new URL(assigned.at(-1))
  assert.equal(url.searchParams.get("kc_action"), "delete_credential:0f1e2d3c-aaaa-bbbb-cccc-1234567890ab")
  assert.equal(url.searchParams.get("max_age"), "0")
  const flow = JSON.parse(storage.get("wiki-login"))
  assert.equal(flow.returnTo, "/account")
  location.pathname = "/auth/callback"
  location.search = `?state=${flow.state}&code=authorization-code&kc_action=delete_credential&kc_action_status=success`
  assert.equal(await auth.completeLogin(), "/account")
  const result = { action: "delete_credential:0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", status: "success" }
  assert.deepEqual(auth.accountActionResult(), result)
  assert.deepEqual(auth.accountActionResult(), result, "reading does not consume the result")
  auth.clearAccountActionResult()
  assert.equal(auth.accountActionResult(), null)
})

test("account actions reject unknown actions and report cancellations", async () => {
  const auth = createPublicAuth(config)
  await assert.rejects(auth.signIn(false, { action: "UPDATE_EMAIL" }), /Unsupported account action/)
  await assert.rejects(auth.signIn(false, { action: "delete_credential:../x" }), /Unsupported account action/)
  assert.equal(assigned.length, 0)
  await auth.signIn(false, { action: "CONFIGURE_TOTP" })
  const url = new URL(assigned.at(-1))
  assert.equal(url.searchParams.get("kc_action"), "CONFIGURE_TOTP")
  assert.equal(url.searchParams.has("max_age"), false)
  const flow = JSON.parse(storage.get(config.storageKey))
  location.pathname = "/auth/callback"
  location.search = `?state=${flow.state}&code=authorization-code&kc_action_status=cancelled`
  await auth.completeLogin()
  assert.deepEqual(auth.accountActionResult(), { action: "CONFIGURE_TOTP", status: "cancelled" })
})

test("a plain sign-in carries no account action result", async () => {
  const auth = createPublicAuth(config)
  await callback(auth)
  await auth.completeLogin()
  assert.equal(auth.accountActionResult(), null)
})
