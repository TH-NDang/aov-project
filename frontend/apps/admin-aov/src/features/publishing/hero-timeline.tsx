import { useQueries } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { CatalogTimeline, type TimelineCount } from "./catalog-timeline"
import type { CatalogFilter } from "./catalog-context"
import type { PublicationOverview } from "./publication-overview"
export function HeroTimeline({
  data,
  rulesetId,
  value,
  onChange,
}: {
  data: PublicationOverview
  rulesetId: string
  value: CatalogFilter
  onChange: (value: CatalogFilter) => void
}) {
  const variants = data.variants.filter((v) => !rulesetId || v.rulesetId === rulesetId)
  const queries = useQueries({
    queries: variants.map((v) => ({
      queryKey: ["patch-changes", v.id, "vi-VN"],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        backendRequest<{ heroId: string }[]>(`/admin/patch-variants/${v.id}/hero-changes?locale=vi-VN`, { signal }),
      staleTime: 60000,
    })),
  })
  const counts = new Map<string, TimelineCount>()
  queries.forEach((query, index) => {
    if (query.data)
      counts.set(variants[index].id, { changes: new Set(query.data.map((row) => row.heroId)).size, baseline: 0 })
  })
  return (
    <CatalogTimeline
      data={{ ...data, variants }}
      value={value}
      onChange={onChange}
      counts={counts}
      loading={queries.some((q) => q.isPending)}
    />
  )
}
