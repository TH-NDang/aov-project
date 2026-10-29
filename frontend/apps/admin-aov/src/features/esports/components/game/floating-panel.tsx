import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { GripHorizontal, X } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"

const PHONE = "(max-width: 639px)"

/** True on phone-sized viewports, where the viewer switches to its own layout. */
export function usePhoneLayout() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.(PHONE)
      query?.addEventListener("change", notify)
      return () => query?.removeEventListener("change", notify)
    },
    () => !!window.matchMedia?.(PHONE).matches,
    () => false,
  )
}

/**
 * Non-modal panel floating above the page so the video and timeline stay usable while recording. It can be dragged
 * by its header on larger screens and becomes a bottom sheet on phones.
 */
export function FloatingPanel({
  title,
  icon,
  onClose,
  children,
  width = 560,
}: {
  title: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const phone = usePhoneLayout()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    // Only when focus is inside, so Esc in a dialog opened on top does not also close this panel.
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel.current?.contains(document.activeElement)) onClose()
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [onClose])

  return createPortal(
    <section
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={cn(
        "fixed z-50 flex max-h-[85vh] flex-col overflow-hidden border bg-popover text-popover-foreground shadow-2xl",
        phone ? "inset-x-0 bottom-0 rounded-t-2xl" : "right-6 bottom-6 rounded-2xl",
      )}
      style={
        phone ? undefined : { width: `min(${width}px, calc(100vw - 3rem))`, translate: `${offset.x}px ${offset.y}px` }
      }
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5",
          !phone && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        onPointerDown={(event) => {
          if (phone || (event.target as HTMLElement).closest("button")) return
          drag.current = { x: offset.x, y: offset.y, startX: event.clientX, startY: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (!start) return
          setOffset({ x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        {phone ? (
          <span className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
        ) : (
          <GripHorizontal size={14} className="text-muted-foreground" aria-hidden="true" />
        )}
        {icon}
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-md hover:bg-muted"
          aria-label="Đóng"
        >
          <X size={15} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>,
    document.body,
  )
}
