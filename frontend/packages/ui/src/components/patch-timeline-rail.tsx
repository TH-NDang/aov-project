import { useEffect, useRef, useState, type ReactNode } from "react"

const ACTIVE = '[data-patch][aria-pressed="true"], [data-season][aria-pressed="true"]'

/**
 * A row that scrolls sideways: drag it with a mouse, swipe it on touch. The chosen stop is brought into view when the
 * choice changes and again when the row's contents change width, since counts that arrive later hide or show stops.
 * The open group is kept whole on screen when it fits. Edges that hide more of the row fade out.
 */
export function PatchTimelineRail({
  selection,
  label,
  children,
}: {
  selection: string
  label: string
  children: ReactNode
}) {
  const rail = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; scroll: number; pointer: number } | null>(null)
  const suppressClick = useRef(false)
  const [edges, setEdges] = useState({ start: false, end: false })
  const measure = () => {
    const node = rail.current
    if (!node) return
    const start = node.scrollLeft > 1
    const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1
    setEdges((now) => (now.start === start && now.end === end ? now : { start, end }))
  }
  useEffect(() => {
    const node = rail.current
    if (!node) return
    const reveal = () => {
      const active = node.querySelector<HTMLElement>(ACTIVE)
      const chapter = active?.closest<HTMLElement>("[data-chapter]")
      const target = chapter && chapter.offsetWidth <= node.clientWidth ? chapter : active
      if (target) {
        const offset = target.getBoundingClientRect().left - node.getBoundingClientRect().left + node.scrollLeft
        if (offset < node.scrollLeft || offset + target.offsetWidth > node.scrollLeft + node.clientWidth)
          node.scrollLeft = Math.max(0, offset - node.clientWidth / 2 + target.offsetWidth / 2)
      }
      measure()
    }
    reveal()
    if (typeof ResizeObserver === "undefined" || !track.current) return
    let width = track.current.offsetWidth
    const observer = new ResizeObserver(() => {
      const next = track.current?.offsetWidth ?? width
      if (next !== width) reveal()
      else measure()
      width = next
    })
    observer.observe(track.current)
    observer.observe(node)
    return () => observer.disconnect()
  }, [selection])
  const fade = edges.start && edges.end ? "both" : edges.start ? "start" : edges.end ? "end" : undefined
  return (
    <div
      ref={rail}
      role="group"
      aria-label={label}
      data-fade={fade}
      className="min-w-0 cursor-grab overflow-x-auto overscroll-x-contain select-none active:cursor-grabbing [scrollbar-width:none] data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-1.5rem),transparent)] data-[fade=end]:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] data-[fade=start]:[mask-image:linear-gradient(to_right,transparent,black_0.75rem)] [&::-webkit-scrollbar]:hidden"
      onScroll={measure}
      onPointerDown={(event) => {
        suppressClick.current = false
        if (
          event.pointerType !== "mouse" ||
          event.button !== 0 ||
          event.currentTarget.scrollWidth <= event.currentTarget.clientWidth
        )
          return
        drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, pointer: event.pointerId }
      }}
      onPointerMove={(event) => {
        const state = drag.current
        if (!state || state.pointer !== event.pointerId || !event.buttons) return
        if (Math.abs(event.clientX - state.x) > 6) {
          suppressClick.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.scrollLeft = state.scroll - (event.clientX - state.x)
          event.preventDefault()
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId)
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
        suppressClick.current = false
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }
      }}
    >
      <div
        ref={track}
        className="relative isolate flex w-max min-w-full items-center gap-1.5 py-0.5 before:absolute before:inset-x-0 before:top-1/2 before:-z-10 before:border-t before:border-dashed before:border-border sm:gap-2"
      >
        {children}
      </div>
    </div>
  )
}
