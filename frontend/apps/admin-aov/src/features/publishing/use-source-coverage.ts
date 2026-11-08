import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { HeroSourceCoverage } from "./source-image-gaps"

/** Captures are copied into `resources` by hand, so the page looks again on its own. */
export const SOURCE_COVERAGE_REFRESH_MS = 30_000
export const sourceCoverageKey = ["source-coverage"] as const

export type SourceCoverageState =
  /** Only the Vite dev and preview servers can read the capture sets. */
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

const json = (response: Response) => response.headers.get("content-type")?.includes("application/json")

/** Null where the capture endpoint does not exist. */
export async function fetchCaptureSetList(signal?: AbortSignal): Promise<string[] | null> {
  const response = await fetch("/__patch-captures/sets.json", { credentials: "omit", signal })
  // An app server without the capture endpoint answers with its page or a plain not found.
  if (!json(response) || response.status === 404) return null
  if (!response.ok) throw new Error("Không đọc được danh sách bộ ảnh gốc.")
  return ((await response.json()) as { patches: string[] }).patches
}

export async function fetchSourceCoverage(patchCode: string, signal?: AbortSignal): Promise<HeroSourceCoverage[]> {
  const response = await fetch(`/__patch-captures/${encodeURIComponent(patchCode)}/heroes.json`, {
    credentials: "omit",
    signal,
  })
  if (!json(response)) throw new Error(`Không đọc được bộ ảnh gốc của patch ${patchCode}.`)
  const body = (await response.json()) as { heroes?: HeroSourceCoverage[]; message?: string }
  if (!response.ok) throw new Error(body.message ?? `Không đọc được bộ ảnh gốc của patch ${patchCode}.`)
  return body.heroes ?? []
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
    queryFn: ({ signal }) => fetchCaptureSetList(signal),
    ...live,
  })
  const wanted = useMemo(() => (sets.data ? patchesFor(sets.data) : []), [sets.data, patchesFor])
  const coverage = useQueries({
    queries: wanted.map((patchCode) => ({
      queryKey: [...sourceCoverageKey, "patch", patchCode],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchSourceCoverage(patchCode, signal),
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
