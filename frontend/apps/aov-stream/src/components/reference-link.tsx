import { useRef, useState, type MouseEvent } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { resolveEntityRoute, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { GoLink } from "./go-link"
import { ReferenceCard } from "./reference-card"
import "./reference-link.css"

/**
 * A name inside a text that opens its page. Pointing at it shows the card of what it names; a finger, which cannot
 * point, opens the card with the first tap and the page with the next one, on the card or on the name. The card stands
 * beside the name on a phone too, so the reader keeps their place in the text.
 */
export function ReferenceLink({ entity, label }: { entity: EntityReference; label: string }) {
  const [open, setOpen] = useState(false)
  const pointer = useRef("")
  // Whether the card showed when the finger came down; it may open between that and the click.
  const shown = useRef(false)
  const to = resolveEntityRoute(entity, "stream")
  if (!to) return <>{label}</>
  const tapped = (event: MouseEvent) => {
    if (pointer.current !== "touch" || shown.current) return
    event.preventDefault()
    setOpen(true)
  }
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={280} closeDelay={120}>
      <HoverCardTrigger asChild>
        <GoLink
          to={to}
          prose
          onPointerDown={(event) => {
            pointer.current = event.pointerType
            shown.current = open
          }}
          onClick={tapped}
        >
          {label}
        </GoLink>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} collisionPadding={12} className="hub-ref-popup">
        <ReferenceCard entity={entity} label={label} to={to} />
      </HoverCardContent>
    </HoverCard>
  )
}
