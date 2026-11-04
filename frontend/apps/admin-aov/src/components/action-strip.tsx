import type { ComponentProps } from "react"
import { cn } from "@aov/ui/lib/utils"

export function ActionStrip({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      className={cn(
        "flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap px-1 py-1 scrollbar-none [&>*]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}
