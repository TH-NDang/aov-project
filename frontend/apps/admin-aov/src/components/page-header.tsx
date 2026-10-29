import type { ComponentProps, ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  children?: ReactNode
}

export function PageHeader({ title, description, actions, className, children }: PageHeaderProps) {
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
