import type { ComponentProps } from "react"
import { cn } from "@aov/ui/lib/utils"

/**
 * Centers page content at the HoYoWiki body width (1188px).
 * box-content keeps the max width on the content and adds the side gutter outside it,
 * so narrower screens shrink the content instead of scrolling sideways.
 */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto box-content max-w-page px-6 max-[640px]:px-[15px]", className)} {...props} />
}
