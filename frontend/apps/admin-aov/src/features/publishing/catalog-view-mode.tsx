import { ListFilter, Layers } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
export function CatalogViewMode() {
  const [params, setParams] = useSearchParams()
  const all = params.get("show") === "all"
  return (
    <div role="group" aria-label="Phạm vi hiển thị" className="inline-flex rounded-lg bg-muted/50 p-0.5">
      {(
        [
          { all: false, label: "Chỉ thay đổi", icon: ListFilter },
          { all: true, label: "Tất cả tại mốc", icon: Layers },
        ] as const
      ).map((option) => (
        <Button
          key={option.label}
          type="button"
          variant={all === option.all ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-pressed={all === option.all}
          onClick={() =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current)
                if (option.all) next.set("show", "all")
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
