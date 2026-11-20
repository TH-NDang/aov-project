import { useLayoutEffect, useRef, useState, type RefObject } from "react"

function scrollParent(element: HTMLElement | null) {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === "auto" || overflow === "scroll") return node
  }
  return null
}

/**
 * Keeps what the reader is looking at on the same spot of the screen across a change that adds or removes controls
 * above it, such as turning a page into its editing mode. The element just under the sticky bar is the anchor: after the
 * change it is put back where it was, so the page does not jump.
 */
export function useKeepInPlace(bar: RefObject<HTMLElement | null>) {
  const pending = useRef<{ scroller: HTMLElement; anchor: Element; top: number } | null>(null)
  const [changes, setChanges] = useState(0)

  useLayoutEffect(() => {
    const saved = pending.current
    pending.current = null
    if (!saved?.anchor.isConnected) return
    saved.scroller.scrollTop += saved.anchor.getBoundingClientRect().top - saved.top
  }, [changes])

  return (change: () => void) => {
    const element = bar.current
    const scroller = scrollParent(element)
    if (element && scroller && document.elementFromPoint) {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom + 16)
      // A block of text rather than a control, since the controls are what the change adds or removes.
      const anchor = hit?.closest("p, li, h2, h3, img, section") ?? hit
      if (anchor && scroller.contains(anchor) && !element.contains(anchor))
        pending.current = { scroller, anchor, top: anchor.getBoundingClientRect().top }
    }
    change()
    setChanges((count) => count + 1)
  }
}
