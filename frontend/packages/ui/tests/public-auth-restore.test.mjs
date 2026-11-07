import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { createPublicAuth, relaySilentLogin } from "../src/lib/public-auth.ts"

const names = ["location", "history", "sessionStorage", "localStorage", "fetch", "window", "document"]
const originals = Object.fromEntries(names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const config = {
  issuer: "https://login.example.test/realms/aov",
  clientId: "aov-stream",
  storageKey: "stream-login",
  returnPath: "/",
  profileUrl: "/api/community/v1/me",
  nameField: "name",
  locale: () => "vi",
}
let persisted, listeners, frames, requests, reply
const define = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const memoryStorage = (map) => ({
  getItem: (key) => map.get(key) ?? null,
  setItem: (key, value) => map.set(key, value),
  removeItem: (key) => map.delete(key),
})

beforeEach(() => {
  persisted = new Map()
  listeners = new Set()
  frames = []
  requests = []
  reply = (state) => `?state=${state}&code=silent-code`
  define("location", { origin: "https://stream.example.test", pathname: "/account", search: "", hash: "" })
  define("sessionStorage", memoryStorage(new Map()))
  define("localStorage", memoryStorage(persisted))
  const self = {
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  }
  self.parent = self
  define("window", self)
  define("document", {
    createElement: () => ({
      contentWindow: {},
      remove() {
        frames.splice(frames.indexOf(this), 1)
      },
    }),
    body: {
      appendChild(frame) {
        frames.push(frame)
        const search = reply(new URL(frame.src).searchParams.get("state"))
        if (search === null) return
        queueMicrotask(() => {
          for (const listener of listeners) {
            listener({
              origin: location.origin,
              source: frame.contentWindow,
              data: { type: "aov-silent-login", search },
            })
          }
        })
      },
    },
  })
  define("fetch", async (url, options) => {
    requests.push({ url, options })
    return Response.json(
      url.endsWith("/token")
        ? { access_token: "access", refresh_token: "refresh", id_token: "id", expires_in: 300 }
        : { name: "Explorer" },
    )
  })
})
afterEach(() => {
  for (const key of names) {
    const descriptor = originals[key]
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test("visitors who never signed in make no identity request", async () => {
  const auth = createPublicAuth(config)
  assert.equal(auth.getSnapshot().status, "anonymous")
  await auth.restoreSession()
  assert.equal(frames.length, 0)
  assert.equal(requests.length, 0)
})

test("a reload restores the session silently and keeps tokens out of storage", async () => {
  persisted.set("stream-login-active", "1")
  const auth = createPublicAuth(config)
  assert.equal(auth.getSnapshot().status, "loading")
  let requested
  const appendChild = document.body.appendChild
  document.body.appendChild = (frame) => {
    requested = new URL(frame.src)
    appendChild(frame)
  }
  await auth.restoreSession()
  assert.equal(requested.searchParams.get("prompt"), "none")
  assert.equal(requested.searchParams.get("redirect_uri"), "https://stream.example.test/auth/callback")
  assert.equal(auth.getSnapshot().status, "authenticated")
  assert.equal(auth.getSnapshot().name, "Explorer")
  assert.equal(await auth.accessToken(), "access")
  assert.equal(frames.length, 0)
  assert.deepEqual([...persisted.entries()], [["stream-login-active", "1"]])
  assert.equal(requests[0].options.body.get("code"), "silent-code")
})

test("an ended provider session clears the marker without showing an error", async () => {
  persisted.set("stream-login-active", "1")
  reply = (state) => `?state=${state}&error=login_required`
  const auth = createPublicAuth(config)
  await auth.restoreSession()
  assert.equal(auth.getSnapshot().status, "anonymous")
  assert.equal(auth.getSnapshot().error, undefined)
  assert.equal(persisted.size, 0)
  assert.equal(requests.length, 0)
})

test("a wrong state or no answer never signs in, and a timeout keeps the marker", async () => {
  persisted.set("stream-login-active", "1")
  reply = () => "?state=forged&code=stolen"
  let auth = createPublicAuth(config)
  await auth.restoreSession()
  assert.equal(auth.getSnapshot().status, "anonymous")
  assert.equal(requests.length, 0)

  reply = () => null
  auth = createPublicAuth(config)
  await auth.restoreSession(5)
  assert.equal(auth.getSnapshot().status, "anonymous")
  assert.equal(persisted.get("stream-login-active"), "1")
  assert.equal(frames.length, 0)
})

test("messages from another origin or frame are ignored", async () => {
  persisted.set("stream-login-active", "1")
  reply = () => null
  const auth = createPublicAuth(config)
  const pending = auth.restoreSession(20)
  await new Promise((resolve) => setTimeout(resolve, 1))
  for (const listener of listeners) {
    listener({
      origin: "https://evil.example.test",
      source: frames[0].contentWindow,
      data: { type: "aov-silent-login", search: "" },
    })
    listener({ origin: location.origin, source: {}, data: { type: "aov-silent-login", search: "" } })
  }
  await pending
  assert.equal(persisted.get("stream-login-active"), "1")
  assert.equal(requests.length, 0)
})

test("signing out removes the marker", async () => {
  persisted.set("stream-login-active", "1")
  const auth = createPublicAuth(config)
  await auth.restoreSession()
  auth.signOut(false)
  assert.equal(persisted.size, 0)
  assert.equal(auth.getSnapshot().status, "anonymous")
})

test("only a hidden callback frame relays and skips rendering", () => {
  assert.equal(relaySilentLogin(), false)
  const posted = []
  window.parent = { postMessage: (...args) => posted.push(args) }
  assert.equal(relaySilentLogin(), false)
  location.pathname = "/auth/callback"
  location.search = "?state=s&code=c"
  assert.equal(relaySilentLogin(), true)
  assert.deepEqual(posted, [[{ type: "aov-silent-login", search: "?state=s&code=c" }, "https://stream.example.test"]])
})

test("an app under a base path signs in, returns and signs out inside that path", async () => {
  const auth = createPublicAuth({ ...config, basePath: "/stream/" })
  location.pathname = "/stream/pages/team"
  location.search = "?tab=roster"
  location.hash = "#top"
  let authorize
  location.assign = (url) => {
    authorize = new URL(url)
  }
  await auth.signIn()
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://stream.example.test/stream/auth/callback")

  const flow = JSON.parse(sessionStorage.getItem("stream-login"))
  assert.equal(flow.returnTo, "/pages/team?tab=roster#top")

  define("history", { replaceState() {} })
  location.pathname = "/stream/auth/callback"
  location.search = `?state=${flow.state}&code=code`
  assert.equal(await auth.completeLogin(), "/pages/team?tab=roster#top")
  assert.equal(requests[0].options.body.get("redirect_uri"), "https://stream.example.test/stream/auth/callback")

  let logout
  location.assign = (url) => {
    logout = new URL(url)
  }
  auth.signOut()
  assert.equal(logout.searchParams.get("post_logout_redirect_uri"), "https://stream.example.test/stream/")
})

test("the silent callback relays only on the callback path of the app", () => {
  const messages = []
  const top = {}
  window.parent = { postMessage: (message) => messages.push(message), ...top }
  location.search = "?state=s&code=c"
  location.pathname = "/auth/callback"
  assert.equal(relaySilentLogin("/stream/"), false)
  location.pathname = "/stream/auth/callback"
  assert.equal(relaySilentLogin("/stream/"), true)
  assert.equal(messages[0].search, "?state=s&code=c")
})
