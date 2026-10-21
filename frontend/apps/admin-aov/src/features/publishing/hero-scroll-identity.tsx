import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "./hero-asset"

function scrollParent(element: HTMLElement): HTMLElement | null {
  const view = element.ownerDocument.defaultView
  if (!view) return null
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(view.getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

/** Reveal a compact identity after the normal heading passes its own scrolling viewport. */
export function HeroScrollIdentity({
  headingRef,
  identityKey,
  assetId,
  name,
  actions,
}: {
  headingRef: RefObject<HTMLElement | null>
  identityKey: string
  assetId?: string | null
  name: string
  actions?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const heading = headingRef.current
    const view = heading?.ownerDocument.defaultView
    setVisible(false)
    if (!heading || !view) return
    const root = scrollParent(heading)
    let alive = true
    const update = (bounds: Pick<DOMRectReadOnly, "height" | "bottom">, rootTop: number) => {
      if (alive) setVisible(bounds.height > 0 && bounds.bottom <= rootTop)
    }
    const readPosition = () => update(heading.getBoundingClientRect(), root?.getBoundingClientRect().top ?? 0)
    readPosition()
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries.find((value) => value.target === heading)
          if (entry) update(entry.boundingClientRect, entry.rootBounds?.top ?? root?.getBoundingClientRect().top ?? 0)
        },
        { root, threshold: [0, 1] },
      )
      observer.observe(heading)
      return () => {
        alive = false
        observer.disconnect()
      }
    }
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = view.requestAnimationFrame(() => {
        frame = 0
        readPosition()
      })
    }
    const target = root ?? view
    target.addEventListener("scroll", schedule, { passive: true })
    view.addEventListener("resize", schedule)
    return () => {
      alive = false
      if (frame) view.cancelAnimationFrame(frame)
      target.removeEventListener("scroll", schedule)
      view.removeEventListener("resize", schedule)
    }
  }, [headingRef, identityKey])
  const monogram = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase()
  return (
    <div
      data-slot="hero-scroll-identity"
      data-visible={visible}
      aria-hidden={!visible}
      className="pointer-events-none sticky top-0 z-20 -mb-6 h-0 shrink-0"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 flex h-12 min-w-0 items-center gap-2.5 rounded-b-xl border-b bg-background/95 px-3 shadow-sm backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none",
          visible ? "pointer-events-auto opacity-100" : "opacity-0",
        )}
      >
        {assetId ? (
          <HeroAsset id={assetId} className="size-8 shrink-0 rounded-full" frameAspectRatio={1} />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
          >
            {monogram || "?"}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        {visible && actions && <div className="ml-auto shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
