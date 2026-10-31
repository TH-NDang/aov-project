import { Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"

/** Shown at the top of a detail panel while it displays a published revision that only a draft can change. */
export function DraftPrompt({
  busy = false,
  onCreate,
  className,
}: {
  busy?: boolean
  onCreate: () => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3", className)}>
      <p className="flex-1 text-sm">Bản đã xuất bản. Tạo bản nháp để cập nhật.</p>
      <Button size="sm" disabled={busy} onClick={onCreate}>
        <Plus className="size-4" /> Tạo bản nháp
      </Button>
    </div>
  )
}
