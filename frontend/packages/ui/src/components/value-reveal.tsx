import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

const OPEN_DELAY = 120
const CLOSE_DELAY = 160

type ValueRevealProps = {
  as?: "span" | "time"
  /** For `as="time"`, the machine-readable moment. */
  dateTime?: string
  /** The stylesheet gives the dashes to this element through its class. */
  className: string
  /** Read by screen readers after the value, because the popup only opens on request. */
  hiddenText: string
  popupLabel: string
  popup: ReactNode
  children: ReactNode
}

/**
 * A converted value with dashes underneath. Hovering, tapping or focusing it reveals the original in a popup. Rows are
 * often links, so using it never activates the row.
 */
export function ValueReveal({
  as = "span",
  dateTime,
  className,
  hiddenText,
  popupLabel,
  popup: popupContent,
  children,
}: ValueRevealProps) {
  const Anchor = as as ElementType
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const pressing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const anchor = useRef<HTMLElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const later = (next: boolean, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), delay)
  }
  const close = () => {
    clearTimeout(timer.current)
    pinned.current = false
    setOpen(false)
  }
  /** A first press keeps open what hovering started; the next one closes it. */
  const press = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    clearTimeout(timer.current)
    if (pinned.current) close()
    else {
      pinned.current = true
      setOpen(true)
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <Anchor
          ref={anchor}
          dateTime={dateTime}
          className={className}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onPointerDown={() => {
            pressing.current = true
          }}
          onPointerEnter={(event: React.PointerEvent) => {
            if (event.pointerType === "mouse") later(true, OPEN_DELAY)
          }}
          onPointerLeave={(event: React.PointerEvent) => {
            pressing.current = false
            if (event.pointerType === "mouse" && !pinned.current) later(false, CLOSE_DELAY)
          }}
          onFocus={() => {
            if (!pressing.current) setOpen(true)
          }}
          onBlur={(event: React.FocusEvent) => {
            pressing.current = false
            // Pressing the popup, to select its text for example, moves focus there and must not close it.
            if (!popup.current?.contains(event.relatedTarget)) close()
          }}
          onClick={(event: MouseEvent) => {
            pressing.current = false
            press(event)
          }}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") press(event)
          }}
        >
          {children}
          <span className="local-time-hidden">{hiddenText}</span>
        </Anchor>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={popup}
          className="local-time-popup"
          side="top"
          sideOffset={6}
          collisionPadding={12}
          hideWhenDetached
          aria-label={popupLabel}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchor.current?.contains(event.target as Node)) event.preventDefault()
          }}
          onPointerEnter={() => clearTimeout(timer.current)}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !pinned.current) later(false, CLOSE_DELAY)
          }}
          // React events bubble through the portal, so a click here would still reach a surrounding link.
          onClick={(event) => event.stopPropagation()}
        >
          {popupContent}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
