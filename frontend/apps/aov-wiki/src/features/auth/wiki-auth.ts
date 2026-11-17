import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAccountCurrency } from "@aov/ui/lib/currency"
import { createPublicAuth, type AccountAction } from "@aov/ui/lib/public-auth"
import { useAccountTimeZone } from "@aov/ui/lib/time-zone"
import { useAccountDateFormat } from "@aov/ui/lib/time-zone"
import { WIKI_API_ROOT, wikiRequest, type WikiRequest } from "../../lib/wiki-api"

/** Every query key of the signed-in account; the revision changes on every sign-in and sign-out. */
export const accountKeys = {
  profile: (revision: number) => ["wiki", "user-profile", revision] as const,
}

const auth = createPublicAuth({
  issuer: import.meta.env.VITE_AUTH_ISSUER || "http://localhost:8081/realms/wikiaov",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID || "aov-wiki",
  storageKey: "wiki-login",
  returnPath: "/",
  profileUrl: `${WIKI_API_ROOT}/users/me`,
  nameField: "displayName",
  locale: () => document.documentElement.lang || "vi",
})
export const {
  signIn,
  signOut,
  completeLogin,
  accountActionResult,
  clearAccountActionResult,
  useSession: useWikiSession,
} = auth
/** The signed-in reader's bearer token for personal requests; rejects when nobody is signed in. */
export const wikiAccessToken = () => auth.accessToken()

/** Runs a Keycloak account action (authenticator, recovery codes, removal) and returns to the current page. */
export function startAccountAction(action: AccountAction, options: { reauthenticate?: boolean } = {}) {
  return signIn(false, { action, reauthenticate: options.reauthenticate })
}
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

async function requestProfile(request: Pick<WikiRequest, "method" | "body" | "signal"> = {}) {
  return wikiRequest<WikiProfile>("/users/me", { ...request, token: await auth.accessToken(), timeoutMs: 20_000 })
}

/** Keeps the shared account's time zone and currency in step with this browser's choices while someone is signed in. */
export function useWikiAccountPreferences() {
  const session = useWikiSession()
  const client = useQueryClient()
  const key = accountKeys.profile(session.revision)
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
      body: { displayName, biography, locale, timeZone, avatarAssetId, expectedVersion: version },
    })
    client.setQueryData(key, saved)
  })
  useAccountDateFormat(profile.data, async (dateFormat) => {
    const { displayName, biography, locale, timeZone, avatarAssetId, version } = await requestProfile()
    const saved = await requestProfile({
      method: "PUT",
      body: {
        displayName,
        biography,
        locale,
        timeZone,
        dateFormat,
        avatarAssetId,
        expectedVersion: version,
      },
    })
    client.setQueryData(key, saved)
  })
  useAccountCurrency(profile.data, async (currency) => {
    const { displayName, biography, locale, timeZone, avatarAssetId, version } = await requestProfile()
    const saved = await requestProfile({
      method: "PUT",
      body: {
        displayName,
        biography,
        locale,
        timeZone,
        currency,
        avatarAssetId,
        expectedVersion: version,
      },
    })
    client.setQueryData(key, saved)
  })
}
