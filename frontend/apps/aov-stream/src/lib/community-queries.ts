import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { useCommunitySession } from "./stream-auth"
import { nextPageOf } from "@aov/ui/lib/page-slice"

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
    queryKey: communityKeys.follows(revision),
    queryFn: communityApi.follows,
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
    queryKey: communityKeys.suggestions(revision, size),
    queryFn: () => communityApi.suggestions(size),
    enabled,
    staleTime: 60_000,
  })
}

export function useFollowPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pageId, following }: { pageId: string; following: boolean }) =>
      communityApi.follow(pageId, following),
    onSuccess: async () => {
      await Promise.all(
        [
          communityKeys.followAll,
          communityKeys.suggestionAll,
          communityKeys.viewerAll,
          communityKeys.publicPageAll,
          communityKeys.feedAll,
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      )
    },
  })
}

/** The pages the reader manages; the account card counts them and the Pages tab lists them. */
export function useManagedPages() {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: communityKeys.managedPages(revision),
    queryFn: () => communityApi.managedPages(),
    enabled,
  })
}

export function useUnreadCount() {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: communityKeys.unread(revision),
    queryFn: () => communityApi.unreadNotifications(),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useNotifications(page: number, size: number) {
  const { revision, enabled } = useAccountQuery()
  return useQuery({
    queryKey: communityKeys.notifications(revision, page, size),
    queryFn: () => communityApi.notifications(page, size),
    enabled,
  })
}

/** The whole inbox, a page at a time; `useNotifications` stays the short list behind the menus. */
export function useNotificationInbox(size: number) {
  const { revision, enabled } = useAccountQuery()
  return useInfiniteQuery({
    queryKey: communityKeys.inbox(revision, size),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.notifications(pageParam, size),
    getNextPageParam: nextPageOf,
    enabled,
  })
}

export function useReadNotifications() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: communityKeys.notificationAll }),
      client.invalidateQueries({ queryKey: communityKeys.unreadAll }),
    ])
  const one = useMutation({
    mutationFn: (id: string) => communityApi.readNotification(id),
    onSuccess: refresh,
  })
  const all = useMutation({ mutationFn: () => communityApi.readAllNotifications(), onSuccess: refresh })
  return { one, all }
}
