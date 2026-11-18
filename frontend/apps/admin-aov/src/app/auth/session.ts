import { randomId } from "@/lib/random-id"
import {
  GOOGLE_REDIRECT_KEY,
  createAuthRequest,
  googleRedirectOutcome,
  isGoogleCompletion,
  isGoogleError,
} from "./auth-api"
import { createAuthenticatedClient } from "@/lib/api/authenticated-client"
import { ApiError } from "@/lib/api/errors"

export interface Actor {
  issuer: string
  subject: string
  type: "HUMAN" | "SERVICE"
  displayName: string | null
  capabilities: string[]
}
interface Session {
  status: "loading" | "anonymous" | "authenticated" | "error"
  actor: Actor | null
  googleEnabled: boolean
  error?: string
}
interface TokenResponse {
  accessToken: string
  expiresIn: number
}
let session: Session = { status: "loading", actor: null, googleEnabled: false }
let token: { value: string; expiresAt: number } | null = null
let refreshPending: Promise<void> | null = null
let generation = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("aov-admin-session")
const messages: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS:
    "Tên đăng nhập, mật khẩu hoặc mã xác thực 2 bước chưa đúng. Tài khoản đã bật xác thực 2 bước cần nhập mã 6 số mới nhất.",
  AUTH_SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  AUTH_RATE_LIMITED: "Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.",
  AUTH_PROVIDER_UNAVAILABLE: "Chưa kết nối được Keycloak. Hãy kiểm tra cấu hình máy chủ.",
  AUTH_GOOGLE_DISABLED: "Đăng nhập Google chưa được cấu hình.",
  AUTH_ORIGIN_REJECTED: "Địa chỉ admin chưa được cho phép trong cấu hình máy chủ.",
  FORBIDDEN: "Tài khoản chưa được cấp quyền truy cập trang quản trị.",
}
// Codes sent by the Keycloak error page of the Google popup (theme aov-admin).
const googleErrors: Record<string, string> = {
  REJECTED: "Đăng nhập Google bị từ chối. Vui lòng thử lại hoặc báo quản trị viên.",
  ACCOUNT_DISABLED: "Tài khoản này đang bị khóa. Hãy liên hệ quản trị viên.",
  EXPIRED: "Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.",
  UNKNOWN: "Đăng nhập Google không thành công. Vui lòng thử lại.",
}
const googleCancelled = "Đăng nhập Google đã hủy hoặc không thành công."
/** Reads and clears the outcome of a same-page Google sign-in; returns the message to show, if any. */
function takeGoogleRedirect(): string | undefined {
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(GOOGLE_REDIRECT_KEY)
    sessionStorage.removeItem(GOOGLE_REDIRECT_KEY)
  } catch {
    /* Storage is blocked: no same-page sign-in can have been started. */
  }
  const outcome = googleRedirectOutcome(saved, location.hash)
  if (new URLSearchParams(location.hash.replace(/^#/, "")).has("google-error"))
    history.replaceState(history.state, "", location.pathname + location.search)
  if (outcome?.kind === "keycloak-error") return googleErrors[outcome.code] ?? googleErrors.UNKNOWN
  if (outcome?.kind === "completion" && outcome.status !== "success") return messages[outcome.status] ?? googleCancelled
  return undefined
}
/** Same-page Google sign-in, used when the browser blocks the popup. The page leaves, so this never settles. */
async function loginGoogleInPage(): Promise<never> {
  const result = await authRequest<{ state: string; authorizationUrl: string }>("google")
  try {
    sessionStorage.setItem(
      GOOGLE_REDIRECT_KEY,
      JSON.stringify({ state: result.state, returnTo: location.pathname + location.search }),
    )
  } catch {
    /* Without storage the sign-in still works; only a failure message is lost. */
  }
  window.location.assign(result.authorizationUrl)
  return new Promise<never>(() => {})
}
export function authMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? "Không thể hoàn tất đăng nhập. Vui lòng thử lại."
  return error instanceof Error ? error.message : "Không thể kết nối máy chủ."
}
function publish(next: Partial<Session>) {
  session = { ...session, ...next }
  listeners.forEach((listener) => listener())
}
export const getSession = () => session
export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function expireSession() {
  generation++
  token = null
  clearTimeout(refreshTimer)
  publish({ status: "anonymous", actor: null, error: undefined })
}
if (channel)
  channel.onmessage = (event) => {
    if (event.data === "logout") {
      cancelLogin()
      expireSession()
    }
  }
const authRequest = createAuthRequest()
/** Serialize refresh-cookie rotation across tabs where Web Locks are available. */
async function sessionLock<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request("aov-admin-refresh", action) : action()
}
function acceptToken(result: TokenResponse) {
  if (!result.accessToken || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0)
    throw new Error("Phiên đăng nhập không hợp lệ.")
  token = { value: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 }
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(
    () => {
      void refreshSession().catch(() => {})
    },
    Math.max(1000, (result.expiresIn - 30) * 1000),
  )
}
function refreshSession(): Promise<void> {
  if (refreshPending) return refreshPending
  const current = generation
  refreshPending = sessionLock(async () => {
    if (current !== generation) return
    const result = await authRequest<TokenResponse>("refresh")
    if (current === generation) acceptToken(result)
  })
    .catch((error) => {
      if (current === generation) {
        expireSession()
        if (!(error instanceof ApiError && error.status === 401))
          publish({ status: "error", error: authMessage(error) })
      }
      throw error
    })
    .finally(() => {
      refreshPending = null
    })
  return refreshPending
}
async function getToken() {
  if (!token || token.expiresAt <= Date.now() + 30000) await refreshSession()
  if (!token) throw new ApiError({ status: 401, code: "AUTH_SESSION_EXPIRED" })
  return token.value
}
export const backendRequest = createAuthenticatedClient(getToken, expireSession)
export const communityRequest = createAuthenticatedClient(getToken, expireSession, fetch, "/api/community/v1")
async function readActor() {
  const current = generation
  const actor = await backendRequest<Actor>("/admin/me")
  if (current === generation && token) publish({ status: "authenticated", actor, error: undefined })
}
export async function verifySession() {
  const current = generation
  publish({ status: "loading", actor: null, error: undefined })
  try {
    await refreshSession()
    if (current === generation) await readActor()
  } catch (error) {
    if (current === generation) publish({ status: "error", actor: null, error: authMessage(error) })
  }
}
export async function initializeSession() {
  const googleError = takeGoogleRedirect()
  try {
    const response = await fetch("/api/wiki/v1/auth/config", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    if (response.ok) {
      const config = await response.json()
      publish({ googleEnabled: config.googleEnabled === true })
    }
  } catch {
    /* The session request below reports backend connection errors. */
  }
  await verifySession()
  if (googleError && session.status === "anonymous") publish({ error: googleError })
}
/** `otp` is the six-digit authenticator code for accounts with two-step sign-in (ADR-028). */
export async function loginPassword(username: string, password: string, otp?: string) {
  const current = ++generation
  try {
    await sessionLock(async () => {
      const result = await authRequest<TokenResponse>(
        "login",
        otp ? { username, password, otp } : { username, password },
      )
      if (current === generation) acceptToken(result)
    })
    if (current === generation) await readActor()
  } catch (error) {
    if (current === generation) expireSession()
    throw error
  }
}
let cancelPopup: (() => void) | undefined
export function cancelLogin() {
  cancelPopup?.()
}
export function loginGoogle(): Promise<void> {
  cancelLogin()
  if (!session.googleEnabled) return Promise.reject(new Error(messages.AUTH_GOOGLE_DISABLED))
  const popup = window.open(
    import.meta.env.BASE_URL + "auth/google-wait.html",
    "aov-google-" + randomId(),
    "popup=yes,width=480,height=740,left=" +
      Math.max(0, window.screenX + (window.outerWidth - 480) / 2) +
      ",top=" +
      Math.max(0, window.screenY + (window.outerHeight - 740) / 2),
  )
  if (!popup) return loginGoogleInPage()
  return new Promise((resolve, reject) => {
    let state: string | undefined
    let keycloakOrigin: string | undefined
    let done = false
    const cleanup = () => {
      done = true
      window.removeEventListener("message", receive)
      clearInterval(closed)
      clearTimeout(timeout)
      cancelPopup = undefined
      popup.close()
    }
    const fail = (message: string) => {
      if (!done) {
        cleanup()
        reject(new Error(message))
      }
    }
    const receive = (event: MessageEvent) => {
      if (!done && keycloakOrigin && isGoogleError(event, popup, keycloakOrigin)) {
        fail(googleErrors[event.data.code] ?? googleErrors.UNKNOWN)
        return
      }
      if (done || !state || !isGoogleCompletion(event, popup, state, window.location.origin)) return
      const status = event.data.status
      if (status !== "success") {
        fail(messages[status] ?? googleCancelled)
        return
      }
      cleanup()
      void refreshSession().then(readActor).then(resolve, reject)
    }
    const closed = window.setInterval(() => {
      if (popup.closed) fail("Cửa sổ đăng nhập đã đóng. Bạn có thể thử lại.")
    }, 500)
    const timeout = window.setTimeout(() => fail("Đã hết thời gian chờ đăng nhập."), 300000)
    cancelPopup = () => fail("Đã hủy đăng nhập.")
    window.addEventListener("message", receive)
    void authRequest<{ state: string; authorizationUrl: string }>("google").then(
      (result) => {
        if (done) return
        state = result.state
        keycloakOrigin = new URL(result.authorizationUrl, window.location.href).origin
        popup.location.href = result.authorizationUrl
      },
      (error) => fail(authMessage(error)),
    )
  })
}
export async function logout() {
  cancelLogin()
  expireSession()
  channel?.postMessage("logout")
  try {
    await sessionLock(() => authRequest<void>("logout"))
  } catch (error) {
    publish({
      status: "error",
      error: "Chưa thu hồi được phiên trên máy chủ. Bấm Đăng xuất để thử lại. " + authMessage(error),
    })
  }
}
