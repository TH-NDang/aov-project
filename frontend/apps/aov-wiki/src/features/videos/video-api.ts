import { queryOptions } from "@tanstack/react-query"
import type { PublicVideo, VideoSubjectKind } from "./video-model"
import { wikiGet } from "../../lib/wiki-api"

export function subjectVideosQuery(kind: VideoSubjectKind, subjectId: string, subjectKey?: string) {
  return queryOptions({
    queryKey: ["wiki", "videos", kind, subjectId, subjectKey ?? ""],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({ subjectKind: kind, subjectId })
      if (subjectKey) query.set("subjectKey", subjectKey)
      return (await wikiGet<{ items: PublicVideo[] }>(`/videos?${query}`, signal)).items
    },
    staleTime: 60_000,
    retry: 1,
  })
}
