import { createPublicAuth } from "@aov/ui/lib/public-auth"
import { streamLocale } from "../../components/stream-locale"

const auth = createPublicAuth({
  issuer: import.meta.env.VITE_AUTH_ISSUER || "http://localhost:8081/realms/wikiaov",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID || "aov-stream",
  storageKey: "community-login",
  returnPath: "/pages",
  profileUrl: "/api/community/v1/me",
  nameField: "name",
  locale: streamLocale,
})
export const { signIn, signOut, accessToken, completeLogin, useSession: useCommunitySession } = auth
