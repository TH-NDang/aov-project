import { useEffect, useRef, type RefObject } from "react"
import { LoaderCircle } from "lucide-react"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"

interface InfiniteScrollProps {
  query: {
    hasNextPage: boolean
    isFetching: boolean
    isError: boolean
    fetchNextPage: () => Promise<unknown>
  }
  label: string
  /** Text of the button that loads the next part again after a failure. */
  retryLabel?: string
  enabled?: boolean
  rootRef?: RefObject<HTMLElement | null>
}

function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if (!/^(auto|scroll)$/.test(style.overflowY)) continue
    const horizontalOnly =
      style.overflowY !== "scroll" &&
      /^(auto|scroll)$/.test(style.overflowX) &&
      parent.scrollHeight <= parent.clientHeight &&
      (!style.maxHeight || style.maxHeight === "none")
    if (!horizontalOnly) return parent
  }
  return null
}

/**
 * Loads the next part of a list as the reader nears its end. Place it right after the last row, inside the box that
 * scrolls. Takes an infinite query, or `useRevealedRows().loader` when the rows are already in memory.
 */
export function InfiniteScroll({ query, label, retryLabel, enabled = true, rootRef }: InfiniteScrollProps) {
  const t = useLocaleText()
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetching, isError, fetchNextPage } = query
  useEffect(() => {
    const node = sentinel.current
    if (!node || !enabled || !hasNextPage || isFetching || isError || typeof IntersectionObserver === "undefined")
      return
    let requested = false
    let closed = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested || !entries.some((entry) => entry.isIntersecting)) return
        requested = true
        void fetchNextPage().then(
          (result) => {
            // A page can finish before React renders it as fetching, so this effect never runs again. Without this
            // the observer stays spent and the list stops loading. Observing again reports a sentinel still in view.
            if (closed || (result as { isError?: boolean } | undefined)?.isError) return
            requested = false
            observer.unobserve(node)
            observer.observe(node)
          },
          () => undefined,
        )
      },
      { root: rootRef?.current ?? scrollParent(node), rootMargin: "240px 0px" },
    )
    observer.observe(node)
    return () => {
      closed = true
      observer.disconnect()
    }
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage, rootRef])

  if (!hasNextPage) return null
  return (
    <div ref={sentinel} aria-label={label} className="flex min-h-8 items-center justify-center px-3 py-1">
      {isFetching ? (
        <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          {label}
        </span>
      ) : (
        // Scrolling never retries a failed page, so the reader needs a way to continue.
        isError && (
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            onClick={() => void fetchNextPage().catch(() => undefined)}
          >
            {retryLabel ?? t("Tải lại phần tiếp theo", "Load the next part again")}
          </button>
        )
      )}
    </div>
  )
}
