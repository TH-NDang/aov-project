import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { LocalBroadcastChannel } from "./fixtures/broadcast-channel"
import { createScriptWindow, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, noContent } from "./fixtures/network"
import { editor } from "./fixtures/session"

const state = "s".repeat(43)
let cookie = false
const backend = fakeBackend((request) => {
  if (request.pathname === "/auth/config") return json({ googleEnabled: true })
  if (request.pathname === "/auth/google")
    return json({ state, authorizationUrl: "http://localhost/idp/realms/wikiaov/protocol/openid-connect/auth" })
  if (request.pathname === "/auth/refresh")
    return cookie
      ? json({ accessToken: "fixture-only", expiresIn: 3600 })
      : json({ code: "AUTH_SESSION_EXPIRED", status: 401 }, 401)
  if (request.pathname === "/auth/logout") return noContent()
  if (request.pathname === "/admin/me") return json(editor())
  return undefined
})
// The session reads the page address and history for a same-page sign-in that comes back.
const dom = withDom({
  globals: (window) => ({
    fetch: backend.fetch,
    location: window.location,
    history: window.history,
    BroadcastChannel: LocalBroadcastChannel,
  }),
})

/** Stands in for the popup window Admin opens; `closed` turns true when it moves to another browsing context group. */
function fakePopup() {
  const popup = { closed: false, close() {}, location: { href: "" } }
  dom.window.open = (() => popup) as unknown as typeof window.open
  return popup
}

function announce(message: unknown) {
  return import("../src/app/auth/auth-api").then(({ GOOGLE_CHANNEL }) => {
    const channel = new BroadcastChannel(GOOGLE_CHANNEL)
    channel.postMessage(message)
    channel.close()
  })
}

test("a Google popup that lost its opener still signs Admin in through the channel", async () => {
  const { getSession, initializeSession, loginGoogle, logout } = await import("../src/app/auth/session")
  await initializeSession()
  const popup = fakePopup()
  const login = loginGoogle()
  await waitFor(() => popup.location.href, "The popup goes to Keycloak")
  popup.closed = true
  await assert.rejects(login, /Cửa sổ đăng nhập đã đóng/)

  cookie = true
  await announce({ type: "aov-google-complete", state: "x".repeat(43), status: "success" })
  await announce({ type: "aov-google-complete", state, status: "success" })

  await waitFor(() => getSession().status === "authenticated", "Admin signs in from the channel")
  assert.equal(backend.requests.filter((request) => request.pathname === "/auth/refresh").length, 2)
  cookie = false
  await logout()
})

test("a Google sign-in the editor cancelled is not completed by a later message", async () => {
  const { cancelLogin, getSession, loginGoogle } = await import("../src/app/auth/session")
  const popup = fakePopup()
  const login = loginGoogle()
  await waitFor(() => popup.location.href, "The popup goes to Keycloak")
  cancelLogin()
  await assert.rejects(login, /Đã hủy đăng nhập/)
  const refreshes = backend.requests.filter((request) => request.pathname === "/auth/refresh").length

  cookie = true
  await announce({ type: "aov-google-complete", state, status: "success" })

  await assert.rejects(
    waitFor(() => getSession().status === "authenticated", { timeout: 300 }),
    "The cancelled sign-in stays cancelled",
  )
  assert.equal(backend.requests.filter((request) => request.pathname === "/auth/refresh").length, refreshes)
  cookie = false
})

/** The completion page of the popup at its address, with its script run as the browser would run it. */
function completionPage(fragment: string, opener: unknown = null) {
  const html = readFileSync(new URL("../public/auth/google-complete.html", import.meta.url), "utf8")
  const page = createScriptWindow("http://localhost/admin/auth/google-complete.html#" + fragment, html)
  let closes = 0
  Object.assign(page.window, { BroadcastChannel: LocalBroadcastChannel, opener, close: () => closes++ })
  page.window.eval(readFileSync(new URL("../public/auth/google-complete.js", import.meta.url), "utf8"))
  return { text: () => page.window.document.getElementById("status")!.textContent, closes: () => closes }
}

test("the completion page of a popup that lost its opener tells Admin on the channel and closes", async () => {
  const { GOOGLE_CHANNEL } = await import("../src/app/auth/auth-api")
  const admin = new LocalBroadcastChannel(GOOGLE_CHANNEL)
  const received: unknown[] = []
  admin.onmessage = (event) => received.push(event.data)

  const page = completionPage(`state=${state}&status=success`)

  await waitFor(() => received.length > 0 && page.closes() === 1, "The page announces and closes")
  admin.close()
  assert.deepEqual(received, [{ type: "aov-google-complete", state, status: "success" }])
  assert.equal(page.text(), "Đăng nhập thành công. Bạn có thể đóng cửa sổ này.")
})

test("the completion page of a popup with its opener reports by postMessage only", async () => {
  const { GOOGLE_CHANNEL } = await import("../src/app/auth/auth-api")
  const admin = new LocalBroadcastChannel(GOOGLE_CHANNEL)
  const broadcasts: unknown[] = []
  admin.onmessage = (event) => broadcasts.push(event.data)
  const posted: unknown[][] = []

  // A copy, as postMessage makes one: the page builds its message in a window of its own.
  const opener = { postMessage: (...args: unknown[]) => posted.push(structuredClone(args)) }
  completionPage(`state=${state}&status=FORBIDDEN`, opener)

  await waitFor(() => posted.length > 0, "The page posts to its opener")
  admin.close()
  assert.deepEqual(posted, [[{ type: "aov-google-complete", state, status: "FORBIDDEN" }, "http://localhost"]])
  assert.deepEqual(broadcasts, [])
})
