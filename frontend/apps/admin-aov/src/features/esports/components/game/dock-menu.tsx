import { useContext, type ComponentProps } from "react"
import { DropdownMenuContent } from "@aov/ui/components/dropdown-menu"
import { PopoverBoundary } from "@aov/ui/components/popover"

/**
 * The list of a menu that keeps inside the dock, so it never covers the picture or the timeline beside it. Closed, it
 * gives the focus back to its button, unless the dock holds a field that keeps the focus (the hero search): letters
 * typed after the menu go there, not to the keys of the desk.
 */
export function DockMenuContent({ onCloseAutoFocus, ...props }: ComponentProps<typeof DropdownMenuContent>) {
  const boundary = useContext(PopoverBoundary)
  return (
    <DropdownMenuContent
      collisionBoundary={boundary ?? undefined}
      collisionPadding={8}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event)
        if (event.defaultPrevented) return
        const field = (boundary ?? document).querySelector<HTMLElement>("[data-keeps-focus]")
        if (!field) return
        event.preventDefault()
        field.focus({ preventScroll: true })
      }}
      {...props}
    />
  )
}
