import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import {
  fetchCaptureSets,
  rankingApi,
  rankingKeys,
  type RankingDetail,
  type RankingMetric,
  type RankingPage,
  type RankingSummary,
  type ReviewValue,
} from "./ranking-api"

export function useRankingSnapshots() {
  return useQuery({ queryKey: rankingKeys.list, queryFn: ({ signal }) => rankingApi.list(signal) })
}

export function useRankingDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: rankingKeys.detail(id ?? ""),
    queryFn: ({ signal }) => rankingApi.detail(id!, signal),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCaptureSets() {
  return useQuery({ queryKey: rankingKeys.captureSets, queryFn: () => fetchCaptureSets() })
}

interface HeroPage {
  items: { code: string; name: string; head?: { currentVersion?: { url?: string } | null } | null }[]
  totalPages: number
}

/** Faces of every published hero and form, by code; a hero without one falls back to its initial. */
export function useHeroHeads() {
  return useQuery({
    queryKey: ["ranking-snapshots", "hero-heads"],
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

function patchSummary(client: ReturnType<typeof useQueryClient>, summary: RankingSummary) {
  client.setQueryData<RankingPage>(rankingKeys.list, (page) =>
    page ? { ...page, items: page.items.map((item) => (item.id === summary.id ? summary : item)) } : page,
  )
  client.setQueryData<RankingDetail>(rankingKeys.detail(summary.id), (detail) =>
    detail ? { ...detail, ...summary } : detail,
  )
}

export function useReviewValue(snapshotId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ heroId, metric, body }: { heroId: string; metric: RankingMetric; body: ReviewValue }) =>
      rankingApi.review(snapshotId, heroId, metric, body),
    onSuccess: ({ value, snapshot }, { heroId }) => {
      client.setQueryData<RankingDetail>(rankingKeys.detail(snapshotId), (detail) =>
        detail
          ? {
              ...detail,
              heroes: detail.heroes.map((hero) =>
                hero.heroId === heroId
                  ? { ...hero, values: hero.values.map((item) => (item.metric === value.metric ? value : item)) }
                  : hero,
              ),
            }
          : detail,
      )
      patchSummary(client, snapshot)
    },
  })
}

export function useSnapshotActions() {
  const client = useQueryClient()
  const confirm = useMutation({
    mutationFn: (snapshot: RankingSummary) => rankingApi.confirm(snapshot),
    onSuccess: (summary) => patchSummary(client, summary),
  })
  const remove = useMutation({
    mutationFn: (snapshot: RankingSummary) => rankingApi.remove(snapshot),
    onSuccess: (_, snapshot) => {
      client.removeQueries({ queryKey: rankingKeys.detail(snapshot.id) })
      return client.invalidateQueries({ queryKey: rankingKeys.list })
    },
  })
  const importSet = useMutation({
    mutationFn: (body: unknown) => rankingApi.importSnapshot(body),
    onSuccess: (detail) => {
      client.setQueryData(rankingKeys.detail(detail.id), detail)
      return client.invalidateQueries({ queryKey: rankingKeys.list })
    },
  })
  return { confirm, remove, importSet }
}
