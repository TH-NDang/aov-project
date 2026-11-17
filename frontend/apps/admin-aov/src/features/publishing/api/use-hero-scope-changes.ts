import { useCallback, useMemo } from "react"
import { useQueries, type UseQueryResult } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import type { CatalogFilter } from "../components/catalog/catalog-context"
import type { PublicationOverview } from "./publication-overview"
import type { RecordedChangeSet } from "../components/patch-changes/patch-change-lines"
import type { HeroGameplayChange } from "./types"

/** Reuse the timeline's patch queries; a catalog page alone only contains each hero's latest change. */
export function useHeroScopeChanges(
  data: PublicationOverview | undefined,
  filter: CatalogFilter,
  locale: string,
  enabled: boolean,
) {
  const variants = useMemo(
    () =>
      (data?.variants ?? []).filter(
        (entry) =>
          enabled &&
          !!(filter.variantId || filter.seasonId) &&
          (!filter.variantId || entry.id === filter.variantId) &&
          (!filter.seasonId || entry.seasonId === filter.seasonId),
      ),
    [data, filter.variantId, filter.seasonId, enabled],
  )
  const combine = useCallback(
    (queries: UseQueryResult<RecordedChangeSet[]>[]) => {
      const byHero: Record<string, HeroGameplayChange[]> = {}
      queries.forEach((query, index) => {
        const variant = variants[index]
        for (const entry of query.data ?? []) {
          const change: HeroGameplayChange = {
            id: entry.id,
            patchVariantId: variant.id,
            seasonId: variant.seasonId ?? null,
            rulesetId: variant.rulesetId,
            fromHeroRevisionId: entry.fromHeroRevisionId ?? null,
            toHeroRevisionId: entry.toHeroRevisionId ?? null,
            sourceKind: entry.sourceKind,
            overallKind: entry.overallKind,
            changeKinds: [...new Set(entry.changes.map((change) => change.changeKind))],
            summary: entry.summary ?? null,
            actualLocale: entry.actualLocale ?? null,
            recordedAt: "",
          }
          ;(byHero[entry.heroId] ??= []).push(change)
        }
      })
      return {
        byHero,
        pending: queries.some((query) => query.isPending),
        error: queries.find((query) => query.error)?.error,
      }
    },
    [variants],
  )
  return useQueries({
    queries: variants.map((variant) => ({
      queryKey: ["patch-changes", variant.id, locale],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        backendRequest<RecordedChangeSet[]>(
          `/admin/patch-variants/${variant.id}/hero-changes?locale=${encodeURIComponent(locale)}`,
          { signal },
        ),
      staleTime: 60000,
    })),
    combine,
  })
}
