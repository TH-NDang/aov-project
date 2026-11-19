import { Link2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useWarehouseText } from "../warehouse-view"

/**
 * The hints over the board's corner: which item a link starts from while one is open, and what the two kinds of wire
 * mean while an item is selected. A zero-height sticky row keeps them in view without moving the board.
 */
export function ShopLegend({
  linkingFrom,
  selectedId,
  showOpenButton,
  onSelect,
  onFocus,
}: {
  /** The name of the item a link is being made from, while one is open. */
  linkingFrom: string | null
  selectedId: string | null
  showOpenButton: boolean
  onSelect: (id: string) => void
  onFocus: (id: string | null) => void
}) {
  const t = useWarehouseText()
  if (linkingFrom === null && !selectedId) return null
  return (
    <div className="shop-legend pointer-events-none sticky top-2 z-30 flex h-0 justify-end px-2">
      <div className="pointer-events-auto mt-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5">
        {linkingFrom !== null && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/95 px-2.5 py-1.5 text-xs text-primary shadow-sm backdrop-blur"
          >
            <Link2 className="size-3.5 shrink-0" />
            {t("Đang nối", "Linking")} {linkingFrom}{" "}
            {t("· chọn chấm ở phía đối diện. Esc để hủy.", "· pick a dot on the opposite side. Press Esc to cancel.")}
          </p>
        )}
        {selectedId && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card/95 py-1 pr-1 pl-2.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-5 border-t-[3px] border-primary" />
              {t("Nguyên liệu trực tiếp", "Direct ingredients")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-5 border-t border-dashed border-primary" />
              {t("Gián tiếp / nâng cấp", "Indirect / upgrade")}
            </span>
            {showOpenButton && (
              <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => onSelect(selectedId)}>
                {t("Mở chi tiết", "Open details")}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onFocus(null)}>
              {t("Bỏ chọn", "Clear selection")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
