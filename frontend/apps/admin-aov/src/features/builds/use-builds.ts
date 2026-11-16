import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
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

interface HeroPage {
  items: { code: string; name: string; head?: { currentVersion?: { url?: string } | null } | null }[]
  totalPages: number
}

/** Faces of every published hero and form, by code; a hero without one falls back to its initial. */
export function useHeroHeads() {
  return useQuery({
    queryKey: ["build-captures", "hero-heads"],
    staleTime: 300_000,
    queryFn: async ({ signal }) => {
      const heads = new Map<string, string>()
      for (let page = 0; page < 10; page++) {
        const slice = await backendRequest<HeroPage>(`/heroes?playable=true&page=${page}&size=100`, { signal })
        for (const hero of slice.items) {
          const url = hero.head?.currentVersion?.url
          if (url) heads.set(hero.code, url)
        }
        if (page + 1 >= slice.totalPages) break
      }
      return heads
    },
  })
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
    onSuccess: (detail) => {
      client.setQueryData(buildKeys.detail(detail.id), detail)
      return client.invalidateQueries({ queryKey: buildKeys.list })
    },
  })
  return { confirm, remove, importSet }
}
