import { PanelRightOpen } from "lucide-react"

export function WarehouseCardHint() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary">
      <PanelRightOpen aria-hidden className="size-3.5" />
      Xem chi tiết
    </span>
  )
}
