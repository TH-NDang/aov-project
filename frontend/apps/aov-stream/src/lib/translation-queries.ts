import { useQuery } from "@tanstack/react-query"
import type { CommunityPost } from "@aov/community-contracts"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { createTaskQueue } from "./task-queue"

/** Two translations at a time across the whole page; the rest wait their turn. */
const queued = createTaskQueue(2)

/** Whether Stream can translate posts now. Off when the service has no key or has spent this month's budget. */
export function useTranslationStatus() {
  return useQuery({
    queryKey: communityKeys.translationStatus,
    // A service that cannot say is treated as off, so no post offers a button that would fail.
    queryFn: () => communityApi.translationStatus().catch(() => ({ enabled: false, locales: [] as string[] })),
    staleTime: 10 * 60_000,
    retry: false,
  })
}

/** The post in `locale`, asked for once `wanted` turns true and kept for the visit. */
export function usePostTranslation(post: CommunityPost, locale: string, wanted: boolean) {
  return useQuery({
    queryKey: communityKeys.postTranslation(post.id, post.version, locale),
    queryFn: () => queued(() => communityApi.postTranslation(post.id, locale)),
    enabled: wanted,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  })
}
