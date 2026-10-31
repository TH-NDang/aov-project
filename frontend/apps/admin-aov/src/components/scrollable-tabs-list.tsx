import { useCallback, useLayoutEffect, useRef, useState, type ComponentProps } from "react"
import { TabsList } from "@aov/ui/components/tabs"
import { cn } from "@aov/ui/lib/utils"

type Props = ComponentProps<typeof TabsList> & { activeValue: string }

export function ScrollableTabsList({ activeValue, className, ...props }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const [edges, setEdges] = useState({ left: false, right: false })
  const gesture = useRef<{ id: number; x: number; y: number; left: number; moved: boolean } | null>(null)
  const ignoreClick = useRef(false)
  const [dragging, setDragging] = useState(false)

  const measure = useCallback(() => {
    const element = viewport.current
    if (!element) return
    const left = element.scrollLeft > 1
    const right = element.scrollWidth - element.clientWidth - element.scrollLeft > 1
    setEdges((previous) => (previous.left === left && previous.right === right ? previous : { left, right }))
  }, [])

  const reveal = useCallback((tab: HTMLElement | null, animate: boolean) => {
    const element = viewport.current
    if (!element || !tab || gesture.current) return
    const maximum = element.scrollWidth - element.clientWidth
    if (maximum <= 0) return
    const frame = element.getBoundingClientRect()
    const item = tab.getBoundingClientRect()
    const peek = 44
    let delta = 0
    if (item.width > frame.width - peek * 2) delta = (item.left + item.right - frame.left - frame.right) / 2
    else if (item.left < frame.left + peek) delta = item.left - frame.left - peek
    else if (item.right > frame.right - peek) delta = item.right - frame.right + peek
    const left = Math.max(0, Math.min(maximum, element.scrollLeft + delta))
    if (Math.abs(left - element.scrollLeft) < 1) return
    // Scroll only the tab strip, leaving the page and its panels in place.
    element.scrollTo({
      left,
      behavior: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant",
    })
  }, [])

  useLayoutEffect(() => {
    reveal(list.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]') ?? null, mounted.current)
    mounted.current = true
    measure()
  }, [activeValue, measure, reveal])

  useLayoutEffect(() => {
    const element = viewport.current
    const content = list.current
    if (!element || !content) return
    let width = element.clientWidth
    let contentWidth = content.scrollWidth
    const resize = () => {
      if (width !== element.clientWidth || contentWidth !== content.scrollWidth) {
        width = element.clientWidth
        contentWidth = content.scrollWidth
        reveal(content.querySelector('[role="tab"][data-state="active"]'), false)
      }
      measure()
    }
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize)
    observer?.observe(element)
    observer?.observe(content)
    window.addEventListener("resize", resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [measure, reveal])

  return (
    <div className="relative min-w-0 max-w-full rounded-xl border bg-muted/40">
      <div
        ref={viewport}
        data-slot="tabs-scroll-viewport"
        className={cn(
          "overflow-x-auto overscroll-x-contain rounded-[inherit] select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          (edges.left || edges.right) && "cursor-grab [&_[role=tab]]:cursor-grab",
          dragging && "cursor-grabbing [&_[role=tab]]:cursor-grabbing",
        )}
        onScroll={measure}
        onPointerDownCapture={(event) => {
          ignoreClick.current = false
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            event.currentTarget.scrollWidth <= event.currentTarget.clientWidth
          )
            return
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            moved: false,
          }
        }}
        onMouseDownCapture={(event) => {
          // Defer Radix's mouse-down activation until click so a drag cannot change tabs.
          if (gesture.current && event.button === 0) event.preventDefault()
        }}
        onPointerMove={(event) => {
          const start = gesture.current
          if (!start || start.id !== event.pointerId) return
          const distance = event.clientX - start.x
          if (!start.moved && Math.abs(distance) > 6 && Math.abs(distance) > Math.abs(event.clientY - start.y)) {
            start.moved = true
            if (event.pointerType === "mouse") {
              event.currentTarget.setPointerCapture(event.pointerId)
              setDragging(true)
            }
          }
          // Touch keeps the browser's native pan and momentum, including vertical page scrolling.
          if (start.moved && event.pointerType === "mouse")
            event.currentTarget.scrollTo({ left: start.left - distance, behavior: "instant" })
        }}
        onPointerUp={(event) => {
          if (gesture.current?.id !== event.pointerId) return
          ignoreClick.current = gesture.current.moved
          gesture.current = null
          setDragging(false)
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          gesture.current = null
          setDragging(false)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && !gesture.current?.moved) gesture.current = null
        }}
        onLostPointerCapture={() => {
          gesture.current = null
          setDragging(false)
        }}
        onFocusCapture={(event) => {
          if (event.target.getAttribute("role") === "tab") reveal(event.target, true)
        }}
        onClickCapture={(event) => {
          if (ignoreClick.current) {
            ignoreClick.current = false
            event.preventDefault()
            event.stopPropagation()
            return
          }
          const tab = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]')
          if (tab && !tab.hasAttribute("disabled")) {
            if (document.activeElement === tab && tab.getAttribute("aria-selected") !== "true") tab.blur()
            tab.focus({ preventScroll: true })
            reveal(tab, true)
          }
        }}
      >
        <TabsList
          {...props}
          ref={list}
          className={cn("h-11! w-full min-w-max gap-1 rounded-xl bg-transparent p-1", className)}
        />
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-xl bg-gradient-to-r from-background to-transparent",
          !edges.left && "hidden",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-background to-transparent",
          !edges.right && "hidden",
        )}
      />
    </div>
  )
}
