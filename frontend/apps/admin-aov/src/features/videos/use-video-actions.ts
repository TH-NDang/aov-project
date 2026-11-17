import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { usePublicationOverview } from "../publishing/api/publication-overview"
import { videoApi, videoKeys } from "./video-api"
import { reorder, saveBody, type AdminVideo } from "./video-model"

export function useVideoSubjects() {
  return useQuery({
    queryKey: videoKeys.subjects,
    queryFn: ({ signal }) => videoApi.subjects(signal),
    staleTime: 5 * 60_000,
  })
}

export function usePatchCodes() {
  const overview = usePublicationOverview()
  return new Map((overview.data?.variants ?? []).map((variant) => [variant.id, variant.patchCode]))
}

/** Row actions shared by a subject's panel and the review page. */
export function useVideoActions() {
  const cache = useQueryClient()
  const refresh = () => cache.invalidateQueries({ queryKey: videoKeys.lists })

  const setStatus = useMutation({
    mutationFn: ({ video, status }: { video: AdminVideo; status: AdminVideo["status"] }) =>
      videoApi.update(video.id, saveBody(video, { status })),
    onSettled: refresh,
    meta: { silent: true },
  })
  const remove = useMutation({
    mutationFn: (video: AdminVideo) => videoApi.remove(video),
    onSettled: refresh,
    meta: { silent: true },
  })
  const move = useMutation({
    mutationFn: async ({ videos, id, direction }: { videos: AdminVideo[]; id: string; direction: -1 | 1 }) => {
      for (const { video, displayOrder } of reorder(videos, id, direction))
        await videoApi.update(video.id, saveBody(video, { displayOrder }))
    },
    onSettled: refresh,
    meta: { silent: true },
  })

  return {
    setStatus,
    remove,
    move,
    busy: setStatus.isPending || remove.isPending || move.isPending,
    error: setStatus.error ?? remove.error ?? move.error,
  }
}
