import { useCallback, useState } from "react"

/**
 * Counts how many rows of an in-memory list are on screen, for lists whose total is only known later. A new `scope`
 * (filter, sort or search) starts again from the first batch. Rows up to `minimum` always stay revealed.
 */
export function useRevealedCount(scope: string, step = 25, minimum = 0) {
  const [state, setState] = useState({ scope, count: step })
  if (state.scope !== scope) setState({ scope, count: step })
  const count = Math.max(state.scope === scope ? state.count : step, minimum)

  // Changes with the count on purpose: InfiniteScroll observes again, so a tall screen keeps filling up.
  const fetchNextPage = useCallback(async () => setState({ scope, count: count + step }), [scope, count, step])

  return {
    count,
    loader: (total: number) => ({ hasNextPage: count < total, isFetching: false, isError: false, fetchNextPage }),
  }
}

/** The rows to render and the `loader` that `InfiniteScroll` needs to reveal more of them. */
export function useRevealedRows<T>(rows: readonly T[], scope: string, step = 25, minimum = 0) {
  const { count, loader } = useRevealedCount(scope, step, minimum)
  return { rows: rows.slice(0, count), loader: loader(rows.length) }
}
