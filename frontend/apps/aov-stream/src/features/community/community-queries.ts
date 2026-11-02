import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityNotification, CommunityProfile, PageSlice } from "@aov/community-contracts"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"

/**
 * Account-only community data: follows, suggestions and notifications. Every key carries the session revision, so
 * nothing read for one account is shown after signing in as another, and nothing is requested while signed out.
 */
function useAccountQuery() {
  const session = useCommunitySession()
  return { revision: session.revision, enabled: session.status === "authenticated" }
}

export function useFollowedPages() {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: ["my-follows", revision],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>("/me/follows?size=100"),
    enabled,
    staleTime: 30_000,
  })
}

/** Ids of the pages the viewer follows; null while signed out or still loading. */
export function useFollowedIds() {
  const follows = useFollowedPages()
  return follows.data ? new Set(follows.data.items.map((page) => page.id)) : null
}

export function useSuggestions(size = 5) {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: ["page-suggestions", revision, size],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>(`/me/suggestions?size=${size}`),
    enabled,
    staleTime: 60_000,
  })
}

export function useFollowPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pageId, following }: { pageId: string; following: boolean }) =>
      communityApi(`/me/pages/${pageId}/follow`, { following }),
    onSuccess: async () => {
      await Promise.all(
        ["my-follows", "page-suggestions", "page-viewer", "public-page", "community-feed"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}

export function useUnreadCount() {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: ["notifications-unread", revision],
    queryFn: () => communityApi<{ unread: number }>("/me/notifications/unread"),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useNotifications(page: number, size: number) {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: ["notifications", revision, page, size],
    queryFn: () => communityApi<PageSlice<CommunityNotification>>(`/me/notifications?page=${page}&size=${size}`),
    enabled,
  })
}

export function useReadNotifications() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["notifications"] }),
      client.invalidateQueries({ queryKey: ["notifications-unread"] }),
    ])
  const one = useMutation({
    mutationFn: (id: string) => communityApi(`/me/notifications/${id}/read`, {}),
    onSuccess: refresh,
  })
  const all = useMutation({ mutationFn: () => communityApi("/me/notifications/read-all", {}), onSuccess: refresh })
  return { one, all }
}
