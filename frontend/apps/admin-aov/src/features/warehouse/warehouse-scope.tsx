import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { type CatalogFilter } from "../publishing/catalog-context"
import { CatalogTimeline } from "../publishing/catalog-timeline"
import { usePublicationOverview } from "../publishing/publication-overview"
import { errorMessage } from "@/lib/api/errors"
import { Button } from "@aov/ui/components/button"
import { warehouseApi, warehouseKeys } from "./warehouse-api"
import { useCatalogChanges, changeCounts, scopedChanges, CatalogChangeBadges } from "./catalog-changes"
import type { WarehouseKind } from "./warehouse-types"

export function useWarehouseScope<K extends WarehouseKind>(kind: K, rulesetId: string, locale: string) {
  const [params, setParams] = useSearchParams()
  const value: CatalogFilter = { seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }
  const showAll = params.get("show") === "all"
  const scoped = !!(value.seasonId || value.variantId)
  const overview = usePublicationOverview()
  const changes = useCatalogChanges(kind, rulesetId, locale)
  const query = useQuery({
    queryKey: [...warehouseKeys.catalog(kind, rulesetId, locale), "scope", value.seasonId, value.variantId, showAll],
    queryFn: ({ signal }) =>
      warehouseApi.list(kind, rulesetId, locale, signal, {
        seasonId: value.seasonId,
        patchVariantId: value.variantId,
        includeUnchanged: showAll,
      }),
    enabled: scoped && !!rulesetId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })
  const data = useMemo(
    () =>
      overview.data
        ? {
            ...overview.data,
            rulesets: overview.data.rulesets.filter((r) => r.id === rulesetId),
            seasons: overview.data.seasons.filter((s) =>
              overview.data!.variants.some((v) => v.rulesetId === rulesetId && v.seasonId === s.id),
            ),
            variants: overview.data.variants.filter((v) => v.rulesetId === rulesetId),
          }
        : undefined,
    [overview.data, rulesetId],
  )
  const onChange = (next: CatalogFilter) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, value] of [
          ["season", next.seasonId],
          ["patch", next.variantId],
        ])
          if (value) copy.set(key, value)
          else copy.delete(key)
        copy.delete("group")
        return copy
      },
      { replace: true, preventScrollReset: true },
    )
  const matched = useMemo(
    () => scopedChanges(changes.data ?? [], data, value),
    [changes.data, data, value.seasonId, value.variantId],
  )
  const latest = useMemo(() => {
    const result = new Map<string, (typeof matched)[number]>()
    for (const change of matched) {
      const old = result.get(change.ownerId)
      const ordinal = (id: string) => data?.variants.find((v) => v.id === id)?.rulesetOrdinal ?? 0
      if (!old || ordinal(change.patchVariantId) > ordinal(old.patchVariantId)) result.set(change.ownerId, change)
    }
    return result
  }, [matched, data])
  const variants =
    data?.variants.filter(
      (v) => (!value.seasonId || v.seasonId === value.seasonId) && (!value.variantId || v.id === value.variantId),
    ) ?? []
  const reviewed = variants.length > 0 && variants.every((v) => v.dataReviewState === "COMPLETE")
  const badgeKinds = (id: string): import("./catalog-changes").CatalogBadgeKind[] =>
    latest.get(id)?.kinds ?? (scoped && showAll ? [reviewed ? "UNCHANGED" : "INHERITED"] : [])
  return { value, scoped, overview, changes, query, data, onChange, latest, matched, showAll, badgeKinds }
}
export type WarehouseScopeState = ReturnType<typeof useWarehouseScope>
export function WarehouseScopeControls({ scope }: { scope: WarehouseScopeState }) {
  const counts = changeCounts(scope.changes.data ?? [])
  for (const variant of scope.data?.variants ?? [])
    if (!counts.has(variant.id)) counts.set(variant.id, { changes: 0, baseline: 0 })
  const kinds = [...new Set(scope.matched.flatMap((c) => c.kinds))]
  return (
    <div className="min-w-0 space-y-3">
      {scope.data && (
        <>
          <CatalogTimeline
            data={scope.data}
            value={scope.value}
            onChange={scope.onChange}
            counts={scope.changes.isError ? undefined : counts}
            loading={scope.changes.isPending}
          />
          {scope.scoped && !scope.changes.isPending && !scope.changes.isError && (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {new Set(scope.matched.filter((c) => !c.kinds.includes("DATA_BASELINE")).map((c) => c.ownerId)).size}{" "}
                mục thay đổi
              </span>
              <CatalogChangeBadges kinds={kinds} />
              {!scope.matched.some((c) => !c.kinds.includes("DATA_BASELINE")) && (
                <span>Chưa ghi nhận thay đổi gameplay trong phạm vi này.</span>
              )}
            </div>
          )}
        </>
      )}
      {(scope.overview.error || scope.changes.error) && (
        <div role="alert" className="text-sm text-destructive">
          {errorMessage(scope.overview.error ?? scope.changes.error)}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void scope.overview.refetch()
              void scope.changes.refetch()
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
    </div>
  )
}
