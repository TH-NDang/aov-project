import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAccountCurrency } from "@aov/ui/lib/currency"
import { createPublicAuth } from "@aov/ui/lib/public-auth"
import { useAccountTimeZone } from "@aov/ui/lib/time-zone"
import { useAccountDateFormat } from "@aov/ui/lib/time-zone"

const auth = createPublicAuth({
  issuer: import.meta.env.VITE_AUTH_ISSUER || "http://localhost:8081/realms/wikiaov",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID || "aov-wiki",
  storageKey: "wiki-login",
  returnPath: "/",
  profileUrl: "/api/wiki/v1/users/me",
  nameField: "displayName",
  locale: () => document.documentElement.lang || "vi",
})
export const { signIn, signOut, completeLogin, useSession: useWikiSession } = auth
void auth.restoreSession()

type WikiProfile = {
  id: string | null
  displayName: string
  biography: string
  locale: string
  timeZone: string
  dateFormat?: string
  currency: string | null
  avatarAssetId: string | null
  version: number
}

async function requestProfile(init: RequestInit = {}) {
  const timeout = AbortSignal.timeout(20000)
  const response = await fetch("/api/wiki/v1/users/me", {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.accessToken()}` },
    credentials: "omit",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("User profile is unavailable.")
  return (await response.json()) as WikiProfile
}

/** Keeps the shared account's time zone and currency in step with this browser's choices while someone is signed in. */
export function useWikiAccountPreferences() {
  const session = useWikiSession()
  const client = useQueryClient()
  const key = ["wiki", "user-profile", session.revision]
  const profile = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => requestProfile({ signal }),
    enabled: session.status === "authenticated",
    staleTime: 5 * 60_000,
    retry: 1,
  })
  useAccountTimeZone(profile.data, async (timeZone) => {
    // Stream and Admin share this profile, so the copy on this page may be out of date.
    const { displayName, biography, locale, avatarAssetId, version } = await requestProfile()
    const saved = await requestProfile({
      method: "PUT",
      body: JSON.stringify({ displayName, biography, locale, timeZone, avatarAssetId, expectedVersion: version }),
    })
    client.setQueryData(key, saved)
  })
  useAccountDateFormat(profile.data, async (dateFormat) => {
    const { displayName, biography, locale, timeZone, avatarAssetId, version } = await requestProfile()
    const saved = await requestProfile({
      method: "PUT",
      body: JSON.stringify({
        displayName,
        biography,
        locale,
        timeZone,
        dateFormat,
        avatarAssetId,
        expectedVersion: version,
      }),
    })
    client.setQueryData(key, saved)
  })
  useAccountCurrency(profile.data, async (currency) => {
    const { displayName, biography, locale, timeZone, avatarAssetId, version } = await requestProfile()
    const saved = await requestProfile({
      method: "PUT",
      body: JSON.stringify({
        displayName,
        biography,
        locale,
        timeZone,
        currency,
        avatarAssetId,
        expectedVersion: version,
      }),
    })
    client.setQueryData(key, saved)
  })
}
