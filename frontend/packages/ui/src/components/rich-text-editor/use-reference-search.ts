import * as React from "react"
import {
  entityKindLabels,
  referenceTranslation,
  validSkillReference,
  type EntityReference,
} from "../../lib/entity-rich-text"
import {
  referenceSearchGroup,
  searchReferenceChoices,
  type EntityReferenceSearch,
  type ReferenceSearchPage,
} from "../../lib/entity-rich-text-editor"

const empty: EntityReference[] = []

/** The kinds the server searches; the others are found among the entities the editor already holds. */
export const remoteReferenceKinds = ["skill", "team", "player"]

/** Pages of server results for the query, loaded 300 ms after the query settles and dropped when it changes. */
export function useReferenceSearch(
  searchReferences: EntityReferenceSearch | undefined,
  query: string,
  locale: string,
  open: boolean,
) {
  const key = `${locale}\0${query}`
  const request = React.useRef<AbortController | null>(null)
  const generation = React.useRef(0)
  const pending = React.useRef(false)
  const [result, setResult] = React.useState<ReferenceSearchPage & { key: string; loading: boolean; error: boolean }>({
    key: "",
    items: [],
    page: -1,
    size: 20,
    totalElements: 0,
    loading: false,
    error: false,
  })
  const group = referenceSearchGroup(query).kind
  const allowed = open && !!searchReferences && (!group || remoteReferenceKinds.includes(group))
  const load = React.useCallback(
    async (page: number, run: number) => {
      if (!searchReferences || pending.current || run !== generation.current) return
      const controller = new AbortController()
      request.current = controller
      pending.current = true
      setResult((previous) => ({ ...previous, loading: true, error: false }))
      try {
        const response = await searchReferences({ query, locale, page, signal: controller.signal })
        if (controller.signal.aborted || run !== generation.current) return
        if (
          !Array.isArray(response.items) ||
          response.page !== page ||
          !Number.isInteger(response.size) ||
          response.size < 1 ||
          !Number.isInteger(response.totalElements) ||
          response.totalElements < 0
        )
          throw new Error("Invalid reference search page")
        setResult((previous) => ({
          ...response,
          items: page === 0 ? response.items.slice(0, 100) : [...previous.items, ...response.items.slice(0, 100)],
          key,
          loading: false,
          error: false,
        }))
      } catch {
        if (!controller.signal.aborted && run === generation.current)
          setResult((previous) => ({ ...previous, loading: false, error: true }))
      } finally {
        if (run === generation.current) pending.current = false
      }
    },
    [searchReferences, query, locale, key],
  )
  React.useEffect(() => {
    const run = generation.current + 1
    generation.current = run
    request.current?.abort()
    pending.current = false
    setResult({ key, items: [], page: -1, size: 20, totalElements: 0, loading: allowed, error: false })
    const timer = allowed ? setTimeout(() => void load(0, run), 300) : undefined
    return () => {
      clearTimeout(timer)
      request.current?.abort()
      generation.current++
      pending.current = false
    }
  }, [allowed, key, load])
  const current = result.key === key && allowed ? result : undefined
  const hasMore = !!current && current.page >= 0 && (current.page + 1) * current.size < current.totalElements
  return {
    items: current?.items ?? empty,
    loading: current?.loading ?? false,
    error: current?.error ?? false,
    hasMore,
    loadMore: () => {
      if (hasMore && !current.loading && !current.error) void load(current.page + 1, generation.current)
    },
    retry: () => {
      if (allowed) void load(Math.max(0, result.page + 1), generation.current)
    },
  }
}

export type ReferenceSearch = ReturnType<typeof useReferenceSearch>

/** The entities the editor holds that match the query, then the server's results, each one once. */
export function useReferenceOptions({
  open,
  searchIndex,
  query,
  remote,
  locale,
  fallbackLocale,
}: {
  open: boolean
  searchIndex: Parameters<typeof searchReferenceChoices>[0]
  query: string
  remote: ReferenceSearch
  locale: string
  fallbackLocale: string
}) {
  return React.useMemo(() => {
    if (!open) return []
    const local = searchReferenceChoices(searchIndex, query)
    const group = referenceSearchGroup(query).kind
    const choices = new Map(
      local.map(({ entity, translation }) => [`${entity.kind}:${entity.id}`, { entity, translation }]),
    )
    for (const entity of remote.items) {
      if (
        !entity ||
        !Object.hasOwn(entityKindLabels, entity.kind) ||
        !Array.isArray(entity.translations) ||
        (group && entity.kind !== group) ||
        (entity.kind === "skill" && !validSkillReference(entity))
      )
        continue
      const translation = referenceTranslation(entity, locale, fallbackLocale)
      if (translation?.name.trim()) choices.set(`${entity.kind}:${entity.id}`, { entity, translation })
    }
    return [...choices.values()]
  }, [open, searchIndex, locale, fallbackLocale, query, remote.items])
}
