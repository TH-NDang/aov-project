import { useEffect, useRef, type RefObject } from "react"
import { LoaderCircle } from "lucide-react"

interface InfiniteScrollProps {
  query: {
    hasNextPage: boolean
    isFetching: boolean
    isError: boolean
    fetchNextPage: () => Promise<unknown>
  }
  label: string
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

export function InfiniteScroll({ query, label, enabled = true, rootRef }: InfiniteScrollProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetching, isError, fetchNextPage } = query
  useEffect(() => {
    const node = sentinel.current
    if (!node || !enabled || !hasNextPage || isFetching || isError || typeof IntersectionObserver === "undefined")
      return
    let requested = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested || !entries.some((entry) => entry.isIntersecting)) return
        requested = true
        void fetchNextPage().catch(() => undefined)
      },
      { root: rootRef?.current ?? scrollParent(node), rootMargin: "240px 0px" },
    )
    observer.observe(node)
    return () => {
      requested = true
      observer.disconnect()
    }
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage, rootRef])

  if (!hasNextPage) return null
  return (
    <div ref={sentinel} aria-label={label} className="flex min-h-8 items-center justify-center px-3 py-1">
      {isFetching && (
        <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          {label}
        </span>
      )}
    </div>
  )
}
