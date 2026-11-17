import type { ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { errorMessage } from "@/lib/api/errors"

/** A list or panel still loading: one line, announced to screen readers. */
export function LoadingState({ children = "Đang tải…", className }: { children?: ReactNode; className?: string }) {
  return (
    <p role="status" className={cn("type-body text-muted-foreground", className)}>
      {children}
    </p>
  )
}

/** Nothing to show yet: says what is missing, as QUY-UOC-VIET section 8 words it. */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("type-body text-muted-foreground", className)}>{children}</p>
}

/**
 * A read that failed: the message of the error (or `message`) and, when the screen can ask again, a retry button,
 * so every failed list offers the same way back.
 */
export function ErrorState({
  error,
  message,
  onRetry,
  className,
}: {
  error?: unknown
  message?: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-2 type-body text-destructive", className)}>
      <span>{message ?? errorMessage(error)}</span>
      {onRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="size-3.5" aria-hidden />
          Thử lại
        </Button>
      )}
    </div>
  )
}
