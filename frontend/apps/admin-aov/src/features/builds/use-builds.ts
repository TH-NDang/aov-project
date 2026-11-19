import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  buildKeys,
  buildsApi,
  fetchCaptureSets,
  type CaptureDetail,
  type CapturePage,
  type CaptureSummary,
  type ReviewBuild,
} from "./builds-api"

export function useBuildCaptures() {
  return useQuery({ queryKey: buildKeys.list, queryFn: ({ signal }) => buildsApi.list(signal) })
}

export function useBuildCapture(id: string | null | undefined) {
  return useQuery({
    queryKey: buildKeys.detail(id ?? ""),
    queryFn: ({ signal }) => buildsApi.detail(id!, signal),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCaptureSets() {
  return useQuery({ queryKey: buildKeys.captureSets, queryFn: () => fetchCaptureSets() })
}

function patchSummary(client: ReturnType<typeof useQueryClient>, summary: CaptureSummary) {
  client.setQueryData<CapturePage>(buildKeys.list, (page) =>
    page ? { ...page, items: page.items.map((item) => (item.id === summary.id ? summary : item)) } : page,
  )
  client.setQueryData<CaptureDetail>(buildKeys.detail(summary.id), (detail) =>
    detail ? { ...detail, ...summary } : detail,
  )
}

export function useReviewBuild(captureId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ buildId, body }: { buildId: string; body: ReviewBuild }) =>
      buildsApi.review(captureId, buildId, body),
    onSuccess: ({ build, capture }) => {
      client.setQueryData<CaptureDetail>(buildKeys.detail(captureId), (detail) =>
        detail
          ? {
              ...detail,
              heroes: detail.heroes.map((hero) => ({
                ...hero,
                builds: hero.builds.map((item) => (item.id === build.id ? build : item)),
              })),
            }
          : detail,
      )
      patchSummary(client, capture)
    },
  })
}

export function useCaptureActions() {
  const client = useQueryClient()
  const confirm = useMutation({
    mutationFn: (capture: CaptureSummary) => buildsApi.confirm(capture),
    onSuccess: (summary) => patchSummary(client, summary),
  })
  const remove = useMutation({
    mutationFn: (capture: CaptureSummary) => buildsApi.remove(capture),
    onSuccess: (_, capture) => {
      client.removeQueries({ queryKey: buildKeys.detail(capture.id) })
      return client.invalidateQueries({ queryKey: buildKeys.list })
    },
  })
  const importSet = useMutation({
    mutationFn: (body: unknown) => buildsApi.importCapture(body),
    // The import dialog shows a failure next to the set; the shared toast stays quiet.
    meta: { silent: true },
    onSuccess: (detail) => {
      client.setQueryData(buildKeys.detail(detail.id), detail)
      return client.invalidateQueries({ queryKey: buildKeys.list })
    },
  })
  return { confirm, remove, importSet }
}
