/** Client for /users/me/security on wiki-service (ADR-028), shared by the public apps. */

export type SecurityOverview = {
  email: string | null
  emailVerified: boolean
  password: { set: boolean; updatedAt: string | null }
  passwordChangeAvailable: boolean
  twoFactor: {
    enabled: boolean
    credentialId: string | null
    label: string | null
    createdAt: string | null
    recoveryCodes: {
      credentialId: string
      remaining: number | null
      total: number | null
      createdAt: string | null
    } | null
  }
}
export type PasswordChallenge = {
  challengeId: string
  emailHint: string
  expiresAt: string
  resendAvailableAt: string
}
export type PasswordChangeResult = { otherSessions: "SIGNED_OUT" | "KEPT" | "FAILED"; signedOut: number }
export type AccountSession = {
  id: string
  current: boolean
  ipAddress: string | null
  startedAt: string | null
  lastAccessAt: string | null
  applications: string[]
  device: {
    browser: string | null
    os: string | null
    osVersion: string | null
    device: string | null
    mobile: boolean
  } | null
}
export type SessionList = { sessions: AccountSession[]; deviceDetails: boolean }

/** Problem returned by the API; {@link code} is the stable error code and {@link context} its hints. */
export class AccountSecurityError extends Error {
  readonly status: number
  readonly code: string
  readonly context: Record<string, unknown>

  constructor(status: number, code: string, context: Record<string, unknown> = {}) {
    super(code)
    this.status = status
    this.code = code
    this.context = context
  }
}

export const DEFAULT_ACCOUNT_SECURITY_URL = "/api/wiki/v1/users/me/security"

export function createAccountSecurityApi(accessToken: () => Promise<string>, base = DEFAULT_ACCOUNT_SECURITY_URL) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await accessToken()
    let response: Response
    try {
      response = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new AccountSecurityError(0, "NETWORK_ERROR")
    }
    if (response.status === 204) return undefined as T
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      const context =
        data && typeof data.context === "object" && data.context !== null
          ? (data.context as Record<string, unknown>)
          : {}
      throw new AccountSecurityError(response.status, typeof data?.code === "string" ? data.code : "UNKNOWN", context)
    }
    return data as T
  }
  return {
    overview: () => call<SecurityOverview>("GET", ""),
    startPasswordChange: (language: string) =>
      call<PasswordChallenge>("POST", "/password-change", { language: language.startsWith("en") ? "en" : "vi" }),
    confirmPasswordChange: (
      challengeId: string,
      body: { code: string; newPassword: string; signOutOtherSessions: boolean; language: string },
    ) =>
      call<PasswordChangeResult>("POST", `/password-change/${encodeURIComponent(challengeId)}/confirm`, {
        ...body,
        language: body.language.startsWith("en") ? "en" : "vi",
      }),
    sessions: () => call<SessionList>("GET", "/sessions"),
    signOutSession: (sessionId: string) => call<void>("DELETE", `/sessions/${encodeURIComponent(sessionId)}`),
    signOutOtherSessions: () => call<{ signedOut: number }>("POST", "/sessions/sign-out-others"),
    removeRecoveryCodes: () => call<void>("DELETE", "/two-factor/recovery-codes"),
  }
}
export type AccountSecurityApi = ReturnType<typeof createAccountSecurityApi>

/** Human-readable application names for Keycloak client ids. */
export function applicationName(clientId: string) {
  switch (clientId) {
    case "aov-wiki":
      return "AOV WiKi"
    case "aov-stream":
      return "AOV Stream"
    case "admin-aov":
    case "admin-aov-backend":
      return "AOV Admin"
    default:
      return clientId
  }
}

/** "Chrome/130.0" + "Windows" "10" → "Chrome 130 · Windows 10"; null when Keycloak gave no device details. */
export function deviceName(device: AccountSession["device"]) {
  if (!device) return null
  // Keycloak reports "Chrome/152.0.7977"; the major version is enough to recognise a browser.
  const browser = device.browser?.replace(/^([^/]+)\/(\d+).*$/, "$1 $2") ?? null
  const os = [device.os, device.osVersion].filter((part) => part && part !== "Other" && part !== "Unknown").join(" ")
  return [browser, os].filter(Boolean).join(" · ") || null
}
