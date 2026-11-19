/** Account data and a recording fake of the account security client, shared by the account settings tests. */
import type {
  AccountSecurityApi,
  PasswordChallenge,
  SecurityOverview,
  SessionList,
} from "../../src/lib/account-security.ts"

export const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
export const secondsFromNow = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()

/** An account with a verified email, a password and two-step sign-in off; `change` replaces top-level fields. */
export function overviewWith(change: Partial<SecurityOverview> = {}): SecurityOverview {
  return {
    email: "player@example.test",
    emailVerified: true,
    password: { set: true, updatedAt: "2026-10-01T08:00:00Z" },
    passwordChangeAvailable: true,
    twoFactor: { enabled: false, credentialId: null, label: null, createdAt: null, recoveryCodes: null },
    ...change,
  }
}

/** Two-step sign-in on with the authenticator `otp-1` and 8 of 10 recovery codes left. */
export const twoFactorOn: SecurityOverview["twoFactor"] = {
  enabled: true,
  credentialId: "otp-1",
  label: "Pixel",
  createdAt: "2026-09-01T08:00:00Z",
  recoveryCodes: { credentialId: "codes-1", remaining: 8, total: 10, createdAt: "2026-09-01T08:00:00Z" },
}

/** This browser and two other devices. */
export function sessionList(): SessionList {
  return {
    deviceDetails: true,
    sessions: [
      {
        id: "s-current",
        current: true,
        ipAddress: "198.51.100.1",
        startedAt: hoursAgo(1),
        lastAccessAt: hoursAgo(0),
        applications: ["aov-wiki"],
        device: { browser: "Firefox/140.0", os: "Windows", osVersion: "11", device: null, mobile: false },
      },
      {
        id: "s-phone",
        current: false,
        ipAddress: "203.0.113.7",
        startedAt: hoursAgo(30),
        lastAccessAt: hoursAgo(2),
        applications: ["aov-stream", "aov-wiki"],
        device: { browser: "Chrome/130.0.6723", os: "Android", osVersion: "14", device: null, mobile: true },
      },
      {
        id: "s-old",
        current: false,
        ipAddress: null,
        startedAt: null,
        lastAccessAt: null,
        applications: [],
        device: null,
      },
    ],
  }
}

export function challengeWith(change: Partial<PasswordChallenge> = {}): PasswordChallenge {
  return {
    challengeId: "challenge-1",
    emailHint: "p***@example.test",
    expiresAt: secondsFromNow(600),
    resendAvailableAt: secondsFromNow(-1),
    ...change,
  }
}

type Answers = { [Name in keyof AccountSecurityApi]?: AccountSecurityApi[Name] }
export type Call = { name: keyof AccountSecurityApi; args: unknown[] }

/** A fake client that answers from `answers` (a healthy account by default) and records every call in order. */
export function fakeAccountApi(answers: Answers = {}) {
  const calls: Call[] = []
  const defaults: AccountSecurityApi = {
    overview: async () => overviewWith(),
    sessions: async () => sessionList(),
    startPasswordChange: async () => challengeWith(),
    confirmPasswordChange: async () => ({ otherSessions: "KEPT", signedOut: 0 }),
    signOutSession: async () => undefined,
    signOutOtherSessions: async () => ({ signedOut: 2 }),
    removeRecoveryCodes: async () => undefined,
  }
  const answer = { ...defaults, ...answers } as Record<string, (...args: unknown[]) => Promise<unknown>>
  const api = Object.fromEntries(
    Object.keys(defaults).map((name) => [
      name,
      (...args: unknown[]) => {
        calls.push({ name: name as keyof AccountSecurityApi, args })
        return answer[name]!(...args)
      },
    ]),
  ) as AccountSecurityApi
  return { api, calls, callsTo: (name: keyof AccountSecurityApi) => calls.filter((call) => call.name === name) }
}

/** A recording `startAction`; it resolves, as the real one does before the page leaves for the identity provider. */
export function recordedActions() {
  const actions: unknown[][] = []
  const startAction = async (...args: unknown[]) => {
    actions.push(args)
  }
  return { actions, startAction }
}
