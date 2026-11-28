import type { ComponentProps, ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /**
   * A `SearchField` with `placement="header"`: centered between title and actions when the header is at least 48rem
   * wide, otherwise an icon that opens the field over the header row.
   */
  search?: ReactNode
  className?: string
  children?: ReactNode
}

export function PageHeader({ title, description, actions, search, className, children }: PageHeaderProps) {
  // The layout follows the header's own width, not the window's: the sidebar can leave a wide window little room.
  if (search)
    return (
      <div className={cn("@container/page-header flex flex-col gap-3", className)}>
        <div className="relative flex min-h-9 items-center gap-2 @3xl/page-header:grid @3xl/page-header:grid-cols-[1fr_auto_1fr] @3xl/page-header:gap-x-4">
          <h1 className="type-page-title min-w-0 flex-1 truncate">{title}</h1>
          {search}
          {actions && (
            <div className="flex shrink-0 items-center gap-2 @3xl/page-header:justify-self-end">{actions}</div>
          )}
        </div>
        {description && <p className="-mt-1 text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
    )
  // The title gives way first: it wraps onto a second line beside the buttons, and only when it would be narrower than
  // 10rem do the buttons move under it, together.
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_10rem] space-y-0.5 py-0.5">
          <h1 className="type-page-title text-balance">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/**
 * How wide a page's content grows: past it, on a very wide screen, the page stays centred instead of stretching lines
 * and tables across the whole width. A page that needs less sets its own `max-w-*`.
 */
export const PAGE_MAX_WIDTH = "max-w-[110rem]"

/** Standard padded page body. */
export function Page({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-1 flex-col gap-4 p-4 md:px-6 md:py-5", PAGE_MAX_WIDTH, className)}
      {...props}
    >
      {children}
    </div>
  )
}
