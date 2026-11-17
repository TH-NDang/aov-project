import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
    // The import dialog shows a failure next to the set; the shared toast stays quiet.
    meta: { silent: true },
    onSuccess: (detail) => {
      client.setQueryData(rankingKeys.detail(detail.id), detail)
      return client.invalidateQueries({ queryKey: rankingKeys.list })
    },
  })
  return { confirm, remove, importSet }
}
