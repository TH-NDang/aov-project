import { Coins } from "lucide-react"
import { useWarehouseText } from "./warehouse-view"

export function ItemPrice({
  amount,
  locale,
  badge = false,
}: {
  amount?: number | null
  locale: string
  badge?: boolean
}) {
  const t = useWarehouseText()
  const number = amount?.toLocaleString(locale)
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
      <Coins aria-hidden="true" className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="item-price-text">{label}</span>
    </span>
  )
}
