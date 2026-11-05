import { useEffect, useRef, type ReactNode } from "react"

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
  const drag = useRef<{ x: number; scroll: number; pointer: number } | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => {
    const active = rail.current?.querySelector<HTMLElement>(
      '[data-patch][aria-pressed="true"], [data-season][aria-pressed="true"]',
    )
    if (active && rail.current) {
      const offset =
        active.getBoundingClientRect().left - rail.current.getBoundingClientRect().left + rail.current.scrollLeft
      if (
        offset < rail.current.scrollLeft ||
        offset + active.offsetWidth > rail.current.scrollLeft + rail.current.clientWidth
      )
        rail.current.scrollLeft = Math.max(0, offset - rail.current.clientWidth / 2 + active.offsetWidth / 2)
    }
  }, [selection])
  return (
    <div
      ref={rail}
      role="group"
      aria-label={label}
      className="min-w-0 cursor-grab overflow-x-auto overscroll-x-contain select-none active:cursor-grabbing [scrollbar-width:none] sm:[scrollbar-width:thin] max-sm:[&::-webkit-scrollbar]:hidden"
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
      <div className="relative isolate flex w-max min-w-full items-center gap-2 py-0.5 before:absolute before:inset-x-0 before:top-1/2 before:-z-10 before:border-t before:border-border sm:gap-4 sm:py-1">
        {children}
      </div>
    </div>
  )
}
