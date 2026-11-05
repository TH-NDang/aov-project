import { useSyncExternalStore } from "react"

type Session = { status: "anonymous" | "authenticated" | "loading"; name: string; revision: number; error?: string }
type Credentials = { access: string; refresh?: string; idToken?: string; expires: number }
type Config = {
  issuer: string
  clientId: string
  storageKey: string
  returnPath: string
  profileUrl: string
  nameField: string
  locale: () => string
}
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

export function safeAuthReturnPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u0020]/.test(value)) return fallback
  try {
    const url = new URL(value, "https://aov.invalid")
    return url.origin === "https://aov.invalid" && !url.pathname.startsWith("/auth/")
      ? url.pathname + url.search + url.hash
      : fallback
  } catch {
    return fallback
  }
}

export function publicAuthError(locale = "vi") {
  return locale.startsWith("en")
    ? "Sign-in could not be completed. Please try again."
    : "Chưa hoàn tất đăng nhập. Vui lòng thử lại."
}

const SILENT_MESSAGE = "aov-silent-login"

/**
 * Runs first in each public app. Inside the hidden frame of a silent login the callback only hands its query to the
 * parent page, so the app must not render.
 */
export function relaySilentLogin() {
  if (window.parent === window || location.pathname !== "/auth/callback") return false
  window.parent.postMessage({ type: SILENT_MESSAGE, search: location.search }, location.origin)
  return true
}

/**
 * Each public app owns its PKCE transaction; bearer and refresh tokens stay in memory. A reload therefore starts with
 * no tokens, and restoreSession asks the identity provider again without showing a page. The stored marker holds no
 * credential: it only avoids that request for visitors who never signed in.
 */
export function createPublicAuth(config: Config) {
  const markerKey = `${config.storageKey}-active`
  const hasMarker = () => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(markerKey) === "1"
    } catch {
      return false
    }
  }
  const setMarker = (active: boolean) => {
    try {
      if (typeof localStorage === "undefined") return
      if (active) localStorage.setItem(markerKey, "1")
      else localStorage.removeItem(markerKey)
    } catch {
      // Without storage the session simply ends with the page, as it did before.
    }
  }
  const restorable = () =>
    hasMarker() && typeof window !== "undefined" && window.parent === window && location.pathname !== "/auth/callback"
  let session: Session = { status: restorable() ? "loading" : "anonymous", name: "", revision: 0 }
  let credentials: Credentials | null = null
  let renewing: Promise<string> | null = null
  let completing: Promise<string> | null = null
  let starting: Promise<void> | null = null
  let generation = 0
  const listeners = new Set<() => void>()
  const issuer = config.issuer.replace(/\/$/, "")
  const callback = () => `${location.origin}/auth/callback`
  const publish = (value: Partial<Session>) => {
    session = { ...session, ...value }
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const getSnapshot = () => session
  const useSession = () => useSyncExternalStore(subscribe, getSnapshot)

  function authorizeParams(state: string, challenge: string) {
    return new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callback(),
      response_type: "code",
      response_mode: "query",
      scope: "openid profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ui_locales: config.locale().startsWith("en") ? "en" : "vi",
    })
  }

  function signIn(register = false): Promise<void> {
    if (starting) return starting
    starting = (async () => {
      completing = null
      const verifier = encode(crypto.getRandomValues(new Uint8Array(48)))
      const state = encode(crypto.getRandomValues(new Uint8Array(24)))
      const challenge = encode(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
      )
      sessionStorage.setItem(
        config.storageKey,
        JSON.stringify({
          verifier,
          state,
          created: Date.now(),
          returnTo: location.pathname + location.search + location.hash,
        }),
      )
      const params = authorizeParams(state, challenge)
      location.assign(`${issuer}/protocol/openid-connect/${register ? "registrations" : "auth"}?${params}`)
    })().finally(() => {
      starting = null
    })
    return starting
  }

  async function tokens(values: Record<string, string>, started: number) {
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, ...values }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error("Token exchange failed.")
    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      id_token?: string
      expires_in: number
    }
    if (!data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0)
      throw new Error("Invalid token response.")
    if (started !== generation) throw new Error("Session ended.")
    credentials = {
      access: data.access_token,
      refresh: data.refresh_token,
      idToken: data.id_token,
      expires: Date.now() + data.expires_in * 1000,
    }
    return data.access_token
  }

  async function finishLogin(code: string, verifier: string, started: number) {
    const token = await tokens(
      { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: callback() },
      started,
    )
    const response = await fetch(config.profileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error("Profile connection failed.")
    const me = (await response.json()) as Record<string, unknown>
    if (started !== generation) throw new Error("Session ended.")
    setMarker(true)
    publish({
      status: "authenticated",
      name: typeof me[config.nameField] === "string" ? (me[config.nameField] as string) : "AOV",
      revision: session.revision + 1,
      error: undefined,
    })
  }

  function silentAuthorize(url: string, timeout: number) {
    return new Promise<URLSearchParams>((resolve, reject) => {
      const frame = document.createElement("iframe")
      frame.hidden = true
      frame.title = "Silent sign-in"
      const finish = () => {
        clearTimeout(timer)
        window.removeEventListener("message", onMessage)
        frame.remove()
      }
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return
        if (event.data?.type !== SILENT_MESSAGE) return
        finish()
        resolve(new URLSearchParams(String(event.data.search)))
      }
      const timer = setTimeout(() => {
        finish()
        reject(new Error("Silent sign-in timed out."))
      }, timeout)
      window.addEventListener("message", onMessage)
      frame.src = url
      document.body.appendChild(frame)
    })
  }

  /** Restores the session after a reload or in a new tab, if the identity provider still has one. */
  async function restoreSession(timeout = 8000) {
    if (!restorable() || credentials || completing) return
    const started = generation
    publish({ status: "loading", error: undefined })
    try {
      const verifier = encode(crypto.getRandomValues(new Uint8Array(48)))
      const state = encode(crypto.getRandomValues(new Uint8Array(24)))
      const challenge = encode(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
      )
      const params = authorizeParams(state, challenge)
      params.set("prompt", "none")
      const reply = await silentAuthorize(`${issuer}/protocol/openid-connect/auth?${params}`, timeout)
      if (started !== generation) return
      if (reply.get("state") !== state) throw new Error("Invalid silent sign-in response.")
      const code = reply.get("code")
      if (!code) {
        // The provider answered that nobody is signed in; only then is the marker wrong.
        setMarker(false)
        publish({ status: "anonymous", name: "", error: undefined })
        return
      }
      await finishLogin(code, verifier, started)
    } catch {
      if (started === generation) {
        credentials = null
        publish({ status: "anonymous", name: "", error: undefined })
      }
    }
  }

  function completeLogin(): Promise<string> {
    if (completing) return completing
    const started = generation
    completing = (async () => {
      publish({ status: "loading", error: undefined })
      const saved = sessionStorage.getItem(config.storageKey)
      sessionStorage.removeItem(config.storageKey)
      const params = new URLSearchParams(location.search)
      history.replaceState(null, "", location.pathname)
      if (!saved) throw new Error("Login transaction not found.")
      const flow = JSON.parse(saved) as { state: string; verifier: string; created: number; returnTo: string }
      if (
        typeof flow.state !== "string" ||
        !flow.state ||
        params.get("state") !== flow.state ||
        typeof flow.verifier !== "string" ||
        !/^[A-Za-z0-9_-]{43,128}$/.test(flow.verifier) ||
        !Number.isFinite(flow.created) ||
        Date.now() < flow.created ||
        Date.now() - flow.created > 10 * 60_000 ||
        params.has("error") ||
        !params.get("code")
      )
        throw new Error("Invalid or expired login transaction.")
      await finishLogin(params.get("code")!, flow.verifier, started)
      return safeAuthReturnPath(flow.returnTo, config.returnPath)
    })().catch((error: unknown) => {
      if (started === generation) {
        credentials = null
        publish({ status: "anonymous", name: "", error: publicAuthError(config.locale()) })
      }
      throw error
    })
    return completing
  }

  async function accessToken(): Promise<string> {
    if (!credentials) throw new Error("Authentication required.")
    if (credentials.expires > Date.now() + 30000) return credentials.access
    if (!credentials.refresh) {
      signOut(false)
      throw new Error("Session expired.")
    }
    const started = generation
    renewing ??= tokens({ grant_type: "refresh_token", refresh_token: credentials.refresh }, started)
      .catch((error: unknown) => {
        if (started === generation) signOut(false)
        throw error
      })
      .finally(() => {
        if (started === generation) renewing = null
      })
    return renewing
  }

  function signOut(remote = true) {
    generation++
    const idToken = credentials?.idToken
    credentials = null
    completing = null
    renewing = null
    sessionStorage.removeItem(config.storageKey)
    setMarker(false)
    publish({ status: "anonymous", name: "", revision: session.revision + 1, error: undefined })
    if (remote && idToken)
      location.assign(
        `${issuer}/protocol/openid-connect/logout?${new URLSearchParams({ id_token_hint: idToken, post_logout_redirect_uri: location.origin + config.returnPath })}`,
      )
  }
  return { useSession, signIn, signOut, accessToken, completeLogin, restoreSession, getSnapshot }
}
