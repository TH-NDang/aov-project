/** Stands in for `src/lib/stream-auth.ts`: a session a test sets itself, and sign-in calls it records. */
import { useSyncExternalStore } from "react"

type Session = { status: "anonymous" | "authenticated" | "loading"; name: string; revision: number; error?: string }

let session: Session = { status: "anonymous", name: "", revision: 0 }
const listeners = new Set<() => void>()

/** Every call of `signIn`, with its arguments. */
export const signIns: unknown[][] = []

/** Replaces the session every screen reads, as a sign-in or a sign-out would. */
export function setSession(next: Partial<Session>) {
  session = { ...session, ...next }
  listeners.forEach((listener) => listener())
}

export const signedIn = (name = "Linh") => setSession({ status: "authenticated", name, revision: 1 })

export async function signIn(...args: unknown[]) {
  signIns.push(args)
}

export async function signOut() {
  setSession({ status: "anonymous", name: "" })
}

export async function accessToken() {
  return session.status === "authenticated" ? "token-1" : null
}

export async function completeLogin() {
  return null
}

export function useCommunitySession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => session,
  )
}
