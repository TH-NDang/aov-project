import { beforeDomCloses } from "./dom"
import { json, noContent, type Handler } from "./network"

export type SessionOptions = {
  /** Capabilities of the signed-in editor in the wiki service. */
  capabilities?: string[]
  /** Capabilities in the community service; tournament screens read them. */
  communityCapabilities?: string[]
}

/** The signed-in editor every test uses; the token is a placeholder that no service accepts. */
export const editor = (capabilities: string[] = []) => ({
  issuer: "fixture",
  subject: "editor",
  type: "HUMAN" as const,
  displayName: "UI fixture",
  capabilities,
})

/** Answers the sign-in requests of the app: token refresh, sign-out and who the editor is. */
export function sessionRoutes({ capabilities = [], communityCapabilities = [] }: SessionOptions = {}): Handler {
  return (request) => {
    if (request.pathname === "/auth/refresh") return json({ accessToken: "fixture-only", expiresIn: 3600 })
    if (request.pathname === "/auth/logout") return noContent()
    if (request.pathname === "/admin/me" && request.service === "community")
      return json({ capabilities: communityCapabilities })
    if (request.pathname === "/admin/me") return json(editor(capabilities))
    return undefined
  }
}

/**
 * Signs the app in through the session routes; call it after the fetch that answers them is installed. The session
 * ends after the last test, before the window closes.
 */
export async function signIn() {
  const { verifySession, logout } = await import("../../src/app/auth/session")
  await verifySession()
  beforeDomCloses(logout)
}
