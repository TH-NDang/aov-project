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
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
          {search}
          {actions && (
            <div className="flex shrink-0 items-center gap-2 @3xl/page-header:justify-self-end">{actions}</div>
          )}
        </div>
        {description && <p className="-mt-1 text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
    )
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Standard padded page body. */
export function Page({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 p-4 md:px-6 md:py-5", className)} {...props}>
      {children}
    </div>
  )
}
