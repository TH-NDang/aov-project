import { useCallback, useEffect, useMemo, useState } from "react"
import type { Item, ItemCatalog } from "@/lib/api/types"
import { changedItemIds, validateCatalog } from "@/lib/domain/items"

const HISTORY_LIMIT = 60

interface WorkspaceState {
  /** Catalog version the working copy was taken from; sent back as `expectedVersion`. */
  baseVersion: number
  items: Item[]
  history: Item[][]
}

/**
 * Local working copy of the item catalog. Every edit is staged with undo history and validated
 * live; nothing reaches the API until the editor saves the whole batch.
 */
export function useItemWorkspace(catalog: ItemCatalog | undefined) {
  const [state, setState] = useState<WorkspaceState | null>(null)

  useEffect(() => {
    if (catalog && (!state || state.baseVersion !== catalog.version)) {
      setState({ baseVersion: catalog.version, items: structuredClone(catalog.items), history: [] })
    }
  }, [catalog, state])

  const apply = useCallback((mutate: (items: Item[]) => void) => {
    setState((current) => {
      if (!current) return current
      const items = structuredClone(current.items)
      mutate(items)
      return { ...current, items, history: [...current.history.slice(-HISTORY_LIMIT + 1), current.items] }
    })
  }, [])

  const updateItem = useCallback(
    (itemId: string, mutate: (item: Item) => void) =>
      apply((items) => {
        const item = items.find((candidate) => candidate.id === itemId)
        if (item) mutate(item)
      }),
    [apply],
  )

  const undo = useCallback(() => {
    setState((current) =>
      current && current.history.length
        ? { ...current, items: current.history[current.history.length - 1], history: current.history.slice(0, -1) }
        : current,
    )
  }, [])

  const discard = useCallback(() => {
    if (catalog) setState({ baseVersion: catalog.version, items: structuredClone(catalog.items), history: [] })
  }, [catalog])

  const items = state?.items
  const changed = useMemo(() => new Set(catalog && items ? changedItemIds(catalog.items, items) : []), [catalog, items])
  const problems = useMemo(
    () => (catalog && items ? validateCatalog({ categories: catalog.categories, items }) : []),
    [catalog, items],
  )

  return {
    ready: !!state,
    items: items ?? [],
    baseVersion: state?.baseVersion ?? 0,
    canUndo: !!state?.history.length,
    changed,
    problems,
    apply,
    updateItem,
    undo,
    discard,
  }
}

export type ItemWorkspace = ReturnType<typeof useItemWorkspace>
