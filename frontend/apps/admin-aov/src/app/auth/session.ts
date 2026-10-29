import { randomId } from "@/lib/random-id"
import { createAuthRequest, isGoogleCompletion } from "./auth-api"
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
  AUTH_INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu chưa đúng, hoặc tài khoản cần hoàn tất xác minh tại Keycloak.",
  AUTH_SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  AUTH_RATE_LIMITED: "Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.",
  AUTH_PROVIDER_UNAVAILABLE: "Chưa kết nối được Keycloak. Hãy kiểm tra cấu hình backend.",
  AUTH_GOOGLE_DISABLED: "Đăng nhập Google chưa được cấu hình.",
  AUTH_ORIGIN_REJECTED: "Địa chỉ admin chưa được cho phép trong cấu hình backend.",
  FORBIDDEN: "Tài khoản chưa được cấp quyền truy cập trang quản trị.",
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
}
export async function loginPassword(username: string, password: string) {
  const current = ++generation
  try {
    await sessionLock(async () => {
      const result = await authRequest<TokenResponse>("login", { username, password })
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
  if (!popup) return Promise.reject(new Error("Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại."))
  return new Promise((resolve, reject) => {
    let state: string | undefined
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
      if (done || !state || !isGoogleCompletion(event, popup, state, window.location.origin)) return
      const status = event.data.status
      if (status !== "success") {
        fail(messages[status] ?? "Đăng nhập Google đã hủy hoặc không thành công.")
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
