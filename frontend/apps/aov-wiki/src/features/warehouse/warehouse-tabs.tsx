import { useNavigate } from "react-router"
import { PublicTabBar } from "@aov/ui/components/public-tab-bar"
import { useWikiContext } from "../../context/wiki-context"
import { warehousePath } from "../../lib/wiki-catalog"
import { WAREHOUSE_SECTIONS, type WarehouseKind } from "./warehouse-types"

/** The armory's four parts as tabs under the compact header, so each stays a tap away without opening the contents. */
export function WarehouseTabs({ active }: { active: WarehouseKind }) {
  const scope = useWikiContext()
  const navigate = useNavigate()
  return (
    <PublicTabBar
      label={scope.t("warehouse")}
      tabs={WAREHOUSE_SECTIONS.map(({ kind }) => ({ key: kind, label: scope.t(kind) }))}
      active={active}
      onSelect={(key) => navigate(scope.href(warehousePath(key)))}
    />
  )
}
