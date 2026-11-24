import { useState } from "react"
import { NO_SELECTION, toggledRow } from "../model/bulk-changes"

/**
 * The ticked rows of a list. Only rows on screen count: one that a filter hid, or that left the list, can never be
 * changed by accident, and a new `scope` (other filters, another search) starts with nothing ticked.
 */
export function useRowSelection(order: readonly string[], scope: string) {
  const [state, setState] = useState({ scope, selection: NO_SELECTION })
  const selection = state.scope === scope ? state.selection : NO_SELECTION
  const ids = new Set(order.filter((id) => selection.ids.has(id)))
  const select = (next: Iterable<string>) => setState({ scope, selection: { ids: new Set(next), anchor: null } })
  return {
    ids,
    select,
    toggle: (id: string, range: boolean) =>
      setState({ scope, selection: toggledRow({ ...selection, ids }, order, id, range) }),
    /** After a run over `handled` rows: those go, unless they are still to deal with. */
    settle: (handled: readonly string[], left: readonly string[]) =>
      setState((current) => ({
        scope: current.scope,
        selection: {
          ids: new Set([...[...current.selection.ids].filter((id) => !handled.includes(id)), ...left]),
          anchor: null,
        },
      })),
    toggleAll: () => select(ids.size === order.length ? [] : order),
  }
}
export type RowSelectionState = ReturnType<typeof useRowSelection>
