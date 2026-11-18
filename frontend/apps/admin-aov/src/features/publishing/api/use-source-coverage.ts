import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { fetchPublishedSets, isSourceAccessDenied } from "../../files/capture-sets"
import type { HeroSourceCoverage } from "../model/captures/source-image-gaps"

/**
 * New captures arrive when someone publishes a set with the sync tool, so the page looks again on its own. A look costs
 * two small API calls; the set itself downloads again only when it changed.
 */
export const SOURCE_COVERAGE_REFRESH_MS = 30_000
export const sourceCoverageKey = ["source-coverage"] as const

export type SourceCoverageState =
  /** The account cannot open source files (no catalog:read). */
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      patches: string[]
      heroes: Map<string, Map<string, HeroSourceCoverage>>
      /** Sets still on their way, so their rows are not called complete too early. */
      pending: boolean
    }

/** The patches with a published set; null where the account cannot open source files. */
export async function fetchCaptureSetList(): Promise<string[] | null> {
  try {
    return (await fetchPublishedSets("HERO_CAPTURE")).map((entry) => entry.set.patchCode).sort()
  } catch (failure) {
    if (isSourceAccessDenied(failure)) return null
    throw new Error("Không đọc được danh sách bộ ảnh gốc.")
  }
}

export async function fetchSourceCoverage(patchCode: string): Promise<HeroSourceCoverage[]> {
  const set = (await fetchPublishedSets("HERO_CAPTURE")).find((entry) => entry.set.patchCode === patchCode)?.set
  if (!set) throw new Error(`Không đọc được bộ ảnh gốc của patch ${patchCode}.`)
  return set.sources
}

// Kept outside the hook so the combined result only changes when a query does.
const combineCoverage = (results: { data?: HeroSourceCoverage[]; error: Error | null }[]) => ({
  data: results.map((query) => query.data),
  // A set that loaded once keeps showing while a later look at it fails.
  error: results.find((query) => query.error && !query.data)?.error ?? null,
})

const live = { refetchInterval: SOURCE_COVERAGE_REFRESH_MS, refetchOnWindowFocus: true, retry: false } as const

/** The capture sets on disk, and each hero's coverage in the sets `patchesFor` picks from them. */
export function useSourceCoverage(patchesFor: (patches: string[]) => string[]): SourceCoverageState {
  const sets = useQuery({
    queryKey: [...sourceCoverageKey, "sets"],
    queryFn: () => fetchCaptureSetList(),
    ...live,
  })
  const wanted = useMemo(() => (sets.data ? patchesFor(sets.data) : []), [sets.data, patchesFor])
  const coverage = useQueries({
    queries: wanted.map((patchCode) => ({
      queryKey: [...sourceCoverageKey, "patch", patchCode],
      queryFn: () => fetchSourceCoverage(patchCode),
      ...live,
    })),
    combine: combineCoverage,
  })
  const failure = coverage.error ?? (!sets.data ? sets.error : null)
  const heroes = useMemo(
    () =>
      new Map(
        wanted.flatMap((patchCode, index) => {
          const items = coverage.data[index]
          return items ? [[patchCode, new Map(items.map((hero) => [hero.heroCode, hero]))] as const] : []
        }),
      ),
    [wanted, coverage.data],
  )

  if (sets.data === null) return { status: "unavailable" }
  if (failure) return { status: "error", message: failure instanceof Error ? failure.message : String(failure) }
  if (!sets.data) return { status: "loading" }
  return { status: "ready", patches: sets.data, heroes, pending: heroes.size < wanted.length }
}
