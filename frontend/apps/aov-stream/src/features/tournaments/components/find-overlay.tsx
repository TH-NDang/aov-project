import type { ReactNode, RefObject } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@aov/ui/components/popover"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import "./find-overlay.css"

/**
 * A panel at the seat that opened it, or a sheet on phones. The seat may be another one by the time the panel closes, or
 * gone, so the panel hangs on no trigger of its own: `onClosed` says where the focus goes on.
 */
export function FindOverlay({
  open,
  anchor,
  title,
  label,
  className,
  onClose,
  onClosed,
  children,
}: {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  /** The heading of the sheet, and what a screen reader calls the panel. */
  title: string
  label: string
  className: string
  /** `left` is true when the reader went on elsewhere on the page. */
  onClose: (left: boolean) => void
  onClosed: () => void
  children: ReactNode
}) {
  const compact = usePageLayout() === "compact"
  const closed = (event: Event) => {
    event.preventDefault()
    onClosed()
  }
  if (compact)
    return (
      <PublicDrawer open={open} onOpenChange={(next) => !next && onClose(false)}>
        <PublicDrawerContent
          title={title}
          className={`tn-find-overlay ${className}`}
          aria-describedby={undefined}
          onCloseAutoFocus={closed}
        >
          {children}
        </PublicDrawerContent>
      </PublicDrawer>
    )
  return (
    <Popover open={open} onOpenChange={(next) => !next && onClose(false)}>
      <PopoverAnchor virtualRef={anchor as RefObject<HTMLElement>} />
      <PopoverContent
        aria-label={label}
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className={`hub-popover tn-find-overlay ${className}`}
        onCloseAutoFocus={closed}
        onInteractOutside={(event) => {
          // Pressing the seat again closes the panel by itself.
          if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault()
          else onClose(true)
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
