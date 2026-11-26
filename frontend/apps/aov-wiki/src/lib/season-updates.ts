import { queryOptions, useQueries, useQuery } from "@tanstack/react-query"
import { useWikiContext } from "../context/wiki-context"
import type { WikiSectionKey } from "./wiki-sections"
import { wikiCatalogParameters, type WikiCatalogScope } from "./wiki-catalog"
import { wikiGet } from "./wiki-api"
import { KIND_ORDER } from "./change-kinds"
import { patchDayLabel } from "./patch-day-label"

const kindRank = (kind: string) => KIND_ORDER.indexOf(kind) + 1 || 99

/** Every query key of the season in force; reads and invalidation both use these. */
export const seasonKeys = {
  updates: (scope: WikiCatalogScope) => ["wiki", "season-updates", scope.region, scope.locale] as const,
  changed: (scope: WikiCatalogScope, domain: string, patchIds: string[]) =>
    ["wiki", "season-changed", scope.region, scope.locale, domain, ...patchIds] as const,
  kinds: (scope: WikiCatalogScope, patchId: string) =>
    ["wiki", "season-hero-kinds", scope.region, scope.locale, patchId] as const,
}

export interface SeasonPatch {
  id: string
  code: string
  title: string | null
  summary: string | null
  actualLocale: string | null
  effectiveAt: string | null
  effectiveOn: string | null
  sourceUrl: string | null
  isCurrent: boolean
}

export interface SeasonUpdates {
  region: string
  requestedLocale: string
  asOf: string
  season: { id: string; code: string; displayName: string } | null
  currentPatchId: string | null
  patches: SeasonPatch[]
}

export const seasonUpdatesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: seasonKeys.updates(scope),
    queryFn: ({ signal }) =>
      wikiGet<SeasonUpdates>(`/seasons/current/updates?${wikiCatalogParameters(scope, false)}&limit=4`, signal),
    meta: { storedAnswer: "wiki-season-updates@1" },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

/** The catalog each section of the Wiki records its changes under. */
const SECTION_DOMAINS = {
  heroes: "HERO",
  items: "ITEM",
  enchantments: "ENCHANTMENT",
  arcana: "ARCANA",
  spells: "SPELL",
} as const satisfies Partial<Record<WikiSectionKey, string>>

/** What the season in force changed in one section: the versions that changed it, newest first, as day labels. */
export interface SeasonMark {
  /** Day labels (dd/mm) of the versions that changed the section, newest first. */
  days: string[]
  /** For heroes: how many heroes each kind of change touched in the newest of those versions. */
  kinds?: [kind: string, count: number][]
}

/**
 * Which sections the versions of the season in force changed, read from the total of a one-row page of each version's
 * changes in each catalog: five small queries of at most four requests each, kept for five minutes. For heroes one more
 * request reads the newest changed version's rows to count each kind of change. A section that has not answered, or
 * failed, simply has no mark.
 */
export function useSeasonMarks() {
  const scope = useWikiContext()
  const updates = useQuery(seasonUpdatesQuery(scope))
  const patches = updates.data?.patches ?? []
  const patchIds = patches.map((patch) => patch.id)
  const zone = scope.regions.find((market) => market.code === scope.region)?.timeZone ?? "Asia/Ho_Chi_Minh"
  const domains = Object.entries(SECTION_DOMAINS)
  const answers = useQueries({
    queries: domains.map(([, domain]) => ({
      queryKey: seasonKeys.changed(scope, domain, patchIds),
      enabled: patchIds.length > 0,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        Promise.all(
          patchIds.map(async (id) => {
            const query = wikiCatalogParameters(scope, false)
            query.set("domain", domain)
            query.set("page", "0")
            query.set("size", "1")
            return (
              (await wikiGet<{ totalElements?: number }>(`/patches/${id}/changes?${query}`, signal)).totalElements ?? 0
            )
          }),
        ),
      staleTime: 5 * 60_000,
      retry: 0,
    })),
  })
  const changedOf = (index: number) => patches.filter((_, at) => (answers[index]?.data?.[at] ?? 0) > 0)
  const heroPatch = changedOf(0)[0]
  const heroKinds = useQuery({
    queryKey: seasonKeys.kinds(scope, heroPatch?.id ?? ""),
    enabled: !!heroPatch,
    queryFn: async ({ signal }) => {
      const query = wikiCatalogParameters(scope, false)
      query.set("domain", "HERO")
      query.set("page", "0")
      query.set("size", "50")
      const rows = (
        await wikiGet<{ items: { overallKind?: string }[] }>(`/patches/${heroPatch!.id}/changes?${query}`, signal)
      ).items
      const tally = new Map<string, number>()
      for (const row of rows) if (row.overallKind) tally.set(row.overallKind, (tally.get(row.overallKind) ?? 0) + 1)
      return [...tally].sort(([a], [b]) => kindRank(a) - kindRank(b))
    },
    staleTime: 5 * 60_000,
    retry: 0,
  })

  const marks: Partial<Record<WikiSectionKey, SeasonMark>> = {}
  domains.forEach(([key], index) => {
    const changed = changedOf(index)
    if (!changed.length) return
    marks[key as WikiSectionKey] = {
      days: changed.map((patch) => patchDayLabel(patch.effectiveOn ?? patch.effectiveAt ?? "", zone)),
      kinds: key === "heroes" ? heroKinds.data : undefined,
    }
  })
  return { season: updates.data?.season?.displayName, patchCount: patches.length, marks }
}
