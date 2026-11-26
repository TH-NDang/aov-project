import type { ReactElement } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import "./stream-tip.css"

/**
 * A short label for a mark that has no words of its own, such as a lane, a ban nobody saw or the MVP, shown in the
 * site's own look when the mark is pointed at or focused, where `title` would wait for the browser. The mark keeps its
 * own accessible name, which the label describes.
 */
export function Tip({
  label,
  side = "top",
  children,
}: {
  label: string
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} collisionPadding={8} className="hub-tip">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
