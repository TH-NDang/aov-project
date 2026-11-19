import { Coins } from "lucide-react"
import { useWarehouseText } from "./warehouse-view"
import { formatGameNumber } from "@aov/ui/lib/game-number"

export function ItemPrice({
  amount,
  badge = false,
}: {
  amount?: number | null
  /** @deprecated A price is written as the game writes it, so the locale no longer changes it. */
  locale?: string
  badge?: boolean
}) {
  const t = useWarehouseText()
  const number = amount == null ? undefined : formatGameNumber(amount)
  const label = number == null ? t("Chưa rõ giá", "Price unknown") : `${number} ${t("vàng", "gold")}`

  if (badge) {
    return (
      <span
        className="shop-item-price absolute -right-1.5 -bottom-1.5 whitespace-nowrap rounded-md bg-card px-1 text-xs leading-4 shadow-sm ring-1 ring-border"
        title={label}
      >
        <span className="item-price-text" aria-hidden="true">
          {number ?? "—"}
        </span>
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  if (number == null) return null
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Coins aria-hidden="true" className="size-3.5 shrink-0 text-(--aov-game-gold)" />
      <span className="item-price-text">{label}</span>
    </span>
  )
}
