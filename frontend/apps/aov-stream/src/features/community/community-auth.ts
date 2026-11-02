import { useSyncExternalStore } from "react"

type Session = { status: "anonymous" | "authenticated" | "loading"; name: string; revision: number; error?: string }
let session: Session = { status: "anonymous", name: "", revision: 0 }
let credentials: { access: string; refresh?: string; idToken?: string; expires: number } | null = null
let renewing: Promise<string> | null = null
let completing: Promise<string> | null = null
let generation = 0
const listeners = new Set<() => void>()
const issuer = (import.meta.env.VITE_AUTH_ISSUER || "http://localhost:8081/realms/wikiaov").replace(/\/$/, "")
const clientId = import.meta.env.VITE_AUTH_CLIENT_ID || "aov-stream"
const callback = () => `${location.origin}/auth/callback`
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
const publish = (value: Partial<Session>) => {
  session = { ...session, ...value }
  listeners.forEach((listener) => listener())
}
export const useCommunitySession = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => session,
  )

export async function signIn(register = false) {
  completing = null
  const verifier = encode(crypto.getRandomValues(new Uint8Array(48)))
  const state = encode(crypto.getRandomValues(new Uint8Array(24)))
  const challenge = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))
  sessionStorage.setItem(
    "community-login",
    JSON.stringify({
      verifier,
      state,
      created: Date.now(),
      returnTo: location.pathname + location.search + location.hash,
    }),
  )
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback(),
    response_type: "code",
    response_mode: "query",
    scope: "openid profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
  location.assign(`${issuer}/protocol/openid-connect/${register ? "registrations" : "auth"}?${params}`)
}

async function tokens(values: Record<string, string>) {
  const started = generation
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...values }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.")
  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in: number
  }
  if (!data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0)
    throw new Error("Không nhận được phiên đăng nhập hợp lệ.")
  if (started !== generation) throw new Error("Phiên đăng nhập đã kết thúc.")
  credentials = {
    access: data.access_token,
    refresh: data.refresh_token,
    idToken: data.id_token,
    expires: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

export function completeLogin(): Promise<string> {
  if (completing) return completing
  completing = (async () => {
    publish({ status: "loading" })
    const saved = sessionStorage.getItem("community-login")
    sessionStorage.removeItem("community-login")
    const params = new URLSearchParams(location.search)
    history.replaceState(null, "", location.pathname)
    if (!saved) throw new Error("Không tìm thấy phiên đăng nhập. Vui lòng thử lại.")
    const flow = JSON.parse(saved) as { state: string; verifier: string; created: number; returnTo: string }
    if (
      params.get("state") !== flow.state ||
      Date.now() - flow.created > 10 * 60_000 ||
      params.has("error") ||
      !params.get("code")
    )
      throw new Error("Đăng nhập chưa hoàn tất hoặc đã hết hạn.")
    await tokens({
      grant_type: "authorization_code",
      code: params.get("code")!,
      code_verifier: flow.verifier,
      redirect_uri: callback(),
    })
    const response = await fetch("/api/community/v1/me", {
      headers: { Authorization: `Bearer ${credentials!.access}` },
      cache: "no-store",
      credentials: "omit",
    })
    if (!response.ok)
      throw new Error("Tài khoản chưa kết nối được với cộng đồng. Vui lòng kiểm tra cấu hình đăng nhập.")
    const me = (await response.json()) as { name: string }
    publish({ status: "authenticated", name: me.name, revision: session.revision + 1, error: undefined })
    return flow.returnTo?.startsWith("/") && !flow.returnTo.startsWith("//") && !flow.returnTo.startsWith("/auth/")
      ? flow.returnTo
      : "/pages"
  })().catch((error) => {
    credentials = null
    publish({ status: "anonymous", error: error instanceof Error ? error.message : "Chưa đăng nhập được." })
    throw error
  })
  return completing
}

export async function accessToken(): Promise<string> {
  if (!credentials) throw new Error("Bạn cần đăng nhập để thực hiện thao tác này.")
  if (credentials.expires > Date.now() + 30000) return credentials.access
  if (!credentials.refresh) {
    signOut(false)
    throw new Error("Phiên đăng nhập đã hết hạn.")
  }
  renewing ??= tokens({ grant_type: "refresh_token", refresh_token: credentials.refresh })
    .catch((error) => {
      signOut(false)
      throw error
    })
    .finally(() => {
      renewing = null
    })
  return renewing
}

export function signOut(remote = true) {
  generation++
  const idToken = credentials?.idToken
  credentials = null
  completing = null
  publish({ status: "anonymous", name: "", revision: session.revision + 1 })
  if (remote && idToken)
    location.assign(
      `${issuer}/protocol/openid-connect/logout?${new URLSearchParams({ id_token_hint: idToken, post_logout_redirect_uri: location.origin + "/pages" })}`,
    )
}
