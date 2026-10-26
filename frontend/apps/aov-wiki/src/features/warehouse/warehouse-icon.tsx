import { WikiIcon } from "../../components/wiki-icon"
import type { WarehouseKind } from "./warehouse-types"

type WarehouseIconName =
  WarehouseKind | "search" | "close" | "arrow" | "clock" | "spark" | "reset" | "all" | "switch" | "chevron"

export function WarehouseIcon({ name, size = 20 }: { name: WarehouseIconName; size?: number }) {
  return <WikiIcon name={name} size={size} />
}
