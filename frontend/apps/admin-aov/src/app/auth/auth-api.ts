import { ApiError } from "../../lib/api/errors"

export function createAuthRequest(fetcher: typeof fetch = fetch) {
  return async function request<T>(path: "login" | "refresh" | "logout" | "google", body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetcher("/api/wiki/v1/auth/" + path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "Content-Type": "application/json", "X-AOV-Auth": "1" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại.")
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}))
      throw new ApiError({ ...problem, status: response.status, code: problem.code ?? "HTTP_ERROR" })
    }
    return response.status === 204 ? (undefined as T) : response.json()
  }
}

export function isGoogleCompletion(event: MessageEvent, popup: Window, state: string, origin: string) {
  return (
    event.origin === origin &&
    event.source === popup &&
    event.data?.type === "aov-google-complete" &&
    event.data.state === state &&
    typeof event.data.status === "string"
  )
}

/**
 * BroadcastChannel of a Google popup that lost its opener (a COOP header on its path does that); public/auth/
 * google-complete.js posts to the same name. Only pages of this origin can post on it.
 */
export const GOOGLE_CHANNEL = "aov-admin-google"

export function isGoogleBroadcast(
  data: unknown,
  state: string,
): data is { type: "aov-google-complete"; state: string; status: string } {
  const message = data as { type?: unknown; state?: unknown; status?: unknown } | null
  return (
    typeof message === "object" &&
    message !== null &&
    message.type === "aov-google-complete" &&
    message.state === state &&
    typeof message.status === "string"
  )
}

/** sessionStorage key of a same-page Google sign-in; public/auth/google-complete.js writes the same key. */
export const GOOGLE_REDIRECT_KEY = "aov-admin-google-redirect"

export type GoogleRedirectOutcome =
  { kind: "completion"; status: string } | { kind: "keycloak-error"; code: string } | { kind: "abandoned" }

/**
 * Outcome of a same-page Google sign-in, started when the browser blocked the popup. The completion page adds the
 * backend status to the saved entry; the Keycloak error page (theme aov-admin) returns with `#google-error=CODE`.
 * Without a saved entry nothing was started here, so a fragment alone is ignored.
 */
export function googleRedirectOutcome(saved: string | null, hash: string): GoogleRedirectOutcome | null {
  let entry: unknown
  try {
    entry = saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
  if (!entry || typeof entry !== "object" || typeof (entry as { state?: unknown }).state !== "string") return null
  const status = (entry as { status?: unknown }).status
  if (typeof status === "string") return { kind: "completion", status }
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("google-error")
  return code ? { kind: "keycloak-error", code } : { kind: "abandoned" }
}

// The Keycloak error page of the popup (theme aov-admin) sends a code instead of showing its own screen.
export function isGoogleError(event: MessageEvent, popup: Window, keycloakOrigin: string) {
  return (
    event.origin === keycloakOrigin &&
    event.source === popup &&
    event.data?.type === "aov-google-error" &&
    typeof event.data.code === "string"
  )
}
