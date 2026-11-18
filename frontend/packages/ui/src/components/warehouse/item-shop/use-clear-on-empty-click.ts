import { useEffect, type RefObject } from "react"
import type { ShopConnections } from "./use-shop-connections"

/**
 * A click on the board's empty space, or on the page around it within the same tab, clears the selection and any link
 * in progress. A click that ends a drag, a scroll or a press on a control does not.
 */
export function useClearOnEmptyClick(
  scrollArea: RefObject<HTMLDivElement | null>,
  { pointer, suppressClick, cancelConnection, setArmed }: ShopConnections,
  onFocus: (id: string | null) => void,
) {
  useEffect(() => {
    const viewport = scrollArea.current
    if (!viewport) return
    const surface = viewport.closest<HTMLElement>("[data-item-selection-surface]") ?? viewport
    const boundary = surface.closest<HTMLElement>("[data-page-tab]") ?? surface
    let gesture: { id: number; x: number; y: number; moved: boolean } | null = null
    const inside = (target: EventTarget | null): target is Element =>
      target instanceof Element &&
      boundary.contains(target) &&
      (target.closest("[data-item-selection-surface]") ?? surface) === surface
    function start(event: PointerEvent) {
      gesture =
        event.button === 0 && inside(event.target)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
          : null
    }
    function move(event: PointerEvent) {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6)
        gesture.moved = true
    }
    function cancel() {
      if (gesture) gesture.moved = true
    }
    function dismiss(event: MouseEvent) {
      if (!surface.isConnected || surface.closest("[hidden],[inert]") || !inside(event.target)) return
      if (event.defaultPrevented || pointer.current || gesture?.moved || Date.now() < suppressClick.current) return
      if (
        event.target.closest(
          '[data-item-node],button,a,input,select,textarea,label,[contenteditable="true"],[role="button"],[role="tab"],[role="menuitem"],[role="combobox"],[role="dialog"],[role="menu"],[role="listbox"]',
        )
      )
        return
      cancelConnection()
      setArmed(null)
      onFocus(null)
    }
    document.addEventListener("pointerdown", start, true)
    document.addEventListener("pointermove", move, true)
    document.addEventListener("pointercancel", cancel, true)
    document.addEventListener("scroll", cancel, true)
    document.addEventListener("click", dismiss, true)
    return () => {
      document.removeEventListener("pointerdown", start, true)
      document.removeEventListener("pointermove", move, true)
      document.removeEventListener("pointercancel", cancel, true)
      document.removeEventListener("scroll", cancel, true)
      document.removeEventListener("click", dismiss, true)
    }
  }, [scrollArea, pointer, suppressClick, onFocus, cancelConnection, setArmed])
}
