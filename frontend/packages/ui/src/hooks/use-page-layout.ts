import { useSyncExternalStore } from "react"

export type PageLayout = "compact" | "wide"

/**
 * Where a public page stops having room for side columns. Reading order and navigation change here, so each side
 * renders its own components instead of one layout rearranged by CSS. Also written in `public-compact.css`.
 */
const COMPACT_QUERY = "(max-width: 899.98px)"

const query = () => (typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_QUERY) : undefined)

function subscribe(notify: () => void) {
  const list = query()
  list?.addEventListener("change", notify)
  return () => list?.removeEventListener("change", notify)
}

/** Read synchronously, so a page renders the right layout from its first frame and never swaps after mounting. */
export function usePageLayout(): PageLayout {
  return useSyncExternalStore<PageLayout>(
    subscribe,
    () => (query()?.matches ? "compact" : "wide"),
    () => "wide",
  )
}
