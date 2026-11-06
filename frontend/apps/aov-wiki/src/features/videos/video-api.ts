import { queryOptions } from "@tanstack/react-query"
import type { PublicVideo, VideoSubjectKind } from "./video-model"

export function subjectVideosQuery(kind: VideoSubjectKind, subjectId: string, subjectKey?: string) {
  return queryOptions({
    queryKey: ["wiki", "videos", kind, subjectId, subjectKey ?? ""],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({ subjectKind: kind, subjectId })
      if (subjectKey) query.set("subjectKey", subjectKey)
      const response = await fetch(`/api/wiki/v1/videos?${query}`, { signal, credentials: "omit" })
      if (!response.ok) throw new Error("Videos are unavailable.")
      return ((await response.json()) as { items: PublicVideo[] }).items
    },
    staleTime: 60_000,
    retry: 1,
  })
}
