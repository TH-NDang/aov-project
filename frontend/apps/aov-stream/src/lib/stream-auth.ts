import { createPublicAuth } from "@aov/ui/lib/public-auth"
import { COMMUNITY_API_ROOT } from "./api-client"
import { streamLocale } from "../components/stream-locale"

const auth = createPublicAuth({
  issuer: import.meta.env.VITE_AUTH_ISSUER || "http://localhost:8081/realms/wikiaov",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID || "aov-stream",
  storageKey: "community-login",
  returnPath: "/",
  profileUrl: `${COMMUNITY_API_ROOT}/me`,
  nameField: "name",
  locale: streamLocale,
  basePath: import.meta.env.BASE_URL,
})
export const { signIn, signOut, accessToken, completeLogin, useSession: useCommunitySession } = auth
void auth.restoreSession()
