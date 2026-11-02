import { useQuery } from "@tanstack/react-query"
import { accessToken, useCommunitySession } from "../community/community-auth"
import { createWikiRequest, type ProfileRequest, type UserProfile } from "./profile-model"

export const wikiRequest = createWikiRequest(accessToken)

/** The session revision changes on every sign-in and sign-out, so a profile never leaks across accounts. */
export const profileKey = (revision: number) => ["user-profile", "me", revision] as const

export const saveProfile = (body: ProfileRequest) =>
  wikiRequest<UserProfile>("/users/me", { method: "PUT", body: JSON.stringify(body) })

/** Signed avatar URLs expire after 15 minutes, so the profile is re-read before that. */
export function useOwnProfile() {
  const session = useCommunitySession()
  return useQuery({
    queryKey: profileKey(session.revision),
    queryFn: ({ signal }) => wikiRequest<UserProfile>("/users/me", { signal }),
    enabled: session.status === "authenticated",
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}
