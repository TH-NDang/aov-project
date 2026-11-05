import { createPublicAuth } from "@aov/ui/lib/public-auth"

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
