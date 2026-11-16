import { WikiIcon } from "../../components/wiki-icon"
import type { WarehouseKind } from "./warehouse-types"

/** The mark of one of the armory's catalogs, shown where an entry has no picture of its own. */
export function WarehouseIcon({ name, size = 20 }: { name: WarehouseKind; size?: number }) {
  return <WikiIcon name={name} size={size} />
}
