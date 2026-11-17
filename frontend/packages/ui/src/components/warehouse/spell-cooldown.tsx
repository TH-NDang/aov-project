import { Clock3 } from "lucide-react"
import { useWarehouseText } from "./warehouse-view"
import { formatGameNumber } from "@aov/ui/lib/game-number"

export function SpellCooldown({ seconds }: { seconds?: number | null }) {
  const t = useWarehouseText()
  const value = seconds == null ? undefined : formatGameNumber(seconds)
  const label =
    value == null ? t("Chưa rõ hồi chiêu", "Cooldown unknown") : t(`Hồi chiêu ${value} giây`, `Cooldown: ${value} s`)
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
    >
      <Clock3 aria-hidden className="size-3.5 shrink-0" />
      {value == null ? "—" : `${value} s`}
    </span>
  )
}
