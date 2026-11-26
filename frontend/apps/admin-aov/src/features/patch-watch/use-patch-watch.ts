import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { useSession } from "@/app/auth/auth-gate"
import { patchWatchApi, patchWatchKeys, type PatchNotePost, type PatchWatchOverview } from "./patch-watch-api"
import type { PatchNotePostState } from "./patch-watch-model"

const PAGE_SIZE = 30

export function usePatchWatchAccess() {
  const capabilities = useSession().actor?.capabilities ?? []
  return { canRead: capabilities.includes("catalog:read"), canWrite: capabilities.includes("patch:write") }
}

export function usePatchWatchOverview(enabled = true) {
  return useQuery({
    queryKey: patchWatchKeys.overview,
    queryFn: ({ signal }) => patchWatchApi.overview(signal),
    enabled,
    staleTime: 60_000,
  })
}

/** Posts waiting in the inbox, for the navigation badge and the dashboard; nothing for an account that cannot read. */
export function useNewPatchNoteCount() {
  const { canRead } = usePatchWatchAccess()
  return usePatchWatchOverview(canRead).data?.newCount
}

export function usePatchNotePosts(state: PatchNotePostState | null) {
  return useInfiniteQuery({
    queryKey: patchWatchKeys.postList(state),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => patchWatchApi.posts(state, pageParam, PAGE_SIZE, signal),
    getNextPageParam: nextPageOf,
    placeholderData: keepPreviousData,
  })
}

/** Moving posts and checking at once; both refresh the inbox and the counts. */
export function usePatchWatchActions() {
  const cache = useQueryClient()
  const refresh = () => cache.invalidateQueries({ queryKey: patchWatchKeys.all })

  const move = useMutation({
    mutationFn: ({ post, state }: { post: PatchNotePost; state: PatchNotePostState }) =>
      patchWatchApi.changeState(post, state),
    onSettled: refresh,
    meta: { silent: true },
  })
  const check = useMutation({
    mutationFn: () => patchWatchApi.checkNow(),
    onSuccess: (overview: PatchWatchOverview) => cache.setQueryData(patchWatchKeys.overview, overview),
    onSettled: refresh,
    meta: { silent: true, successMessage: "Đã kiểm tra các nguồn." },
  })

  return { move, check, error: move.error ?? check.error }
}
