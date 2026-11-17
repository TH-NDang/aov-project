import { ListFilter, Layers } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
export function CatalogViewMode({
  defaultAll = false,
  allLabel = "Dữ liệu tại mốc",
  compact = false,
}: {
  defaultAll?: boolean
  allLabel?: string
  compact?: boolean
}) {
  const [params, setParams] = useSearchParams()
  const all = params.get("show") === "all" || (defaultAll && params.get("show") !== "changes")
  return (
    <div
      role="group"
      aria-label="Phạm vi hiển thị"
      className={cn("inline-flex shrink-0 rounded-md bg-muted/50 p-0.5", compact ? "ml-auto" : "w-full sm:w-auto")}
    >
      {(
        [
          { all: true, label: allLabel, icon: Layers },
          { all: false, label: "Chỉ thay đổi", icon: ListFilter },
        ] as const
      ).map((option) => (
        <Button
          key={option.label}
          type="button"
          variant={all === option.all ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "type-label min-w-0 gap-1.5 rounded px-2",
            compact ? "h-7 shadow-none" : "h-10 flex-1 sm:h-8 sm:flex-none",
          )}
          aria-pressed={all === option.all}
          title={
            option.all ? "Xem cả dữ liệu kế thừa đến mốc đã chọn" : "Chỉ xem mục có thay đổi đã ghi nhận trong phạm vi"
          }
          onClick={() =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current)
                if (option.all) next.set("show", "all")
                else if (defaultAll) next.set("show", "changes")
                else next.delete("show")
                return next
              },
              { replace: true, preventScrollReset: true },
            )
          }
        >
          <option.icon className="size-3.5" />
          {option.label}
        </Button>
      ))}
    </div>
  )
}
