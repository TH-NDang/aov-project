"use client"

import * as React from "react"
import { cn } from "@aov/ui/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { usePageLayout } from "../hooks/use-page-layout"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"

/**
 * Where an app wants its side sheets on phones. Admin sets "bottom" so its detail sheets rise like the public apps'
 * drawers; without a provider a sheet keeps the side its caller chose.
 */
const PhoneSheetSide = React.createContext<"bottom" | "keep">("keep")

export function SheetPhoneSideProvider({ side, children }: { side: "bottom" | "keep"; children: React.ReactNode }) {
  return <PhoneSheetSide.Provider value={side}>{children}</PhoneSheetSide.Provider>
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  )
}

/** How far, or how fast, a bottom sheet must be pulled down before letting go closes it. */
const CLOSE_DISTANCE = 96
const CLOSE_SPEED = 0.6
/** Movement under this many pixels is still a tap or a scroll that has not decided its way. */
const SLOP = 8

/** The scroll region the touch started in, inside the sheet, or null when the sheet itself does not scroll there. */
function scrollerOf(target: Element | null, sheet: HTMLElement) {
  for (let node = target; node && node !== sheet.parentElement; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node
    if (node === sheet) break
  }
  return null
}

/**
 * Lets a bottom sheet be pulled down and closed when let go far or fast enough, as the phone drawers of the public apps
 * do. A finger pulls it from anywhere once the content under it is scrolled to the top (scrolling up still scrolls); a
 * mouse pulls it by its grabber or header. Fields keep their own gestures.
 */
function usePullToClose(sheet: React.RefObject<HTMLDivElement | null>, enabled: boolean, close: () => void) {
  const latestClose = React.useRef(close)
  React.useEffect(() => {
    latestClose.current = close
  })

  React.useEffect(() => {
    const element = sheet.current
    if (!element || !enabled) return
    let origin: { x: number; y: number; time: number; scroller: HTMLElement | null } | null = null
    let pulling = false

    const move = (distance: number) => {
      element.style.transition = "none"
      element.style.transform = `translateY(${Math.max(0, distance)}px)`
    }
    const release = (distance: number) => {
      const speed = origin ? distance / Math.max(1, performance.now() - origin.time) : 0
      element.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)"
      if (distance > CLOSE_DISTANCE || (distance > 24 && speed > CLOSE_SPEED)) {
        element.style.transform = "translateY(100%)"
        window.setTimeout(() => latestClose.current(), 160)
      } else {
        element.style.transform = ""
      }
      origin = null
      pulling = false
    }
    const fieldUnder = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("input, textarea, select, [contenteditable='true'], [data-no-pull]")

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || fieldUnder(event.target)) return
      const touch = event.touches[0]!
      origin = {
        x: touch.clientX,
        y: touch.clientY,
        time: performance.now(),
        scroller: scrollerOf(event.target as Element, element),
      }
      pulling = false
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!origin) return
      const touch = event.touches[0]!
      const dy = touch.clientY - origin.y
      const dx = touch.clientX - origin.x
      if (!pulling) {
        if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return
        // Only a pull down, mostly vertical, from content already at its top becomes a pull of the sheet.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || (origin.scroller && origin.scroller.scrollTop > 0)) {
          origin = null
          return
        }
        pulling = true
      }
      event.preventDefault()
      move(dy - SLOP)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (!origin || !pulling) {
        origin = null
        return
      }
      const touch = event.changedTouches[0]!
      release(touch.clientY - origin.y - SLOP)
    }

    // A mouse pulls by the grabber or the header, so dragging to select text in the body stays possible.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return
      const target = event.target as Element
      if (!target.closest('[data-sheet-grabber], [data-slot="sheet-header"]') || target.closest("button, a")) return
      if (fieldUnder(target)) return
      origin = { x: event.clientX, y: event.clientY, time: performance.now(), scroller: null }
      pulling = true
      element.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && origin && pulling) move(event.clientY - origin.y)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && origin && pulling) release(event.clientY - origin.y)
    }

    element.addEventListener("touchstart", onTouchStart, { passive: true })
    element.addEventListener("touchmove", onTouchMove, { passive: false })
    element.addEventListener("touchend", onTouchEnd)
    element.addEventListener("touchcancel", onTouchEnd)
    element.addEventListener("pointerdown", onPointerDown)
    element.addEventListener("pointermove", onPointerMove)
    element.addEventListener("pointerup", onPointerUp)
    return () => {
      element.removeEventListener("touchstart", onTouchStart)
      element.removeEventListener("touchmove", onTouchMove)
      element.removeEventListener("touchend", onTouchEnd)
      element.removeEventListener("touchcancel", onTouchEnd)
      element.removeEventListener("pointerdown", onPointerDown)
      element.removeEventListener("pointermove", onPointerMove)
      element.removeEventListener("pointerup", onPointerUp)
    }
  }, [sheet, enabled])
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  /** False when the caller draws its own close, or while the sheet must stay open. */
  showCloseButton?: boolean
}) {
  // On phones an app may have its side sheets rise from the bottom instead, like the public apps' drawers.
  const compact = usePageLayout() === "compact"
  const phoneSide = React.useContext(PhoneSheetSide)
  const edge = compact && phoneSide === "bottom" && (side === "right" || side === "left") ? "bottom" : side
  const closeLabel = useLocaleText()("Đóng", "Close")
  const closeRef = React.useRef<HTMLButtonElement>(null)
  // The sheet element arrives after it mounts in the portal, so the pull listens once it is there.
  const [sheetElement, setSheetElement] = React.useState<HTMLDivElement | null>(null)
  const sheetRef = React.useMemo(() => ({ current: sheetElement }), [sheetElement])
  // A pull closes the sheet like Escape does, so a sheet that refuses Escape while it saves refuses the pull too.
  const closeByPull = () => {
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
    onEscapeKeyDown?.(escape)
    if (!escape.defaultPrevented) closeRef.current?.click()
  }
  usePullToClose(sheetRef, edge === "bottom", closeByPull)
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={setSheetElement}
        data-slot="sheet-content"
        data-side={edge}
        className={cn(
          "group/sheet fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          edge === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          edge === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          edge === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          edge === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
          // A bottom sheet is as tall as its content, at most most of the screen, with the rounded top of a drawer;
          // these come after the caller's classes so a side sheet's width or height never carries over on a phone.
          edge === "bottom" &&
            "inset-x-0 top-auto bottom-0 h-auto max-h-[92dvh] w-full max-w-none rounded-t-[18px] border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] sm:max-w-none",
        )}
        onEscapeKeyDown={onEscapeKeyDown}
        {...props}
      >
        {edge === "bottom" && (
          // The grabber says the sheet can be pulled down; it and the header are where the pull starts.
          <div
            data-sheet-grabber
            aria-hidden="true"
            className="flex h-5 shrink-0 cursor-grab touch-none justify-center"
          >
            <span className="mt-2 h-1 w-10 rounded-full bg-muted-foreground/40" />
          </div>
        )}
        {children}
        {edge === "bottom" ? (
          // No visible close on a bottom sheet: a tap above it, Escape or a pull down closes it. This hidden one serves
          // screen readers and the pull, also when the caller draws a close of its own.
          <SheetPrimitive.Close ref={closeRef} className="sr-only">
            {closeLabel}
          </SheetPrimitive.Close>
        ) : (
          showCloseButton && (
            <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
